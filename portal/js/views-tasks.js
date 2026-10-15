/* Views: recurring tasks + calendar, maintenance register, digital logs, dashboard summary */
(function () {
  "use strict";
  var CC = window.CC, S = CC.state, SC = window.CCScoring, T = CC.TOOLS, esc = function (s) { return CC.esc(s); }, t = function (s, v) { return CC.t(s, v); };
  var DAY = 86400000;

  function today() { return CC.isoDate(0); }
  function cy() { return CC.lang === "cy"; }
  function canManage() { var r = CC.role(); return r === "principal" || r === "practice_manager" || r === "platform_admin"; }
  function canEditTasks() { return canManage() || CC.role() === "group_admin"; }
  function freqOpts(sel) { return CC.options(T.FREQ.map(function (f) { return { value: f[0], label: t(f[1]) }; }), sel); }
  function nameMap(people) { var m = {}; people.forEach(function (p) { m[p.id] = p.full_name || p.email; }); return m; }
  function taskTitle(x) { return cy() && x.title_cy ? x.title_cy : x.title; }
  function itemName(x) { return cy() && x.name_cy ? x.name_cy : x.name; }
  function seg(items, active) {
    return '<div class="seg" role="tablist">' + items.map(function (i) { return '<button type="button" role="tab" data-seg="' + i[0] + '" class="' + (i[0] === active ? "active" : "") + '">' + esc(t(i[1])) + "</button>"; }).join("") + "</div>";
  }
  function dueChip(d) {
    if (!d) return CC.chip("none", t("Not set"));
    var n = SC.daysUntil(d);
    if (n < 0) return CC.chip("red", t("{n} days overdue", { n: -n }));
    if (n === 0) return CC.chip("amber", t("Today"));
    if (n <= 7) return CC.chip("amber", t("in {n} days", { n: n }));
    return CC.chip("green", t("in {n} days", { n: n }));
  }
  function peopleOf(pid) {
    return CC.api.profiles.list({ practice_id: pid }).then(function (p) { return p.filter(function (u) { return u.practice_id === pid && u.active && ["principal", "practice_manager", "staff"].indexOf(u.role) >= 0; }); }).catch(function () { return []; });
  }
  function noPractice(el) { el.innerHTML = '<div class="empty">' + esc(t("No practice selected.")) + "</div>"; }

  /* ============================== Tasks & calendar ============================== */
  var tabState = { tasks: "list", month: null };

  function occurrences(tk, from, to) {
    var out = [], d = tk.next_due, g = 0;
    if (!tk.active || !d) return out;
    if (tk.frequency === "once") { if (d >= from && d <= to) out.push(d); return out; }
    while (d && d < from && g < 600) { d = T.nextDue(tk.frequency, d); g++; }
    while (d && d <= to && g < 1200) { out.push(d); d = T.nextDue(tk.frequency, d); g++; }
    return out;
  }

  CC.views.tasks = function (el) {
    var pid = S.practiceId; if (!pid) return noPractice(el);
    var role = CC.role(), me = S.profile, practice = CC.practice();
    var wantLeave = canManage() || role === "group_admin";
    return Promise.all([CC.api.tasks.list(pid), CC.api.tasks.completions(pid), peopleOf(pid),
      wantLeave ? CC.api.hr.leave.list({ practice_id: pid }).catch(function () { return []; }) : Promise.resolve([]),
      wantLeave ? CC.api.hr.staff.list({ practice_id: pid }).catch(function () { return []; }) : Promise.resolve([])]).then(function (r) {
      var tasks = r[0].filter(function (x) { return x.active; }), done = r[1], people = r[2], leave = r[3].filter(function (l) { return l.status === "approved"; }), hrStaff = r[4];
      var names = nameMap(people), byId = {}; r[0].forEach(function (x) { byId[x.id] = x; });
      var editor = canEditTasks();
      if (!tabState.month) tabState.month = today().slice(0, 7);

      var overdue = tasks.filter(function (x) { return x.next_due < today(); }).length;
      var week = tasks.filter(function (x) { var n = SC.daysUntil(x.next_due); return n >= 0 && n <= 7; }).length;
      var cutoff = CC.isoDate(-90), recent = done.filter(function (c) { return c.done_on >= cutoff; });
      var onTime = recent.filter(function (c) { return !c.due_date || c.done_on <= c.due_date; }).length;
      var pctOn = recent.length ? Math.round(100 * onTime / recent.length) : null;

      function canComplete(x) { return canManage() || x.assignee_id === me.id; }

      function listHtml() {
        var rows = tasks.slice().sort(function (a, b) { return a.next_due < b.next_due ? -1 : 1; });
        if (!rows.length) return '<div class="empty">' + esc(t("No tasks yet.")) + (editor ? " " + esc(t("Add the recommended set to get started.")) : "") + "</div>";
        return '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Task")) + "</th><th>" + esc(t("Repeats")) + "</th><th>" + esc(t("Assigned to")) + "</th><th>" + esc(t("Next due")) + "</th><th>" + esc(t("Last done")) + '</th><th></th></tr></thead><tbody>' +
          rows.map(function (x) {
            return "<tr><td><strong>" + esc(taskTitle(x)) + '</strong><div class="sub">' + esc(x.category || "") + "</div></td><td>" + esc(t(T.freqLabel(x.frequency))) + "</td><td>" + esc(x.assignee_id ? names[x.assignee_id] || "—" : t("Practice team")) + "</td><td>" + esc(CC.fmtDate(x.next_due)) + " " + dueChip(x.next_due) + "</td><td>" + esc(x.last_done ? CC.fmtDate(x.last_done) : "—") + '</td><td class="actions-cell">' +
              (canComplete(x) ? '<button class="btn btn-primary btn-sm" data-act="done" data-id="' + x.id + '">' + esc(t("Mark done")) + "</button> " : "") +
              (editor ? '<button class="btn btn-secondary btn-sm" data-act="edit" data-id="' + x.id + '">' + esc(t("Edit")) + '</button> <button class="btn btn-danger btn-sm" data-act="del" data-id="' + x.id + '">' + esc(t("Delete")) + "</button>" : "") + "</td></tr>";
          }).join("") + "</tbody></table></div>";
      }

      /* ---- calendar ---- */
      function monthEvents(ym) {
        var first = ym + "-01", y = +ym.slice(0, 4), m = +ym.slice(5, 7), last = new Date(Date.UTC(y, m, 0)).getUTCDate(), to = ym + "-" + (last < 10 ? "0" : "") + last;
        var ev = {};
        function add(d, text, cls) { (ev[d] = ev[d] || []).push({ text: text, cls: cls }); }
        tasks.forEach(function (x) { occurrences(x, first, to).forEach(function (d) { add(d, taskTitle(x), d < today() ? "red" : "blue"); }); });
        done.forEach(function (c) { if (c.done_on >= first && c.done_on <= to) { var x = byId[c.task_id]; add(c.done_on, "✓ " + (x ? taskTitle(x) : t("Task")), "green"); } });
        leave.forEach(function (l) {
          var s = hrStaff.filter(function (h) { return h.id === l.staff_id; })[0]; if (!s) return;
          var d = l.start_date, g = 0;
          while (d <= l.end_date && g < 120) { if (d >= first && d <= to) { var wd = new Date(d + "T12:00:00Z").getUTCDay(); if (wd !== 0 && wd !== 6) add(d, s.full_name + " (" + t("leave") + ")", "grey"); } d = new Date(new Date(d + "T12:00:00Z").getTime() + DAY).toISOString().slice(0, 10); g++; }
        });
        if (practice && practice.next_inspection && practice.next_inspection >= first && practice.next_inspection <= to) add(practice.next_inspection, t("HIW inspection"), "red");
        return { ev: ev, last: last };
      }
      function calHtml() {
        var ym = tabState.month, y = +ym.slice(0, 4), m = +ym.slice(5, 7), info = monthEvents(ym), startWd = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
        var label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(cy() ? "cy-GB" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
        var wd = cy() ? ["Llun", "Maw", "Mer", "Iau", "Gwe", "Sad", "Sul"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        var cells = "";
        for (var i = 0; i < startWd; i++) cells += '<div class="cal-cell cal-off"></div>';
        for (var d = 1; d <= info.last; d++) {
          var iso = ym + "-" + (d < 10 ? "0" : "") + d, list = info.ev[iso] || [];
          cells += '<div class="cal-cell' + (iso === today() ? " cal-today" : "") + '" data-day="' + iso + '"><div class="cal-d">' + d + "</div>" +
            list.slice(0, 3).map(function (e) { return '<div class="cal-ev cal-' + e.cls + '" title="' + esc(e.text) + '">' + esc(e.text) + "</div>"; }).join("") +
            (list.length > 3 ? '<div class="cal-more">+' + (list.length - 3) + " " + esc(t("more")) + "</div>" : "") + "</div>";
        }
        return '<div class="cal-head"><button type="button" class="btn btn-secondary btn-sm" data-act="prev" aria-label="' + esc(t("Previous month")) + '">‹</button><strong>' + esc(label) + '</strong><button type="button" class="btn btn-secondary btn-sm" data-act="next" aria-label="' + esc(t("Next month")) + '">›</button><button type="button" class="btn btn-secondary btn-sm" data-act="today">' + esc(t("Today")) + "</button></div>" +
          '<div class="cal-grid">' + wd.map(function (w) { return '<div class="cal-wd">' + w + "</div>"; }).join("") + cells + "</div>" +
          '<p class="muted small" style="margin-top:8px"><span class="cal-key cal-blue"></span> ' + esc(t("Task due")) + ' <span class="cal-key cal-red"></span> ' + esc(t("Overdue / inspection")) + ' <span class="cal-key cal-green"></span> ' + esc(t("Done")) + (wantLeave ? ' <span class="cal-key cal-grey"></span> ' + esc(t("Leave")) : "") + "</p>";
      }

      function draw() {
        el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Tasks & calendar")) + "</h1><p class=\"muted\">" + esc(t("Recurring checks, audits and reviews. Mark them done and the next date is set for you.")) + "</p></div>" +
          (editor ? '<div class="actions"><button class="btn btn-secondary" data-act="library">' + esc(t("Add recommended tasks")) + '</button><button class="btn btn-primary" data-act="add">+ ' + esc(t("Add task")) + "</button></div>" : "") + "</div>" +
          '<div class="grid-kpi"><div class="kpi ' + (overdue ? "red" : "green") + '"><div class="label">' + esc(t("Overdue")) + '</div><div class="value">' + overdue + "</div></div>" +
          '<div class="kpi ' + (week ? "amber" : "") + '"><div class="label">' + esc(t("Due in the next 7 days")) + '</div><div class="value">' + week + "</div></div>" +
          '<div class="kpi ' + (pctOn === null ? "" : (pctOn >= 85 ? "green" : (pctOn >= 60 ? "amber" : "red"))) + '"><div class="label">' + esc(t("Done on time (90 days)")) + '</div><div class="value">' + (pctOn === null ? "—" : pctOn + "%") + '</div><div class="sub">' + esc(t("{n} completed", { n: recent.length })) + "</div></div></div>" +
          '<div class="panel">' + seg([["list", "List"], ["calendar", "Calendar"]], tabState.tasks) + '<div style="margin-top:14px">' + (tabState.tasks === "list" ? listHtml() : calHtml()) + "</div></div>";
      }

      /* ---- modals ---- */
      function taskForm(x) {
        x = x || {};
        return '<div class="field"><label>' + esc(t("Task")) + '</label><input name="title" required value="' + esc(x.title || "") + '"></div>' +
          '<div class="field"><label>' + esc(t("Category")) + '</label><input name="category" value="' + esc(x.category || "") + '"></div>' +
          '<div class="field"><label>' + esc(t("Repeats")) + '</label><select name="frequency">' + freqOpts(x.frequency || "monthly") + "</select></div>" +
          '<div class="field"><label>' + esc(t("Next due")) + '</label><input type="date" name="next_due" required value="' + esc(x.next_due || CC.isoDate(7)) + '"></div>' +
          '<div class="field"><label>' + esc(t("Assigned to")) + '</label><select name="assignee_id">' + CC.options(people.map(function (p) { return { value: p.id, label: p.full_name || p.email }; }), x.assignee_id || "", "Practice team") + "</select></div>" +
          '<div class="field"><label>' + esc(t("Notes")) + '</label><textarea name="notes" rows="2">' + esc(x.notes || "") + "</textarea></div>";
      }
      function dayModal(iso) {
        var list = monthEvents(iso.slice(0, 7)).ev[iso] || [];
        CC.modal({ title: CC.fmtDate(iso), hideSubmit: true, body: list.length ? '<ul class="list">' + list.map(function (e) { return '<li><span class="cal-ev cal-' + e.cls + '" style="white-space:normal">' + esc(e.text) + "</span></li>"; }).join("") + "</ul>" : '<div class="empty">' + esc(t("Nothing scheduled.")) + "</div>" });
      }

      draw();
      el.onclick = function (e) {
        var sg = e.target.closest("[data-seg]");
        if (sg) { tabState.tasks = sg.getAttribute("data-seg"); draw(); return; }
        var day = e.target.closest("[data-day]");
        if (day && !e.target.closest("[data-act]")) { dayModal(day.getAttribute("data-day")); return; }
        var b = e.target.closest("[data-act]"); if (!b) return;
        var act = b.getAttribute("data-act"), id = b.getAttribute("data-id"), x = id ? byId[id] : null;
        var ym = tabState.month, y = +ym.slice(0, 4), m = +ym.slice(5, 7);
        if (act === "prev" || act === "next") { var nd = new Date(Date.UTC(y, m - 1 + (act === "next" ? 1 : -1), 1)); tabState.month = nd.toISOString().slice(0, 7); draw(); return; }
        if (act === "today") { tabState.month = today().slice(0, 7); draw(); return; }
        if (act === "add") {
          CC.modal({ title: t("Add task"), submitLabel: "Save", body: taskForm(), onSubmit: function (d) {
            return CC.api.tasks.add([{ practice_id: pid, title: d.title.trim(), category: d.category || null, frequency: d.frequency, next_due: d.next_due, assignee_id: d.assignee_id || null, notes: d.notes || null }]).then(function () { CC.toast(t("Saved.")); CC.render(); });
          } });
        } else if (act === "edit" && x) {
          CC.modal({ title: t("Edit task"), submitLabel: "Save", body: taskForm(x), onSubmit: function (d) {
            return CC.api.tasks.update(x.id, { title: d.title.trim(), category: d.category || null, frequency: d.frequency, next_due: d.next_due, assignee_id: d.assignee_id || null, notes: d.notes || null }).then(function () { CC.toast(t("Saved.")); CC.render(); });
          } });
        } else if (act === "del" && x) {
          CC.confirm(t("Delete this task and its history?"), "Delete").then(function (yes) { if (yes) CC.api.tasks.remove(x.id).then(function () { CC.render(); }).catch(CC.fail); });
        } else if (act === "done" && x) {
          CC.modal({ title: t("Mark done") + ": " + taskTitle(x), submitLabel: "Mark done", body: '<div class="field"><label>' + esc(t("Note (optional)")) + '</label><textarea name="note" rows="2"></textarea></div>', onSubmit: function (d) {
            return CC.api.tasks.complete(x.id, d.note || null).then(function (nxt) { CC.toast(nxt ? t("Done. Next due {d}.", { d: CC.fmtDate(nxt) }) : t("Done.")); CC.alerts && CC.alerts.refreshBell(); CC.render(); });
          } });
        } else if (act === "library") {
          var have = {}; r[0].forEach(function (z) { have[z.title] = 1; });
          var avail = T.TASK_LIBRARY.filter(function (l) { return !have[l[0]]; });
          if (!avail.length) { CC.toast(t("All recommended tasks are already added.")); return; }
          CC.modal({ title: t("Add recommended tasks"), submitLabel: "Add", body: '<p class="muted small">' + esc(t("Starting points only: adjust how often each one repeats to suit your practice.")) + '</p><div class="field"><label>' + esc(t("First due date")) + '</label><input type="date" name="start" value="' + CC.isoDate(7) + '"></div><div class="checks">' +
            avail.map(function (l, i) { return '<label><input type="checkbox" name="pick" value="' + i + '" checked> ' + esc(cy() ? l[3] : l[0]) + ' <span class="muted small">(' + esc(t(T.freqLabel(l[2]))) + ")</span></label>"; }).join("") + "</div>",
            onSubmit: function (d) {
              var pick = [].concat(d.pick || []); if (!pick.length) throw new Error(t("Choose at least one task."));
              return CC.api.tasks.add(pick.map(function (i) { var l = avail[+i]; return { practice_id: pid, title: l[0], title_cy: l[3], category: l[1], frequency: l[2], next_due: d.start || CC.isoDate(7) }; })).then(function () { CC.toast(t("Tasks added.")); CC.render(); });
            } });
        }
      };
    });
  };

  /* ============================== Maintenance register ============================== */
  CC.views.maintenance = function (el) {
    var pid = S.practiceId; if (!pid) return noPractice(el);
    return CC.api.maintenance.list(pid).then(function (items) {
      items = items.filter(function (x) { return x.active !== false; });
      var editor = canManage(), byId = {}; items.forEach(function (x) { byId[x.id] = x; });
      var overdue = items.filter(function (x) { return x.next_due && x.next_due < today(); }).length;
      var soon = items.filter(function (x) { var n = SC.daysUntil(x.next_due); return x.next_due && n >= 0 && n <= 60; }).length;
      var unset = items.filter(function (x) { return !x.next_due && x.frequency !== "once"; }).length;
      var groups = []; items.forEach(function (x) { var g = x.grp || t("Other"); if (groups.indexOf(g) < 0) groups.push(g); });
      function status(x) {
        if (!x.next_due) return CC.chip("none", t("Date needed"));
        var n = SC.daysUntil(x.next_due);
        return n < 0 ? CC.chip("red", t("{n} days overdue", { n: -n })) : (n <= 60 ? CC.chip("amber", t("in {n} days", { n: n })) : CC.chip("green", t("In date")));
      }
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Maintenance register")) + "</h1><p class=\"muted\">" + esc(t("Services, tests, insurance and certificates. Enter when each was last done and the next date is worked out for you.")) + "</p></div>" +
        (editor ? '<div class="actions"><button class="btn btn-secondary" data-act="library">' + esc(t("Add recommended items")) + '</button><button class="btn btn-primary" data-act="add">+ ' + esc(t("Add item")) + "</button></div>" : "") + "</div>" +
        '<div class="grid-kpi"><div class="kpi ' + (overdue ? "red" : "green") + '"><div class="label">' + esc(t("Overdue")) + '</div><div class="value">' + overdue + "</div></div>" +
        '<div class="kpi ' + (soon ? "amber" : "green") + '"><div class="label">' + esc(t("Due within 60 days")) + '</div><div class="value">' + soon + "</div></div>" +
        '<div class="kpi ' + (unset ? "amber" : "green") + '"><div class="label">' + esc(t("Dates still to enter")) + '</div><div class="value">' + unset + "</div></div></div>" +
        (items.length ? groups.map(function (g) {
          return '<div class="panel"><h3>' + esc(g) + '</h3><div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Item")) + "</th><th>" + esc(t("Last done")) + "</th><th>" + esc(t("Repeats")) + "</th><th>" + esc(t("Next due")) + "</th><th>" + esc(t("Status")) + '</th><th></th></tr></thead><tbody>' +
            items.filter(function (x) { return (x.grp || t("Other")) === g; }).map(function (x) {
              return "<tr><td><strong>" + esc(itemName(x)) + '</strong><div class="sub">' + esc(x.notes || "") + "</div></td><td>" + esc(x.last_done ? CC.fmtDate(x.last_done) : "—") + "</td><td>" + esc(t(T.freqLabel(x.frequency))) + "</td><td>" + esc(x.next_due ? CC.fmtDate(x.next_due) : "—") + "</td><td>" + status(x) + '</td><td class="actions-cell">' +
                (editor ? '<button class="btn btn-primary btn-sm" data-act="today" data-id="' + x.id + '">' + esc(t("Done today")) + '</button> <button class="btn btn-secondary btn-sm" data-act="edit" data-id="' + x.id + '">' + esc(t("Edit")) + "</button>" : "") + "</td></tr>";
            }).join("") + "</tbody></table></div></div>";
        }).join("") : '<div class="panel"><div class="empty">' + esc(t("Nothing in the register yet.")) + (editor ? " " + esc(t("Add the recommended items to get started.")) : "") + "</div></div>");

      function form(x) {
        x = x || {};
        return '<div class="field"><label>' + esc(t("Item")) + '</label><input name="name" required value="' + esc(x.name || "") + '"></div>' +
          '<div class="field"><label>' + esc(t("Group")) + '</label><input name="grp" value="' + esc(x.grp || "") + '"></div>' +
          '<div class="field"><label>' + esc(t("Repeats")) + '</label><select name="frequency">' + freqOpts(x.frequency || "yearly") + "</select></div>" +
          '<div class="field"><label>' + esc(t("Last done")) + '</label><input type="date" name="last_done" value="' + esc(x.last_done || "") + '"></div>' +
          '<div class="field"><label>' + esc(t("Notes")) + '</label><textarea name="notes" rows="2">' + esc(x.notes || "") + "</textarea></div>";
      }
      el.onclick = function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return;
        var act = b.getAttribute("data-act"), x = byId[b.getAttribute("data-id")];
        if (act === "today" && x) CC.api.maintenance.update(x.id, { last_done: today() }).then(function () { CC.api.audit.log("maintenance_done", "maintenance", x.id, pid, { item: x.name }); CC.toast(t("Saved.")); CC.alerts && CC.alerts.refreshBell(); CC.render(); }).catch(CC.fail);
        else if (act === "add") CC.modal({ title: t("Add item"), body: form(), onSubmit: function (d) {
          return CC.api.maintenance.add([{ practice_id: pid, name: d.name.trim(), grp: d.grp || null, frequency: d.frequency, last_done: d.last_done || null, notes: d.notes || null }]).then(function () { CC.render(); });
        } });
        else if (act === "edit" && x) CC.modal({ title: t("Edit item"), body: form(x) + '<label class="check-row"><input type="checkbox" name="remove"> ' + esc(t("Remove this item from the register")) + "</label>", onSubmit: function (d) {
          if (d.remove) return CC.api.maintenance.remove(x.id).then(function () { CC.render(); });
          return CC.api.maintenance.update(x.id, { name: d.name.trim(), grp: d.grp || null, frequency: d.frequency, last_done: d.last_done || null, notes: d.notes || null }).then(function () { CC.render(); });
        } });
        else if (act === "library") {
          var have = {}; items.forEach(function (z) { have[z.name] = 1; });
          var avail = T.MAINT_LIBRARY.filter(function (l) { return !have[l[1]]; });
          if (!avail.length) { CC.toast(t("All recommended items are already added.")); return; }
          CC.modal({ title: t("Add recommended items"), submitLabel: "Add", body: '<p class="muted small">' + esc(t("Starting points only. Intervals depend on your equipment and risk assessments, so adjust them with your advisers.")) + '</p><div class="checks">' +
            avail.map(function (l, i) { return '<label><input type="checkbox" name="pick" value="' + i + '" checked> ' + esc(cy() ? l[3] : l[1]) + ' <span class="muted small">(' + esc(t(l[0])) + ", " + esc(t(T.freqLabel(l[2]))) + ")</span></label>"; }).join("") + "</div>",
            onSubmit: function (d) {
              var pick = [].concat(d.pick || []); if (!pick.length) throw new Error(t("Choose at least one item."));
              return CC.api.maintenance.add(pick.map(function (i) { var l = avail[+i]; return { practice_id: pid, grp: l[0], name: l[1], name_cy: l[3], frequency: l[2] }; })).then(function () { CC.toast(t("Items added.")); CC.render(); });
            } });
        }
      };
    });
  };

  /* ============================== Digital logs ============================== */
  var logState = { type: "" };
  CC.views.logs = function (el) {
    var pid = S.practiceId; if (!pid) return noPractice(el);
    return Promise.all([CC.api.logs.list(pid, { limit: 600 }), peopleOf(pid)]).then(function (r) {
      var all = r[0], names = nameMap(r[1]), me = S.profile;
      var canAdd = ["principal", "practice_manager", "staff"].indexOf(me.role) >= 0 && me.practice_id === pid;
      var fails = all.filter(function (l) { return !l.pass && l.entry_date >= CC.isoDate(-30); }).length;
      var todayDone = {}; all.forEach(function (l) { if (l.entry_date === today()) todayDone[l.log_type] = true; });

      function cardFor(def) {
        var mine = all.filter(function (l) { return l.log_type === def.key; }), last = mine[0];
        var daily = /day|session/i.test(def.freq), state;
        if (!last) state = CC.chip("none", t("No entries yet"));
        else if (!last.pass) state = CC.chip("red", t("Last entry needs action"));
        else if (daily && !todayDone[def.key]) state = CC.chip("amber", t("Not done today"));
        else state = CC.chip("green", daily ? t("Done today") : t("Up to date"));
        return '<div class="log-card"><div class="row"><strong>' + esc(cy() ? def.cy : def.title) + "</strong>" + state + '</div><div class="muted small">' + esc(t(def.freq)) + (last ? " · " + esc(t("Last: {d}", { d: CC.fmtDate(last.entry_date) })) : "") + "</div>" +
          (canAdd ? '<button class="btn btn-secondary btn-sm" data-act="add" data-key="' + def.key + '">+ ' + esc(t("Add entry")) + "</button>" : "") + "</div>";
      }
      function summary(l) {
        var def = T.logDef(l.log_type); if (!def) return "";
        return def.fields.map(function (f) {
          var v = l.data[f.k];
          if (f.t === "check") return (v ? "✓ " : "✗ ") + (cy() ? f.cy : f.l);
          return (cy() ? f.cy : f.l) + ": " + (v === undefined ? "—" : v) + (f.unit ? " " + f.unit : "");
        }).join(" · ");
      }
      function draw() {
        var rows = all.filter(function (l) { return !logState.type || l.log_type === logState.type; }).slice(0, 60);
        el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Logs")) + "</h1><p class=\"muted\">" + esc(t("Daily and weekly checks, signed with your name and the time. Entries cannot be edited or deleted.")) + "</p></div></div>" +
          '<div class="grid-kpi"><div class="kpi ' + (fails ? "red" : "green") + '"><div class="label">' + esc(t("Entries needing action (30 days)")) + '</div><div class="value">' + fails + "</div></div></div>" +
          '<div class="log-grid">' + T.LOGS.map(cardFor).join("") + "</div>" +
          '<div class="panel"><h3>' + esc(t("Recent entries")) + '</h3><div class="toolbar"><select id="f-log"><option value="">' + esc(t("All logs")) + "</option>" + T.LOGS.map(function (d) { return '<option value="' + d.key + '"' + (logState.type === d.key ? " selected" : "") + ">" + esc(cy() ? d.cy : d.title) + "</option>"; }).join("") + "</select></div>" +
          (rows.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Date")) + "</th><th>" + esc(t("Log")) + "</th><th>" + esc(t("Result")) + "</th><th>" + esc(t("Details")) + "</th><th>" + esc(t("By")) + "</th></tr></thead><tbody>" +
            rows.map(function (l) {
              var def = T.logDef(l.log_type) || {};
              return "<tr><td>" + esc(CC.fmtDate(l.entry_date)) + "</td><td>" + esc(cy() ? def.cy : def.title) + "</td><td>" + CC.chip(l.pass ? "green" : "red", t(l.pass ? "OK" : "Action needed")) + '</td><td class="small">' + esc(summary(l)) + (l.note ? '<div class="sub">' + esc(l.note) + "</div>" : "") + "</td><td>" + esc(names[l.done_by] || "—") + "</td></tr>";
            }).join("") + "</tbody></table></div>" : '<div class="empty">' + esc(t("No entries yet.")) + "</div>") + "</div>";
        document.getElementById("f-log").onchange = function (e) { logState.type = e.target.value; draw(); };
      }
      draw();
      el.onclick = function (e) {
        var b = e.target.closest('[data-act="add"]'); if (!b) return;
        var def = T.logDef(b.getAttribute("data-key"));
        var body = def.fields.map(function (f) {
          var lbl = esc(cy() ? f.cy : f.l);
          if (f.t === "check") return '<label class="check-row" style="margin:8px 0"><input type="checkbox" name="f_' + f.k + '"> ' + lbl + "</label>";
          if (f.t === "number") return '<div class="field"><label>' + lbl + (f.unit ? " (" + esc(f.unit) + ")" : "") + (f.min !== undefined || f.max !== undefined ? ' <span class="muted small">' + esc(t("expected {a} to {b}", { a: f.min === undefined ? "" : f.min, b: f.max === undefined ? "" : f.max })) + "</span>" : "") + '</label><input type="number" step="0.1" name="f_' + f.k + '" required></div>';
          return '<div class="field"><label>' + lbl + '</label><select name="f_' + f.k + '">' + CC.options(f.opts.map(function (o) { return { value: o, label: t(o) }; })) + "</select></div>";
        }).join("");
        CC.modal({ title: cy() ? def.cy : def.title, submitLabel: "Save entry", body: body + '<div class="field"><label>' + esc(t("Note / action taken")) + '</label><textarea name="note" rows="2"></textarea></div>', onSubmit: function (d) {
          var data = {};
          def.fields.forEach(function (f) { var v = d["f_" + f.k]; data[f.k] = f.t === "check" ? !!v : (f.t === "number" ? +v : v); });
          var pass = T.logPass(def, data);
          if (!pass && !(d.note || "").trim()) throw new Error(t("Something is missing or out of range. Please note what action you have taken."));
          return CC.api.logs.add({ practice_id: pid, log_type: def.key, entry_date: today(), data: data, pass: pass, note: (d.note || "").trim() || null }).then(function () { CC.toast(pass ? t("Entry saved.") : t("Entry saved: action needed.")); CC.alerts && CC.alerts.refreshBell(); CC.render(); });
        } });
      };
    });
  };

  /* ============================== Dashboard summary (tasks, logs, policies, staff) ============================== */
  CC.fillToolsSummary = function (box, pid) {
    var role = CC.role(); if (!box || !pid || role === "inspector") return;
    var manage = canManage() || role === "group_admin";
    Promise.all([
      CC.api.tasks.list(pid).catch(function () { return []; }), CC.api.tasks.completions(pid).catch(function () { return []; }),
      CC.api.policies.list().catch(function () { return []; }), CC.api.policies.reviews(pid).catch(function () { return []; }),
      manage ? CC.api.maintenance.list(pid).catch(function () { return []; }) : Promise.resolve([]),
      CC.api.logs.list(pid, { limit: 200 }).catch(function () { return []; }),
      manage ? CC.api.hr.staff.list({ practice_id: pid }).catch(function () { return []; }) : Promise.resolve([]),
      manage ? CC.api.checklist.list(pid).catch(function () { return []; }) : Promise.resolve([]),
      manage ? peopleOf(pid) : Promise.resolve([])
    ]).then(function (r) {
      var tasks = r[0].filter(function (x) { return x.active; }), comps = r[1], pols = r[2], revs = r[3], maint = r[4], logs = r[5];
      var cut = CC.isoDate(-90), recent = comps.filter(function (c) { return c.done_on >= cut; });
      var open = tasks.filter(function (x) { return SC.daysUntil(x.next_due) <= 7; });
      var lateNow = tasks.filter(function (x) { return x.next_due < today(); }).length, denom = recent.length + lateNow;
      var taskPct = denom ? Math.round(100 * recent.filter(function (c) { return !c.due_date || c.done_on <= c.due_date; }).length / denom) : null;
      var me = S.profile, mine = revs.filter(function (v) { return v.profile_id === me.id; }), cur = {}; pols.forEach(function (p) { cur[p.id] = p.version; });
      var toReview = pols.filter(function (p) { return !mine.some(function (v) { return v.policy_id === p.id && v.version === p.version; }); }).length;
      var mOver = maint.filter(function (x) { return x.next_due && x.next_due < today(); }).length;
      var failed = logs.filter(function (l) { return !l.pass && l.entry_date >= CC.isoDate(-30); }).length;
      var staffPct = null;
      if (manage && window.CC.staffScores) { var sc = CC.staffScores(r[6], r[7], pols, revs, r[8]); staffPct = sc.length ? Math.round(sc.reduce(function (s, x) { return s + (x.overall || 0); }, 0) / sc.length) : null; }
      var upcoming = tasks.slice().sort(function (a, b) { return a.next_due < b.next_due ? -1 : 1; }).slice(0, 5);
      function k(label, val, sub, cls, link) { return '<a class="kpi ' + (cls || "") + '" href="#/' + link + '" style="text-decoration:none;color:inherit"><div class="label">' + esc(label) + '</div><div class="value">' + val + '</div><div class="sub">' + esc(sub) + "</div></a>"; }
      var tl = role === "group_admin" ? "dashboard" : "tasks";
      box.innerHTML = '<div class="grid-kpi" style="margin-bottom:16px">' +
        k(t("Tasks done on time"), taskPct === null ? "—" : taskPct + "%", t("{n} due this week or overdue", { n: open.length }), taskPct === null ? "" : (taskPct >= 85 ? "green" : (taskPct >= 60 ? "amber" : "red")), tl) +
        (role === "group_admin" ? "" : k(t("Policies to review"), toReview, t("{a} of {b} reviewed by you", { a: pols.length - toReview, b: pols.length }), toReview ? "amber" : "green", "policies")) +
        (manage ? k(t("Staff compliance"), staffPct === null ? "—" : staffPct + "%", t("training, recruitment and policies"), staffPct === null ? "" : (staffPct >= 85 ? "green" : (staffPct >= 60 ? "amber" : "red")), role === "group_admin" ? "dashboard" : "staffcompliance") : "") +
        (manage ? k(t("Maintenance overdue"), mOver, t("{n} log entries need action", { n: failed }), (mOver || failed) ? "red" : "green", role === "group_admin" ? "dashboard" : "maintenance") : k(t("Log entries needing action"), failed, t("last 30 days"), failed ? "red" : "green", "logs")) + "</div>" +
        (upcoming.length ? '<div class="panel" style="margin-bottom:16px"><h3>' + esc(t("Coming up")) + '</h3><ul class="list">' + upcoming.map(function (x) { return "<li><span>" + esc(taskTitle(x)) + '<div class="sub">' + esc(t(T.freqLabel(x.frequency))) + "</div></span><span>" + esc(CC.fmtDate(x.next_due)) + " " + dueChip(x.next_due) + "</span></li>"; }).join("") + "</ul></div>" : "");
    });
  };
})();
