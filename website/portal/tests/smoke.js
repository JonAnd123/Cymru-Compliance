const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");
const ROOT = "/sessions/vigilant-bold-mccarthy/mnt/Cymru Compliance/website";
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0, checks = 0;
function ok(name, cond, extra) { checks++; if (!cond) { failures++; console.log("  FAIL", name, extra || ""); } }

async function newApp(userId, lang) {
  const html = fs.readFileSync(ROOT + "/portal/app.html", "utf8").replace(/<script[\s\S]*?<\/script>/g, "");
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/portal/app.html", pretendToBeVisual: true });
  const w = dom.window, errors = [];
  w.console.error = (...a) => errors.push(a.map(String).join(" "));
  w.addEventListener("error", e => errors.push("window error: " + e.message));
  w.addEventListener("unhandledrejection", e => errors.push("unhandled: " + e.reason));
  w.Chart = class { constructor(c, cfg) { this.cfg = cfg; w.__charts = (w.__charts || 0) + 1; } destroy() {} };
  w.URL.createObjectURL = () => "blob:demo";
  w.print = () => {}; w.open = () => {};
  if (lang) w.localStorage.setItem("cc_lang", lang);
  const files = ["js/site-config.js", "portal/js/scoring.js", "portal/js/core.js", "portal/js/i18n.js", "portal/js/demo-content.js", "portal/js/api-demo.js", "portal/js/api-supabase.js", "portal/js/views-dashboard.js", "portal/js/views-practice.js", "portal/js/views-group.js", "portal/js/views-admin.js", "portal/js/app.js"];
  for (const f of files) w.eval(fs.readFileSync(path.join(ROOT, f), "utf8") + "\n//# sourceURL=" + f);
  await sleep(60);
  if (userId) { w.document.querySelector(`[data-demo="${userId}"]`).click(); await sleep(150); }
  return { dom, w, errors, doc: w.document };
}
async function go(app, route) { app.w.location.hash = "#/" + route; await sleep(120); }
const view = app => app.doc.getElementById("view");
const modal = app => app.doc.querySelector(".modal-overlay");

const ROLES = [["u_admin", "platform_admin"], ["u_ga", "group_admin"], ["u_pr1", "principal"], ["u_pm1", "practice_manager"], ["u_st1", "staff"], ["u_insp", "inspector"], ["u_pr4", "principal (independent)"]];

