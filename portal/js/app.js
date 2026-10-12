/* Cymru Compliance portal — boot, authentication screens, shell and router */
(function () {
  "use strict";
  var CC = window.CC;
  var $ = function (id) { return document.getElementById(id); };
  var S = CC.state;

  /* ---------- routes & navigation ---------- */
  var ROUTES = {
    dashboard:  { label: "Dashboard",           ico: "▦",  scoped: true,  roles: ["principal", "practice_manager", "staff", "platform_admin", "group_admin"] },
    group:      { label: "Group overview",      ico: "◫",  roles: ["group_admin"] },
    practices:  { label: "Practices",           ico: "🏥", roles: ["group_admin"] },
    check:      { label: "Compliance check",    ico: "✔",  scoped: true,  roles: ["principal", "practice_manager", "platform_admin"] },
    evidence:   { label: "Evidence",            ico: "🗂", scoped: true,  roles: ["principal", "practice_manager", "platform_admin"] },
    training:   { label: "Team training",       ico: "🎓", scoped: true,  roles: ["principal", "practice_manager"] },
    my:         { label: "My records & training", ico: "👤", roles: ["principal", "practice_manager", "staff"] },
    bookings:   { label: "Bookings",            ico: "📅", roles: ["principal", "practice_manager", "group_admin", "platform_admin"] },
    team:       { label: "Team",                ico: "👥", scoped: true,  roles: ["principal", "practice_manager"] },
    inspectors: { label: "Inspector access",    ico: "🔍", scoped: true,  roles: ["principal"] },
    inspect:    { label: "Inspection view",     ico: "🔍", scoped: true,  roles: ["inspector"] },
    users:      { label: "Users & invites",     ico: "🔑", roles: ["platform_admin"] },
    orgs:       { label: "Groups & practices",  ico: "🏢", roles: ["platform_admin"] },
    enquiries:  { label: "Enquiries",           ico: "✉",  roles: ["platform_admin"] },
    audit:      { label: "Audit log",           ico: "📜", roles: ["principal", "practice_manager", "group_admin", "platform_admin"] },
    settings:   { label: "Settings",            ico: "⚙",  roles: ["principal", "practice_manager", "staff", "group_admin", "inspector", "platform_admin"] }
  };
  var NAV = {
    principal:        ["dashboard", "check", "evidence", "training", "my", "bookings", "team", "inspectors", "audit", "settings"],
    practice_manager: ["dashboard", "check", "evidence", "training", "my", "bookings", "team", "audit", "settings"],
    staff:            ["dashboard", "my", "settings"],
    group_admin:      ["group", "practices", "bookings", "audit", "settings"],
    inspector:        ["inspect", "settings"],
    platform_admin:   ["users", "orgs", "enquiries", "bookings", "dashboard", "evidence", "check", "audit", "settings"]
  };
  var MULTI = ["platform_admin", "group_admin", "inspector"];

  CC.role = function () { return S.profile ? S.profile.role : null; };
  CC.canManage = function () { var r = CC.role(); return r === "principal" || r === "practice_manager" || r === "platform_admin"; };
  CC.practice = function () { return S.practices.filter(function (p) { return p.id === S.practiceId; })[0] || null; };
  CC.go = function (route, practiceId) {
    if (practiceId) S.practiceId = practiceId;
    if (location.hash === "#/" + route) CC.render(); else location.hash = "#/" + route;
  };
  CC.refresh = function () { return CC.render(); };

  /* ---------- auth screens ---------- */
  function authCard(html) { $("auth-card").innerHTML = html; }
  var BRAND = window.CC_BRAND || { name: "Cymru Compliance", logo: "../img/logo-header.png" };
  function brandRow() { return '<div class="brand-row"><img src="' + BRAND.logo + '" alt="" width="40" height="40" onerror="this.style.display=\'none\'"><span>' + CC.esc(BRAND.name) + "</span></div>"; }
  function langRow() {
    return '<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><div class="lang-toggle" id="auth-lang"><button data-lang="en" class="' + (CC.lang === "en" ? "active" : "") + '">EN</button><button data-lang="cy" class="' + (CC.lang === "cy" ? "active" : "") + '">CY</button></div></div>';
  }
  function tabs(active) {
    return '<div class="tabs"><button data-tab="signin" class="' + (active === "signin" ? "active" : "") + '">' + CC.esc(CC.t("Sign in")) + '</button><button data-tab="signup" class="' + (active === "signup" ? "active" : "") + '">' + CC.esc(CC.t("Create account")) + "</button></div>";
  }
  function msg(kind, text) { return text ? '<div class="form-' + kind + '">' + CC.esc(text) + "</div>" : ""; }
  function bindAuthCommon() {
    var root = $("auth-card");
    root.querySelectorAll("[data-tab]").forEach(function (b) { b.onclick = function () { renderAuth(b.getAttribute("data-tab")); }; });
    root.querySelectorAll("#auth-lang button").forEach(function (b) { b.onclick = function () { CC.setLang(b.getAttribute("data-lang")); renderAuth(root.getAttribute("data-mode")); }; });
  }

  function renderAuth(mode, note) {
    $("boot").hidden = true; $("app").hidden = true; $("auth").hidden = false;
    $("auth-title").textContent = CC.t("Your HIW inspection-readiness portal");
    $("auth-sub").textContent = CC.t("Dashboard, evidence, training and bookings in one secure place — in English and Welsh.");
    $("auth-card").setAttribute("data-mode", mode);
    var T = CC.t;

    if (mode === "signin") {
      authCard(langRow() + brandRow() + tabs("signin") + msg(note && note.kind, note && note.text) +
        '<form id="f-signin"><div class="field"><label for="si-email">' + CC.esc(T("Email")) + '</label><input id="si-email" type="email" required autocomplete="username"></div>' +
        '<div class="field"><label for="si-pw">' + CC.esc(T("Password")) + '</label><input id="si-pw" type="password" required autocomplete="current-password"></div>' +
        '<button class="btn btn-primary btn-block" type="submit">' + CC.esc(T("Sign in")) + '</button>' +
        '<p style="margin-top:14px"><button type="button" class="link-btn" data-tab="reset">' + CC.esc(T("Forgot your password?")) + '</button></p><p class="small muted" style="margin-top:6px">' + CC.esc(T("No account yet?")) + ' <a href="../portal.html">' + CC.esc(T("Request access")) + "</a></p></form>" + demoBox());
      $("auth-card").querySelector('[data-tab="reset"]').onclick = function () { renderAuth("reset"); };
      $("f-signin").onsubmit = function (e) {
        e.preventDefault();
        var btn = e.target.querySelector("button[type=submit]"); btn.disabled = true;
        CC.api.signIn($("si-email").value.trim(), $("si-pw").value).then(function (r) {
          if (r.mfaRequired) renderAuth("mfa"); else return afterAuth();
        }).catch(function (err) { btn.disabled = false; renderAuth("signin", { kind: "error", text: err.message }); });
      };
      bindDemo();
    } else if (mode === "signup") {
      authCard(langRow() + brandRow() + tabs("signup") + msg(note && note.kind, note && note.text) +
        '<p class="small muted">' + CC.esc(T("Accounts are by invitation only. Use the email address your Principal or Group Admin invited.")) + "</p>" +
        '<form id="f-signup"><div class="field"><label for="su-name">' + CC.esc(T("Full name")) + '</label><input id="su-name" required autocomplete="name"></div>' +
        '<div class="field"><label for="su-email">' + CC.esc(T("Email")) + '</label><input id="su-email" type="email" required autocomplete="username"></div>' +
        '<div class="field"><label for="su-pw">' + CC.esc(T("Password (at least 10 characters)")) + '</label><input id="su-pw" type="password" minlength="10" required autocomplete="new-password"></div>' +
        '<button class="btn btn-primary btn-block" type="submit">' + CC.esc(T("Create account")) + "</button></form>" + demoBox());
      $("f-signup").onsubmit = function (e) {
        e.preventDefault();
        var btn = e.target.querySelector("button[type=submit]"); btn.disabled = true;
        CC.api.signUp($("su-email").value.trim(), $("su-pw").value, $("su-name").value.trim()).then(function (r) {
          if (r.needsConfirm) renderAuth("signin", { kind: "info", text: CC.t("Account created. Check your email to confirm your address, then sign in.") });
          else return afterAuth();
        }).catch(function (err) { btn.disabled = false; renderAuth("signup", { kind: "error", text: err.message }); });
      };
      bindDemo();
    } else if (mode === "reset") {
      authCard(brandRow() + '<h3>' + CC.esc(T("Reset your password")) + "</h3>" + msg(note && note.kind, note && note.text) +
        '<form id="f-reset"><div class="field"><label for="rs-email">' + CC.esc(T("Email")) + '</label><input id="rs-email" type="email" required></div>' +
        '<button class="btn btn-primary btn-block" type="submit">' + CC.esc(T("Send reset link")) + '</button>' +
        '<p style="margin-top:14px"><button type="button" class="link-btn" id="back-signin">' + CC.esc(T("Back to sign in")) + "</button></p></form>");
      $("back-signin").onclick = function () { renderAuth("signin"); };
      $("f-reset").onsubmit = function (e) {
        e.preventDefault();
        CC.api.resetPassword($("rs-email").value.trim()).then(function () {
          renderAuth("signin", { kind: "info", text: CC.t("If that email has an account, a reset link is on its way.") });
        }).catch(function (err) { renderAuth("reset", { kind: "error", text: err.message }); });
      };
    } else if (mode === "mfa") {
      authCard(brandRow() + '<h3>' + CC.esc(T("Two-factor authentication")) + "</h3><p class=\"muted\">" + CC.esc(T("Enter the 6-digit code from your authenticator app.")) + "</p>" + msg(note && note.kind, note && note.text) +
        '<form id="f-mfa"><div class="field"><label for="mf-code">' + CC.esc(T("6-digit code")) + '</label><input id="mf-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code"></div>' +
        '<button class="btn btn-primary btn-block" type="submit">' + CC.esc(T("Verify")) + "</button></form>");
      $("f-mfa").onsubmit = function (e) {
        e.preventDefault();
        CC.api.mfa.challenge($("mf-code").value.trim()).then(afterAuth).catch(function (err) { renderAuth("mfa", { kind: "error", text: err.message }); });
      };
    } else if (mode === "recovery") {
      authCard(brandRow() + '<h3>' + CC.esc(T("Choose a new password")) + "</h3>" + msg(note && note.kind, note && note.text) +
        '<form id="f-rec"><div class="field"><label for="rc-pw">' + CC.esc(T("New password (at least 10 characters)")) + '</label><input id="rc-pw" type="password" minlength="10" required autocomplete="new-password"></div>' +
        '<button class="btn btn-primary btn-block" type="submit">' + CC.esc(T("Save password")) + "</button></form>");
      $("f-rec").onsubmit = function (e) {
        e.preventDefault();
        CC.api.updatePassword($("rc-pw").value).then(afterAuth).catch(function (err) { renderAuth("recovery", { kind: "error", text: err.message }); });
      };
    } else if (mode === "noaccess") {
      authCard(brandRow() + '<h3>' + CC.esc(T("No access")) + "</h3><p class=\"muted\">" + CC.esc(note || "") + '</p><button class="btn btn-secondary" id="so">' + CC.esc(T("Sign out")) + "</button>");
      $("so").onclick = signOut;
    }
    bindAuthCommon();
  }

  function demoBox() {
    if (CC.api.mode !== "demo") return "";
    var roles = [["u_admin", "Platform admin", "Manage everything"], ["u_ga", "Group Admin", "3-practice group"], ["u_pr1", "Principal", "Cardiff Bay Dental"], ["u_pm1", "Practice Manager", "Cardiff Bay Dental"], ["u_st1", "Staff", "Cardiff Bay Dental"], ["u_insp", "Inspector (HIW)", "Read-only, time-boxed"], ["u_pr4", "Independent Principal", "Aberystwyth"]];
    return '<div class="demo-box"><h4>' + CC.esc(CC.t("Demo mode")) + "</h4><p>" + CC.esc(CC.t("Sample data stored only in your browser. Pick a role to explore.")) + '</p><div class="demo-roles">' +
      roles.map(function (r) { return '<button type="button" data-demo="' + r[0] + '">' + CC.esc(CC.t(r[1])) + "<small>" + CC.esc(CC.t(r[2])) + "</small></button>"; }).join("") +
      '</div><p style="margin:10px 0 0"><button type="button" class="link-btn" id="demo-reset">' + CC.esc(CC.t("Reset demo data")) + "</button></p></div>";
  }
  function bindDemo() {
    document.querySelectorAll("[data-demo]").forEach(function (b) {
      b.onclick = function () { CC.api.demoLogin(b.getAttribute("data-demo")).then(afterAuth); };
    });
    var r = $("demo-reset");
    if (r) r.onclick = function () { CC.api.demoReset(); CC.toast(CC.t("Demo data reset.")); };
  }

  /* ---------- session ---------- */
  function signOut() {
    CC.api.signOut().then(function () { S.user = null; S.profile = null; location.hash = ""; renderAuth("signin"); });
  }
  CC.signOut = signOut;

  function afterAuth() {
    return CC.api.getProfile().then(function (p) {
      if (!p) return renderAuth("noaccess", CC.t("Your account has no portal access yet. Ask your Principal, Group Admin or Cymru Compliance to invite you."));
      if (!p.active) return renderAuth("noaccess", CC.t("Your access has been deactivated. Please contact your practice or Cymru Compliance."));
      S.profile = p; S.user = { id: p.id, email: p.email };
      if (!localStorage.getItem("cc_lang") && p.language) CC.setLang(p.language);
      return Promise.all([CC.api.practices.list(), CC.api.groups.list()]).then(function (r) {
        S.practices = r[0]; S.groups = r[1];
        S.practiceId = (p.practice_id && S.practices.some(function (x) { return x.id === p.practice_id; })) ? p.practice_id : (S.practices[0] ? S.practices[0].id : null);
        var needMfa = (p.role === "principal" || p.role === "group_admin") && CC.api.mode === "live";
        return (needMfa ? CC.api.mfa.status().then(function (m) { S.mfaNudge = !m.enrolled; }, function () {}) : Promise.resolve());
      }).then(function () {
        buildShell();
        if (!location.hash || location.hash === "#") location.hash = "#/" + NAV[p.role][0]; else CC.render();
      });
    }).catch(function (e) { CC.fail(e); renderAuth("signin", { kind: "error", text: e.message }); });
  }

  /* ---------- shell ---------- */
  var P = function (d) { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>"; };
  var ICONS = {
    dashboard: P('<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>'),
    group: P('<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>'),
    practices: P('<path d="M3 21h18M6 21V10h12v11M12 6v8M8 10V6h8v4"/>'),
    check: P('<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>'),
    evidence: P('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    training: P('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>'),
    my: P('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
    bookings: P('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    team: P('<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2.5.6 4 2.3 4 5"/>'),
    inspectors: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    inspect: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    users: P('<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2"/>'),
    orgs: P('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4"/>'),
    enquiries: P('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 8l9 6 9-6"/>'),
    audit: P('<path d="M7 3h8l4 4v14H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
    settings: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>')
  };

  function buildShell() {
    $("boot").hidden = true; $("auth").hidden = true; $("app").hidden = false;
    var p = S.profile, nav = NAV[p.role];
    $("side-nav").innerHTML = nav.map(function (id) {
      var r = ROUTES[id];
      return '<a href="#/' + id + '" data-route="' + id + '"><span class="ico">' + (ICONS[id] || r.ico) + "</span><span>" + CC.esc(CC.t(r.label)) + "</span></a>";
    }).join("");
    var initials = (p.full_name || p.email || "?").split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase();
    $("avatar").textContent = initials;
    $("who").innerHTML = CC.esc(p.full_name || p.email) + "<small>" + CC.esc(CC.roleLabel(p.role)) + "</small>";
    document.querySelectorAll("#lang-toggle button").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-lang") === CC.lang); });
    if ($("back-site")) $("back-site").textContent = CC.t("← Back to website");
  }

  function buildPracticeSelect(route) {
    var sel = $("practice-select"), r = ROUTES[route];
    if (!(r && r.scoped && MULTI.indexOf(CC.role()) >= 0 && S.practices.length > 1)) { sel.hidden = true; return; }
    sel.hidden = false;
    sel.innerHTML = CC.options(S.practices.map(function (p) { return { value: p.id, label: p.name }; }), S.practiceId);
    sel.onchange = function () { S.practiceId = sel.value; CC.render(); };
  }

  CC.render = function () {
    if (!S.profile) return Promise.resolve();
    var route = (location.hash || "").replace(/^#\//, "").split("?")[0];
    var role = S.profile.role;
    if (!ROUTES[route] || ROUTES[route].roles.indexOf(role) < 0) { location.hash = "#/" + NAV[role][0]; return Promise.resolve(); }
    S.route = route;
    document.body.classList.remove("nav-open");
    document.querySelectorAll("#side-nav a").forEach(function (a) { a.classList.toggle("active", a.getAttribute("data-route") === route || (route === "dashboard" && a.getAttribute("data-route") === "group" && role === "group_admin")); });
    $("page-title").textContent = CC.t(ROUTES[route].label);
    document.title = CC.t(ROUTES[route].label) + " — Cymru Compliance";
    buildPracticeSelect(route);
    var el = $("view");
    CC.destroyCharts();
    el.innerHTML = '<p class="muted">' + CC.esc(CC.t("Loading…")) + "</p>";
    var fn = CC.views[route];
    if (!fn) { el.innerHTML = '<div class="empty">' + CC.esc(CC.t("This section is not available.")) + "</div>"; return Promise.resolve(); }
    return Promise.resolve().then(function () { return fn(el); }).then(function () {
      if (S.mfaNudge && route === "dashboard") {
        var b = document.createElement("div"); b.className = "banner warn";
        b.innerHTML = "<span>" + CC.esc(CC.t("Protect your account: turn on two-factor authentication.")) + '</span><a class="btn btn-secondary btn-sm" href="#/settings">' + CC.esc(CC.t("Set up now")) + "</a>";
        el.insertBefore(b, el.firstChild);
      }
    }).catch(function (e) {
      console.error(e);
      el.innerHTML = '<div class="panel"><h3>' + CC.esc(CC.t("Something went wrong")) + "</h3><p class=\"muted\">" + CC.esc(e.message || e) + "</p></div>";
    });
  };

  /* ---------- boot ---------- */
  function boot() {
    document.documentElement.setAttribute("lang", CC.lang);
    CC.api = CC.live && window.supabase ? CC.makeSupabaseApi() : CC.makeDemoApi();
    if (CC.live && !window.supabase) console.warn("Supabase library failed to load; running in demo mode.");
    CC.api.onRecovery(function () { renderAuth("recovery"); });

    $("menu-btn").onclick = function () { document.body.classList.toggle("nav-open"); };
    $("scrim").onclick = function () { document.body.classList.remove("nav-open"); };
    document.querySelectorAll("#lang-toggle button").forEach(function (b) {
      b.onclick = function () {
        CC.setLang(b.getAttribute("data-lang"));
        if (S.profile) { CC.api.profiles.updateMe(null, CC.lang).catch(function () {}); buildShell(); CC.render(); }
      };
    });
    window.addEventListener("hashchange", CC.render);

    CC.api.init().then(function (user) {
      if (user) return afterAuth(); else renderAuth("signin");
    }).catch(function (e) { console.error(e); renderAuth("signin", { kind: "error", text: e.message }); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
