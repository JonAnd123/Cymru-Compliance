/* Cymru Compliance portal — HR helpers (leave types, working-day maths, balances, image resize) */
(function () {
  "use strict";
  var CC = window.CC;
  var HR = CC.hr = CC.hr || {};

  // England & Wales bank holidays (update yearly). Used to count working days.
  HR.BANK_HOLIDAYS = {
    "2026-01-01": "New Year's Day", "2026-04-03": "Good Friday", "2026-04-06": "Easter Monday", "2026-05-04": "Early May bank holiday",
    "2026-05-25": "Spring bank holiday", "2026-08-31": "Summer bank holiday", "2026-12-25": "Christmas Day", "2026-12-28": "Boxing Day (substitute)",
    "2027-01-01": "New Year's Day", "2027-03-26": "Good Friday", "2027-03-29": "Easter Monday", "2027-05-03": "Early May bank holiday",
    "2027-05-31": "Spring bank holiday", "2027-08-30": "Summer bank holiday", "2027-12-27": "Christmas Day (substitute)", "2027-12-28": "Boxing Day (substitute)"
  };

  // key, English label, colour (calendar), group
  HR.TYPES = [
    { key: "annual", label: "Annual leave", color: "#2f9e6e", group: "leave" },
    { key: "sick", label: "Sick leave", color: "#d64545", group: "absence" },
    { key: "maternity", label: "Maternity leave", color: "#8a5cc7", group: "family" },
    { key: "paternity", label: "Paternity leave", color: "#5b7bd6", group: "family" },
    { key: "adoption", label: "Adoption leave", color: "#c76aa8", group: "family" },
    { key: "shared_parental", label: "Shared parental leave", color: "#9a7bd6", group: "family" },
    { key: "compassionate", label: "Compassionate leave", color: "#7a8696", group: "leave" },
    { key: "study", label: "Study / CPD leave", color: "#2b9bb8", group: "leave" },
    { key: "unpaid", label: "Unpaid leave", color: "#a38a5c", group: "leave" },
    { key: "other", label: "Other leave", color: "#8b98a9", group: "leave" }
  ];
  HR.typeInfo = function (k) { return HR.TYPES.filter(function (t) { return t.key === k; })[0] || HR.TYPES[HR.TYPES.length - 1]; };
  HR.typeLabel = function (k) { return CC.t(HR.typeInfo(k).label); };
  // types an employee can request themselves (family leave is recorded by the manager)
  HR.REQUESTABLE = ["annual", "sick", "compassionate", "study", "unpaid", "other"];
  HR.EMPLOYMENT = [["permanent", "Permanent"], ["fixed_term", "Fixed term"], ["part_time", "Part time"], ["locum", "Locum"], ["zero_hours", "Zero hours"]];
  HR.empLabel = function (k) { var e = HR.EMPLOYMENT.filter(function (x) { return x[0] === k; })[0]; return CC.t(e ? e[1] : k); };
  HR.STATUS_CLASS = { pending: "amber", approved: "green", declined: "red", cancelled: "grey" };
  HR.STATUS_LABEL = { pending: "Pending", approved: "Approved", declined: "Declined", cancelled: "Cancelled" };
  HR.statusChip = function (s) { return CC.chip(HR.STATUS_CLASS[s] || "grey", CC.t(HR.STATUS_LABEL[s] || s)); };
  HR.DOC_KINDS = [["contract", "Contract"], ["right_to_work", "Right to work"], ["dbs", "DBS"], ["qualification", "Qualification"], ["appraisal", "Appraisal"], ["disciplinary", "Disciplinary"], ["other", "Other"]];
  HR.docKindLabel = function (k) { var e = HR.DOC_KINDS.filter(function (x) { return x[0] === k; })[0]; return CC.t(e ? e[1] : k); };
  HR.NOTE_KINDS = [["general", "General note"], ["appraisal", "Appraisal"], ["one_to_one", "One-to-one"], ["return_to_work", "Return to work"]];
  HR.noteKindLabel = function (k) { var e = HR.NOTE_KINDS.filter(function (x) { return x[0] === k; })[0]; return CC.t(e ? e[1] : k); };

  /* ---------- dates (all local, ISO yyyy-mm-dd strings) ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  HR.ymd = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  HR.parse = function (s) { var p = String(s).slice(0, 10).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  HR.addDays = function (s, n) { var d = HR.parse(s); d.setDate(d.getDate() + n); return HR.ymd(d); };
  HR.today = function () { return HR.ymd(new Date()); };
  HR.isWorkingDay = function (s) { var d = HR.parse(s).getDay(); return d !== 0 && d !== 6 && !HR.BANK_HOLIDAYS[s]; };

  // working days (Mon–Fri, excluding bank holidays) between two dates inclusive; halfDay only applies to a single day
  HR.workingDays = function (start, end, halfDay) {
    if (!start || !end || end < start) return 0;
    var n = 0, cur = start, guard = 0;
    while (cur <= end && guard++ < 800) { if (HR.isWorkingDay(cur)) n++; cur = HR.addDays(cur, 1); }
    if (halfDay && start === end && n === 1) return 0.5;
    return n;
  };
  HR.clippedDays = function (l, from, to) {
    var s = l.start_date > from ? l.start_date : from, e = l.end_date < to ? l.end_date : to;
    if (e < s) return 0;
    return HR.workingDays(s, e, l.half_day && l.start_date === l.end_date);
  };

  /* ---------- leave year & balances ---------- */
  HR.leaveYear = function (staff, ref) {
    ref = ref || HR.today();
    var m = staff.leave_year_start_month || 1, r = HR.parse(ref), y = r.getFullYear();
    if (r.getMonth() + 1 < m) y -= 1;
    var start = y + "-" + pad(m) + "-01";
    var end = HR.addDays((y + 1) + "-" + pad(m) + "-01", -1);
    return { start: start, end: end };
  };
  HR.balance = function (staff, leaves, ref) {
    var ly = HR.leaveYear(staff, ref), mine = leaves.filter(function (l) { return l.staff_id === staff.id; });
    function sum(status, type) {
      return mine.filter(function (l) { return l.status === status && l.leave_type === type; })
        .reduce(function (a, l) { return a + HR.clippedDays(l, ly.start, ly.end); }, 0);
    }
    var ent = Number(staff.annual_leave_days) || 0, used = sum("approved", "annual"), pending = sum("pending", "annual");
    return {
      year: ly, entitlement: ent, used: used, pending: pending, remaining: ent - used,
      remainingAfterPending: ent - used - pending,
      sickDays: sum("approved", "sick"),
      sickSpells: mine.filter(function (l) { return l.status === "approved" && l.leave_type === "sick" && l.end_date >= ly.start && l.start_date <= ly.end; }).length
    };
  };
  // Bradford factor over the 52 weeks before `ref`: spells² × total days
  HR.bradford = function (staffId, leaves, ref) {
    ref = ref || HR.today();
    var from = HR.addDays(ref, -364);
    var spells = leaves.filter(function (l) { return l.staff_id === staffId && l.status === "approved" && l.leave_type === "sick" && l.end_date >= from && l.start_date <= ref; });
    var days = spells.reduce(function (a, l) { return a + HR.clippedDays(l, from, ref); }, 0);
    return { spells: spells.length, days: days, score: spells.length * spells.length * days };
  };
  HR.isOffOn = function (l, day) { return l.status === "approved" && l.start_date <= day && l.end_date >= day; };

  /* ---------- staff helpers ---------- */
  HR.initials = function (name) { return String(name || "?").split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase(); };
  HR.avatarHtml = function (staff, urls, size) {
    var url = staff.photo_path && urls ? urls[staff.photo_path] : null;
    var cls = "hr-avatar" + (size ? " hr-avatar-" + size : "");
    if (url) return '<span class="' + cls + '"><img src="' + CC.esc(url) + '" alt="' + CC.esc(staff.full_name) + '"></span>';
    return '<span class="' + cls + ' hr-avatar-init" aria-hidden="true">' + CC.esc(HR.initials(staff.full_name)) + "</span>";
  };
  HR.expiryChip = function (d) {
    if (!d) return '<span class="muted">—</span>';
    var today = HR.today();
    var cls = d < today ? "red" : (d <= HR.addDays(today, 60) ? "amber" : "green");
    return CC.chip(cls, CC.fmtDate(d));
  };

  /* ---------- image resize (profile photos): max 480px JPEG, keeps uploads small ---------- */
  HR.resizeImage = function (file, max) {
    max = max || 480;
    return new Promise(function (resolve) {
      if (!file || !/^image\/(png|jpe?g|webp)$/.test(file.type) || !window.createImageBitmap || !document.createElement("canvas").getContext) { resolve(file); return; }
      var done = function (f) { resolve(f || file); };
      createImageBitmap(file).then(function (bmp) {
        var s = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
        c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
        var ctx = c.getContext("2d"); if (!ctx) return done();
        ctx.drawImage(bmp, 0, 0, c.width, c.height);
        c.toBlob(function (b) { done(b ? new File([b], "photo.jpg", { type: "image/jpeg" }) : null); }, "image/jpeg", 0.85);
      }, function () { done(); });
    });
  };
  HR.fileToDataUrl = function (file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(file); });
  };
})();