(async () => {
  for (const lang of ["en", "cy"]) {
    console.log(`\n=== Language: ${lang}`);
    for (const [uid, label] of ROLES) {
      const app = await newApp(uid, lang);
      const routes = [...app.doc.querySelectorAll("#side-nav a")].map(a => a.getAttribute("data-route"));
      ok(`${label}: nav built`, routes.length >= 2, routes.join(","));
      for (const r of routes) {
        app.errors.length = 0;
        await go(app, r);
        const html = view(app).innerHTML;
        ok(`${label}/${r}: renders`, html.length > 200 && !/Something went wrong|Loading…|Llwytho…/.test(html), html.slice(0, 160));
        ok(`${label}/${r}: no console errors`, app.errors.length === 0, app.errors.join(" | ").slice(0, 300));
      }
      app.dom.window.close();
    }
  }

  console.log("\n=== Interactions");
  // Principal: dashboard charts + drill
  let app = await newApp("u_pr1");
  await go(app, "dashboard");
  ok("principal dashboard draws 3 charts", app.w.__charts >= 3, String(app.w.__charts));
  ok("principal dashboard shows group comparison", /vs group average|o gymharu â chyfartaledd/.test(view(app).innerHTML));
  view(app).querySelector("[data-cat]").click(); await sleep(150);
  ok("category drill-down modal opens", !!modal(app));
  modal(app).querySelector("[data-close]").click();

  // Compliance check full flow
  await go(app, "check");
  const startBtn = view(app).querySelector('[data-act="start"]'); ok("check: start button", !!startBtn);
  startBtn.click(); await sleep(150);
  const radios = view(app).querySelectorAll('input[type=radio][value="yes"]'); ok("check: 24 questions", radios.length === 24, String(radios.length));
  radios.forEach(r => { r.checked = true; r.dispatchEvent(new app.w.Event("change", { bubbles: true })); }); await sleep(100);
  view(app).querySelector('[data-act="complete"]').click(); await sleep(300);
  ok("check: gap report modal after completing", !!modal(app) && /No gaps|Gap report|bylchau/i.test(modal(app).innerHTML));
  modal(app) && modal(app).remove();

  // Evidence add via API then verify flow in UI
  const api = app.w.CC.api;
  const ev = await api.evidence.add({ practice_id: "p1", category: "policies", title: "Test policy", expiry_date: app.w.CC.isoDate(10), status: "pending", file: { name: "x.pdf" } });
  await go(app, "evidence");
  ok("evidence: new row listed", /Test policy/.test(view(app).innerHTML));
  view(app).querySelector(`[data-act="verify"][data-id="${ev.id}"]`).click(); await sleep(150);
  const evs = await api.evidence.list("p1"); ok("evidence: verified via UI", evs.find(e => e.id === ev.id).status === "verified");
  ok("evidence: audit entry written", (await api.audit.list({})).some(a => a.action === "verify_evidence"));

  // Add-evidence modal opens
  view(app).querySelector('[data-act="add"]').click(); await sleep(50); ok("evidence: add modal opens", !!modal(app) && !!modal(app).querySelector('input[type=file]')); modal(app).remove();

  // Team invite + inspector grant
  await go(app, "team");
  view(app).querySelector('[data-act="invite"]').click(); await sleep(50);
  const m = modal(app); m.querySelector('[name=full_name]').value = "New Person"; m.querySelector('[name=email]').value = "new@x.com";
  m.querySelector("form").dispatchEvent(new app.w.Event("submit", { cancelable: true })); await sleep(200);
  ok("team: invite created", /new@x\.com/.test(view(app).innerHTML));
  await go(app, "inspectors");
  view(app).querySelector('[data-act="grant"]').click(); await sleep(50);
  const g = modal(app); g.querySelector('[name=email]').value = "insp2@hiw.example";
  g.querySelector("form").dispatchEvent(new app.w.Event("submit", { cancelable: true })); await sleep(250);
  ok("inspectors: grant listed", /insp2@hiw\.example/.test(view(app).innerHTML));

  // Training assign
  await go(app, "training");
  const assignBtn = view(app).querySelector('[data-act="assign"]'); assignBtn.click(); await sleep(50);
  const tm = modal(app); tm.querySelector('input[name=who]').checked = true;
  tm.querySelector("form").dispatchEvent(new app.w.Event("submit", { cancelable: true })); await sleep(200);
  ok("training: assignment created", (await api.training.assignments({ practice_id: "p1" })).length > 13);

  // Bookings
  await go(app, "bookings");
  view(app).querySelector('[data-act="book"]').click(); await sleep(50);
  modal(app).querySelector("form").dispatchEvent(new app.w.Event("submit", { cancelable: true })); await sleep(200);
  ok("bookings: request created", (await api.bookings.list()).filter(b => b.practice_id === "p1").length >= 2);
  app.dom.window.close();

  // Staff: scoping and own upload
  app = await newApp("u_st1");
  await go(app, "my");
  ok("staff: sees own training", /Welcome and practice induction/.test(view(app).innerHTML));
  const sev = await app.w.CC.api.evidence.list("p1"); ok("staff: only sees own evidence", sev.every(e => e.staff_member === "u_st1" || e.uploaded_by === "u_st1"));
  const sub = await app.w.CC.api.evidence.add({ practice_id: "p1", category: "staff_training", title: "Staff cert", status: "verified" });
  ok("staff: upload forced to pending", sub.status === "pending");
  let denied = false; try { await app.w.CC.api.evidence.setStatus(sub.id, "verified"); } catch (e) { denied = true; } ok("staff: cannot verify", denied);
  app.w.location.hash = "#/evidence"; await sleep(100); ok("staff: evidence route redirected", app.w.location.hash !== "#/evidence");
  app.dom.window.close();

  // Group admin
  app = await newApp("u_ga");
  await go(app, "group");
  ok("group: draws chart + table of 3 practices", app.w.__charts >= 1 && (view(app).innerHTML.match(/data-view=/g) || []).length >= 3);
  ok("group: needs-attention list", /Needs attention|Angen sylw/.test(view(app).innerHTML));
  let gd = false; try { await app.w.CC.api.evidence.list("p3"); const l = await app.w.CC.api.evidence.list("p3"); gd = l.length === 0; } catch (e) { gd = true; } ok("group admin cannot read evidence rows", gd);
  view(app).querySelector("[data-view]").click(); await sleep(200); ok("group: drill into practice dashboard", app.w.location.hash === "#/dashboard" && /Overall compliance/.test(view(app).innerHTML));
  await go(app, "practices");
  view(app).querySelector('[data-act="add"]').click(); await sleep(50);
  const pm = modal(app); pm.querySelector('[name=name]').value = "Wrexham Dental"; pm.querySelector('[name=pname]').value = "Dr W"; pm.querySelector('[name=pemail]').value = "w@x.com";
  pm.querySelector("form").dispatchEvent(new app.w.Event("submit", { cancelable: true })); await sleep(250);
  ok("group: practice added + principal invited", /Wrexham Dental/.test(view(app).innerHTML) && /w@x\.com/.test(view(app).innerHTML));
  await go(app, "bookings");
  view(app).querySelector('[data-act="book"]').click(); await sleep(50);
  const bm = modal(app); bm.querySelectorAll('input[name=pids]').forEach(c => c.checked = true);
  bm.querySelector("form").dispatchEvent(new app.w.Event("submit", { cancelable: true })); await sleep(250);
  ok("group: bulk booking creates one per practice", (await app.w.CC.api.bookings.list()).filter(b => b.kind === "pre_inspection").length >= 5);
  app.dom.window.close();

  // Inspector
  app = await newApp("u_insp");
  await go(app, "inspect");
  ok("inspector: sees expiry banner + evidence", /expires|dod i ben/i.test(view(app).innerHTML) && /data-open/.test(view(app).innerHTML));
  let wd = false; try { await app.w.CC.api.evidence.add({ practice_id: "p1", category: "policies", title: "x" }); } catch (e) { wd = true; } ok("inspector cannot write", wd);
  const sel = app.doc.getElementById("practice-select"); ok("inspector: practice selector for 2 grants", !sel.hidden && sel.options.length === 2);
  app.dom.window.close();

  // Platform admin
  app = await newApp("u_admin");
  await go(app, "users");
  view(app).querySelector('[data-act="invite"]').click(); await sleep(50);
  const im = modal(app); im.querySelector('[name=full_name]').value = "New Admin"; im.querySelector('[name=email]').value = "admin2@x.com"; im.querySelector("#inv-role").value = "platform_admin"; im.querySelector("#inv-role").dispatchEvent(new app.w.Event("change"));
  im.querySelector("form").dispatchEvent(new app.w.Event("submit", { cancelable: true })); await sleep(200);
  ok("admin: invite created", /admin2@x\.com/.test(view(app).innerHTML));
  await go(app, "enquiries"); ok("admin: enquiries listed", /Lowri Bevan/.test(view(app).innerHTML));
  await go(app, "bookings"); const comp = view(app).querySelector('[data-act="complete"]'); ok("admin: can complete bookings", !!comp);
  app.dom.window.close();

  // Language toggle + settings + MFA demo
  app = await newApp("u_pr1");
  app.doc.querySelector('#lang-toggle [data-lang="cy"]').click(); await sleep(150);
  ok("language toggle switches html lang", app.doc.documentElement.lang === "cy");
  await go(app, "settings"); ok("settings renders", /Cymraeg/.test(view(app).innerHTML));
  app.dom.window.close();

  // Sign out -> sign in screen
  app = await newApp("u_pr1"); app.w.CC.signOut(); await sleep(100);
  ok("sign out returns to auth screen", !app.doc.getElementById("auth").hidden && app.doc.getElementById("app").hidden);
  app.dom.window.close();

  console.log(`\n${checks - failures}/${checks} checks passed`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error("HARNESS CRASH", e); process.exit(2); });
