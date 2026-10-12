/* Views: practices (Group Admin), bookings, audit log */
(function () {
  "use strict";
  var CC = window.CC, S = CC.state, SC = window.CCScoring, esc = function (s) { return CC.esc(s); }, t = function (s, v) { return CC.t(s, v); };

  function practiceName(id) { var p = S.practices.filter(function (x) { return x.id === id; })[0]; return p ? p.name : "—"; }
  function reloadPractices() { return CC.api.practices.list().then(function (p) { S.practices = p; }); }

  /* ------------------------------ Practices (Group Admin) ------------------------------ */
  CC.views.practices = function (el) {
    var grp = S.groups[0];
    return Promise.all([CC.api.profiles.list({}), CC.api.invites.list(), CC.api.practices.list()]).then(function (r) {
      var people = r[0], invites = r[1]; S.practices = r[2];
      var practices = S.practices.filter(function (p) { return p.group_id === (grp && grp.id); });
      function reload() { return reloadPractices().then(function () { return CC.render(); }); }
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Practices")) + "</h1><p class=\"muted\">" + esc(t("Add practices to your group and invite each practice's Principal. You see roll-up data only — local evidence stays with each Principal.")) + "</p></div>" +
        '<div class="actions"><button class="btn btn-primary" data-act="add">+ ' + esc(t("Add practice")) + "</button></div></div>" +
        (grp ? '<div class="panel"><h3>' + esc(t("Group billing")) + '</h3><div class="field inline"><select id="bill-mode" style="max-width:320px">' + CC.options([{ value: "consolidated", label: t("One consolidated invoice for the whole group") }, { value: "per_practice", label: t("Bill each practice separately") }], grp.billing_mode) + '</select><button class="btn btn-secondary btn-sm" data-act="bill">' + esc(t("Save")) + '</button></div><p class="small muted">' + esc(t("Billing is recorded here; invoicing and payment are handled by Cymru Compliance.")) + "</p></div>" : "") +
        '<div class="panel"><h3>' + esc(t("Your practices")) + '</h3><div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Practice")) + "</th><th>" + esc(t("Principal")) + "</th><th>" + esc(t("Health board")) + "</th><th>" + esc(t("Next inspection")) + "</th><th></th></tr></thead><tbody>" +
        practices.map(function (p) {
          var pr = people.filter(function (u) { return u.practice_id === p.id && u.role === "principal"; })[0];
          var inv = invites.filter(function (i) { return i.practice_id === p.id && i.role === "principal"; })[0];
          return "<tr><td><strong>" + esc(p.name) + '</strong><div class="small muted">' + esc(p.address || "") + "</div></td><td>" + (pr ? esc(pr.full_name || pr.email) : (inv ? esc(inv.email) + " " + CC.chip("blue", t("Invited")) : "—")) + "</td><td>" + esc(p.health_board || "—") + "</td><td>" + esc(CC.fmtDate(p.next_inspection)) + '</td><td class="actions-cell"><button class="btn btn-secondary btn-sm" data-act="view" data-id="' + p.id + '">' + esc(t("View")) + '</button> <button class="btn btn-secondary btn-sm" data-act="edit" data-id="' + p.id + '">' + esc(t("Edit")) + '</button> <button class="btn btn-danger btn-sm" data-act="remove" data-id="' + p.id + '">' + esc(t("Remove from group")) + "</button></td></tr>";
        }).join("") + "</tbody></table></div></div>";
      el.onclick = function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return;
        var act = b.getAttribute("data-act"), id = b.getAttribute("data-id"), p = practices.filter(function (x) { return x.id === id; })[0];
        if (act === "view") CC.go("dashboard", id);
        else if (act === "bill") CC.api.groups.update(grp.id, { billing_mode: document.getElementById("bill-mode").value }).then(function () { grp.billing_mode = document.getElementById("bill-mode").value; CC.toast(t("Billing preference saved.")); }).catch(CC.fail);
        else if (act === "remove") CC.confirm(t("Remove {p} from your group? Your group will no longer see its data.", { p: p.name }), "Remove").then(function (ok) { if (ok) CC.api.practices.update(id, { group_id: null }).then(function () { CC.toast(t("Practice removed from group.")); return reload(); }).catch(CC.fail); });
        else if (act === "edit") CC.modal({
          title: t("Edit practice"), body: '<div class="field"><label>' + esc(t("Next HIW inspection")) + '</label><input type="date" name="next" value="' + esc(p.next_inspection || "") + '"></div>',
          onSubmit: function (d) { return CC.api.practices.update(id, { next_inspection: d.next || null }).then(function () { CC.toast(t("Saved.")); return reload(); }); }
        });
        else if (act === "add") CC.modal({
          title: t("Add practice"), submitLabel: "Add practice",
          body: '<div class="field"><label>' + esc(t("Practice name")) + '</label><input name="name" required></div><div class="field"><label>' + esc(t("Address")) + '</label><input name="address"></div>' +
            '<div class="field-row"><div class="field"><label>' + esc(t("Health board")) + '</label><input name="hb"></div><div class="field"><label>' + esc(t("HIW registration no.")) + '</label><input name="reg"></div></div>' +
            '<div class="field"><label>' + esc(t("Next HIW inspection (if known)")) + '</label><input type="date" name="next"></div><hr class="divider" style="margin:14px 0"><h4>' + esc(t("Principal for this practice")) + '</h4><div class="field-row"><div class="field"><label>' + esc(t("Full name")) + '</label><input name="pname" required></div><div class="field"><label>' + esc(t("Email")) + '</label><input type="email" name="pemail" required></div></div>',
          onSubmit: function (d) {
            return CC.api.practices.create({ group_id: grp.id, name: d.name.trim(), address: d.address || null, health_board: d.hb || null, hiw_registration: d.reg || null, next_inspection: d.next || null, package: "group" }).then(function (np) {
              return CC.api.invites.create({ email: d.pemail.trim(), full_name: d.pname.trim(), role: "principal", practice_id: np.id }).then(function () { CC.api.audit.log("add_practice", "practice", np.id, np.id, { name: np.name }); CC.toast(t("Practice added and Principal invited.")); return reload(); });
            });
          }
        });
      };
    });
  };

  /* ------------------------------ Bookings ------------------------------ */
  var KIND = { pre_inspection: "Pre-inspection visit", pm_training: "Practice Manager training" };
  var ST = { requested: ["blue", "Requested"], confirmed: ["green", "Confirmed"], completed: ["none", "Completed"], cancelled: ["none", "Cancelled"] };

  CC.views.bookings = function (el) {
    var role = CC.role();
    return CC.api.bookings.list().then(function (rows) {
      var multi = role === "group_admin" || role === "platform_admin";
      function reload() { CC.render(); }
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Bookings")) + "</h1><p class=\"muted\">" + esc(t("Book expert pre-inspection visits and Practice Manager training.")) + "</p></div>" +
        (role !== "platform_admin" ? '<div class="actions"><button class="btn btn-primary" data-act="book" data-kind="pre_inspection">+ ' + esc(t("Pre-inspection visit")) + '</button><button class="btn btn-secondary" data-act="book" data-kind="pm_training">+ ' + esc(t("Practice Manager training")) + "</button></div>" : "") + "</div>" +
        '<div class="banner info"><span>' + esc(t("Illustrative pricing: extra pre-inspection visit ~£450, Practice Manager training ~£250 per seat. Practice Plus includes one visit and one seat per year. We confirm the final price with you before the booking is confirmed.")) + "</span></div>" +
        '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Practice")) + "</th><th>" + esc(t("Service")) + "</th><th>" + esc(t("Preferred date")) + "</th><th>" + esc(t("Details")) + "</th><th>" + esc(t("Status")) + "</th><th>" + esc(t("Notes")) + "</th><th></th></tr></thead><tbody>" +
        (rows.length ? rows.map(function (b) {
          var st = ST[b.status], open = b.status === "requested" || b.status === "confirmed";
          return "<tr><td>" + esc(practiceName(b.practice_id)) + "</td><td>" + esc(t(KIND[b.kind])) + "</td><td>" + esc(CC.fmtDate(b.preferred_date)) + "</td><td>" + esc(b.kind === "pm_training" ? t("{n} seat(s)", { n: b.seats }) : t(b.mode === "remote" ? "Remote review" : "On-site visit")) + "</td><td>" + CC.chip(st[0], t(st[1])) + "</td><td>" + esc(b.notes || "") + '</td><td class="actions-cell">' +
            (role === "platform_admin" && b.status === "requested" ? '<button class="btn btn-secondary btn-sm" data-act="confirm" data-id="' + b.id + '">' + esc(t("Confirm")) + "</button> " : "") +
            (role === "platform_admin" && open ? '<button class="btn btn-primary btn-sm" data-act="complete" data-id="' + b.id + '">' + esc(t("Complete")) + "</button> " : "") +
            (open ? '<button class="btn btn-danger btn-sm" data-act="cancel" data-id="' + b.id + '">' + esc(t("Cancel")) + "</button>" : "") + "</td></tr>";
        }).join("") : '<tr><td colspan="7"><div class="empty">' + esc(t("No bookings yet.")) + "</div></td></tr>") + "</tbody></table></div>";

      el.onclick = function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return;
        var act = b.getAttribute("data-act"), id = b.getAttribute("data-id"), bk = rows.filter(function (x) { return x.id === id; })[0];
        if (act === "cancel") CC.confirm(t("Cancel this booking?")).then(function (ok) { if (ok) CC.api.bookings.update(id, { status: "cancelled" }).then(function () { CC.toast(t("Booking cancelled.")); reload(); }).catch(CC.fail); });
        else if (act === "confirm") CC.api.bookings.update(id, { status: "confirmed" }).then(function () { CC.toast(t("Booking confirmed.")); reload(); }).catch(CC.fail);
        else if (act === "complete") completeBooking(bk, reload);
        else if (act === "book") {
          var kind = b.getAttribute("data-kind"), single = !multi;
          CC.modal({
            title: t(KIND[kind]), submitLabel: "Request booking",
            body: (single ? "" : '<div class="field"><label>' + esc(t("Which practices?")) + '</label><div class="checks">' + S.practices.map(function (p) { return '<label><input type="checkbox" name="pids" value="' + p.id + '"' + (p.id === S.practiceId ? " checked" : "") + "> " + esc(p.name) + "</label>"; }).join("") + '</div><p class="small muted">' + esc(t("Select several practices to book them in one action.")) + "</p></div>") +
              '<div class="field"><label>' + esc(t("Preferred date")) + '</label><input type="date" name="date" min="' + CC.isoDate(1) + '"></div>' +
              (kind === "pre_inspection" ? '<div class="field"><label>' + esc(t("Format")) + '</label><select name="mode">' + CC.options([{ value: "onsite", label: t("On-site visit") }, { value: "remote", label: t("Remote review") }], "onsite") + "</select></div>" : '<div class="field"><label>' + esc(t("Seats per practice")) + '</label><input type="number" name="seats" min="1" max="50" value="1" required></div>') +
              '<div class="field"><label>' + esc(t("Notes (optional)")) + '</label><textarea name="notes" rows="2"></textarea></div>',
            onSubmit: function (d) {
              var pids = single ? [S.practiceId] : [].concat(d.pids || []);
              if (!pids.length) throw new Error(t("Choose at least one practice."));
              var rowsNew = pids.map(function (pid) { return { practice_id: pid, kind: kind, preferred_date: d.date || null, mode: d.mode || "onsite", seats: +(d.seats || 1), notes: d.notes || null }; });
              return CC.api.bookings.create(rowsNew).then(function () { CC.toast(t("Booking requested.")); reload(); });
            }
          });
        }
      };
    });
  };

  function completeBooking(bk, reload) {
    var isVisit = bk.kind === "pre_inspection";
    CC.modal({
      title: t("Complete booking") + " — " + practiceName(bk.practice_id), submitLabel: "Mark completed",
      body: (isVisit ? '<p class="small muted">' + esc(t("Attach the written gap report. It is added to the practice's evidence library.")) + '</p><div class="field"><label>' + esc(t("Gap report (PDF)")) + '</label><input type="file" name="file" accept=".pdf,.docx"></div>' : "<p>" + esc(t("Mark this training booking as delivered?")) + "</p>"),
      onSubmit: function (d) {
        var p = Promise.resolve();
        if (isVisit && d.file) p = CC.api.evidence.add({ practice_id: bk.practice_id, category: "registration", title: t("Pre-inspection visit gap report") + " — " + CC.fmtDate(new Date()), status: "verified", file: d.file });
        return p.then(function () { return CC.api.bookings.update(bk.id, { status: "completed" }); }).then(function () { CC.api.audit.log("complete_booking", "booking", bk.id, bk.practice_id, { kind: bk.kind }); CC.toast(t("Booking completed.")); reload(); });
      }
    });
  }

  /* ------------------------------ Audit log ------------------------------ */
  CC.views.audit = function (el) {
    var role = CC.role();
    return CC.api.audit.list({ limit: 300 }).then(function (rows) {
      var f = { q: "", p: "" };
      function draw() {
        var shown = rows.filter(function (a) {
          var hay = (a.actor_email + " " + a.action + " " + JSON.stringify(a.detail || {}) + " " + practiceName(a.practice_id)).toLowerCase();
          return (!f.q || hay.indexOf(f.q.toLowerCase()) >= 0) && (!f.p || a.practice_id === f.p);
        });
        el.querySelector("#au-body").innerHTML = shown.length ? shown.map(function (a) {
          var d = a.detail && Object.keys(a.detail).length ? Object.keys(a.detail).map(function (k) { return k + ": " + a.detail[k]; }).join(", ") : "";
          return "<tr><td>" + esc(CC.fmtDateTime(a.at)) + "</td><td>" + esc(a.actor_email || "—") + '<div class="small muted">' + esc(CC.roleLabel(a.actor_role)) + "</div></td><td>" + esc(t(String(a.action).replace(/_/g, " "))) + "</td><td>" + esc(a.practice_id ? practiceName(a.practice_id) : "—") + '</td><td class="small">' + esc(d) + "</td></tr>";
        }).join("") : '<tr><td colspan="5"><div class="empty">' + esc(t("No activity recorded.")) + "</div></td></tr>";
        el._shown = shown;
      }
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Audit log")) + "</h1><p class=\"muted\">" + esc(t("A tamper-resistant record of who viewed or changed what, and when. Entries cannot be edited or deleted.")) + '</p></div><div class="actions"><button class="btn btn-secondary" data-act="csv">' + esc(t("Export CSV")) + "</button></div></div>" +
        '<div class="filters"><input id="au-q" placeholder="' + esc(t("Search…")) + '">' + (S.practices.length > 1 ? '<select id="au-p">' + CC.options(S.practices.map(function (p) { return { value: p.id, label: p.name }; }), "", "All practices") + "</select>" : "") + "</div>" +
        '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("When")) + "</th><th>" + esc(t("Who")) + "</th><th>" + esc(t("Action")) + "</th><th>" + esc(t("Practice")) + "</th><th>" + esc(t("Detail")) + '</th></tr></thead><tbody id="au-body"></tbody></table></div>';
      draw();
      el.querySelector("#au-q").oninput = function (e) { f.q = e.target.value; draw(); };
      var ps = el.querySelector("#au-p"); if (ps) ps.onchange = function (e) { f.p = e.target.value; draw(); };
      el.onclick = function (e) {
        if (!e.target.closest('[data-act="csv"]')) return;
        CC.csv([["When", "Actor", "Role", "Action", "Practice", "Detail"]].concat((el._shown || []).map(function (a) { return [a.at, a.actor_email, a.actor_role, a.action, practiceName(a.practice_id), JSON.stringify(a.detail || {})]; })), "audit-log.csv");
      };
    });
  };
})();
