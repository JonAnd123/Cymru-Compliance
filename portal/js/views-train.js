/* Views: group training (bulk assign + completion matrix) and expiry alerts (bell + alerts page) */
(function () {
  "use strict";
  var CC = window.CC, S = CC.state, SC = window.CCScoring, esc = function (s) { return CC.esc(s); }, t = function (s, v) { return CC.t(s, v); };
  var WINDOW_DAYS = 60;     // warn this many days ahead
  var ROLE_ORDER = ["principal", "practice_manager", "staff"];

  function modTitle(m) { return CC.lang === "cy" && m.title_cy ? m.title_cy : m.title_en; }
  function pname(id) { var p = S.practices.filter(function (x) { return x.id === id; })[0]; return p ? p.name : ""; }
  function pct(n) { return '<div style="display:flex;align-items:center;gap:8px"><div class="progress" style="flex:1"><span style="width:' + n + '%"></span></div><span class="small">' + n + "%</span></div>"; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function isOverdue(a) { return a.status !== "completed" && a.due_date && SC.daysUntil(a.due_date) < 0; }

  /* ============================== Group training ============================== */
  CC.views.grouptrain = function (el) {
    return Promise.all([CC.api.training.modules(), CC.api.training.assignments({}), CC.api.profiles.list({})]).then(function (r) {
      var modules = r[0], assigns = r[1], people = r[2];
      var practices = S.practices.filter(function (p) { return p.group_id; });
      var person = {}; people.forEach(function (p) { person[p.id] = p; });
      assigns = assigns.filter(function (a) { return practices.some(function (p) { return p.id === a.practice_id; }); });

      var total = assigns.length, done = assigns.filter(function (a) { return a.status === "completed"; }).length;
      var overdue = assigns.filter(isOverdue).sort(function (a, b) { return a.due_date < b.due_date ? -1 : 1; });
      var overduePractices = {}; overdue.forEach(function (a) { overduePractices[a.practice_id] = 1; });
      var usedMods = modules.filter(function (m) { return assigns.some(function (a) { return a.module_id === m.id; }); });

      function cell(pid, mid) {
        var rows = assigns.filter(function (a) { return a.practice_id === pid && a.module_id === mid; });
        if (!rows.length) return '<td class="mx mx-none">—</td>';
        var d = rows.filter(function (a) { return a.status === "completed"; }).length;
        var cls = d === rows.length ? "mx-green" : (rows.some(isOverdue) ? "mx-red" : "mx-amber");
        return '<td class="mx ' + cls + '" title="' + esc(d + " / " + rows.length) + '">' + d + "/" + rows.length + "</td>";
      }

      el.innerHTML =
        '<div class="page-head"><div><h1>' + esc(t("Group training")) + "</h1><p class=\"muted\">" + esc(t("Assign training across your practices and track completion in one place.")) + "</p></div>" +
        '<div class="actions"><button class="btn btn-primary" data-act="assign">' + esc(t("Assign training")) + "</button></div></div>" +
        '<div class="grid-kpi">' +
        '<div class="kpi"><div class="label">' + esc(t("Assignments")) + '</div><div class="value">' + total + '</div><div class="sub">' + esc(t("across {n} practices", { n: practices.length })) + "</div></div>" +
        '<div class="kpi ' + (total && done / total >= 0.85 ? "green" : (total && done / total >= 0.6 ? "amber" : (total ? "red" : ""))) + '"><div class="label">' + esc(t("Completed")) + '</div><div class="value">' + (total ? Math.round(100 * done / total) + "%" : "—") + '</div><div class="sub">' + esc(t("{a} of {b} assignments", { a: done, b: total })) + "</div></div>" +
        '<div class="kpi ' + (overdue.length ? "red" : "green") + '"><div class="label">' + esc(t("Overdue")) + '</div><div class="value">' + overdue.length + '</div><div class="sub">' + esc(t("{n} practices affected", { n: Object.keys(overduePractices).length })) + "</div></div></div>" +
        '<div class="panel"><h3>' + esc(t("Completion by practice")) + "</h3>" +
        (usedMods.length ? '<div class="table-wrap"><table class="data matrix"><thead><tr><th>' + esc(t("Practice")) + "</th>" + usedMods.map(function (m) { return '<th class="mx-h" title="' + esc(modTitle(m)) + '">' + esc(modTitle(m).replace(/\s[—-]\s.*$/, "")) + "</th>"; }).join("") + "<th>" + esc(t("Overall")) + "</th></tr></thead><tbody>" +
          practices.map(function (p) {
            var rows = assigns.filter(function (a) { return a.practice_id === p.id; });
            var d = rows.filter(function (a) { return a.status === "completed"; }).length;
            return "<tr><td><strong>" + esc(p.name) + "</strong></td>" + usedMods.map(function (m) { return cell(p.id, m.id); }).join("") + "<td>" + (rows.length ? pct(Math.round(100 * d / rows.length)) : "—") + "</td></tr>";
          }).join("") + "</tbody></table></div><p class=\"muted small\" style=\"margin-top:8px\">" + esc(t("Each cell shows completed / assigned. Red means at least one person is overdue.")) + "</p>"
          : '<div class="empty">' + esc(t("Nothing assigned yet.")) + "</div>") + "</div>" +
        '<div class="panel"><h3>' + esc(t("Overdue training")) + "</h3>" +
        (overdue.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Person")) + "</th><th>" + esc(t("Practice")) + "</th><th>" + esc(t("Module")) + "</th><th>" + esc(t("Due")) + "</th><th>" + esc(t("Progress")) + "</th></tr></thead><tbody>" +
          overdue.map(function (a) {
            var m = modules.filter(function (x) { return x.id === a.module_id; })[0], u = person[a.profile_id] || {}, days = -SC.daysUntil(a.due_date);
            return "<tr><td>" + esc(u.full_name || u.email || "—") + "</td><td>" + esc(pname(a.practice_id)) + "</td><td>" + esc(m ? modTitle(m) : "—") + "</td><td>" + esc(CC.fmtDate(a.due_date)) + " " + CC.chip("red", t("{n} days overdue", { n: days })) + "</td><td style=\"min-width:120px\">" + pct(a.progress) + "</td></tr>";
          }).join("") + "</tbody></table></div>" : '<div class="empty">' + esc(t("Nothing overdue. Well done.")) + "</div>") + "</div>";

      el.onclick = function (e) {
        var b = e.target.closest("[data-act]"); if (!b || b.getAttribute("data-act") !== "assign") return;
        var kinds = [["induction", "Induction"], ["refresher", "Refresher training"], ["pm", "Practice Manager Training"]];
        CC.modal({
          title: t("Assign training across practices"), submitLabel: "Assign",
          body:
            '<div class="field"><label>' + esc(t("Training modules")) + '</label><div class="checks">' + kinds.map(function (k) {
              return '<div class="muted small" style="margin:6px 0 2px">' + esc(t(k[1])) + "</div>" + modules.filter(function (m) { return m.kind === k[0]; }).map(function (m) { return '<label><input type="checkbox" name="mods" value="' + m.id + '"> ' + esc(modTitle(m)) + "</label>"; }).join("");
            }).join("") + "</div></div>" +
            '<div class="field"><label>' + esc(t("Practices")) + '</label><div class="checks">' + practices.map(function (p) { return '<label><input type="checkbox" name="prs" value="' + p.id + '" checked> ' + esc(p.name) + "</label>"; }).join("") + "</div></div>" +
            '<div class="field"><label>' + esc(t("Who")) + '</label><div class="checks">' + ROLE_ORDER.map(function (ro) { return '<label><input type="checkbox" name="roles" value="' + ro + '" checked> ' + esc(CC.roleLabel(ro)) + "</label>"; }).join("") + "</div></div>" +
            '<div class="field"><label>' + esc(t("Due date")) + '</label><input type="date" name="due" value="' + CC.isoDate(30) + '"></div>' +
            '<p class="muted small">' + esc(t("People who already have a module assigned are skipped.")) + "</p>",
          onSubmit: function (d) {
            var mods = [].concat(d.mods || []), prs = [].concat(d.prs || []), roles = [].concat(d.roles || []);
            if (!mods.length) throw new Error(t("Choose at least one module."));
            if (!prs.length) throw new Error(t("Choose at least one practice."));
            if (!roles.length) throw new Error(t("Choose at least one role."));
            var rows = [], perPractice = {};
            people.forEach(function (u) {
              if (!u.active || prs.indexOf(u.practice_id) < 0 || roles.indexOf(u.role) < 0) return;
              perPractice[u.practice_id] = (perPractice[u.practice_id] || 0) + 1;
              mods.forEach(function (mid) { rows.push({ module_id: mid, profile_id: u.id, practice_id: u.practice_id, due_date: d.due || null }); });
            });
            if (!rows.length) throw new Error(t("No active people match your selection."));
            return CC.api.training.assign(rows).then(function () {
              Object.keys(perPractice).forEach(function (pid) { CC.api.audit.log("assign_training", "training", "", pid, { modules: mods.length, people: perPractice[pid], bulk: true }); });
              CC.toast(t("Training assigned to {n} people.", { n: Object.keys(perPractice).reduce(function (s, k) { return s + perPractice[k]; }, 0) }));
              CC.render();
            });
          }
        });
      };
    });
  };

  /* ============================== Alerts ============================== */
  var KIND = {
    evidence:   { label: "Evidence",          route: "evidence" },
    gdc:        { label: "GDC registration",  route: "hr" },
    indemnity:  { label: "Indemnity",         route: "hr" },
    dbs:        { label: "DBS",               route: "hr" },
    training:   { label: "Training overdue",  route: "training" },
    inspection: { label: "HIW inspection",    route: "dashboard" },
    task:       { label: "Task",              route: "tasks" },
    maintenance:{ label: "Maintenance",       route: "maintenance" }
  };
  CC.ALERT_KINDS = KIND;

  function mk(kind, key, title, who, pid, date, extra) {
    var days = SC.daysUntil(date);
    if (days === null || days > WINDOW_DAYS) return null;
    return Object.assign({ kind: kind, key: key, title: title, who: who || "", practice_id: pid, date: date, days: days, sev: days < 0 ? "red" : (days <= 14 ? "amber" : "info") }, extra || {});
  }
  function safe(p, fallback) { return Promise.resolve(p).catch(function () { return fallback; }); }

  // Gather alerts for the current user, according to what their role may see.
  CC.alerts = {
    list: [],
    loaded: false,
    compute: function () {
      var me = S.profile, role = me.role, out = [];
      var practices = role === "staff" ? S.practices.filter(function (p) { return p.id === me.practice_id; }) :
        (role === "group_admin" ? S.practices.filter(function (p) { return p.group_id; }) : (role === "platform_admin" ? S.practices : S.practices.filter(function (p) { return p.id === me.practice_id; })));
      var manage = role !== "staff";
      return Promise.all(practices.map(function (p) {
        return Promise.all([
          safe(CC.api.evidence.list(p.id), []),
          manage ? safe(CC.api.hr.staff.list({ practice_id: p.id }), []) : safe(CC.api.hr.staff.mine(me.email, p.id).then(function (x) { return x ? [x] : []; }), []),
          safe(CC.api.training.assignments({ practice_id: p.id }), []),
          safe(CC.api.profiles.list({ practice_id: p.id }), []),
          safe(CC.api.training.modules(), []),
          safe(CC.api.tasks.list(p.id), []),
          manage ? safe(CC.api.maintenance.list(p.id), []) : Promise.resolve([])
        ]).then(function (r) {
          var ev = r[0], hr = r[1], tr = r[2], ppl = r[3], mods = r[4], tasks = r[5], maint = r[6], nm = {};
          ppl.forEach(function (u) { nm[u.id] = u.full_name || u.email; });
          ev.forEach(function (e) {
            if (e.status === "rejected" || !e.expiry_date) return;
            if (!manage && e.staff_member !== me.id) return;
            var who = e.staff_member ? nm[e.staff_member] : "";
            var a = mk("evidence", "ev:" + e.id + ":" + e.expiry_date, e.title, who, p.id, e.expiry_date, { cat: e.category });
            if (a) out.push(a);
          });
          hr.forEach(function (h) {
            if (h.active === false) return;
            [["gdc", "gdc_expiry", "GDC registration"], ["indemnity", "indemnity_expiry", "Indemnity"], ["dbs", "dbs_expiry", "DBS"]].forEach(function (k) {
              var a = h[k[1]] ? mk(k[0], "hr:" + h.id + ":" + k[0] + ":" + h[k[1]], k[2], h.full_name, p.id, h[k[1]]) : null;
              if (a) out.push(a);
            });
          });
          tr.forEach(function (a) {
            if (a.status === "completed" || !a.due_date) return;
            if (!manage && a.profile_id !== me.id) return;
            var m = mods.filter(function (x) { return x.id === a.module_id; })[0], days = SC.daysUntil(a.due_date);
            if (days === null || days > 14) return;          // only warn when due within 14 days or overdue
            out.push({ kind: "training", key: "tr:" + a.id + ":" + a.due_date, title: m ? modTitle(m) : "Training", who: nm[a.profile_id] || "", practice_id: p.id, date: a.due_date, days: days, sev: days < 0 ? "red" : "amber" });
          });
          tasks.forEach(function (tk) {
            if (!tk.active) return;
            var d = SC.daysUntil(tk.next_due);
            if (d === null || d > 7 || ((tk.frequency === "daily" || tk.frequency === "weekly") && d >= 0)) return;
            out.push({ kind: "task", key: "tk:" + tk.id + ":" + tk.next_due, title: (CC.lang === "cy" && tk.title_cy) ? tk.title_cy : tk.title, who: tk.assignee_id ? nm[tk.assignee_id] || "" : "", practice_id: p.id, date: tk.next_due, days: d, sev: d < 0 ? "red" : "amber" });
          });
          maint.forEach(function (m) {
            if (m.active === false || !m.next_due) return;
            var a = mk("maintenance", "mt:" + m.id + ":" + m.next_due, (CC.lang === "cy" && m.name_cy) ? m.name_cy : m.name, "", p.id, m.next_due);
            if (a) out.push(a);
          });
          if (manage && p.next_inspection) {
            var d = SC.daysUntil(p.next_inspection);
            if (d !== null && d >= 0 && d <= 30) out.push({ kind: "inspection", key: "insp:" + p.id + ":" + p.next_inspection, title: "Next HIW inspection", who: "", practice_id: p.id, date: p.next_inspection, days: d, sev: d <= 14 ? "red" : "amber" });
          }
        });
      })).then(function () {
        var rank = { red: 0, amber: 1, info: 2 };
        out.sort(function (a, b) { return rank[a.sev] - rank[b.sev] || a.days - b.days; });
        CC.alerts.list = out; CC.alerts.loaded = true;
        return out;
      });
    },
    // red/amber count shown on the bell
    count: function () { return CC.alerts.list.filter(function (a) { return a.sev !== "info"; }).length; },
    refreshBell: function () {
      var b = document.getElementById("bell-n"), link = document.getElementById("bell");
      if (!b || !S.profile || S.profile.role === "inspector" || S.profile.role === "platform_admin") { if (link) link.hidden = true; return Promise.resolve(); }
      link.hidden = false;
      return CC.alerts.compute().then(function () {
        var n = CC.alerts.count(), red = CC.alerts.list.some(function (a) { return a.sev === "red"; });
        b.hidden = !n; b.textContent = n > 99 ? "99+" : n; b.className = "bell-n" + (red ? " red" : "");
        link.setAttribute("aria-label", t("Alerts") + (n ? " (" + n + ")" : ""));
      }, function () {});
    }
  };

  function routeFor(a) {
    var role = S.profile.role, hrk = a.kind === "gdc" || a.kind === "indemnity" || a.kind === "dbs";
    if (role === "staff") return hrk ? "myhr" : (a.kind === "task" ? "tasks" : (a.kind === "inspection" ? "dashboard" : "my"));
    if (role === "group_admin") return a.kind === "training" ? "grouptrain" : (a.kind === "task" ? "tasks" : (a.kind === "maintenance" ? "maintenance" : (a.kind === "evidence" || a.kind === "inspection" ? "dashboard" : "hr")));
    return KIND[a.kind].route;
  }

  function whenText(a) {
    if (a.kind === "inspection") return a.days === 0 ? t("today") : t("in {n} days", { n: a.days });
    if (a.days < 0) return a.kind === "training" ? t("{n} days overdue", { n: -a.days }) : t("expired {n} days ago", { n: -a.days });
    return a.days === 0 ? t("today") : t("in {n} days", { n: a.days });
  }

  CC.views.alerts = function (el) {
    var multi = ["group_admin", "platform_admin"].indexOf(S.profile.role) >= 0;
    return Promise.all([CC.alerts.compute(), safe(CC.api.alerts.getPrefs(), { email_digest: true })]).then(function (r) {
      var all = r[0], prefs = r[1], filt = { kind: "", sev: "" };
      function draw() {
        var rows = all.filter(function (a) { return (!filt.kind || a.kind === filt.kind) && (!filt.sev || a.sev === filt.sev); });
        var n = { red: all.filter(function (a) { return a.sev === "red"; }).length, amber: all.filter(function (a) { return a.sev === "amber"; }).length };
        el.innerHTML =
          '<div class="page-head"><div><h1>' + esc(t("Alerts")) + "</h1><p class=\"muted\">" + esc(t("Items that have expired or expire within {n} days.", { n: WINDOW_DAYS })) + "</p></div></div>" +
          '<div class="grid-kpi"><div class="kpi ' + (n.red ? "red" : "green") + '"><div class="label">' + esc(t("Expired / overdue")) + '</div><div class="value">' + n.red + '</div></div>' +
          '<div class="kpi ' + (n.amber ? "amber" : "green") + '"><div class="label">' + esc(t("Due within 14 days")) + '</div><div class="value">' + n.amber + '</div></div>' +
          '<div class="kpi"><div class="label">' + esc(t("Due within {n} days", { n: WINDOW_DAYS })) + '</div><div class="value">' + all.length + "</div></div></div>" +
          '<div class="panel"><div class="toolbar"><select id="f-kind"><option value="">' + esc(t("All types")) + "</option>" + Object.keys(KIND).map(function (k) { return '<option value="' + k + '"' + (filt.kind === k ? " selected" : "") + ">" + esc(t(KIND[k].label)) + "</option>"; }).join("") + "</select>" +
          '<select id="f-sev"><option value="">' + esc(t("All urgency")) + '</option><option value="red"' + (filt.sev === "red" ? " selected" : "") + ">" + esc(t("Expired / overdue")) + '</option><option value="amber"' + (filt.sev === "amber" ? " selected" : "") + ">" + esc(t("Due within 14 days")) + '</option><option value="info"' + (filt.sev === "info" ? " selected" : "") + ">" + esc(t("Later")) + "</option></select></div>" +
          (rows.length ? '<div class="table-wrap"><table class="data"><thead><tr><th></th><th>' + esc(t("Item")) + "</th><th>" + esc(t("Type")) + "</th>" + (multi ? "<th>" + esc(t("Practice")) + "</th>" : "") + "<th>" + esc(t("Person")) + "</th><th>" + esc(t("Date")) + "</th><th></th></tr></thead><tbody>" +
            rows.map(function (a, i) {
              return "<tr><td>" + CC.chip(a.sev === "red" ? "red" : (a.sev === "amber" ? "amber" : "blue"), t(a.sev === "red" ? "Urgent" : (a.sev === "amber" ? "Soon" : "Later"))) + "</td><td><strong>" + esc(a.kind === "inspection" ? t(a.title) : a.title) + "</strong></td><td>" + esc(t(KIND[a.kind].label)) + "</td>" +
                (multi ? "<td>" + esc(pname(a.practice_id)) + "</td>" : "") + "<td>" + esc(a.who || "—") + "</td><td>" + esc(CC.fmtDate(a.date)) + ' <span class="muted small">(' + esc(whenText(a)) + ')</span></td><td class="actions-cell"><button class="btn btn-secondary btn-sm" data-i="' + all.indexOf(a) + '">' + esc(t("Open")) + "</button></td></tr>";
            }).join("") + "</tbody></table></div>" : '<div class="empty">' + esc(t("No alerts. Everything is in date.")) + "</div>") + "</div>" +
          '<div class="panel"><h3>' + esc(t("Email reminders")) + "</h3>" +
          '<label class="check-row"><input type="checkbox" id="pref-email"' + (prefs.email_digest !== false ? " checked" : "") + "> " + esc(t("Email me a reminder when items are about to expire")) + "</label>" +
          '<p class="muted small" style="margin-top:6px">' + esc(CC.api.mode === "live" ? t("Reminders are sent at 60, 30, 14 and 0 days before an item expires, and once it has expired.") : t("Email reminders are only sent in the live version. This preference is saved here for the demo.")) + "</p></div>";
        document.getElementById("f-kind").onchange = function (e) { filt.kind = e.target.value; draw(); };
        document.getElementById("f-sev").onchange = function (e) { filt.sev = e.target.value; draw(); };
        document.getElementById("pref-email").onchange = function (e) { CC.api.alerts.setPrefs(e.target.checked).then(function () { CC.toast(t("Saved.")); }).catch(CC.fail); };
        el.onclick = function (e) {
          var b = e.target.closest("[data-i]"); if (!b) return;
          var a = all[+b.getAttribute("data-i")];
          CC.go(routeFor(a), a.practice_id);
        };
      }
      draw();
    });
  };
})();
