/* Cymru Compliance portal — live data layer (Supabase). Same contract as api-demo.js. */
(function () {
  "use strict";
  var CC = window.CC;

  CC.makeSupabaseApi = function () {
    var sb = window.supabase.createClient(CC.cfg.SUPABASE_URL, CC.cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    var recoveryCb = null;
    sb.auth.onAuthStateChange(function (event) { if (event === "PASSWORD_RECOVERY" && recoveryCb) recoveryCb(); });

    function ok(res) { if (res.error) throw new Error(res.error.message); return res.data; }
    function safeName(n) { return String(n || "file").replace(/[^\w.\-]+/g, "_").slice(0, 120); }
    function upload(practiceId, file) {
      var path = practiceId + "/" + CC.uuid() + "-" + safeName(file.name);
      return sb.storage.from("evidence").upload(path, file, { contentType: file.type || undefined, upsert: false })
        .then(function (r) { if (r.error) throw new Error(r.error.message); return path; });
    }

    var api = {
      mode: "live",
      onRecovery: function (cb) { recoveryCb = cb; },

      /* ---------- auth ---------- */
      init: function () {
        return sb.auth.getSession().then(function (r) {
          var s = r.data && r.data.session;
          return s ? { id: s.user.id, email: s.user.email } : null;
        });
      },
      signIn: function (email, password) {
        return sb.auth.signInWithPassword({ email: email, password: password }).then(function (r) {
          if (r.error) throw new Error(r.error.message === "Invalid login credentials" ? CC.t("Incorrect email or password.") : r.error.message);
          return sb.auth.mfa.getAuthenticatorAssuranceLevel().then(function (a) {
            var need = a.data && a.data.nextLevel === "aal2" && a.data.currentLevel !== "aal2";
            return { user: { id: r.data.user.id, email: r.data.user.email }, mfaRequired: !!need };
          });
        });
      },
      signUp: function (email, password, fullName) {
        return sb.auth.signUp({ email: email, password: password, options: { data: { full_name: fullName } } }).then(function (r) {
          if (r.error) {
            if (/Database error|not been invited/i.test(r.error.message))
              throw new Error(CC.t("This email address has not been invited. Ask your Principal or Group Admin to invite you."));
            throw new Error(r.error.message);
          }
          return { needsConfirm: !r.data.session };
        });
      },
      resetPassword: function (email) {
        return sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] }).then(ok);
      },
      updatePassword: function (pw) { return sb.auth.updateUser({ password: pw }).then(ok); },
      signOut: function () { return sb.auth.signOut(); },
      mfa: {
        status: function () {
          return sb.auth.mfa.listFactors().then(function (r) {
            var f = (r.data && r.data.totp || []).filter(function (x) { return x.status === "verified"; })[0];
            return { enrolled: !!f, factorId: f ? f.id : null };
          });
        },
        enroll: function () {
          return sb.auth.mfa.listFactors().then(function (r) {
            var stale = (r.data && r.data.all || []).filter(function (x) { return x.status !== "verified"; });
            return Promise.all(stale.map(function (x) { return sb.auth.mfa.unenroll({ factorId: x.id }); }));
          }).then(function () { return sb.auth.mfa.enroll({ factorType: "totp" }); }).then(function (r) {
            var d = ok(r);
            return { factorId: d.id, qr: d.totp.qr_code, secret: d.totp.secret };
          });
        },
        verifyEnroll: function (factorId, code) {
          return sb.auth.mfa.challengeAndVerify({ factorId: factorId, code: code }).then(ok);
        },
        challenge: function (code) {
          return sb.auth.mfa.listFactors().then(function (r) {
            var f = (r.data && r.data.totp || [])[0];
            if (!f) throw new Error("No authenticator found");
            return sb.auth.mfa.challengeAndVerify({ factorId: f.id, code: code });
          }).then(function (r) { if (r.error) throw new Error(CC.t("That code was not accepted.")); });
        },
        disable: function (factorId) { return sb.auth.mfa.unenroll({ factorId: factorId }).then(ok); }
      },
      getProfile: function () {
        return sb.auth.getUser().then(function (u) {
          if (!u.data.user) return null;
          return sb.from("profiles").select("*").eq("id", u.data.user.id).maybeSingle().then(ok);
        });
      },

      /* ---------- organisations ---------- */
      practices: {
        list: function () { return sb.from("practices").select("*").order("name").then(ok); },
        create: function (row) { return sb.from("practices").insert(row).select().single().then(ok); },
        update: function (id, patch) { return sb.from("practices").update(patch).eq("id", id).then(ok); }
      },
      groups: {
        list: function () { return sb.from("groups").select("*").order("name").then(ok); },
        create: function (row) { return sb.from("groups").insert(row).select().single().then(ok); },
        update: function (id, patch) { return sb.from("groups").update(patch).eq("id", id).then(ok); }
      },
      practiceInputs: function (pid) { return sb.rpc("practice_inputs", { p_practice: pid }).then(ok); },
      groupAverage: function (pid) { return sb.rpc("group_average", { pid: pid }).then(ok); },
      saveSnapshot: function (pid, score, cats) {
        return sb.from("compliance_snapshots").upsert(
          { practice_id: pid, taken_on: CC.isoDate(0), score: score, cat_scores: cats },
          { onConflict: "practice_id,taken_on" }).then(ok);
      },

      /* ---------- evidence ---------- */
      evidence: {
        list: function (pid) { return sb.from("evidence").select("*").eq("practice_id", pid).order("created_at", { ascending: false }).then(ok); },
        add: function (row) {
          var file = row.file; delete row.file;
          return (file ? upload(row.practice_id, file) : Promise.resolve(null)).then(function (path) {
            row.file_path = path; row.file_name = file ? file.name : null;
            return sb.from("evidence").insert(row).select().single().then(ok);
          }).then(function (ev) {
            return sb.from("evidence_versions").insert({
              evidence_id: ev.id, version: 1, file_path: ev.file_path, file_name: ev.file_name, expiry_date: ev.expiry_date
            }).then(ok).then(function () { return ev; });
          });
        },
        replace: function (id, practiceId, file, expiry, verify) {
          return sb.from("evidence").select("current_version").eq("id", id).single().then(ok).then(function (cur) {
            return (file ? upload(practiceId, file) : Promise.resolve(null)).then(function (path) {
              var v = cur.current_version + 1;
              var patch = { current_version: v, expiry_date: expiry || null, status: verify ? "verified" : "pending" };
              if (path) { patch.file_path = path; patch.file_name = file.name; }
              return sb.from("evidence").update(patch).eq("id", id).select().single().then(ok).then(function (ev) {
                return sb.from("evidence_versions").insert({
                  evidence_id: id, version: v, file_path: ev.file_path, file_name: ev.file_name, expiry_date: ev.expiry_date
                }).then(ok).then(function () { return ev; });
              });
            });
          });
        },
        setStatus: function (id, status) { return sb.from("evidence").update({ status: status }).eq("id", id).then(ok); },
        versions: function (id) { return sb.from("evidence_versions").select("*").eq("evidence_id", id).order("version", { ascending: false }).then(ok); },
        url: function (path) {
          return sb.storage.from("evidence").createSignedUrl(path, 120).then(function (r) {
            if (r.error) throw new Error(r.error.message); return r.data.signedUrl;
          });
        }
      },

      /* ---------- people ---------- */
      profiles: {
        list: function (scope) {
          var q = sb.from("profiles").select("*").order("full_name");
          if (scope && scope.practice_id) q = q.eq("practice_id", scope.practice_id);
          return q.then(ok);
        },
        setActive: function (id, active) { return sb.rpc("team_set_active", { p_user: id, p_active: active }).then(ok); },
        adminUpdate: function (id, p) {
          return sb.rpc("admin_update_profile", { p_user: id, p_role: p.role, p_practice: p.practice_id || null, p_group: p.group_id || null, p_active: p.active }).then(ok);
        },
        updateMe: function (name, lang) { return sb.rpc("update_my_profile", { p_name: name, p_lang: lang }).then(ok); }
      },
      invites: {
        list: function () { return sb.from("invites").select("*").eq("claimed", false).order("created_at", { ascending: false }).then(ok); },
        create: function (row) { return sb.from("invites").insert(row).then(ok); },
        remove: function (id) { return sb.from("invites").delete().eq("id", id).then(ok); }
      },

      /* ---------- training ---------- */
      training: {
        modules: function () { return sb.from("training_modules").select("*").order("sort").then(ok); },
        assignments: function (f) {
          var q = sb.from("training_assignments").select("*");
          if (f && f.practice_id) q = q.eq("practice_id", f.practice_id);
          if (f && f.profile_id) q = q.eq("profile_id", f.profile_id);
          return q.then(ok);
        },
        assign: function (rows) {
          return sb.from("training_assignments").upsert(rows, { onConflict: "module_id,profile_id", ignoreDuplicates: true }).then(ok);
        },
        progress: function (id, progress) {
          var patch = { progress: progress, status: progress >= 100 ? "completed" : (progress > 0 ? "in_progress" : "assigned"),
                        completed_at: progress >= 100 ? new Date().toISOString() : null };
          return sb.from("training_assignments").update(patch).eq("id", id).then(ok);
        }
      },

      /* ---------- self-assessment ---------- */
      assessment: {
        questions: function () { return sb.from("assessment_questions").select("*").order("sort").then(ok); },
        list: function (pid) { return sb.from("assessments").select("*").eq("practice_id", pid).order("created_at", { ascending: false }).then(ok); },
        answers: function (aid) { return sb.from("assessment_answers").select("*").eq("assessment_id", aid).then(ok); },
        start: function (pid, prefillFrom) {
          return sb.from("assessments").insert({ practice_id: pid }).select().single().then(ok).then(function (a) {
            if (!prefillFrom) return a;
            return api.assessment.answers(prefillFrom).then(function (old) {
              if (!old.length) return a;
              var rows = old.map(function (o) { return { assessment_id: a.id, question_id: o.question_id, answer: o.answer, note: o.note }; });
              return sb.from("assessment_answers").insert(rows).then(ok).then(function () { return a; });
            });
          });
        },
        save: function (aid, answers) {
          var rows = answers.map(function (a) { return { assessment_id: aid, question_id: a.question_id, answer: a.answer, note: a.note || null }; });
          return sb.from("assessment_answers").upsert(rows, { onConflict: "assessment_id,question_id" }).then(ok);
        },
        complete: function (aid, score) {
          return sb.from("assessments").update({ status: "completed", score: score, completed_at: new Date().toISOString() }).eq("id", aid).then(ok);
        }
      },

      /* ---------- bookings & inspector access ---------- */
      bookings: {
        list: function () { return sb.from("bookings").select("*").order("created_at", { ascending: false }).then(ok); },
        create: function (rows) { return sb.from("bookings").insert(rows).then(ok); },
        update: function (id, patch) { return sb.from("bookings").update(patch).eq("id", id).then(ok); }
      },
      grants: {
        list: function (pid) { return sb.from("inspector_grants").select("*").eq("practice_id", pid).order("created_at", { ascending: false }).then(ok); },
        mine: function () { return sb.from("inspector_grants").select("*").order("expires_at", { ascending: false }).then(ok); },
        create: function (row) { return sb.from("inspector_grants").insert(row).then(ok); },
        revoke: function (id) { return sb.from("inspector_grants").update({ revoked: true }).eq("id", id).then(ok); }
      },

      /* ---------- HR (staff records, leave, documents, notes) ---------- */
      hr: {
        staff: {
          list: function (f) {
            var q = sb.from("hr_staff").select("*").order("full_name");
            if (f && f.practice_id) q = q.eq("practice_id", f.practice_id);
            return q.then(ok);
          },
          mine: function (email, practiceId) {
            if (!email) return Promise.resolve(null);
            var q = sb.from("hr_staff").select("*").ilike("email", String(email).replace(/[%_]/g, "\\$&")).eq("active", true);
            if (practiceId) q = q.eq("practice_id", practiceId);
            return q.limit(1).then(ok).then(function (r) { return r[0] || null; });
          },
          create: function (row) { return sb.from("hr_staff").insert(row).select().single().then(ok); },
          update: function (id, patch) { return sb.from("hr_staff").update(patch).eq("id", id).select().single().then(ok); },
          setPhoto: function (staff, file) {
            var path = staff.practice_id + "/" + staff.id + "/photo-" + Date.now() + ".jpg";
            return sb.storage.from("hr").upload(path, file, { contentType: file.type || "image/jpeg", upsert: false }).then(function (r) {
              if (r.error) throw new Error(r.error.message);
              return sb.from("hr_staff").update({ photo_path: path }).eq("id", staff.id).then(ok);
            }).then(function () { return path; });
          }
        },
        photoUrls: function (paths) {
          paths = (paths || []).filter(Boolean);
          if (!paths.length) return Promise.resolve({});
          return sb.storage.from("hr").createSignedUrls(paths, 3600).then(function (r) {
            var m = {}; (r.data || []).forEach(function (x) { if (x.signedUrl) m[x.path] = x.signedUrl; }); return m;
          });
        },
        leave: {
          list: function (f) {
            var q = sb.from("hr_leave").select("*").order("start_date", { ascending: false }).limit(2000);
            if (f && f.practice_id) q = q.eq("practice_id", f.practice_id);
            if (f && f.staff_id) q = q.eq("staff_id", f.staff_id);
            return q.then(ok);
          },
          create: function (row) { return sb.from("hr_leave").insert(row).select().single().then(ok); },
          update: function (id, patch) { return sb.from("hr_leave").update(patch).eq("id", id).select().single().then(ok); }
        },
        whosOff: function (pid, from, to) { return sb.rpc("hr_whos_off", { p_practice: pid, p_from: from, p_to: to }).then(ok); },
        docs: {
          list: function (staffId) { return sb.from("hr_documents").select("*").eq("staff_id", staffId).order("created_at", { ascending: false }).then(ok); },
          add: function (row, file) {
            var path = row.practice_id + "/" + row.staff_id + "/" + CC.uuid() + "-" + safeName(file.name);
            return sb.storage.from("hr").upload(path, file, { contentType: file.type || undefined, upsert: false }).then(function (r) {
              if (r.error) throw new Error(r.error.message);
              return sb.from("hr_documents").insert(Object.assign({}, row, { file_path: path, file_name: file.name })).select().single().then(ok);
            });
          },
          remove: function (doc) {
            return sb.from("hr_documents").delete().eq("id", doc.id).then(ok).then(function () {
              return sb.storage.from("hr").remove([doc.file_path]).then(function () {}, function () {});
            });
          },
          url: function (path) {
            return sb.storage.from("hr").createSignedUrl(path, 120).then(function (r) { if (r.error) throw new Error(r.error.message); return r.data.signedUrl; });
          }
        },
        notes: {
          list: function (staffId) { return sb.from("hr_notes").select("*").eq("staff_id", staffId).order("note_date", { ascending: false }).then(ok); },
          add: function (row) { return sb.from("hr_notes").insert(row).select().single().then(ok); }
        }
      },

      /* ---------- audit & enquiries ---------- */
      audit: {
        log: function (action, entity, entityId, practiceId, detail) {
          return sb.rpc("log_event", { p_action: action, p_entity: entity || null, p_entity_id: entityId ? String(entityId) : null, p_practice: practiceId || null, p_detail: detail || {} })
            .then(function () {}, function () {});
        },
        list: function (f) {
          var q = sb.from("audit_log").select("*").order("at", { ascending: false }).limit((f && f.limit) || 300);
          if (f && f.practice_id) q = q.eq("practice_id", f.practice_id);
          return q.then(ok);
        }
      },
      enquiries: {
        list: function () { return sb.from("enquiries").select("*").order("created_at", { ascending: false }).limit(500).then(ok); },
        update: function (id, patch) { return sb.from("enquiries").update(patch).eq("id", id).then(ok); }
      }
    };
    return api;
  };
})();
