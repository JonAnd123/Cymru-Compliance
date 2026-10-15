/* Cymru Compliance portal — DEMO HR data + API (mirrors supabase/03_hr.sql rules; real enforcement is in the database). */
(function () {
  "use strict";
  var CC = window.CC, HR = CC.hr;

  function uid8(p) { return p + "_" + Math.random().toString(36).slice(2, 8); }
  function addD(off) { return HR.addDays(HR.today(), off); }

  /* ---------- seed ---------- */
  CC.demoHrSeed = function (db) {
    db.hr_staff = []; db.hr_leave = []; db.hr_docs = []; db.hr_notes = []; db.hr_files = {};
    // [practice, name, title, email, start offset(days), type, hours, leave days, gdc, startMonth]
    var rows = [
      ["p1", "Dr Sian Williams", "Principal dentist", "sian@cardiffbaydental.example", -2400, "permanent", 37.5, 30, "GDC 123456"],
      ["p1", "Rhian Davies", "Practice manager", "rhian@cardiffbaydental.example", -1800, "permanent", 37.5, 28, null],
      ["p1", "Owen Evans", "Dental nurse", "owen@cardiffbaydental.example", -900, "permanent", 37.5, 28, "GDC 234567"],
      ["p1", "Priya Patel", "Dental hygienist", "priya@cardiffbaydental.example", -400, "part_time", 24, 28, "GDC 345678"],
      ["p1", "Megan Price", "Receptionist", "newstarter@cardiffbaydental.example", -20, "permanent", 30, 28, null],
      ["p1", "Dr Dylan Roberts", "Associate dentist", "dylan@cardiffbaydental.example", -1200, "permanent", 30, 28, "GDC 456789"],
      ["p1", "Ffion Hughes", "Trainee dental nurse", "ffion@cardiffbaydental.example", -300, "fixed_term", 37.5, 28, null],
      ["p2", "Dr Huw Jones", "Principal dentist", "huw@newportdental.example", -3000, "permanent", 37.5, 30, "GDC 567890"],
      ["p2", "Elin Thomas", "Practice manager", "elin@newportdental.example", -1500, "permanent", 37.5, 28, null],
      ["p2", "Callum Reid", "Dental nurse", "callum@newportdental.example", -700, "permanent", 37.5, 28, "GDC 678901"],
      ["p2", "Aisha Khan", "Receptionist", "aisha@newportdental.example", -250, "part_time", 20, 28, null],
      ["p3", "Dr Carys Lloyd", "Principal dentist", "carys@swanseamarina.example", -2000, "permanent", 37.5, 30, "GDC 789012"],
      ["p3", "Gethin Morris", "Dental nurse", "gethin@swanseamarina.example", -600, "permanent", 37.5, 28, "GDC 890123"],
      ["p3", "Lowri James", "Receptionist", "lowri@swanseamarina.example", -200, "permanent", 30, 28, null],
      ["p4", "Dr Emyr Hughes", "Principal dentist", "emyr@aberdental.example", -2600, "permanent", 37.5, 30, "GDC 901234"],
      ["p4", "Nia Parry", "Dental nurse", "nia@aberdental.example", -800, "permanent", 37.5, 28, "GDC 012345"],
      ["p4", "Rhodri Ellis", "Receptionist", "rhodri@aberdental.example", -150, "part_time", 22.5, 28, null]
    ];
    var byEmail = {};
    rows.forEach(function (r, i) {
      var s = {
        id: "hs" + (i + 1), practice_id: r[0], full_name: r[1], job_title: r[2], email: r[3], phone: "07700 9" + (10000 + i * 137),
        address: null, start_date: addD(r[4]), end_date: null, employment_type: r[5], contracted_hours: r[6], annual_leave_days: r[7],
        leave_year_start_month: 1, emergency_name: "Next of kin", emergency_relation: "Partner", emergency_phone: "07700 8" + (20000 + i * 91),
        gdc_number: r[8], gdc_expiry: r[8] ? addD(i % 4 === 0 ? 25 : (i % 5 === 0 ? -10 : 200 + i * 7)) : null,
        indemnity_expiry: r[8] ? addD(150 + i * 5) : null, dbs_expiry: addD(300 + i * 11), photo_path: i === 4 ? null : "demo-asset:hs" + (i + 1), active: true,
        created_by: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      };
      db.hr_staff.push(s); byEmail[s.email] = s;
    });
    function leave(email, type, startOff, endOff, status, reason, half) {
      var s = byEmail[email], a = addD(startOff), b = addD(endOff);
      db.hr_leave.push({
        id: uid8("hl"), practice_id: s.practice_id, staff_id: s.id, leave_type: type, start_date: a, end_date: b, half_day: !!half,
        days: HR.workingDays(a, b, half), status: status, reason: reason || null, manager_note: status === "declined" ? "Short-staffed that week — please pick another date." : null,
        requested_by: null, decided_by: status === "pending" ? null : "u_pr1", decided_at: status === "pending" ? null : new Date().toISOString(), created_at: new Date().toISOString()
      });
    }
    var C = "@cardiffbaydental.example", N = "@newportdental.example", S = "@swanseamarina.example", A = "@aberdental.example";
    leave("owen" + C, "annual", 20, 24, "approved", "Family holiday");
    leave("owen" + C, "annual", -70, -66, "approved");
    leave("owen" + C, "sick", -35, -34, "approved", "Cold");
    leave("owen" + C, "annual", 60, 64, "pending", "Summer break");
    leave("priya" + C, "annual", 3, 5, "pending", "Wedding");
    leave("priya" + C, "sick", -2, 0, "approved", "Back pain");
    leave("priya" + C, "study", 30, 30, "approved", "CPD course");
    leave("rhian" + C, "annual", 14, 18, "approved");
    leave("rhian" + C, "annual", -120, -116, "approved");
    leave("newstarter" + C, "annual", 45, 45, "pending", "", true);
    leave("dylan" + C, "annual", -1, 3, "approved", "Walking trip");
    leave("dylan" + C, "sick", -90, -88, "approved");
    leave("dylan" + C, "sick", -50, -50, "approved");
    leave("ffion" + C, "maternity", -40, 120, "approved", "Maternity leave");
    leave("callum" + N, "annual", 5, 9, "approved");
    leave("callum" + N, "sick", -10, -8, "approved");
    leave("aisha" + N, "annual", 12, 13, "pending");
    leave("elin" + N, "sick", -1, 4, "approved", "Surgery recovery");
    leave("gethin" + S, "sick", -20, -19, "approved");
    leave("gethin" + S, "sick", -8, -7, "approved");
    leave("gethin" + S, "sick", 0, 0, "approved");
    leave("lowri" + S, "paternity", 7, 20, "approved");
    leave("lowri" + S, "annual", 40, 44, "pending");
    leave("nia" + A, "annual", 2, 6, "approved");
    leave("rhodri" + A, "annual", 25, 26, "declined");
    db.hr_notes.push(
      { id: uid8("hn"), practice_id: "p1", staff_id: byEmail["owen" + C].id, kind: "appraisal", note_date: addD(-60), body: "Annual appraisal completed. Strong on infection control; agreed to lead the decontamination audit.", created_by: "u_pr1", created_at: new Date().toISOString() },
      { id: uid8("hn"), practice_id: "p1", staff_id: byEmail["owen" + C].id, kind: "return_to_work", note_date: addD(-33), body: "Return-to-work chat after sickness absence. No ongoing issues.", created_by: "u_pm1", created_at: new Date().toISOString() },
      { id: uid8("hn"), practice_id: "p2", staff_id: byEmail["callum" + N].id, kind: "one_to_one", note_date: addD(-14), body: "One-to-one: workload fine, would like radiography refresher.", created_by: "u_pr2", created_at: new Date().toISOString() }
    );
    db.hr_docs.push(
      { id: uid8("hd"), practice_id: "p1", staff_id: byEmail["owen" + C].id, kind: "contract", title: "Employment contract (signed)", file_path: "demo-doc:contract", file_name: "contract.pdf", created_by: "u_pr1", created_at: new Date().toISOString() }
    );
    return db;
  };

  /* ---------- API ---------- */
  // ctx: { db(), me(), uid(), canManage(pid), isGA(pid), save(), ok(v), deny(msg), logAudit(...), byId(arr,id) }
  CC.makeDemoHr = function (ctx) {
    function myStaffId() {
      var m = ctx.me(); if (!m || ["staff", "practice_manager", "principal"].indexOf(m.role) < 0) return null;
      var h = ctx.db().hr_staff.filter(function (s) { return s.active && s.practice_id === m.practice_id && s.email && s.email.toLowerCase() === m.email.toLowerCase(); })[0];
      return h ? h.id : null;
    }
    function canSee(pid, staffId) { return ctx.canManage(pid) || ctx.isGA(pid) || (staffId && staffId === myStaffId()); }
    function staffById(i) { return ctx.byId(ctx.db().hr_staff, i); }
    function noPractice(pid, staffId) { var s = staffById(staffId); return !s || s.practice_id !== pid; }

    return {
      staff: {
        list: function (f) {
          var rows = ctx.db().hr_staff.filter(function (s) { return canSee(s.practice_id, s.id); });
          if (f && f.practice_id) rows = rows.filter(function (s) { return s.practice_id === f.practice_id; });
          return ctx.ok(rows.sort(function (a, b) { return a.full_name.localeCompare(b.full_name); }));
        },
        mine: function (email, practiceId) {
          var h = ctx.db().hr_staff.filter(function (s) { return s.active && s.email && email && s.email.toLowerCase() === email.toLowerCase() && (!practiceId || s.practice_id === practiceId) && canSee(s.practice_id, s.id); })[0];
          return ctx.ok(h || null);
        },
        create: function (row) {
          if (!ctx.canManage(row.practice_id)) return ctx.deny();
          var s = Object.assign({ id: uid8("hs"), address: null, end_date: null, employment_type: "permanent", annual_leave_days: 28, leave_year_start_month: 1, photo_path: null, active: true, created_by: ctx.uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, row);
          ctx.db().hr_staff.push(s); ctx.save(); return ctx.ok(s);
        },
        update: function (id, patch) {
          var s = staffById(id); if (!s || !ctx.canManage(s.practice_id)) return ctx.deny();
          delete patch.practice_id; Object.assign(s, patch, { updated_at: new Date().toISOString() }); ctx.save(); return ctx.ok(s);
        },
        setPhoto: function (staff, file) {
          var s = staffById(staff.id); if (!s || !ctx.canManage(s.practice_id)) return ctx.deny();
          return HR.fileToDataUrl(file).then(function (url) {
            var path = "demo-photo:" + s.id + ":" + Date.now();
            ctx.db().hr_files[path] = url; s.photo_path = path; ctx.save(); return path;
          });
        }
      },
      photoUrls: function (paths) {
        var m = {}, f = ctx.db().hr_files || {};
        (paths || []).forEach(function (p) { if (!p) return; if (p.indexOf("demo-asset:") === 0) m[p] = "brand/demo/" + p.slice(11) + ".jpg"; else if (f[p]) m[p] = f[p]; });
        return ctx.ok(m);
      },
      leave: {
        list: function (f) {
          var rows = ctx.db().hr_leave.filter(function (l) { return canSee(l.practice_id, l.staff_id); });
          if (f && f.practice_id) rows = rows.filter(function (l) { return l.practice_id === f.practice_id; });
          if (f && f.staff_id) rows = rows.filter(function (l) { return l.staff_id === f.staff_id; });
          return ctx.ok(rows.sort(function (a, b) { return b.start_date.localeCompare(a.start_date); }));
        },
        create: function (row) {
          if (noPractice(row.practice_id, row.staff_id)) return ctx.deny("Staff member does not belong to this practice");
          if (!row.end_date || row.end_date < row.start_date) return ctx.deny("End date must be on or after the start date");
          var mgr = ctx.canManage(row.practice_id);
          if (!mgr && (row.staff_id !== myStaffId() || (row.status && row.status !== "pending"))) return ctx.deny("Staff can only submit their own pending leave requests");
          var l = Object.assign({ id: uid8("hl"), half_day: false, days: 0, status: "pending", reason: null, manager_note: null, decided_by: null, decided_at: null, created_at: new Date().toISOString() }, row, { requested_by: ctx.uid() });
          if (!mgr) { l.status = "pending"; l.manager_note = null; }
          else if (l.status === "approved" || l.status === "declined") { l.decided_by = ctx.uid(); l.decided_at = new Date().toISOString(); }
          ctx.db().hr_leave.push(l);
          ctx.save(); return ctx.ok(l);
        },
        update: function (id, patch) {
          var l = ctx.byId(ctx.db().hr_leave, id); if (!l || !canSee(l.practice_id, l.staff_id)) return ctx.deny();
          if (ctx.canManage(l.practice_id)) {
            if (patch.status && patch.status !== l.status && (patch.status === "approved" || patch.status === "declined")) { patch.decided_by = ctx.uid(); patch.decided_at = new Date().toISOString(); }
            delete patch.practice_id; delete patch.staff_id;
            Object.assign(l, patch);
            ctx.save(); return ctx.ok(l);
          }
          if (l.staff_id !== myStaffId() || l.status !== "pending" || patch.status !== "cancelled" || Object.keys(patch).some(function (k) { return k !== "status"; })) return ctx.deny("Staff can only cancel their own pending requests");
          l.status = "cancelled"; ctx.save(); return ctx.ok(l);
        }
      },
      whosOff: function (pid, from, to) {
        var m = ctx.me();
        var ok = ctx.canManage(pid) || ctx.isGA(pid) || (m && m.role === "staff" && m.practice_id === pid);
        if (!ok) return ctx.deny("Not permitted");
        return ctx.ok(ctx.db().hr_leave.filter(function (l) { return l.practice_id === pid && l.status === "approved" && l.start_date <= to && l.end_date >= from; })
          .map(function (l) { return { staff_id: l.staff_id, full_name: staffById(l.staff_id).full_name, start_date: l.start_date, end_date: l.end_date, half_day: l.half_day }; })
          .sort(function (a, b) { return a.start_date.localeCompare(b.start_date); }));
      },
      docs: {
        list: function (staffId) {
          var s = staffById(staffId); if (!s || !(ctx.canManage(s.practice_id) || ctx.isGA(s.practice_id))) return ctx.ok([]);
          return ctx.ok(ctx.db().hr_docs.filter(function (d) { return d.staff_id === staffId; }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }));
        },
        add: function (row, file) {
          if (!ctx.canManage(row.practice_id) || noPractice(row.practice_id, row.staff_id)) return ctx.deny();
          if (file.size > 1500000) return ctx.deny("Demo mode keeps files in your browser, so uploads are limited to 1.5 MB.");
          return HR.fileToDataUrl(file).then(function (url) {
            var path = "demo-doc:" + uid8("f"); ctx.db().hr_files[path] = url;
            var d = Object.assign({ id: uid8("hd"), created_by: ctx.uid(), created_at: new Date().toISOString() }, row, { file_path: path, file_name: file.name });
            ctx.db().hr_docs.push(d); ctx.save(); return d;
          });
        },
        remove: function (doc) {
          var d = ctx.byId(ctx.db().hr_docs, doc.id); if (!d || !ctx.canManage(d.practice_id)) return ctx.deny();
          ctx.db().hr_docs = ctx.db().hr_docs.filter(function (x) { return x.id !== d.id; }); delete ctx.db().hr_files[d.file_path]; ctx.save(); return ctx.ok();
        },
        url: function (path) { var u = ctx.db().hr_files[path]; return u ? ctx.ok(u) : ctx.deny("This demo document has no file attached."); }
      },
      notes: {
        list: function (staffId) {
          var s = staffById(staffId); if (!s || !(ctx.canManage(s.practice_id) || ctx.isGA(s.practice_id))) return ctx.ok([]);
          return ctx.ok(ctx.db().hr_notes.filter(function (n) { return n.staff_id === staffId; }).sort(function (a, b) { return b.note_date.localeCompare(a.note_date) || b.created_at.localeCompare(a.created_at); }));
        },
        add: function (row) {
          if (!ctx.canManage(row.practice_id) || noPractice(row.practice_id, row.staff_id)) return ctx.deny();
          var n = Object.assign({ id: uid8("hn"), kind: "general", note_date: HR.today(), created_by: ctx.uid(), created_at: new Date().toISOString() }, row);
          ctx.db().hr_notes.push(n); ctx.save(); return ctx.ok(n);
        }
      }
    };
  };
})();
