/* Views: HR (site staff directory, leave, calendar, absence), My HR (employee self-service), Group HR (read-only roll-up) */
(function () {
  "use strict";
  var CC = window.CC, S = CC.state, HR = CC.hr, esc = function (s) { return CC.esc(s); }, t = function (s, v) { return CC.t(s, v); };
  var IMG_MAX = 8 * 1024 * 1024, DOC_MAX = 10 * 1024 * 1024;
  var ui = { tab: "people", q: "", leavers: false, cal: null, lf: { person: "", type: "", status: "" } };
  var cache = { staff: [], leaves: [], urls: {} };

  function canWrite() { return ["principal", "practice_manager", "platform_admin"].indexOf(CC.role()) >= 0; }
  function A(action, entity, id, pid, detail) { return CC.api.audit.log(action, entity, id, pid, detail); }
  function isCurrent(s) { return s.active && !(s.end_date && s.end_date < HR.today()); }
  function staffById(id) { return cache.staff.filter(function (s) { return s.id === id; })[0]; }
  function practiceName(pid) { var p = S.practices.filter(function (x) { return x.id === pid; })[0]; return p ? p.name : "—"; }
  function range(l) {
    if (l.start_date === l.end_date) return esc(CC.fmtDate(l.start_date)) + (l.half_day ? " · " + esc(t("half day")) : "");
    return esc(CC.fmtDate(l.start_date)) + " – " + esc(CC.fmtDate(l.end_date));
  }
  function typeDot(k) { return '<span class="hr-dot" style="background:' + HR.typeInfo(k).color + '"></span>' + esc(HR.typeLabel(k)); }
  function monthLabel(y, m) { return new Date(y, m, 1).toLocaleDateString(CC.lang === "cy" ? "cy-GB" : "en-GB", { month: "long", year: "numeric" }); }
  function monthName(i) { return new Date(2000, i, 1).toLocaleDateString(CC.lang === "cy" ? "cy-GB" : "en-GB", { month: "long" }); }
  function offToday(leaves, staff) {
    var d = HR.today(), ids = {};
    leaves.forEach(function (l) { if (HR.isOffOn(l, d)) ids[l.staff_id] = l; });
    return staff.filter(function (s) { return isCurrent(s) && ids[s.id]; }).map(function (s) { return { staff: s, leave: ids[s.id] }; });
  }
  function regAlerts(s) {
    var lim = HR.addDays(HR.today(), 60);
    return [s.gdc_number ? s.gdc_expiry : null, s.gdc_number ? s.indemnity_expiry : null, s.dbs_expiry].filter(function (d) { return d && d <= lim; }).length;
  }
  function load(filter) {
    return Promise.all([CC.api.hr.staff.list(filter), CC.api.hr.leave.list(filter)]).then(function (r) {
      return CC.api.hr.photoUrls(r[0].map(function (s) { return s.photo_path; })).then(function (urls) {
        cache = { staff: r[0], leaves: r[1], urls: urls || {} };
        return cache;
      });
    });
  }
  function kpi(label, value, sub, cls) { return '<div class="kpi ' + (cls || "") + '"><div class="label">' + esc(label) + '</div><div class="value">' + value + '</div><div class="sub">' + sub + "</div></div>"; }
  function person(s) { return '<span class="hr-person">' + HR.avatarHtml(s, cache.urls, "sm") + "<span>" + esc(s.full_name) + "</span></span>"; }

  /* ============================== forms ============================== */
  function staffForm(staff, pid) {
    var s = staff || {}, isNew = !staff;
    var months = []; for (var i = 0; i < 12; i++) months.push({ value: i + 1, label: monthName(i) });
    return CC.modal({
      title: isNew ? t("Add staff member") : t("Edit details"), wide: true, submitLabel: "Save",
      body: '<div class="hr-photo-row">' + HR.avatarHtml(s.id ? s : { full_name: "?" }, cache.urls, "lg") +
        '<div class="field" style="flex:1;margin:0"><label>' + esc(t("Photo")) + '</label><input type="file" name="photo" accept="image/png,image/jpeg,image/webp"><div class="small muted">' + esc(t("JPG or PNG. It is resized automatically.")) + "</div></div></div>" +
        '<div class="field-row"><div class="field"><label>' + esc(t("Full name")) + '</label><input name="full_name" required value="' + esc(s.full_name) + '"></div>' +
        '<div class="field"><label>' + esc(t("Job title")) + '</label><input name="job_title" value="' + esc(s.job_title) + '"></div></div>' +
        '<div class="field-row"><div class="field"><label>' + esc(t("Email")) + '</label><input type="email" name="email" value="' + esc(s.email) + '"><div class="small muted">' + esc(t("Use the email they sign in with, so they can see their own leave.")) + '</div></div>' +
        '<div class="field"><label>' + esc(t("Phone")) + '</label><input name="phone" value="' + esc(s.phone) + '"></div></div>' +
        '<div class="field"><label>' + esc(t("Home address")) + '</label><textarea name="address" rows="2">' + esc(s.address) + "</textarea></div>" +
        '<h4 class="hr-h">' + esc(t("Employment")) + "</h4>" +
        '<div class="field-row"><div class="field"><label>' + esc(t("Start date")) + '</label><input type="date" name="start_date" value="' + esc(s.start_date) + '"></div>' +
        '<div class="field"><label>' + esc(t("Employment type")) + '</label><select name="employment_type">' + CC.options(HR.EMPLOYMENT.map(function (e) { return { value: e[0], label: t(e[1]) }; }), s.employment_type || "permanent") + "</select></div></div>" +
        '<div class="field-row"><div class="field"><label>' + esc(t("Contracted hours per week")) + '</label><input type="number" step="0.5" min="0" max="60" name="contracted_hours" value="' + esc(s.contracted_hours) + '"></div>' +
        '<div class="field"><label>' + esc(t("Annual leave entitlement (days)")) + '</label><input type="number" step="0.5" min="0" max="80" name="annual_leave_days" required value="' + esc(s.annual_leave_days === undefined ? 28 : s.annual_leave_days) + '"></div></div>' +
        '<div class="field-row"><div class="field"><label>' + esc(t("Leave year starts")) + '</label><select name="leave_year_start_month">' + CC.options(months, s.leave_year_start_month || 1) + "</select></div>" +
        '<div class="field"><label>' + esc(t("Status")) + '</label><select name="status">' + CC.options([{ value: "current", label: t("Current employee") }, { value: "left", label: t("Left the practice") }], isCurrent(s) || isNew ? "current" : "left") + "</select></div></div>" +
        '<div class="field"><label>' + esc(t("Leaving date (if they have left)")) + '</label><input type="date" name="end_date" value="' + esc(s.end_date) + '"></div>' +
        '<h4 class="hr-h">' + esc(t("Professional registration")) + "</h4>" +
        '<div class="field-row"><div class="field"><label>' + esc(t("GDC number")) + '</label><input name="gdc_number" value="' + esc(s.gdc_number) + '"></div>' +
        '<div class="field"><label>' + esc(t("GDC registration expiry")) + '</label><input type="date" name="gdc_expiry" value="' + esc(s.gdc_expiry) + '"></div></div>' +
        '<div class="field-row"><div class="field"><label>' + esc(t("Indemnity expiry")) + '</label><input type="date" name="indemnity_expiry" value="' + esc(s.indemnity_expiry) + '"></div>' +
        '<div class="field"><label>' + esc(t("DBS expiry / renewal")) + '</label><input type="date" name="dbs_expiry" value="' + esc(s.dbs_expiry) + '"></div></div>' +
        '<h4 class="hr-h">' + esc(t("Emergency contact")) + "</h4>" +
        '<div class="field-row"><div class="field"><label>' + esc(t("Name")) + '</label><input name="emergency_name" value="' + esc(s.emergency_name) + '"></div>' +
        '<div class="field"><label>' + esc(t("Relationship")) + '</label><input name="emergency_relation" value="' + esc(s.emergency_relation) + '"></div></div>' +
        '<div class="field"><label>' + esc(t("Phone")) + '</label><input name="emergency_phone" value="' + esc(s.emergency_phone) + '"></div>',
      onSubmit: function (d) {
        var photo = d.photo;
        if (photo && (!/^image\//.test(photo.type) || photo.size > IMG_MAX)) throw new Error(t("Please choose a JPG or PNG photo under 8 MB."));
        var left = d.status === "left";
        if (left && !d.end_date) d.end_date = HR.today();
        var row = {
          full_name: d.full_name.trim(), job_title: d.job_title.trim() || null, email: d.email.trim() || null, phone: d.phone.trim() || null, address: d.address.trim() || null,
          start_date: d.start_date || null, end_date: left ? d.end_date : null, employment_type: d.employment_type,
          contracted_hours: d.contracted_hours === "" ? null : Number(d.contracted_hours), annual_leave_days: Number(d.annual_leave_days || 0),
          leave_year_start_month: Number(d.leave_year_start_month), active: !left,
          emergency_name: d.emergency_name.trim() || null, emergency_relation: d.emergency_relation.trim() || null, emergency_phone: d.emergency_phone.trim() || null,
          gdc_number: d.gdc_number.trim() || null, gdc_expiry: d.gdc_expiry || null, indemnity_expiry: d.indemnity_expiry || null, dbs_expiry: d.dbs_expiry || null
        };
        var p = isNew ? CC.api.hr.staff.create(Object.assign({ practice_id: pid }, row)) : CC.api.hr.staff.update(s.id, row);
        return p.then(function (saved) {
          A(isNew ? "hr_staff_create" : "hr_staff_update", "hr_staff", saved.id, saved.practice_id, { name: saved.full_name });
          return photo ? HR.resizeImage(photo, 480).then(function (f) { return CC.api.hr.staff.setPhoto(saved, f); }) : null;
        }).then(function () { CC.toast(t("Saved.")); reopenAfter(isNew ? null : s.id); });
      }
    });
  }

  function leaveForm(opts) {
    // opts: { staff (fixed) | staffList, mode: "record"|"request", leaves, onDone }
    var fixed = opts.staff, mode = opts.mode, types = mode === "request" ? HR.REQUESTABLE : HR.TYPES.map(function (x) { return x.key; });
    var staffOpts = (opts.staffList || []).filter(isCurrent).map(function (s) { return { value: s.id, label: s.full_name }; });
    return CC.modal({
      title: mode === "request" ? t("Request leave") : t("Record leave"), submitLabel: mode === "request" ? "Send request" : "Save",
      body: (fixed ? '<p class="muted" style="margin-top:0">' + esc(fixed.full_name) + "</p>" : '<div class="field"><label>' + esc(t("Staff member")) + '</label><select name="staff_id" required>' + CC.options(staffOpts, "", "Choose…") + "</select></div>") +
        '<div class="field"><label>' + esc(t("Type")) + '</label><select name="leave_type">' + CC.options(types.map(function (k) { return { value: k, label: HR.typeLabel(k) }; }), "annual") + "</select></div>" +
        '<div class="field-row"><div class="field"><label>' + esc(t("First day")) + '</label><input type="date" name="start_date" required value="' + HR.today() + '"></div>' +
        '<div class="field"><label>' + esc(t("Last day")) + '</label><input type="date" name="end_date" required value="' + HR.today() + '"></div></div>' +
        '<div class="checkbox-field field"><label><input type="checkbox" name="half_day" value="1"> ' + esc(t("Half day (single day only)")) + "</label></div>" +
        (mode === "record" ? '<div class="field"><label>' + esc(t("Status")) + '</label><select name="status">' + CC.options([{ value: "approved", label: t("Approved") }, { value: "pending", label: t("Pending") }], "approved") + "</select></div>" : "") +
        '<div class="field"><label>' + esc(t("Notes")) + '</label><textarea name="reason" rows="2"></textarea></div>' +
        '<p class="small muted">' + esc(t("Weekends and bank holidays are not counted.")) + "</p>",
      onSubmit: function (d) {
        var s = fixed || staffById(d.staff_id);
        if (!s) throw new Error(t("Choose a staff member."));
        if (d.end_date < d.start_date) throw new Error(t("The last day must be on or after the first day."));
        var half = !!d.half_day && d.start_date === d.end_date;
        var days = HR.workingDays(d.start_date, d.end_date, half);
        if (!days) throw new Error(t("Those dates contain no working days."));
        var existing = (opts.leaves || cache.leaves).filter(function (l) { return l.staff_id === s.id && (l.status === "approved" || l.status === "pending") && l.start_date <= d.end_date && l.end_date >= d.start_date; });
        if (existing.length) throw new Error(t("These dates overlap existing leave for {name}.", { name: s.full_name }));
        if (mode === "request" && d.leave_type === "annual") {
          var b = HR.balance(s, opts.leaves || cache.leaves);
          if (days > b.remainingAfterPending) throw new Error(t("You only have {n} days of annual leave available.", { n: Math.max(0, b.remainingAfterPending) }));
        }
        var row = { practice_id: s.practice_id, staff_id: s.id, leave_type: d.leave_type, start_date: d.start_date, end_date: d.end_date, half_day: half, days: days, reason: d.reason.trim() || null, status: mode === "request" ? "pending" : (d.status || "approved") };
        return CC.api.hr.leave.create(row).then(function (l) {
          A(mode === "request" ? "hr_leave_request" : "hr_leave_record", "hr_leave", l.id, l.practice_id, { type: l.leave_type, days: days });
          CC.toast(t(mode === "request" ? "Request sent to your manager." : "Leave recorded."));
          if (opts.onDone) opts.onDone(s);
        });
      }
    });
  }

  function declineForm(l, onDone) {
    CC.modal({
      title: t("Decline leave request"), submitLabel: "Decline",
      body: '<p class="muted" style="margin-top:0">' + esc(HR.typeLabel(l.leave_type)) + " · " + range(l) + '</p><div class="field"><label>' + esc(t("Reason (shown to the employee)")) + '</label><textarea name="note" rows="3"></textarea></div>',
      onSubmit: function (d) {
        return CC.api.hr.leave.update(l.id, { status: "declined", manager_note: d.note.trim() || null }).then(function () {
          A("hr_leave_declined", "hr_leave", l.id, l.practice_id, { type: l.leave_type }); CC.toast(t("Request declined.")); if (onDone) onDone();
        });
      }
    });
  }
  function approve(l, onDone) {
    return CC.api.hr.leave.update(l.id, { status: "approved" }).then(function () {
      A("hr_leave_approved", "hr_leave", l.id, l.practice_id, { type: l.leave_type }); CC.toast(t("Request approved.")); if (onDone) onDone();
    }).catch(CC.fail);
  }
  function cancelLeave(l, onDone) {
    return CC.confirm(t("Cancel this leave?")).then(function (ok) {
      if (!ok) return;
      return CC.api.hr.leave.update(l.id, { status: "cancelled" }).then(function () { A("hr_leave_cancelled", "hr_leave", l.id, l.practice_id, {}); CC.toast(t("Leave cancelled.")); if (onDone) onDone(); }).catch(CC.fail);
    });
  }

  /* ============================== staff record modal ============================== */
  var openModal = null;
  function reopenAfter(staffId) {
    if (openModal) { openModal.close(); openModal = null; }
    return CC.render().then(function () { if (staffId) openStaff(staffId, true); });
  }

  function leaveTable(rows, manage, extra) {
    if (!rows.length) return '<div class="empty">' + esc(t("No leave recorded.")) + "</div>";
    return '<div class="table-wrap"><table class="data" style="min-width:560px"><thead><tr><th>' + esc(t("Type")) + "</th><th>" + esc(t("Dates")) + "</th><th>" + esc(t("Days")) + "</th><th>" + esc(t("Status")) + "</th><th>" + esc(t("Notes")) + "</th><th></th></tr></thead><tbody>" +
      rows.map(function (l) {
        var acts = "";
        if (manage && l.status === "pending") acts = '<button type="button" class="btn btn-primary btn-sm" data-act="approve" data-id="' + l.id + '">' + esc(t("Approve")) + '</button> <button type="button" class="btn btn-danger btn-sm" data-act="decline" data-id="' + l.id + '">' + esc(t("Decline")) + "</button>";
        else if (manage && l.status === "approved" && l.end_date >= HR.today()) acts = '<button type="button" class="btn btn-secondary btn-sm" data-act="cancel" data-id="' + l.id + '">' + esc(t("Cancel")) + "</button>";
        else if (!manage && extra === "own" && l.status === "pending") acts = '<button type="button" class="btn btn-secondary btn-sm" data-act="cancel" data-id="' + l.id + '">' + esc(t("Cancel")) + "</button>";
        return "<tr><td>" + typeDot(l.leave_type) + "</td><td>" + range(l) + "</td><td>" + l.days + "</td><td>" + HR.statusChip(l.status) + '</td><td class="small">' + esc([l.reason, l.manager_note].filter(Boolean).join(" — ")) + '</td><td class="actions-cell">' + acts + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }
  function balanceCards(b) {
    return '<div class="grid-kpi hr-bal">' +
      kpi(t("Entitlement"), b.entitlement, esc(t("days this leave year"))) +
      kpi(t("Taken"), b.used, esc(t("approved days"))) +
      kpi(t("Pending"), b.pending, esc(t("awaiting approval"))) +
      kpi(t("Remaining"), b.remaining, esc(CC.fmtDate(b.year.start)) + " – " + esc(CC.fmtDate(b.year.end)), b.remaining < 0 ? "red" : "green") + "</div>";
  }

  function openStaff(id, silent) {
    var s = staffById(id); if (!s) return;
    var manage = canWrite(), isSelf = S.profile && s.email && s.email.toLowerCase() === (S.profile.email || "").toLowerCase();
    if (!silent && !isSelf) A("view_hr_record", "hr_staff", s.id, s.practice_id, { name: s.full_name });
    Promise.all([CC.api.hr.leave.list({ staff_id: s.id }), CC.api.hr.docs.list(s.id), CC.api.hr.notes.list(s.id)]).then(function (r) {
      var leaves = r[0], docs = r[1], notes = r[2], b = HR.balance(s, leaves), br = HR.bradford(s.id, leaves);
      function dl(label, val) { return "<dt>" + esc(t(label)) + "</dt><dd>" + (val === null || val === undefined || val === "" ? "—" : val) + "</dd>"; }
      var details = '<dl class="hr-dl">' +
        dl("Email", esc(s.email)) + dl("Phone", esc(s.phone)) + dl("Home address", esc(s.address)) +
        dl("Start date", esc(CC.fmtDate(s.start_date))) + dl("Employment type", esc(HR.empLabel(s.employment_type))) +
        dl("Contracted hours per week", esc(s.contracted_hours)) + dl("Leave year starts", esc(monthName((s.leave_year_start_month || 1) - 1))) +
        (s.end_date ? dl("Leaving date (if they have left)", esc(CC.fmtDate(s.end_date))) : "") +
        dl("GDC number", esc(s.gdc_number)) + dl("GDC registration expiry", s.gdc_number ? HR.expiryChip(s.gdc_expiry) : "—") +
        dl("Indemnity expiry", s.gdc_number ? HR.expiryChip(s.indemnity_expiry) : "—") + dl("DBS expiry / renewal", HR.expiryChip(s.dbs_expiry)) +
        dl("Emergency contact", esc([s.emergency_name, s.emergency_relation].filter(Boolean).join(" · ")) + (s.emergency_phone ? "<br>" + esc(s.emergency_phone) : "")) + "</dl>";
      var leavePanel = balanceCards(b) +
        '<p class="small muted">' + esc(t("Sickness in this leave year: {d} days over {n} spells. Bradford factor (52 weeks): {s}.", { d: b.sickDays, n: b.sickSpells, s: br.score })) + "</p>" + leaveTable(leaves, manage);
      var docPanel = (manage ? '<div class="actions" style="margin-bottom:10px"><button type="button" class="btn btn-secondary btn-sm" data-act="adddoc">+ ' + esc(t("Add document")) + "</button></div>" : "") +
        (docs.length ? '<ul class="list">' + docs.map(function (d) {
          return "<li><span><strong>" + esc(d.title) + '</strong><div class="sub">' + esc(HR.docKindLabel(d.kind)) + " · " + esc(d.file_name || "") + " · " + esc(CC.fmtDate(d.created_at)) + '</div></span><span class="actions"><button type="button" class="btn btn-secondary btn-sm" data-act="opendoc" data-id="' + d.id + '">' + esc(t("View")) + "</button>" +
            (manage ? '<button type="button" class="btn btn-danger btn-sm" data-act="deldoc" data-id="' + d.id + '">' + esc(t("Delete")) + "</button>" : "") + "</span></li>";
        }).join("") + "</ul>" : '<div class="empty">' + esc(t("No documents yet.")) + "</div>");
      var notePanel = (manage ? '<div class="actions" style="margin-bottom:10px"><button type="button" class="btn btn-secondary btn-sm" data-act="addnote">+ ' + esc(t("Add note")) + "</button></div>" : "") +
        (notes.length ? '<ul class="list">' + notes.map(function (n) {
          return '<li style="align-items:flex-start"><span><strong>' + esc(HR.noteKindLabel(n.kind)) + '</strong> <span class="sub">· ' + esc(CC.fmtDate(n.note_date)) + '</span><div style="white-space:pre-wrap">' + esc(n.body) + "</div></span></li>";
        }).join("") + "</ul>" : '<div class="empty">' + esc(t("No notes yet.")) + "</div>") +
        '<p class="small muted">' + esc(t("Notes cannot be edited or deleted once saved.")) + "</p>";
      var tabs = [["details", t("Details"), details], ["leave", t("Leave"), leavePanel], ["docs", t("Documents"), docPanel], ["notes", t("Notes"), notePanel]];
      var head = '<div class="hr-head">' + HR.avatarHtml(s, cache.urls, "xl") + '<div style="flex:1;min-width:0"><div class="hr-name">' + esc(s.full_name) + '</div><div class="muted">' + esc(s.job_title || "") + " · " + esc(practiceName(s.practice_id)) + "</div>" +
        '<div style="margin-top:6px">' + (isCurrent(s) ? CC.chip("green", t("Current")) : CC.chip("grey", t("Left"))) + " " + CC.chip("blue", HR.empLabel(s.employment_type)) + "</div></div>" +
        (manage ? '<div class="actions"><button type="button" class="btn btn-secondary btn-sm" data-act="edit">' + esc(t("Edit details")) + '</button><button type="button" class="btn btn-secondary btn-sm" data-act="recordleave">' + esc(t("Record leave")) + "</button></div>" : "") + "</div>";
      var m = CC.modal({
        title: s.full_name, wide: true, hideSubmit: true,
        body: head + '<div class="tabs hr-tabs">' + tabs.map(function (x, i) { return '<button type="button" data-ptab="' + x[0] + '" class="' + (i === 0 ? "active" : "") + '">' + esc(x[1]) + "</button>"; }).join("") + "</div>" +
          tabs.map(function (x, i) { return '<div data-panel="' + x[0] + '"' + (i ? " hidden" : "") + ">" + x[2] + "</div>"; }).join("")
      });
      openModal = m;
      m.el.addEventListener("click", function (e) {
        var tb = e.target.closest("[data-ptab]");
        if (tb) {
          m.el.querySelectorAll("[data-ptab]").forEach(function (b2) { b2.classList.toggle("active", b2 === tb); });
          m.el.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== tb.getAttribute("data-ptab"); });
          return;
        }
        var btn = e.target.closest("[data-act]"); if (!btn) return;
        var act = btn.getAttribute("data-act"), lid = btn.getAttribute("data-id");
        var l = leaves.filter(function (x) { return x.id === lid; })[0], d = docs.filter(function (x) { return x.id === lid; })[0];
        var done = function () { reopenAfter(s.id); };
        if (act === "edit") staffForm(s, s.practice_id);
        else if (act === "recordleave") leaveForm({ staff: s, mode: "record", leaves: leaves, onDone: done });
        else if (act === "approve") approve(l, done);
        else if (act === "decline") declineForm(l, done);
        else if (act === "cancel") cancelLeave(l, done);
        else if (act === "adddoc") docForm(s, done);
        else if (act === "addnote") noteForm(s, done);
        else if (act === "opendoc") { A("view_hr_document", "hr_document", d.id, d.practice_id, { title: d.title }); CC.api.hr.docs.url(d.file_path).then(function (u) { window.open(u, "_blank", "noopener"); }).catch(CC.fail); }
        else if (act === "deldoc") CC.confirm(t("Delete this document? This cannot be undone.")).then(function (ok) {
          if (ok) CC.api.hr.docs.remove(d).then(function () { A("hr_document_delete", "hr_document", d.id, d.practice_id, { title: d.title }); CC.toast(t("Document deleted.")); done(); }).catch(CC.fail);
        });
      });
    }).catch(CC.fail);
  }
  function docForm(s, done) {
    CC.modal({
      title: t("Add document"), submitLabel: "Upload",
      body: '<div class="field"><label>' + esc(t("Title")) + '</label><input name="title" required></div>' +
        '<div class="field"><label>' + esc(t("Type")) + '</label><select name="kind">' + CC.options(HR.DOC_KINDS.map(function (k) { return { value: k[0], label: t(k[1]) }; }), "contract") + "</select></div>" +
        '<div class="field"><label>' + esc(t("File")) + '</label><input type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.docx"></div>',
      onSubmit: function (d) {
        var f = d.file; if (!f) throw new Error(t("Please choose a file."));
        if (f.size > DOC_MAX) throw new Error(t("File is larger than 10 MB."));
        if (!/\.(pdf|png|jpe?g|docx)$/i.test(f.name)) throw new Error(t("Please upload a PDF, PNG, JPG or DOCX file."));
        return CC.api.hr.docs.add({ practice_id: s.practice_id, staff_id: s.id, kind: d.kind, title: d.title.trim() }, f).then(function (row) {
          A("hr_document_add", "hr_document", row.id, s.practice_id, { title: row.title }); CC.toast(t("Document added.")); done();
        });
      }
    });
  }
  function noteForm(s, done) {
    CC.modal({
      title: t("Add note"), submitLabel: "Save",
      body: '<div class="field-row"><div class="field"><label>' + esc(t("Type")) + '</label><select name="kind">' + CC.options(HR.NOTE_KINDS.map(function (k) { return { value: k[0], label: t(k[1]) }; }), "general") + "</select></div>" +
        '<div class="field"><label>' + esc(t("Date")) + '</label><input type="date" name="note_date" value="' + HR.today() + '" required></div></div>' +
        '<div class="field"><label>' + esc(t("Note")) + '</label><textarea name="body" rows="5" required></textarea></div>',
      onSubmit: function (d) {
        return CC.api.hr.notes.add({ practice_id: s.practice_id, staff_id: s.id, kind: d.kind, note_date: d.note_date, body: d.body.trim() }).then(function (n) {
          A("hr_note_add", "hr_note", n.id, s.practice_id, { kind: n.kind }); CC.toast(t("Note saved.")); done();
        });
      }
    });
  }

  /* ============================== HR (one site) ============================== */
  function peopleTab(manage) {
    var q = ui.q.toLowerCase();
    var offMap = {}; offToday(cache.leaves, cache.staff).forEach(function (o) { offMap[o.staff.id] = o.leave; });
    var rows = cache.staff.filter(function (s) { return (ui.leavers || isCurrent(s)) && (!q || (s.full_name + " " + (s.job_title || "")).toLowerCase().indexOf(q) >= 0); });
    return '<div class="filters"><input type="search" id="hr-q" placeholder="' + esc(t("Search by name or job title")) + '" value="' + esc(ui.q) + '" style="min-width:220px">' +
      '<label class="small" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="hr-leavers"' + (ui.leavers ? " checked" : "") + "> " + esc(t("Show people who have left")) + "</label></div>" +
      (rows.length ? '<div class="hr-grid">' + rows.map(function (s) {
        var b = HR.balance(s, cache.leaves), off = offMap[s.id];
        return '<button type="button" class="hr-card" data-act="open" data-id="' + s.id + '">' + HR.avatarHtml(s, cache.urls, "lg") +
          '<div class="hr-card-name">' + esc(s.full_name) + '</div><div class="hr-card-sub">' + esc(s.job_title || "—") + "</div>" +
          '<div class="hr-card-chips">' + (off ? CC.chip("amber", t("Off today")) : "") + (!isCurrent(s) ? CC.chip("grey", t("Left")) : "") + (regAlerts(s) ? CC.chip("red", t("Check expiry dates")) : "") + "</div>" +
          '<div class="hr-card-foot">' + esc(t("{n} days leave left", { n: b.remaining })) + "</div></button>";
      }).join("") + "</div>" : '<div class="empty">' + esc(t("No staff records yet.")) + (manage ? " " + esc(t("Use “Add staff member” to start.")) : "") + "</div>");
  }

  function pendingTable(rows, manage) {
    if (!rows.length) return '<div class="empty">' + esc(t("No requests waiting for a decision.")) + "</div>";
    return '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Name")) + "</th><th>" + esc(t("Type")) + "</th><th>" + esc(t("Dates")) + "</th><th>" + esc(t("Days")) + "</th><th>" + esc(t("Notes")) + "</th><th></th></tr></thead><tbody>" + rows.map(function (l) {
      var s = staffById(l.staff_id) || { full_name: "—" }, b = s.id ? HR.balance(s, cache.leaves) : null;
      return "<tr><td>" + person(s) + "</td><td>" + typeDot(l.leave_type) + "</td><td>" + range(l) + "</td><td>" + l.days + (b && l.leave_type === "annual" ? '<div class="small muted">' + esc(t("{n} left", { n: b.remaining })) + "</div>" : "") + '</td><td class="small">' + esc(l.reason || "") + '</td><td class="actions-cell">' +
        (manage ? '<button type="button" class="btn btn-primary btn-sm" data-act="approve" data-id="' + l.id + '">' + esc(t("Approve")) + '</button> <button type="button" class="btn btn-danger btn-sm" data-act="decline" data-id="' + l.id + '">' + esc(t("Decline")) + "</button>" : "") + "</td></tr>";
    }).join("") + "</tbody></table></div>";
  }
  function leaveTab(manage) {
    var f = ui.lf, pend = cache.leaves.filter(function (l) { return l.status === "pending"; }).sort(function (a, b) { return a.start_date.localeCompare(b.start_date); });
    var rows = cache.leaves.filter(function (l) { return (!f.person || l.staff_id === f.person) && (!f.type || l.leave_type === f.type) && (!f.status || l.status === f.status); }).slice(0, 300);
    return '<div class="panel" style="box-shadow:none;margin-bottom:14px"><h3>' + esc(t("Waiting for a decision")) + " (" + pend.length + ")</h3>" + pendingTable(pend, manage) + "</div>" +
      '<h3 style="margin:18px 0 10px">' + esc(t("All leave")) + "</h3>" +
      '<div class="filters"><select id="lf-person">' + CC.options(cache.staff.map(function (s) { return { value: s.id, label: s.full_name }; }), f.person, "Everyone") + "</select>" +
      '<select id="lf-type">' + CC.options(HR.TYPES.map(function (x) { return { value: x.key, label: HR.typeLabel(x.key) }; }), f.type, "All types") + "</select>" +
      '<select id="lf-status">' + CC.options(["pending", "approved", "declined", "cancelled"].map(function (x) { return { value: x, label: t(HR.STATUS_LABEL[x]) }; }), f.status, "All statuses") + "</select></div>" +
      (rows.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Name")) + "</th><th>" + esc(t("Type")) + "</th><th>" + esc(t("Dates")) + "</th><th>" + esc(t("Days")) + "</th><th>" + esc(t("Status")) + "</th><th>" + esc(t("Notes")) + "</th></tr></thead><tbody>" +
        rows.map(function (l) { var s = staffById(l.staff_id) || { full_name: "—" }; return "<tr><td>" + person(s) + "</td><td>" + typeDot(l.leave_type) + "</td><td>" + range(l) + "</td><td>" + l.days + "</td><td>" + HR.statusChip(l.status) + '</td><td class="small">' + esc([l.reason, l.manager_note].filter(Boolean).join(" — ")) + "</td></tr>"; }).join("") + "</tbody></table></div>"
        : '<div class="empty">' + esc(t("No leave recorded.")) + "</div>");
  }

  function calendarGrid(entries, legend) {
    var now = new Date(), c = ui.cal || (ui.cal = { y: now.getFullYear(), m: now.getMonth() });
    var first = new Date(c.y, c.m, 1), startDow = (first.getDay() + 6) % 7, days = new Date(c.y, c.m + 1, 0).getDate(), today = HR.today();
    var h = '<div class="cal-head"><button type="button" class="btn btn-secondary btn-sm" data-act="calprev" aria-label="' + esc(t("Previous month")) + '">‹</button><strong>' + esc(monthLabel(c.y, c.m)) + '</strong><button type="button" class="btn btn-secondary btn-sm" data-act="calnext" aria-label="' + esc(t("Next month")) + '">›</button><button type="button" class="btn btn-secondary btn-sm" data-act="caltoday">' + esc(t("Today")) + "</button></div>";
    var wd = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return new Date(2024, 0, 1 + i).toLocaleDateString(CC.lang === "cy" ? "cy-GB" : "en-GB", { weekday: "short" }); });
    h += '<div class="cal">' + wd.map(function (w) { return '<div class="cal-dow">' + esc(w) + "</div>"; }).join("");
    for (var i = 0; i < startDow; i++) h += '<div class="cal-cell cal-empty"></div>';
    for (var d = 1; d <= days; d++) {
      var iso = c.y + "-" + (c.m + 1 < 10 ? "0" : "") + (c.m + 1) + "-" + (d < 10 ? "0" : "") + d;
      var dow = (startDow + d - 1) % 7, here = entries.filter(function (e) { return e.start <= iso && e.end >= iso; });
      var bh = HR.BANK_HOLIDAYS[iso];
      h += '<div class="cal-cell' + (dow > 4 ? " cal-we" : "") + (iso === today ? " cal-today" : "") + (bh ? " cal-bh" : "") + '"' + (bh ? ' title="' + esc(bh) + '"' : "") + '><div class="cal-d">' + d + (bh ? ' <span class="cal-bhl">' + esc(t("Bank holiday")) + "</span>" : "") + "</div>" +
        here.slice(0, 3).map(function (e) { return '<div class="cal-ev' + (e.pending ? " cal-pend" : "") + '" style="background:' + e.color + '" title="' + esc(e.title) + '">' + esc(e.label) + "</div>"; }).join("") +
        (here.length > 3 ? '<div class="cal-more" title="' + esc(here.slice(3).map(function (e) { return e.title; }).join(", ")) + '">+' + (here.length - 3) + "</div>" : "") + "</div>";
    }
    h += "</div>" + (legend || "");
    return h;
  }
  function calendarTab() {
    var entries = cache.leaves.filter(function (l) { return l.status === "approved" || l.status === "pending"; }).map(function (l) {
      var s = staffById(l.staff_id) || { full_name: "?" };
      return { start: l.start_date, end: l.end_date, label: HR.firstName(s.full_name) + (l.half_day ? " ½" : ""), title: s.full_name + " — " + HR.typeLabel(l.leave_type) + (l.status === "pending" ? " (" + t("Pending") + ")" : ""), color: HR.typeInfo(l.leave_type).color, pending: l.status === "pending" };
    });
    var legend = '<div class="cal-legend">' + HR.TYPES.map(function (x) { return '<span><span class="hr-dot" style="background:' + x.color + '"></span>' + esc(HR.typeLabel(x.key)) + "</span>"; }).join("") + "<span>" + esc(t("Faded = pending")) + "</span></div>";
    return calendarGrid(entries, legend);
  }

  function absenceRows() {
    var today = HR.today(), from = HR.addDays(today, -364);
    return cache.staff.filter(isCurrent).map(function (s) {
      var br = HR.bradford(s.id, cache.leaves), sick = cache.leaves.filter(function (l) { return l.staff_id === s.id && l.status === "approved" && l.leave_type === "sick" && l.end_date >= from && l.start_date <= today; });
      var longTerm = sick.some(function (l) { return (HR.parse(l.end_date) - HR.parse(l.start_date)) / 86400000 + 1 >= 28; });
      var fam = cache.leaves.filter(function (l) { return l.staff_id === s.id && l.status === "approved" && HR.typeInfo(l.leave_type).group === "family" && l.end_date >= today; }).sort(function (a, b) { return a.start_date.localeCompare(b.start_date); })[0];
      return { s: s, br: br, longTerm: longTerm, fam: fam };
    }).sort(function (a, b) { return b.br.score - a.br.score; });
  }
  function absenceTab() {
    var rows = absenceRows(), cur = cache.staff.filter(isCurrent).length, from = HR.addDays(HR.today(), -364);
    var totalSick = rows.reduce(function (a, r) { return a + r.br.days; }, 0), avail = cur * HR.workingDays(from, HR.today(), false) || 1;
    return '<div class="grid-kpi" style="grid-template-columns:repeat(3,1fr)">' + kpi(t("Sickness days (12 months)"), totalSick, esc(t("across {n} staff", { n: cur }))) +
      kpi(t("Sickness absence rate"), (totalSick / avail * 100).toFixed(1) + "%", esc(t("of available working days"))) +
      kpi(t("Currently off sick"), offToday(cache.leaves.filter(function (l) { return l.leave_type === "sick"; }), cache.staff).length, esc(t("today"))) + "</div>" +
      '<div class="actions" style="margin-bottom:10px"><button type="button" class="btn btn-secondary btn-sm" data-act="csvabs">' + esc(t("Export CSV")) + "</button></div>" +
      '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Name")) + "</th><th>" + esc(t("Sick days")) + "</th><th>" + esc(t("Spells")) + "</th><th>" + esc(t("Bradford factor")) + "</th><th>" + esc(t("Flags")) + "</th><th>" + esc(t("Family leave")) + "</th></tr></thead><tbody>" +
      rows.map(function (r) {
        var bf = r.br.score, cls = bf >= 400 ? "red" : (bf >= 125 ? "amber" : "green");
        return '<tr><td><a href="#" data-act="open" data-id="' + r.s.id + '">' + person(r.s) + "</a></td><td>" + r.br.days + "</td><td>" + r.br.spells + "</td><td>" + CC.chip(cls, String(bf)) + "</td><td>" + (r.longTerm ? CC.chip("red", t("Long-term")) : "") + (r.br.spells >= 4 ? " " + CC.chip("amber", t("Frequent short spells")) : "") +
          "</td><td>" + (r.fam ? typeDot(r.fam.leave_type) + '<div class="small muted">' + esc(CC.fmtDate(r.fam.start_date)) + " – " + esc(CC.fmtDate(r.fam.end_date)) + "</div>" : "—") + "</td></tr>";
      }).join("") + '</tbody></table></div><p class="small muted">' + esc(t("Bradford factor = spells × spells × total days over 52 weeks. It is a prompt for a conversation, not a disciplinary trigger on its own.")) + "</p>";
  }

  CC.views.hr = function (el) {
    var pid = S.practiceId, manage = canWrite();
    if (!pid) { el.innerHTML = '<div class="empty">' + esc(t("No practice selected.")) + "</div>"; return; }
    return load({ practice_id: pid }).then(function () {
      var cur = cache.staff.filter(isCurrent), off = offToday(cache.leaves, cache.staff), pend = cache.leaves.filter(function (l) { return l.status === "pending"; }).length;
      var alerts = cur.filter(function (s) { return regAlerts(s) > 0; }).length;
      el.innerHTML =
        '<div class="page-head"><div><h1>' + esc(t("HR")) + '</h1><p class="muted">' + esc(practiceName(pid)) + " · " + esc(t("Staff records, leave and absence.")) + "</p></div>" +
        (manage ? '<div class="actions"><button type="button" class="btn btn-secondary" data-act="recordleave">' + esc(t("Record leave")) + '</button><button type="button" class="btn btn-primary" data-act="addstaff">+ ' + esc(t("Add staff member")) + "</button></div>" : "") + "</div>" +
        (!manage ? '<div class="banner info"><span>' + esc(t("You are viewing HR read-only. Each record you open is recorded in the audit log.")) + "</span></div>" : "") +
        '<div class="grid-kpi">' + kpi(t("Staff"), cur.length, esc(t("current employees"))) + kpi(t("Off today"), off.length, off.length ? esc(off.map(function (o) { return HR.firstName(o.staff.full_name); }).slice(0, 3).join(", ")) : esc(t("Everyone is in"))) +
        kpi(t("Awaiting approval"), pend, esc(t("leave requests")), pend ? "amber" : "") + kpi(t("Expiry alerts"), alerts, esc(t("GDC, indemnity or DBS within 60 days")), alerts ? "red" : "green") + "</div>" +
        '<div class="panel"><div class="tabs hr-tabs" id="hr-tabs">' + [["people", "People"], ["leave", "Leave requests"], ["calendar", "Calendar"], ["absence", "Absence"]].map(function (x) { return '<button type="button" data-tab="' + x[0] + '" class="' + (ui.tab === x[0] ? "active" : "") + '">' + esc(t(x[1])) + "</button>"; }).join("") + '</div><div id="hr-body"></div></div>';
      function body() { return el.querySelector("#hr-body"); }
      function draw() {
        el.querySelectorAll("#hr-tabs button").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-tab") === ui.tab); });
        body().innerHTML = ui.tab === "people" ? peopleTab(manage) : ui.tab === "leave" ? leaveTab(manage) : ui.tab === "calendar" ? calendarTab() : absenceTab();
        var q = el.querySelector("#hr-q");
        if (q) q.oninput = function () { ui.q = q.value; var pos = q.selectionStart; draw(); var q2 = el.querySelector("#hr-q"); q2.focus(); try { q2.setSelectionRange(pos, pos); } catch (e) {} };
        var lv = el.querySelector("#hr-leavers"); if (lv) lv.onchange = function () { ui.leavers = lv.checked; draw(); };
        ["person", "type", "status"].forEach(function (k) { var x = el.querySelector("#lf-" + k); if (x) x.onchange = function () { ui.lf[k] = x.value; draw(); }; });
      }
      draw();
      el.onclick = function (e) {
        var tb = e.target.closest("[data-tab]"); if (tb && tb.parentNode.id === "hr-tabs") { ui.tab = tb.getAttribute("data-tab"); draw(); return; }
        var b = e.target.closest("[data-act]"); if (!b) return;
        if (b.tagName === "A") e.preventDefault();
        var act = b.getAttribute("data-act"), id = b.getAttribute("data-id"), l = cache.leaves.filter(function (x) { return x.id === id; })[0];
        var reload = function () { CC.render(); };
        if (act === "open") openStaff(id);
        else if (act === "addstaff") staffForm(null, pid);
        else if (act === "recordleave") leaveForm({ staffList: cache.staff, mode: "record", onDone: reload });
        else if (act === "approve") approve(l, reload);
        else if (act === "decline") declineForm(l, reload);
        else if (act === "calprev") { ui.cal.m--; if (ui.cal.m < 0) { ui.cal.m = 11; ui.cal.y--; } draw(); }
        else if (act === "calnext") { ui.cal.m++; if (ui.cal.m > 11) { ui.cal.m = 0; ui.cal.y++; } draw(); }
        else if (act === "caltoday") { ui.cal = null; draw(); }
        else if (act === "csvabs") {
          CC.csv([[t("Name"), t("Sick days"), t("Spells"), t("Bradford factor")]].concat(absenceRows().map(function (r) { return [r.s.full_name, r.br.days, r.br.spells, r.br.score]; })), "absence-" + HR.today() + ".csv");
          A("hr_export_absence", "hr_leave", "", pid, {});
        }
      };
    });
  };

  /* ============================== My HR (employee self-service) ============================== */
  CC.views.myhr = function (el) {
    var me = S.profile;
    return CC.api.hr.staff.mine(me.email, me.practice_id).then(function (rec) {
      if (!rec) { el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("My HR")) + '</h1></div></div><div class="panel"><div class="empty">' + esc(t("Your HR record has not been set up yet. Ask your manager to add you, using the email address you sign in with.")) + "</div></div>"; return; }
      var from = HR.today(), to = HR.addDays(from, 56);
      return Promise.all([CC.api.hr.leave.list({ staff_id: rec.id }), CC.api.hr.whosOff(rec.practice_id, from, to), CC.api.hr.photoUrls([rec.photo_path])]).then(function (r) {
        var leaves = r[0], team = r[1], urls = r[2] || {}; cache = { staff: [rec], leaves: leaves, urls: urls };
        var b = HR.balance(rec, leaves), upcoming = leaves.filter(function (l) { return l.status !== "cancelled" && l.end_date >= from; }).sort(function (x, y) { return x.start_date.localeCompare(y.start_date); });
        var past = leaves.filter(function (l) { return !(l.status !== "cancelled" && l.end_date >= from); });
        function dl(label, val) { return "<dt>" + esc(t(label)) + "</dt><dd>" + (val === null || val === undefined || val === "" ? "—" : val) + "</dd>"; }
        var others = team.filter(function (x) { return x.staff_id !== rec.id; });
        el.innerHTML =
          '<div class="page-head"><div><h1>' + esc(t("My HR")) + '</h1><p class="muted">' + esc(practiceName(rec.practice_id) !== "—" ? practiceName(rec.practice_id) : "") + "</p></div>" +
          '<div class="actions"><button type="button" class="btn btn-primary" data-act="request">+ ' + esc(t("Request leave")) + "</button></div></div>" +
          '<div class="panel"><div class="hr-head">' + HR.avatarHtml(rec, urls, "xl") + '<div><div class="hr-name">' + esc(rec.full_name) + '</div><div class="muted">' + esc(rec.job_title || "") + "</div></div></div></div>" +
          balanceCards(b) +
          '<div class="cols-2"><div class="panel"><h3>' + esc(t("My leave")) + "</h3>" + leaveTable(upcoming.concat(past), false, "own") + "</div>" +
          '<div><div class="panel"><h3>' + esc(t("Who is off in the next 8 weeks")) + "</h3>" + (others.length ? '<ul class="list">' + others.map(function (x) { return "<li><span>" + esc(x.full_name) + '</span><span class="sub">' + esc(CC.fmtDate(x.start_date)) + (x.start_date !== x.end_date ? " – " + esc(CC.fmtDate(x.end_date)) : "") + "</span></li>"; }).join("") + "</ul>" : '<div class="empty">' + esc(t("Nobody is off.")) + "</div>") + "</div>" +
          '<div class="panel"><h3>' + esc(t("My details")) + '</h3><dl class="hr-dl">' + dl("Email", esc(rec.email)) + dl("Phone", esc(rec.phone)) + dl("Start date", esc(CC.fmtDate(rec.start_date))) + dl("Employment type", esc(HR.empLabel(rec.employment_type))) + dl("Contracted hours per week", esc(rec.contracted_hours)) +
          dl("GDC number", esc(rec.gdc_number)) + dl("GDC registration expiry", rec.gdc_number ? HR.expiryChip(rec.gdc_expiry) : "—") + dl("DBS expiry / renewal", HR.expiryChip(rec.dbs_expiry)) + '</dl><p class="small muted">' + esc(t("To change your details, ask your manager.")) + "</p></div></div></div>";
        el.onclick = function (e) {
          var btn = e.target.closest("[data-act]"); if (!btn) return;
          var act = btn.getAttribute("data-act"), l = leaves.filter(function (x) { return x.id === btn.getAttribute("data-id"); })[0];
          if (act === "request") leaveForm({ staff: rec, mode: "request", leaves: leaves, onDone: function () { CC.render(); } });
          else if (act === "cancel") cancelLeave(l, function () { CC.render(); });
        };
      });
    });
  };

  /* ============================== Group HR (read-only roll-up) ============================== */
  CC.views.hrgroup = function (el) {
    return load({}).then(function () {
      var today = HR.today(), from90 = HR.addDays(today, -89), q = { v: "", p: "" };
      var byP = {};
      S.practices.forEach(function (p) { byP[p.id] = { p: p, staff: [], pending: 0, sick: 0, alerts: 0, off: 0 }; });
      cache.staff.forEach(function (s) { if (byP[s.practice_id] && isCurrent(s)) { byP[s.practice_id].staff.push(s); byP[s.practice_id].alerts += regAlerts(s) ? 1 : 0; } });
      cache.leaves.forEach(function (l) {
        var r = byP[l.practice_id]; if (!r) return;
        if (l.status === "pending") r.pending++;
        if (l.status === "approved" && l.leave_type === "sick") r.sick += HR.clippedDays(l, from90, today);
      });
      offToday(cache.leaves, cache.staff).forEach(function (o) { if (byP[o.staff.practice_id]) byP[o.staff.practice_id].off++; });
      var list = Object.keys(byP).map(function (k) { return byP[k]; }).sort(function (a, b) { return a.p.name.localeCompare(b.p.name); });
      var avail = HR.workingDays(from90, today, false) || 1;
      function rate(r) { return r.staff.length ? r.sick / (r.staff.length * avail) * 100 : 0; }
      var totals = list.reduce(function (a, r) { a.staff += r.staff.length; a.off += r.off; a.pending += r.pending; a.sick += r.sick; a.alerts += r.alerts; return a; }, { staff: 0, off: 0, pending: 0, sick: 0, alerts: 0 });
      var next = (function () {
        var to = HR.addDays(today, 14);
        return cache.leaves.filter(function (l) { return l.status === "approved" && l.start_date <= to && l.end_date >= today; }).map(function (l) { return { l: l, s: staffById(l.staff_id) }; }).filter(function (x) { return x.s; }).sort(function (a, b) { return a.l.start_date.localeCompare(b.l.start_date); }).slice(0, 25);
      })();
      el.innerHTML =
        '<div class="page-head"><div><h1>' + esc(t("Group HR")) + '</h1><p class="muted">' + esc(t("Staffing, leave and absence across your practices. Read-only — each record you open is recorded in the audit log.")) + "</p></div>" +
        '<div class="actions"><button type="button" class="btn btn-secondary btn-sm" data-act="csv">' + esc(t("Export CSV")) + "</button></div></div>" +
        '<div class="grid-kpi">' + kpi(t("Staff across the group"), totals.staff, esc(t("{n} practices", { n: list.length }))) + kpi(t("Off today"), totals.off, esc(t("across all sites"))) +
        kpi(t("Awaiting approval"), totals.pending, esc(t("leave requests")), totals.pending ? "amber" : "") + kpi(t("Sickness absence rate"), (totals.staff ? totals.sick / (totals.staff * avail) * 100 : 0).toFixed(1) + "%", esc(t("last 90 days")), "") + "</div>" +
        '<div class="panel"><h3>' + esc(t("By practice")) + '</h3><div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Practice")) + "</th><th>" + esc(t("Staff")) + "</th><th>" + esc(t("Off today")) + "</th><th>" + esc(t("Awaiting approval")) + "</th><th>" + esc(t("Sick days (90 days)")) + "</th><th>" + esc(t("Absence rate")) + "</th><th>" + esc(t("Expiry alerts")) + "</th><th></th></tr></thead><tbody>" +
        list.map(function (r) { var rt = rate(r); return "<tr><td><strong>" + esc(r.p.name) + "</strong></td><td>" + r.staff.length + "</td><td>" + r.off + "</td><td>" + (r.pending ? CC.chip("amber", String(r.pending)) : "0") + "</td><td>" + r.sick + "</td><td>" + CC.chip(rt >= 5 ? "red" : (rt >= 3 ? "amber" : "green"), rt.toFixed(1) + "%") + "</td><td>" + (r.alerts ? CC.chip("red", String(r.alerts)) : "0") + '</td><td class="actions-cell"><button type="button" class="btn btn-secondary btn-sm" data-act="site" data-id="' + r.p.id + '">' + esc(t("Open site HR")) + "</button></td></tr>"; }).join("") + "</tbody></table></div></div>" +
        '<div class="cols-2"><div class="panel"><h3>' + esc(t("Who is off in the next 14 days")) + "</h3>" + (next.length ? '<ul class="list">' + next.map(function (x) { return "<li><span>" + person(x.s) + '<div class="sub">' + esc(practiceName(x.s.practice_id)) + " · " + esc(HR.typeLabel(x.l.leave_type)) + '</div></span><span class="sub">' + esc(CC.fmtDate(x.l.start_date)) + (x.l.start_date !== x.l.end_date ? " – " + esc(CC.fmtDate(x.l.end_date)) : "") + "</span></li>"; }).join("") + "</ul>" : '<div class="empty">' + esc(t("Nobody is off.")) + "</div>") + "</div>" +
        '<div class="panel"><h3>' + esc(t("All staff")) + '</h3><div class="filters"><input type="search" id="g-q" placeholder="' + esc(t("Search by name or job title")) + '"><select id="g-p">' + CC.options(list.map(function (r) { return { value: r.p.id, label: r.p.name }; }), "", "All practices") + '</select></div><div id="g-list"></div></div></div>';
      function drawList() {
        var rows = cache.staff.filter(function (s) { return isCurrent(s) && (!q.p || s.practice_id === q.p) && (!q.v || (s.full_name + " " + (s.job_title || "")).toLowerCase().indexOf(q.v.toLowerCase()) >= 0); });
        el.querySelector("#g-list").innerHTML = rows.length ? '<ul class="list">' + rows.map(function (s) {
          return '<li><a href="#" data-act="open" data-id="' + s.id + '" class="hr-person">' + HR.avatarHtml(s, cache.urls, "sm") + "<span>" + esc(s.full_name) + '<div class="sub">' + esc(s.job_title || "—") + " · " + esc(practiceName(s.practice_id)) + "</div></span></a>" + (regAlerts(s) ? CC.chip("red", t("Check expiry dates")) : "") + "</li>";
        }).join("") + "</ul>" : '<div class="empty">' + esc(t("No staff records yet.")) + "</div>";
      }
      drawList();
      el.querySelector("#g-q").oninput = function (e) { q.v = e.target.value; drawList(); };
      el.querySelector("#g-p").onchange = function (e) { q.p = e.target.value; drawList(); };
      el.onclick = function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return;
        if (b.tagName === "A") e.preventDefault();
        var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
        if (act === "open") openStaff(id);
        else if (act === "site") { S.practiceId = id; location.hash = "#/hr"; }
        else if (act === "csv") {
          CC.csv([[t("Practice"), t("Staff"), t("Off today"), t("Awaiting approval"), t("Sick days (90 days)"), t("Absence rate")]].concat(list.map(function (r) { return [r.p.name, r.staff.length, r.off, r.pending, r.sick, rate(r).toFixed(1) + "%"]; })), "group-hr-" + today + ".csv");
          A("hr_export_group", "hr", "", null, {});
        }
      };
    });
  };
})();
