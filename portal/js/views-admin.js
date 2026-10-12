/* Views: platform admin (users, orgs, enquiries) and settings */
(function () {
  "use strict";
  var CC = window.CC, S = CC.state, esc = function (s) { return CC.esc(s); }, t = function (s, v) { return CC.t(s, v); };
  var ROLES = ["platform_admin", "group_admin", "principal", "practice_manager", "staff", "inspector"];
  var PACKAGES = [{ value: "solo", label: "Solo" }, { value: "practice_plus", label: "Practice Plus" }, { value: "group", label: "Group" }];

  function refreshOrgs() {
    return Promise.all([CC.api.practices.list(), CC.api.groups.list()]).then(function (r) { S.practices = r[0]; S.groups = r[1]; });
  }
  function groupName(id) { var g = S.groups.filter(function (x) { return x.id === id; })[0]; return g ? g.name : "—"; }
  function practiceName(id) { var p = S.practices.filter(function (x) { return x.id === id; })[0]; return p ? p.name : "—"; }
  function orgOf(p) { return p.role === "group_admin" ? groupName(p.group_id) : (p.practice_id ? practiceName(p.practice_id) : "—"); }
  function roleOpts(sel) { return CC.options(ROLES.map(function (r) { return { value: r, label: CC.roleLabel(r) }; }), sel); }
  function practiceOpts(sel, ph) { return CC.options(S.practices.map(function (p) { return { value: p.id, label: p.name }; }), sel, ph); }
  function groupOpts(sel, ph) { return CC.options(S.groups.map(function (g) { return { value: g.id, label: g.name }; }), sel, ph); }

  /* ------------------------------ Users & invites ------------------------------ */
  CC.views.users = function (el) {
    return Promise.all([CC.api.profiles.list({}), CC.api.invites.list(), refreshOrgs()]).then(function (r) {
      var people = r[0], invites = r[1], f = { q: "", role: "" };
      function reload() { CC.render(); }
      function draw() {
        var shown = people.filter(function (p) { return (!f.role || p.role === f.role) && (!f.q || ((p.full_name || "") + " " + p.email).toLowerCase().indexOf(f.q.toLowerCase()) >= 0); });
        el.querySelector("#us-body").innerHTML = shown.map(function (p) {
          return "<tr><td><strong>" + esc(p.full_name || "—") + "</strong></td><td>" + esc(p.email) + "</td><td>" + esc(CC.roleLabel(p.role)) + "</td><td>" + esc(orgOf(p)) + "</td><td>" + CC.chip(p.active ? "green" : "none", t(p.active ? "Active" : "Deactivated")) + '</td><td class="actions-cell"><button class="btn btn-secondary btn-sm" data-act="edit" data-id="' + p.id + '">' + esc(t("Edit")) + "</button></td></tr>";
        }).join("") || '<tr><td colspan="6"><div class="empty">' + esc(t("No users match.")) + "</div></td></tr>";
      }
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Users & invites")) + "</h1><p class=\"muted\">" + esc(t("Access is by invitation only. Invite someone, then they create their account with the same email.")) + '</p></div><div class="actions"><button class="btn btn-primary" data-act="invite">+ ' + esc(t("Invite user")) + "</button></div></div>" +
        '<div class="filters"><input id="us-q" placeholder="' + esc(t("Search…")) + '"><select id="us-role">' + CC.options(ROLES.map(function (x) { return { value: x, label: CC.roleLabel(x) }; }), "", "All roles") + "</select></div>" +
        '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Name")) + "</th><th>" + esc(t("Email")) + "</th><th>" + esc(t("Role")) + "</th><th>" + esc(t("Organisation")) + "</th><th>" + esc(t("Access")) + '</th><th></th></tr></thead><tbody id="us-body"></tbody></table></div>' +
        (invites.length ? '<div class="panel" style="margin-top:16px"><h3>' + esc(t("Pending invites")) + '</h3><ul class="list">' + invites.map(function (i) { return "<li><span>" + esc(i.full_name || i.email) + '<div class="sub">' + esc(i.email) + " · " + esc(CC.roleLabel(i.role)) + " · " + esc(i.role === "group_admin" ? groupName(i.group_id) : (i.practice_id ? practiceName(i.practice_id) : "")) + '</div></span><button class="btn btn-secondary btn-sm" data-act="revoke" data-id="' + i.id + '">' + esc(t("Cancel invite")) + "</button></li>"; }).join("") + "</ul></div>" : "");
      draw();
      el.querySelector("#us-q").oninput = function (e) { f.q = e.target.value; draw(); };
      el.querySelector("#us-role").onchange = function (e) { f.role = e.target.value; draw(); };

      function orgFields(role, p) {
        return (role === "group_admin" ? '<div class="field"><label>' + esc(t("Group")) + '</label><select name="group_id" required>' + groupOpts(p && p.group_id, "Choose…") + "</select></div>" :
          (["principal", "practice_manager", "staff"].indexOf(role) >= 0 ? '<div class="field"><label>' + esc(t("Practice")) + '</label><select name="practice_id" required>' + practiceOpts(p && p.practice_id, "Choose…") + "</select></div>" : ""));
      }
      el.onclick = function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return;
        var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
        if (act === "revoke") CC.api.invites.remove(id).then(function () { CC.toast(t("Invite cancelled.")); reload(); }).catch(CC.fail);
        else if (act === "invite") {
          var m = CC.modal({
            title: t("Invite user"), submitLabel: "Send invite",
            body: '<div class="field"><label>' + esc(t("Full name")) + '</label><input name="full_name" required></div><div class="field"><label>' + esc(t("Email")) + '</label><input type="email" name="email" required></div><div class="field"><label>' + esc(t("Role")) + '</label><select name="role" id="inv-role">' + roleOpts("principal") + '</select></div><div id="inv-org">' + orgFields("principal") + "</div>",
            onSubmit: function (d) {
              var row = { email: d.email.trim(), full_name: d.full_name.trim(), role: d.role };
              if (d.practice_id) row.practice_id = d.practice_id; if (d.group_id) row.group_id = d.group_id;
              return CC.api.invites.create(row).then(function () { CC.toast(t("Invite created.")); reload(); });
            }
          });
          m.el.querySelector("#inv-role").onchange = function (ev) { m.el.querySelector("#inv-org").innerHTML = orgFields(ev.target.value); };
        } else if (act === "edit") {
          var p = people.filter(function (x) { return x.id === id; })[0];
          var m2 = CC.modal({
            title: t("Edit user") + " — " + (p.full_name || p.email),
            body: '<div class="field"><label>' + esc(t("Role")) + '</label><select name="role" id="ed-role">' + roleOpts(p.role) + '</select></div><div id="ed-org">' + orgFields(p.role, p) + '</div><div class="field"><label>' + esc(t("Access")) + '</label><select name="active">' + CC.options([{ value: "1", label: t("Active") }, { value: "0", label: t("Deactivated") }], p.active ? "1" : "0") + "</select></div>",
            onSubmit: function (d) {
              return CC.api.profiles.adminUpdate(id, { role: d.role, practice_id: d.practice_id || null, group_id: d.group_id || null, active: d.active === "1" }).then(function () { CC.toast(t("User updated.")); reload(); });
            }
          });
          m2.el.querySelector("#ed-role").onchange = function (ev) { m2.el.querySelector("#ed-org").innerHTML = orgFields(ev.target.value, p); };
        }
      };
    });
  };

  /* ------------------------------ Groups & practices ------------------------------ */
  CC.views.orgs = function (el) {
    return refreshOrgs().then(function () {
      function reload() { CC.render(); }
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Groups & practices")) + '</h1></div><div class="actions"><button class="btn btn-secondary" data-act="add-group">+ ' + esc(t("New group")) + '</button><button class="btn btn-primary" data-act="add-practice">+ ' + esc(t("New practice")) + "</button></div></div>" +
        '<div class="panel"><h3>' + esc(t("Groups")) + "</h3>" + (S.groups.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Group")) + "</th><th>" + esc(t("Practices")) + "</th><th>" + esc(t("Billing")) + '</th></tr></thead><tbody>' +
          S.groups.map(function (g) { return "<tr><td><strong>" + esc(g.name) + "</strong></td><td>" + S.practices.filter(function (p) { return p.group_id === g.id; }).length + "</td><td>" + esc(t(g.billing_mode === "consolidated" ? "Consolidated" : "Per practice")) + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">' + esc(t("No groups yet.")) + "</div>") + "</div>" +
        '<div class="panel"><h3>' + esc(t("Practices")) + '</h3><div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Practice")) + "</th><th>" + esc(t("Group")) + "</th><th>" + esc(t("Package")) + "</th><th>" + esc(t("Health board")) + "</th><th>" + esc(t("Next inspection")) + '</th><th></th></tr></thead><tbody>' +
        S.practices.map(function (p) { return "<tr><td><strong>" + esc(p.name) + "</strong></td><td>" + esc(p.group_id ? groupName(p.group_id) : t("Independent")) + "</td><td>" + esc(p.package) + "</td><td>" + esc(p.health_board || "—") + "</td><td>" + esc(CC.fmtDate(p.next_inspection)) + '</td><td class="actions-cell"><button class="btn btn-secondary btn-sm" data-act="edit-practice" data-id="' + p.id + '">' + esc(t("Edit")) + "</button></td></tr>"; }).join("") + "</tbody></table></div></div>";
      function practiceFields(p) {
        p = p || {};
        return '<div class="field"><label>' + esc(t("Practice name")) + '</label><input name="name" required value="' + esc(p.name || "") + '"></div><div class="field-row"><div class="field"><label>' + esc(t("Group")) + '</label><select name="group_id">' + groupOpts(p.group_id, "— Independent —") + '</select></div><div class="field"><label>' + esc(t("Package")) + '</label><select name="package">' + CC.options(PACKAGES, p.package || "solo") + "</select></div></div>" +
          '<div class="field"><label>' + esc(t("Address")) + '</label><input name="address" value="' + esc(p.address || "") + '"></div><div class="field-row"><div class="field"><label>' + esc(t("Health board")) + '</label><input name="health_board" value="' + esc(p.health_board || "") + '"></div><div class="field"><label>' + esc(t("HIW registration no.")) + '</label><input name="hiw_registration" value="' + esc(p.hiw_registration || "") + '"></div></div><div class="field"><label>' + esc(t("Next HIW inspection")) + '</label><input type="date" name="next_inspection" value="' + esc(p.next_inspection || "") + '"></div>';
      }
      function rowFrom(d) { return { name: d.name.trim(), group_id: d.group_id || null, package: d.package, address: d.address || null, health_board: d.health_board || null, hiw_registration: d.hiw_registration || null, next_inspection: d.next_inspection || null }; }
      el.onclick = function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return;
        var act = b.getAttribute("data-act");
        if (act === "add-group") CC.modal({ title: t("New group"), body: '<div class="field"><label>' + esc(t("Group name")) + '</label><input name="name" required></div><div class="field"><label>' + esc(t("Billing")) + '</label><select name="billing_mode">' + CC.options([{ value: "consolidated", label: t("Consolidated") }, { value: "per_practice", label: t("Per practice") }], "consolidated") + "</select></div>", onSubmit: function (d) { return CC.api.groups.create({ name: d.name.trim(), billing_mode: d.billing_mode }).then(function () { CC.toast(t("Group created.")); reload(); }); } });
        else if (act === "add-practice") CC.modal({ title: t("New practice"), body: practiceFields(), onSubmit: function (d) { return CC.api.practices.create(rowFrom(d)).then(function () { CC.toast(t("Practice created.")); reload(); }); } });
        else if (act === "edit-practice") { var p = S.practices.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0]; CC.modal({ title: t("Edit practice"), body: practiceFields(p), onSubmit: function (d) { return CC.api.practices.update(p.id, rowFrom(d)).then(function () { CC.toast(t("Saved.")); reload(); }); } }); }
      };
    });
  };

  /* ------------------------------ Enquiries ------------------------------ */
  CC.views.enquiries = function (el) {
    return CC.api.enquiries.list().then(function (rows) {
      var KIND = { demo: "Demo request", interest: "Expression of interest", general: "General enquiry", waitlist: "Portal waitlist" };
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Enquiries")) + "</h1><p class=\"muted\">" + esc(t("Demo requests, expressions of interest and waitlist sign-ups from the website.")) + '</p></div><div class="actions"><button class="btn btn-secondary" data-act="csv">' + esc(t("Export CSV")) + "</button></div></div>" +
        '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Received")) + "</th><th>" + esc(t("Type")) + "</th><th>" + esc(t("Contact")) + "</th><th>" + esc(t("Practice / group")) + "</th><th>" + esc(t("Message")) + "</th><th>" + esc(t("Status")) + "</th></tr></thead><tbody>" +
        (rows.length ? rows.map(function (q) {
          return "<tr><td>" + esc(CC.fmtDate(q.created_at)) + "</td><td>" + esc(t(KIND[q.kind] || q.kind)) + (q.practice_type ? '<div class="small muted">' + esc(q.practice_type) + "</div>" : "") + "</td><td><strong>" + esc(q.name) + '</strong><div class="small"><a href="mailto:' + esc(q.email) + '">' + esc(q.email) + "</a></div></td><td>" + esc(q.practice_name || "—") + (q.sites ? '<div class="small muted">' + esc(t("{n} practice(s)", { n: q.sites })) + "</div>" : "") + '</td><td class="small">' + esc(q.message || q.role || "") + '</td><td><select data-id="' + q.id + '">' + CC.options([{ value: "new", label: t("New") }, { value: "contacted", label: t("Contacted") }, { value: "closed", label: t("Closed") }], q.status) + "</select></td></tr>";
        }).join("") : '<tr><td colspan="6"><div class="empty">' + esc(t("No enquiries yet.")) + "</div></td></tr>") + "</tbody></table></div>";
      el.onchange = function (e) { var s = e.target.closest("select[data-id]"); if (s) CC.api.enquiries.update(s.getAttribute("data-id"), { status: s.value }).then(function () { CC.toast(t("Status updated.")); }).catch(CC.fail); };
      el.onclick = function (e) {
        if (!e.target.closest('[data-act="csv"]')) return;
        CC.csv([["Received", "Type", "Name", "Email", "Practice", "Sites", "Practice type", "Role", "Message", "Status"]].concat(rows.map(function (q) { return [q.created_at, q.kind, q.name, q.email, q.practice_name, q.sites, q.practice_type, q.role, q.message, q.status]; })), "enquiries.csv");
      };
    });
  };

  /* ------------------------------ Settings ------------------------------ */
  CC.views.settings = function (el) {
    var p = S.profile;
    return CC.api.mfa.status().catch(function () { return { enrolled: false }; }).then(function (mfa) {
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Settings")) + "</h1></div></div>" +
        '<div class="cols-2"><div class="panel"><h3>' + esc(t("Profile")) + '</h3><form id="f-prof"><div class="field"><label>' + esc(t("Full name")) + '</label><input name="name" value="' + esc(p.full_name || "") + '" required></div><div class="field"><label>' + esc(t("Email")) + '</label><input value="' + esc(p.email) + '" disabled></div><div class="field"><label>' + esc(t("Role")) + '</label><input value="' + esc(CC.roleLabel(p.role)) + '" disabled></div><div class="field"><label>' + esc(t("Language")) + '</label><select name="lang">' + CC.options([{ value: "en", label: "English" }, { value: "cy", label: "Cymraeg" }], CC.lang) + '</select></div><button class="btn btn-primary" type="submit">' + esc(t("Save")) + "</button></form></div>" +
        '<div><div class="panel"><h3>' + esc(t("Two-factor authentication")) + "</h3><p class=\"muted\">" + esc(t("Adds a second step when you sign in, using an authenticator app. Recommended for Principals and Group Admins.")) + "</p><p>" + CC.chip(mfa.enrolled ? "green" : "none", t(mfa.enrolled ? "Enabled" : "Not enabled")) + '</p><button class="btn ' + (mfa.enrolled ? "btn-danger" : "btn-primary") + ' btn-sm" id="mfa-btn">' + esc(t(mfa.enrolled ? "Turn off" : "Set up")) + "</button></div>" +
        (CC.api.mode === "live" ? '<div class="panel"><h3>' + esc(t("Change password")) + '</h3><form id="f-pw"><div class="field"><label>' + esc(t("New password (at least 10 characters)")) + '</label><input type="password" name="pw" minlength="10" required autocomplete="new-password"></div><button class="btn btn-secondary" type="submit">' + esc(t("Update password")) + "</button></form></div>" : '<div class="panel"><h3>' + esc(t("Demo data")) + "</h3><p class=\"muted\">" + esc(t("Sample data is stored only in this browser.")) + '</p><button class="btn btn-secondary btn-sm" id="demo-reset2">' + esc(t("Reset demo data")) + "</button></div>") +
        '<div class="panel"><button class="btn btn-secondary" id="so">' + esc(t("Sign out")) + "</button></div></div></div>";

      el.querySelector("#so").onclick = CC.signOut;
      el.querySelector("#f-prof").onsubmit = function (e) {
        e.preventDefault();
        var fd = new FormData(e.target), name = fd.get("name").trim(), lang = fd.get("lang");
        CC.api.profiles.updateMe(name, lang).then(function () { p.full_name = name; p.language = lang; CC.setLang(lang); CC.toast(t("Saved.")); location.reload(); }).catch(CC.fail);
      };
      var pw = el.querySelector("#f-pw");
      if (pw) pw.onsubmit = function (e) { e.preventDefault(); CC.api.updatePassword(new FormData(pw).get("pw")).then(function () { pw.reset(); CC.toast(t("Password updated.")); }).catch(CC.fail); };
      var dr = el.querySelector("#demo-reset2"); if (dr) dr.onclick = function () { CC.api.demoReset(); location.hash = ""; location.reload(); };

      el.querySelector("#mfa-btn").onclick = function () {
        if (mfa.enrolled) { CC.confirm(t("Turn off two-factor authentication?")).then(function (ok) { if (ok) CC.api.mfa.disable(mfa.factorId).then(function () { S.mfaNudge = true; CC.toast(t("Two-factor authentication turned off.")); CC.render(); }).catch(CC.fail); }); return; }
        CC.api.mfa.enroll().then(function (en) {
          CC.modal({
            title: t("Set up two-factor authentication"), submitLabel: "Verify and enable",
            body: "<p>" + esc(t("Scan this QR code with an authenticator app (such as Microsoft Authenticator, Google Authenticator or Authy), then enter the 6-digit code it shows.")) + '</p><p>' + (en.qr ? '<span class="qr"><img alt="QR code" src="' + esc(en.qr) + '"></span>' : "") + '</p><p class="small">' + esc(t("Or enter this key manually:")) + ' <code class="secret">' + esc(en.secret) + '</code></p><div class="field"><label>' + esc(t("6-digit code")) + '</label><input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code"></div>',
            onSubmit: function (d) { return CC.api.mfa.verifyEnroll(en.factorId, d.code.trim()).then(function () { S.mfaNudge = false; CC.toast(t("Two-factor authentication enabled.")); CC.render(); }); }
          });
        }).catch(CC.fail);
      };
    });
  };
})();
