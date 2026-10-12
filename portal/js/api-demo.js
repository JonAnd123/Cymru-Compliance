/* Cymru Compliance portal — DEMO data layer.
   Sample data lives only in this browser (localStorage). Mirrors the role rules in
   supabase/01_schema.sql closely enough to demo every role; the real enforcement is in the database. */
(function () {
  "use strict";
  var CC = window.CC;
  var DB_KEY = "cc_demo_db_v1", USER_KEY = "cc_demo_user";

  function clone(x) { return x === undefined ? x : JSON.parse(JSON.stringify(x)); }
  function iso(off) { var d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); }
  function ts(off) { var d = new Date(); d.setDate(d.getDate() + off); return d.toISOString(); }
  var seedN = 0;
  function id(prefix) { seedN++; return prefix + "_" + seedN + "_" + Math.random().toString(36).slice(2, 6); }
  function rng(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  var DOCS = {
    registration: ["HIW registration certificate", "Employer's liability insurance", "Public liability insurance"],
    staff_training: ["Enhanced DBS — {s}", "GDC registration — {s}", "Basic life support — {s}", "Safeguarding level 2 — {s}"],
    decontamination: ["Autoclave validation certificate", "Washer-disinfector service report", "WHTM 01-05 annual audit"],
    radiation: ["RPA report", "X-ray critical examination report", "Local rules (signed)"],
    health_safety: ["Fire risk assessment", "Electrical installation condition report", "Gas safety certificate", "Legionella risk assessment"],
    policies: ["Safeguarding policy", "Complaints policy", "Infection control policy", "Data protection policy"]
  };

  function seed() {
    var C = CC.DEMO_CONTENT;
    var db = {
      groups: [{ id: "g1", name: "Cardiff Bay Dental Group", billing_mode: "consolidated", created_at: ts(-300) }],
      practices: [
        { id: "p1", group_id: "g1", name: "Cardiff Bay Dental", address: "12 Mount Stuart Sq, Cardiff", health_board: "Cardiff and Vale UHB", hiw_registration: "HIW-D-1042", package: "group", next_inspection: iso(21), created_at: ts(-300) },
        { id: "p2", group_id: "g1", name: "Newport High Street Dental", address: "48 High St, Newport", health_board: "Aneurin Bevan UHB", hiw_registration: "HIW-D-1187", package: "group", next_inspection: iso(48), created_at: ts(-280) },
        { id: "p3", group_id: "g1", name: "Swansea Marina Dental", address: "3 Marina Walk, Swansea", health_board: "Swansea Bay UHB", hiw_registration: "HIW-D-0975", package: "group", next_inspection: iso(9), created_at: ts(-270) },
        { id: "p4", group_id: null, name: "Aberystwyth Family Dental", address: "21 Terrace Rd, Aberystwyth", health_board: "Hywel Dda UHB", hiw_registration: "HIW-D-1310", package: "practice_plus", next_inspection: iso(90), created_at: ts(-200) }
      ],
      profiles: [
        { id: "u_admin", email: "jon@cymrucompliance.example", full_name: "Jon Anderson", role: "platform_admin", practice_id: null, group_id: null, language: "en", active: true, created_at: ts(-320) },
        { id: "u_ga", email: "gareth@cardiffbaygroup.example", full_name: "Gareth Morgan", role: "group_admin", practice_id: null, group_id: "g1", language: "en", active: true, created_at: ts(-290) },
        { id: "u_pr1", email: "sian@cardiffbaydental.example", full_name: "Dr Sian Williams", role: "principal", practice_id: "p1", group_id: null, language: "cy", active: true, created_at: ts(-290) },
        { id: "u_pm1", email: "rhian@cardiffbaydental.example", full_name: "Rhian Davies", role: "practice_manager", practice_id: "p1", group_id: null, language: "en", active: true, created_at: ts(-280) },
        { id: "u_st1", email: "owen@cardiffbaydental.example", full_name: "Owen Evans", role: "staff", practice_id: "p1", group_id: null, language: "en", active: true, created_at: ts(-200) },
        { id: "u_st2", email: "priya@cardiffbaydental.example", full_name: "Priya Patel", role: "staff", practice_id: "p1", group_id: null, language: "en", active: true, created_at: ts(-60) },
        { id: "u_pr2", email: "huw@newportdental.example", full_name: "Dr Huw Jones", role: "principal", practice_id: "p2", group_id: null, language: "en", active: true, created_at: ts(-270) },
        { id: "u_pr3", email: "carys@swanseamarina.example", full_name: "Dr Carys Lloyd", role: "principal", practice_id: "p3", group_id: null, language: "en", active: true, created_at: ts(-260) },
        { id: "u_pr4", email: "emyr@aberdental.example", full_name: "Dr Emyr Hughes", role: "principal", practice_id: "p4", group_id: null, language: "cy", active: true, created_at: ts(-190) },
        { id: "u_insp", email: "alun.rees@hiw.example", full_name: "Alun Rees (HIW)", role: "inspector", practice_id: null, group_id: null, language: "en", active: true, created_at: ts(-30) }
      ],
      invites: [
        { id: "inv1", email: "newstarter@cardiffbaydental.example", full_name: "Megan Price", role: "staff", practice_id: "p1", group_id: null, claimed: false, created_at: ts(-2) }
      ],
      evidence: [], versions: [],
      modules: C.modules, questions: C.questions,
      assignments: [], assessments: [], answers: [],
      snapshots: [], grants: [], bookings: [], audit: [], enquiries: []
    };

    // Evidence, with a quality profile per practice
    var quality = { p1: 0.82, p2: 0.55, p3: 0.25, p4: 0.78 };
    var staffNames = { p1: ["Owen Evans", "Priya Patel"], p2: ["Huw Jones"], p3: ["Carys Lloyd"], p4: ["Emyr Hughes"] };
    var n = 0;
    Object.keys(quality).forEach(function (pid, pi) {
      var r = rng(97 + pi * 31);
      Object.keys(DOCS).forEach(function (cat) {
        DOCS[cat].forEach(function (title) {
          var names = cat === "staff_training" ? staffNames[pid] : [null];
          names.forEach(function (sn) {
            n++;
            var x = r(), status = "verified", exp = 60 + Math.round(r() * 300);
            if (x >= quality[pid]) {
              var y = r();
              if (y < 0.35) status = "pending";
              else if (y < 0.55) exp = 4 + Math.round(r() * 22);
              else if (y < 0.9) exp = -(3 + Math.round(r() * 60));
              else status = "rejected";
            }
            var eid = "e" + n;
            var staffId = null;
            if (sn) { var pf = db.profiles.filter(function (p) { return p.full_name === sn && p.practice_id === pid; })[0]; staffId = pf ? pf.id : null; }
            db.evidence.push({
              id: eid, practice_id: pid, category: cat, title: title.replace("{s}", sn || ""), staff_member: staffId,
              file_path: pid + "/demo-" + eid + ".pdf", file_name: title.replace(/[^\w]+/g, "_") + ".pdf",
              expiry_date: iso(exp), status: status, uploaded_by: staffId || (db.profiles.filter(function (p) { return p.practice_id === pid && p.role === "principal"; })[0] || {}).id,
              verified_by: status === "verified" ? "u_pr1" : null, verified_at: status === "verified" ? ts(-20) : null,
              current_version: 1, created_at: ts(-100 + Math.round(r() * 80)), updated_at: ts(-10)
            });
            db.versions.push({ id: "v" + n, evidence_id: eid, version: 1, file_path: pid + "/demo-" + eid + ".pdf", file_name: title + ".pdf", expiry_date: iso(exp), uploaded_by: "u_pr1", created_at: ts(-100) });
          });
        });
      });
    });

    // Completed assessments
    var ansQ = { p1: 0.85, p2: 0.55, p3: 0.25 };
    Object.keys(ansQ).forEach(function (pid, pi) {
      var aid = "a_" + pid, r = rng(555 + pi * 17);
      db.assessments.push({ id: aid, practice_id: pid, started_by: "u_pr" + pid.slice(1), status: "completed", score: null, created_at: ts(-40), completed_at: ts(-38) });
      db.questions.forEach(function (q) {
        var x = r(), a = x < ansQ[pid] ? "yes" : (x < ansQ[pid] + (1 - ansQ[pid]) * 0.5 ? "partial" : "no");
        db.answers.push({ assessment_id: aid, question_id: q.id, answer: a, note: a === "yes" ? null : "Action agreed at team meeting." });
      });
    });

    // Training (practice 1 has team members)
    var induction = db.modules.filter(function (m) { return m.kind === "induction"; });
    [["u_st1", [100, 100, 100, 60, 0]], ["u_st2", [100, 40, 0, 0, 0]], ["u_pm1", [100, 100, 100, 100, 100]]].forEach(function (u) {
      induction.forEach(function (m, i) {
        var pr = u[1][i];
        db.assignments.push({ id: id("t"), module_id: m.id, profile_id: u[0], practice_id: "p1", assigned_by: "u_pr1", due_date: iso(14 - i), status: pr >= 100 ? "completed" : (pr > 0 ? "in_progress" : "assigned"), progress: pr, completed_at: pr >= 100 ? ts(-15) : null, created_at: ts(-45) });
      });
    });
    var pmMods = db.modules.filter(function (m) { return m.kind === "pm"; });
    pmMods.forEach(function (m, i) {
      db.assignments.push({ id: id("t"), module_id: m.id, profile_id: "u_pm1", practice_id: "p1", assigned_by: "u_pr1", due_date: iso(30), status: i < 2 ? "completed" : "in_progress", progress: i < 2 ? 100 : 30, completed_at: i < 2 ? ts(-10) : null, created_at: ts(-30) });
    });

    // Snapshot history
    var hist = { p1: [74, 79, 83, 88, 90, 92], p2: [58, 62, 66, 70, 72, 76], p3: [70, 66, 63, 60, 57, 54], p4: [80, 81, 83, 84, 86, 87] };
    Object.keys(hist).forEach(function (pid) {
      hist[pid].forEach(function (s, i) { db.snapshots.push({ id: id("s"), practice_id: pid, taken_on: iso(-150 + i * 28), score: s, cat_scores: null }); });
    });

    db.grants.push({ id: "gr1", practice_id: "p1", inspector_email: "alun.rees@hiw.example", granted_by: "u_pr1", starts_at: ts(-1), expires_at: ts(14), revoked: false, created_at: ts(-1) });
    db.grants.push({ id: "gr2", practice_id: "p4", inspector_email: "alun.rees@hiw.example", granted_by: "u_pr4", starts_at: ts(-1), expires_at: ts(7), revoked: false, created_at: ts(-1) });

    db.bookings.push(
      { id: "b1", practice_id: "p1", kind: "pre_inspection", requested_by: "u_pr1", preferred_date: iso(10), mode: "onsite", seats: 1, status: "confirmed", notes: "Ahead of HIW visit", created_at: ts(-12), updated_at: ts(-10) },
      { id: "b2", practice_id: "p3", kind: "pre_inspection", requested_by: "u_ga", preferred_date: iso(5), mode: "remote", seats: 1, status: "requested", notes: "Urgent — inspection in 9 days", created_at: ts(-2), updated_at: ts(-2) },
      { id: "b3", practice_id: "p2", kind: "pm_training", requested_by: "u_ga", preferred_date: iso(30), mode: "remote", seats: 2, status: "requested", notes: "Bulk booking", created_at: ts(-3), updated_at: ts(-3) },
      { id: "b4", practice_id: "p3", kind: "pm_training", requested_by: "u_ga", preferred_date: iso(30), mode: "remote", seats: 1, status: "requested", notes: "Bulk booking", created_at: ts(-3), updated_at: ts(-3) }
    );

    var al = [["u_pr1", "principal", "p1", "verify_evidence", "evidence", "DBS — Owen Evans"], ["u_st1", "staff", "p1", "upload_evidence", "evidence", "Basic life support"], ["u_ga", "group_admin", "p3", "view_dashboard", "practice", ""], ["u_pr1", "principal", "p1", "grant_inspector", "grant", "alun.rees@hiw.example"], ["u_insp", "inspector", "p1", "view_evidence", "evidence", "Fire risk assessment"]];
    al.forEach(function (a, i) {
      db.audit.push({ id: i + 1, at: ts(-5 + i * 0.5), actor: a[0], actor_email: (db.profiles.filter(function (p) { return p.id === a[0]; })[0] || {}).email, actor_role: a[1], practice_id: a[2], group_id: a[2] === "p4" ? null : "g1", action: a[3], entity: a[4], entity_id: "", detail: { note: a[5] } });
    });

    db.enquiries.push(
      { id: "q1", created_at: ts(-1), kind: "demo", practice_type: "Corporate group", name: "Lowri Bevan", email: "lowri@valleysdental.example", practice_name: "Valleys Dental Care", sites: 5, role: null, message: "Interested in the group dashboard.", language: "cy", status: "new" },
      { id: "q2", created_at: ts(-3), kind: "interest", practice_type: "Independent practice", name: "Dr Tom Hart", email: "tom@wrexhamsmiles.example", practice_name: "Wrexham Smiles", sites: 1, role: null, message: "", language: "en", status: "contacted" },
      { id: "q3", created_at: ts(-6), kind: "waitlist", practice_type: null, name: "Bethan Cole", email: "bethan@example.com", practice_name: "Cole Dental", sites: null, role: "Practice Manager", message: "", language: "en", status: "new" }
    );
    if (CC.demoHrSeed) CC.demoHrSeed(db);
    return db;
  }

  CC.makeDemoApi = function () {
    var db, uid = null;
    function load() {
      try { var raw = localStorage.getItem(DB_KEY); if (raw) { db = JSON.parse(raw); if (!db.hr_staff && CC.demoHrSeed) { CC.demoHrSeed(db); save(); } return; } } catch (e) {}
      db = seed(); save();
    }
    function save() { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) {} }
    function ok(v) { return Promise.resolve(clone(v)); }
    function deny(msg) { return Promise.reject(new Error(msg || "Not permitted")); }
    function me() { return db.profiles.filter(function (p) { return p.id === uid && p.active; })[0]; }
    function role() { var m = me(); return m ? m.role : null; }
    function groupOf(pid) { var p = db.practices.filter(function (x) { return x.id === pid; })[0]; return p ? p.group_id : null; }
    function grantOk(pid) {
      var m = me(); if (!m || m.role !== "inspector") return false;
      return db.grants.some(function (g) { return g.practice_id === pid && !g.revoked && g.inspector_email.toLowerCase() === m.email.toLowerCase() && new Date(g.starts_at) <= new Date() && new Date(g.expires_at) >= new Date(); });
    }
    function isGA(pid) { var m = me(); return !!m && m.role === "group_admin" && groupOf(pid) === m.group_id && !!m.group_id; }
    function canManage(pid) { var m = me(); return !!m && (m.role === "platform_admin" || ((m.role === "principal" || m.role === "practice_manager") && m.practice_id === pid)); }
    function canRead(pid) { var m = me(); return canManage(pid) || (!!m && m.role === "staff" && m.practice_id === pid) || isGA(pid) || grantOk(pid); }
    function canBook(pid) { return canManage(pid) || isGA(pid); }
    function logAudit(action, entity, entityId, pid, detail) {
      var m = me(); if (!m) return;
      db.audit.push({ id: db.audit.length + 1, at: new Date().toISOString(), actor: m.id, actor_email: m.email, actor_role: m.role, practice_id: pid || null, group_id: pid ? groupOf(pid) : null, action: action, entity: entity || null, entity_id: entityId || null, detail: detail || {} });
    }
    function byId(arr, i) { return arr.filter(function (x) { return x.id === i; })[0]; }

    var api = {
      mode: "demo",
      demoUsers: function () { return clone(db.profiles.filter(function (p) { return p.active; })); },
      demoLogin: function (profileId) { uid = profileId; try { localStorage.setItem(USER_KEY, uid); } catch (e) {} return Promise.resolve({ id: uid, email: me().email }); },
      demoReset: function () { try { localStorage.removeItem(DB_KEY); localStorage.removeItem(USER_KEY); } catch (e) {} db = seed(); save(); uid = null; },
      onRecovery: function () {},

      init: function () {
        load();
        try { uid = localStorage.getItem(USER_KEY) || null; } catch (e) {}
        return Promise.resolve(me() ? { id: uid, email: me().email } : null);
      },
      signIn: function () { return deny(CC.t("Demo mode: choose a role below.")); },
      signUp: function () { return deny(CC.t("Demo mode: choose a role below.")); },
      resetPassword: function () { return deny(CC.t("Demo mode: choose a role below.")); },
      updatePassword: function () { return Promise.resolve(); },
      signOut: function () { uid = null; try { localStorage.removeItem(USER_KEY); } catch (e) {} return Promise.resolve(); },
      mfa: {
        status: function () { return Promise.resolve({ enrolled: db.mfa === true, factorId: "demo" }); },
        enroll: function () { return Promise.resolve({ factorId: "demo", qr: "", secret: "DEMO-SECRET-0000" }); },
        verifyEnroll: function (f, code) { if (!/^\d{6}$/.test(code)) return deny(CC.t("That code was not accepted.")); db.mfa = true; save(); return Promise.resolve(); },
        challenge: function () { return Promise.resolve(); },
        disable: function () { db.mfa = false; save(); return Promise.resolve(); }
      },
      getProfile: function () { return ok(me() || null); },

      practices: {
        list: function () {
          var m = me(); if (!m) return ok([]);
          return ok(db.practices.filter(function (p) { return canRead(p.id); }).sort(function (a, b) { return a.name.localeCompare(b.name); }));
        },
        create: function (row) {
          var m = me();
          if (!(m.role === "platform_admin" || (m.role === "group_admin" && row.group_id === m.group_id))) return deny();
          var p = Object.assign({ id: id("p"), group_id: null, address: null, health_board: null, hiw_registration: null, package: "solo", next_inspection: null, created_at: new Date().toISOString() }, row);
          db.practices.push(p); save(); return ok(p);
        },
        update: function (pid, patch) {
          var p = byId(db.practices, pid), m = me();
          if (!p || !(m.role === "platform_admin" || (m.role === "principal" && m.practice_id === pid) || isGA(pid))) return deny();
          if ("group_id" in patch && patch.group_id !== p.group_id) {
            if (!(m.role === "platform_admin" || (m.role === "group_admin" && (patch.group_id === null || patch.group_id === m.group_id)))) return deny("Not permitted to change group membership");
          }
          Object.assign(p, patch); save(); return ok(p);
        }
      },
      groups: {
        list: function () {
          var m = me();
          return ok(db.groups.filter(function (g) { return m.role === "platform_admin" || g.id === m.group_id || (m.practice_id && groupOf(m.practice_id) === g.id); }));
        },
        create: function (row) { if (role() !== "platform_admin") return deny(); var g = Object.assign({ id: id("g"), billing_mode: "consolidated", created_at: new Date().toISOString() }, row); db.groups.push(g); save(); return ok(g); },
        update: function (gid, patch) { var m = me(); if (!(m.role === "platform_admin" || (m.role === "group_admin" && m.group_id === gid))) return deny(); Object.assign(byId(db.groups, gid), patch); save(); return ok(); }
      },
      practiceInputs: function (pid) {
        if (!canRead(pid)) return deny();
        var r = role();
        if (r === "group_admin" || r === "inspector" || r === "platform_admin") logAudit("view_dashboard", "practice", pid, pid);
        var done = db.assessments.filter(function (a) { return a.practice_id === pid && a.status === "completed"; }).sort(function (a, b) { return b.completed_at.localeCompare(a.completed_at); })[0];
        var cutoff = iso(-190);
        save();
        return ok({
          practice: byId(db.practices, pid),
          evidence: db.evidence.filter(function (e) { return e.practice_id === pid; }).map(function (e) { return { category: e.category, status: e.status, expiry_date: e.expiry_date }; }),
          assessment: done ? { id: done.id, completed_at: done.completed_at, answers: db.answers.filter(function (a) { return a.assessment_id === done.id; }).map(function (a) { return { category: byId(db.questions, a.question_id).category, answer: a.answer }; }) } : null,
          training: db.assignments.filter(function (t) { return t.practice_id === pid; }).map(function (t) { return { kind: byId(db.modules, t.module_id).kind, status: t.status }; }),
          staff_count: db.profiles.filter(function (p) { return p.practice_id === pid && p.active && ["staff", "practice_manager", "principal"].indexOf(p.role) >= 0; }).length,
          pm_trained: db.assignments.some(function (t) { return t.practice_id === pid && byId(db.modules, t.module_id).kind === "pm" && t.status === "completed"; }),
          snapshots: db.snapshots.filter(function (s) { return s.practice_id === pid && s.taken_on > cutoff; }).sort(function (a, b) { return a.taken_on.localeCompare(b.taken_on); }).map(function (s) { return { taken_on: s.taken_on, score: s.score }; })
        });
      },
      groupAverage: function (pid) {
        if (!canRead(pid)) return deny();
        var g = groupOf(pid); if (!g) return ok(null);
        var vals = db.practices.filter(function (p) { return p.group_id === g; }).map(function (p) {
          var s = db.snapshots.filter(function (x) { return x.practice_id === p.id; }).sort(function (a, b) { return b.taken_on.localeCompare(a.taken_on); })[0];
          return s ? s.score : null;
        }).filter(function (v) { return v !== null; });
        return ok(vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null);
      },
      saveSnapshot: function (pid, score, cats) {
        if (!canBook(pid)) return deny();
        var today = iso(0), ex = db.snapshots.filter(function (s) { return s.practice_id === pid && s.taken_on === today; })[0];
        if (ex) { ex.score = score; ex.cat_scores = cats; } else db.snapshots.push({ id: id("s"), practice_id: pid, taken_on: today, score: score, cat_scores: cats });
        save(); return ok();
      },

      evidence: {
        list: function (pid) {
          if (!canRead(pid)) return ok([]);
          var m = me();
          var rows = db.evidence.filter(function (e) { return e.practice_id === pid; });
          if (!(canManage(pid) || grantOk(pid))) rows = rows.filter(function (e) { return e.uploaded_by === m.id || e.staff_member === m.id; });
          return ok(rows.sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }));
        },
        add: function (row) {
          var m = me(), pid = row.practice_id;
          if (!(canManage(pid) || (m.role === "staff" && m.practice_id === pid))) return deny();
          var file = row.file; delete row.file;
          var ev = Object.assign({ id: id("e"), staff_member: null, expiry_date: null, status: "pending", uploaded_by: m.id, verified_by: null, verified_at: null, current_version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, row);
          if (!canManage(pid)) { ev.status = "pending"; ev.staff_member = m.id; }
          ev.file_name = file ? file.name : null; ev.file_path = file ? pid + "/demo-" + ev.id : null;
          db.evidence.push(ev);
          db.versions.push({ id: id("v"), evidence_id: ev.id, version: 1, file_path: ev.file_path, file_name: ev.file_name, expiry_date: ev.expiry_date, uploaded_by: m.id, created_at: ev.created_at });
          save(); return ok(ev);
        },
        replace: function (eid, pid, file, expiry, verify) {
          var ev = byId(db.evidence, eid), m = me();
          if (!ev || !(canManage(ev.practice_id) || ev.uploaded_by === m.id)) return deny();
          ev.current_version++; ev.expiry_date = expiry || null; ev.status = verify && canManage(ev.practice_id) ? "verified" : "pending";
          if (file) { ev.file_name = file.name; ev.file_path = ev.practice_id + "/demo-" + ev.id + "-v" + ev.current_version; }
          db.versions.push({ id: id("v"), evidence_id: eid, version: ev.current_version, file_path: ev.file_path, file_name: ev.file_name, expiry_date: ev.expiry_date, uploaded_by: m.id, created_at: new Date().toISOString() });
          save(); return ok(ev);
        },
        setStatus: function (eid, status) {
          var ev = byId(db.evidence, eid);
          if (!ev || !canManage(ev.practice_id)) return deny(CC.t("Only a Principal or Practice Manager can verify evidence."));
          ev.status = status; ev.verified_by = me().id; ev.verified_at = new Date().toISOString(); save(); return ok();
        },
        versions: function (eid) { var ev = byId(db.evidence, eid); if (!ev || !canRead(ev.practice_id)) return ok([]); return ok(db.versions.filter(function (v) { return v.evidence_id === eid; }).sort(function (a, b) { return b.version - a.version; })); },
        url: function (path) {
          var blob = new Blob(["Demo document placeholder.\nIn live mode this opens the real uploaded file.\n\n" + path], { type: "text/plain" });
          return Promise.resolve(URL.createObjectURL(blob));
        }
      },

      profiles: {
        list: function (scope) {
          var m = me(), rows = db.profiles;
          if (m.role === "platform_admin") { /* all */ }
          else if (m.role === "principal" || m.role === "practice_manager") rows = rows.filter(function (p) { return p.practice_id === m.practice_id; });
          else if (m.role === "group_admin") rows = rows.filter(function (p) { return p.group_id === m.group_id || (p.practice_id && groupOf(p.practice_id) === m.group_id); });
          else rows = rows.filter(function (p) { return p.id === m.id; });
          if (scope && scope.practice_id) rows = rows.filter(function (p) { return p.practice_id === scope.practice_id; });
          return ok(rows);
        },
        setActive: function (pid, active) {
          var m = me(), t = byId(db.profiles, pid);
          if (!t || t.id === m.id) return deny("You cannot change your own access");
          var okp = m.role === "platform_admin" || ((m.role === "principal" || m.role === "practice_manager") && t.practice_id === m.practice_id && ["staff", "practice_manager"].indexOf(t.role) >= 0 && (m.role === "principal" || t.role === "staff"));
          if (!okp) return deny();
          t.active = active; logAudit(active ? "user_reactivated" : "user_deactivated", "profile", pid, t.practice_id); save(); return ok();
        },
        adminUpdate: function (pid, p) {
          if (role() !== "platform_admin") return deny();
          var t = byId(db.profiles, pid);
          if (pid === uid && (p.active === false || p.role !== "platform_admin")) return deny("You cannot remove your own admin access");
          Object.assign(t, { role: p.role, practice_id: p.practice_id || null, group_id: p.group_id || null, active: p.active });
          logAudit("admin_update_user", "profile", pid, p.practice_id || null); save(); return ok();
        },
        updateMe: function (name, lang) { var m = me(); if (name) m.full_name = name; if (lang) m.language = lang; save(); return ok(); }
      },
      invites: {
        list: function () {
          var m = me();
          return ok(db.invites.filter(function (i) {
            if (i.claimed) return false;
            if (m.role === "platform_admin") return true;
            if (m.role === "group_admin") return i.group_id === m.group_id || (i.practice_id && groupOf(i.practice_id) === m.group_id);
            if (m.role === "principal" || m.role === "practice_manager") return i.practice_id === m.practice_id;
            return false;
          }));
        },
        create: function (row) {
          var m = me(), r = row.role, pid = row.practice_id;
          var allowed = m.role === "platform_admin"
            || (m.role === "principal" && pid === m.practice_id && ["staff", "practice_manager", "inspector"].indexOf(r) >= 0)
            || (m.role === "practice_manager" && pid === m.practice_id && r === "staff")
            || (m.role === "group_admin" && r === "principal" && pid && isGA(pid));
          if (!allowed) return deny();
          if (db.invites.some(function (i) { return !i.claimed && i.email.toLowerCase() === row.email.toLowerCase(); })) return deny("An open invite for this email already exists");
          db.invites.push(Object.assign({ id: id("inv"), full_name: null, practice_id: null, group_id: null, claimed: false, created_at: new Date().toISOString() }, row)); save(); return ok();
        },
        remove: function (iid) { db.invites = db.invites.filter(function (i) { return i.id !== iid; }); save(); return ok(); }
      },

      training: {
        modules: function () { return ok(db.modules); },
        assignments: function (f) {
          var m = me(), rows = db.assignments.filter(function (t) { return (t.profile_id === m.id) || canManage(t.practice_id) || isGA(t.practice_id); });
          if (f && f.practice_id) rows = rows.filter(function (t) { return t.practice_id === f.practice_id; });
          if (f && f.profile_id) rows = rows.filter(function (t) { return t.profile_id === f.profile_id; });
          return ok(rows);
        },
        assign: function (rows) {
          for (var i = 0; i < rows.length; i++) if (!canBook(rows[i].practice_id)) return deny();
          rows.forEach(function (r) {
            if (db.assignments.some(function (t) { return t.module_id === r.module_id && t.profile_id === r.profile_id; })) return;
            db.assignments.push(Object.assign({ id: id("t"), assigned_by: uid, due_date: null, status: "assigned", progress: 0, completed_at: null, created_at: new Date().toISOString() }, r));
          });
          save(); return ok();
        },
        progress: function (aid, progress) {
          var t = byId(db.assignments, aid);
          if (!t || !(t.profile_id === uid || canManage(t.practice_id))) return deny();
          t.progress = progress; t.status = progress >= 100 ? "completed" : (progress > 0 ? "in_progress" : "assigned"); t.completed_at = progress >= 100 ? new Date().toISOString() : null;
          save(); return ok();
        }
      },

      assessment: {
        questions: function () { return ok(db.questions); },
        list: function (pid) { if (!(canManage(pid) || grantOk(pid))) return ok([]); return ok(db.assessments.filter(function (a) { return a.practice_id === pid; }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at); })); },
        answers: function (aid) { var a = byId(db.assessments, aid); if (!a || !(canManage(a.practice_id) || grantOk(a.practice_id))) return ok([]); return ok(db.answers.filter(function (x) { return x.assessment_id === aid; })); },
        start: function (pid, prefill) {
          if (!canManage(pid)) return deny();
          var a = { id: id("a"), practice_id: pid, started_by: uid, status: "in_progress", score: null, created_at: new Date().toISOString(), completed_at: null };
          db.assessments.push(a);
          if (prefill) db.answers.filter(function (x) { return x.assessment_id === prefill; }).forEach(function (x) { db.answers.push({ assessment_id: a.id, question_id: x.question_id, answer: x.answer, note: x.note }); });
          save(); return ok(a);
        },
        save: function (aid, answers) {
          var a = byId(db.assessments, aid); if (!a || !canManage(a.practice_id)) return deny();
          answers.forEach(function (x) {
            var ex = db.answers.filter(function (y) { return y.assessment_id === aid && y.question_id === x.question_id; })[0];
            if (ex) { ex.answer = x.answer; ex.note = x.note || null; } else db.answers.push({ assessment_id: aid, question_id: x.question_id, answer: x.answer, note: x.note || null });
          });
          save(); return ok();
        },
        complete: function (aid, score) { var a = byId(db.assessments, aid); if (!a || !canManage(a.practice_id)) return deny(); a.status = "completed"; a.score = score; a.completed_at = new Date().toISOString(); save(); return ok(); }
      },

      bookings: {
        list: function () { return ok(db.bookings.filter(function (b) { return canManage(b.practice_id) || isGA(b.practice_id); }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at); })); },
        create: function (rows) {
          for (var i = 0; i < rows.length; i++) if (!canBook(rows[i].practice_id)) return deny();
          rows.forEach(function (r) { db.bookings.push(Object.assign({ id: id("b"), requested_by: uid, preferred_date: null, mode: "onsite", seats: 1, status: "requested", notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, r, { status: "requested" })); });
          logAudit("create_booking", "booking", "", rows[0].practice_id, { count: rows.length }); save(); return ok();
        },
        update: function (bid, patch) {
          var b = byId(db.bookings, bid); if (!b) return deny();
          if (role() !== "platform_admin" && patch.status !== "cancelled") return deny();
          if (role() !== "platform_admin" && !(canManage(b.practice_id) || isGA(b.practice_id))) return deny();
          Object.assign(b, patch, { updated_at: new Date().toISOString() }); save(); return ok();
        }
      },
      grants: {
        list: function (pid) { if (!canManage(pid)) return ok([]); return ok(db.grants.filter(function (g) { return g.practice_id === pid; }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at); })); },
        mine: function () { var m = me(); return ok(db.grants.filter(function (g) { return g.inspector_email.toLowerCase() === m.email.toLowerCase(); })); },
        create: function (row) {
          if (!(role() === "principal" || role() === "platform_admin") || !canManage(row.practice_id)) return deny();
          db.grants.push(Object.assign({ id: id("gr"), granted_by: uid, starts_at: new Date().toISOString(), revoked: false, created_at: new Date().toISOString() }, row));
          logAudit("grant_inspector", "grant", "", row.practice_id, { inspector: row.inspector_email }); save(); return ok();
        },
        revoke: function (gid) { var g = byId(db.grants, gid); if (!g || !canManage(g.practice_id)) return deny(); g.revoked = true; logAudit("revoke_inspector", "grant", gid, g.practice_id); save(); return ok(); }
      },

      hr: CC.makeDemoHr({ db: function () { return db; }, me: me, uid: function () { return uid; }, canManage: canManage, isGA: isGA, save: save, ok: ok, deny: deny, logAudit: logAudit, byId: byId }),

      audit: {
        log: function (action, entity, entityId, pid, detail) { if (pid && !canRead(pid)) return Promise.resolve(); logAudit(action, entity, entityId, pid, detail); save(); return Promise.resolve(); },
        list: function (f) {
          var m = me(), rows = db.audit.filter(function (a) {
            if (m.role === "platform_admin") return true;
            if (m.role === "principal" || m.role === "practice_manager") return a.practice_id === m.practice_id;
            if (m.role === "group_admin") return a.group_id === m.group_id;
            return false;
          });
          if (f && f.practice_id) rows = rows.filter(function (a) { return a.practice_id === f.practice_id; });
          return ok(rows.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }).slice(0, (f && f.limit) || 300));
        }
      },
      enquiries: {
        list: function () { if (role() !== "platform_admin") return ok([]); return ok(db.enquiries.slice().sort(function (a, b) { return b.created_at.localeCompare(a.created_at); })); },
        update: function (qid, patch) { if (role() !== "platform_admin") return deny(); Object.assign(byId(db.enquiries, qid), patch); save(); return ok(); }
      }
    };
    return api;
  };
})();
