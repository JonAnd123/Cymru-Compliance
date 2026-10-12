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
  const files = ["js/site-config.js", "portal/js/scoring.js", "portal/js/core.js","portal/js/hr-core.js", "portal/js/i18n.js","portal/js/i18n-hr.js", "portal/js/demo-content.js", "portal/js/demo-hr.js","portal/js/api-demo.js", "portal/js/api-supabase.js", "portal/js/views-dashboard.js", "portal/js/views-practice.js", "portal/js/views-group.js", "portal/js/views-admin.js", "portal/js/views-hr.js","portal/js/app.js"];
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


  // ---------------- HR module ----------------
  console.log("\n=== HR");
  const submit = (a, root) => { (root || modal(a)).querySelector("form").dispatchEvent(new a.w.Event("submit", { cancelable: true })); };
  app = await newApp("u_pm1");
  await go(app, "hr");
  ok("hr: staff cards shown", view(app).querySelectorAll(".hr-card").length >= 6, String(view(app).querySelectorAll(".hr-card").length));
  ok("hr: shows only own practice staff", !/Newport|Callum Reid/.test(view(app).innerHTML));
  ok("hr: initials avatar for staff without photo", view(app).querySelectorAll(".hr-avatar-init").length >= 6);
  view(app).querySelector('.hr-card[data-act="open"]').click(); await sleep(200);
  ok("hr: staff record modal opens with 4 tabs", !!modal(app) && modal(app).querySelectorAll("[data-ptab]").length === 4);
  ok("hr: balance cards in staff record", /Entitlement/.test(modal(app).innerHTML) && modal(app).querySelectorAll(".hr-bal .kpi").length === 4);
  ok("hr: manager sees edit/record-leave actions", !!modal(app).querySelector('[data-act="edit"]') && !!modal(app).querySelector('[data-act="recordleave"]'));
  modal(app).querySelector('[data-ptab="docs"]').click();
  ok("hr: documents tab switches", !modal(app).querySelector('[data-panel="docs"]').hidden && modal(app).querySelector('[data-panel="details"]').hidden);
  modal(app).querySelector("[data-close]").click();
  // pending → approve
  const hrApi = () => app.w.CC.api.hr;
  const pendBefore = (await hrApi().leave.list({ practice_id: "p1" })).filter(l => l.status === "pending").length;
  view(app).querySelector('[data-tab="leave"]').click(); await sleep(60);
  ok("hr: pending requests listed", pendBefore >= 2 && view(app).querySelectorAll('[data-act="approve"]').length === pendBefore);
  view(app).querySelector('[data-act="approve"]').click(); await sleep(250);
  const pendAfter = (await hrApi().leave.list({ practice_id: "p1" })).filter(l => l.status === "pending").length;
  ok("hr: approving a request updates status", pendAfter === pendBefore - 1);
  const au = await app.w.CC.api.audit.list({ practice_id: "p1" });
  ok("hr: approval written to audit log", au.some(a => a.action === "hr_leave_approved"));
  // decline needs modal
  await go(app, "hr"); view(app).querySelector('[data-tab="leave"]').click(); await sleep(60);
  view(app).querySelector('[data-act="decline"]').click(); await sleep(60);
  modal(app).querySelector("[name=note]").value = "Too busy"; submit(app); await sleep(250);
  ok("hr: decline stores manager note", (await hrApi().leave.list({ practice_id: "p1" })).some(l => l.status === "declined" && l.manager_note === "Too busy"));
  // calendar + absence
  await go(app, "hr"); view(app).querySelector('[data-tab="calendar"]').click(); await sleep(60);
  ok("hr: calendar renders month grid with legend", view(app).querySelectorAll(".cal-cell").length >= 28 && /Sick leave/.test(view(app).innerHTML));
  view(app).querySelector('[data-act="calnext"]').click(); await sleep(30);
  ok("hr: calendar next month works", view(app).querySelectorAll(".cal-cell").length >= 28);
  view(app).querySelector('[data-tab="absence"]').click(); await sleep(60);
  ok("hr: absence tab shows Bradford factor", /Bradford factor/.test(view(app).innerHTML) && view(app).querySelectorAll("table.data tbody tr").length >= 5);
  // add staff
  await go(app, "hr"); view(app).querySelector('[data-act="addstaff"]').click(); await sleep(60);
  let am = modal(app); am.querySelector("[name=full_name]").value = "Test Newstarter"; am.querySelector("[name=job_title]").value = "Dental nurse"; am.querySelector("[name=email]").value = "test.new@cardiffbaydental.example";
  submit(app); await sleep(300);
  ok("hr: add staff member", /Test Newstarter/.test(view(app).innerHTML));
  // record leave via modal; overlap rejected
  view(app).querySelector('[data-act="recordleave"]').click(); await sleep(60);
  let lm = modal(app); const ns = (await hrApi().staff.list({ practice_id: "p1" })).filter(x => x.full_name === "Test Newstarter")[0];
  lm.querySelector("[name=staff_id]").value = ns.id; lm.querySelector("[name=leave_type]").value = "sick";
  const monday = (() => { let d = new Date(); d.setDate(d.getDate() + 90); while (d.getDay() !== 1) d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  lm.querySelector("[name=start_date]").value = monday; lm.querySelector("[name=end_date]").value = monday;
  submit(app); await sleep(300);
  ok("hr: record sick leave", (await hrApi().leave.list({ staff_id: ns.id })).some(l => l.leave_type === "sick" && l.status === "approved" && l.days === 1));
  view(app).querySelector('[data-act="recordleave"]').click(); await sleep(60);
  lm = modal(app); lm.querySelector("[name=staff_id]").value = ns.id; lm.querySelector("[name=start_date]").value = monday; lm.querySelector("[name=end_date]").value = monday;
  submit(app); await sleep(200);
  ok("hr: overlapping leave rejected", /overlap/i.test(modal(app).querySelector(".modal-error").textContent));
  modal(app).querySelector("[data-close]").click();
  // photo upload (demo stores data URL)
  const pf = new app.w.File([new Uint8Array([137, 80, 78, 71])], "me.png", { type: "image/png" });
  await hrApi().staff.setPhoto({ id: ns.id, practice_id: "p1" }, pf);
  const withPhoto = (await hrApi().staff.list({ practice_id: "p1" })).filter(x => x.id === ns.id)[0];
  const urls = await hrApi().photoUrls([withPhoto.photo_path]);
  ok("hr: photo stored and resolvable", !!withPhoto.photo_path && /^data:/.test(urls[withPhoto.photo_path] || ""));
  // document + note
  const df = new app.w.File(["%PDF-1.4 demo"], "contract.pdf", { type: "application/pdf" });
  await hrApi().docs.add({ practice_id: "p1", staff_id: ns.id, kind: "contract", title: "Contract" }, df);
  await hrApi().notes.add({ practice_id: "p1", staff_id: ns.id, kind: "general", body: "Welcome" });
  ok("hr: document and note saved", (await hrApi().docs.list(ns.id)).length === 1 && (await hrApi().notes.list(ns.id)).length === 1);
  app.dom.window.close();

  // Staff self-service
  app = await newApp("u_st1");
  await go(app, "myhr");
  ok("myhr: balance and details render", /Entitlement/.test(view(app).innerHTML) && /Owen Evans/.test(view(app).innerHTML));
  ok("myhr: team off list (no leave types shown)", /Who is off in the next 8 weeks/.test(view(app).innerHTML) && !/Sick leave<\/li>/.test(view(app).innerHTML));
  ok("myhr: staff sees only own HR record", (await hrApi().staff.list({})).length === 1);
  { const lv = await hrApi().leave.list({}); ok("myhr: staff sees only own leave", lv.length > 0 && lv.every(l => l.staff_id === lv[0].staff_id)); }
  ok("myhr: staff cannot read HR notes/documents", (await hrApi().notes.list("hs1")).length === 0 && (await hrApi().docs.list("hs3")).length === 0);
  const own = await hrApi().staff.mine("owen@cardiffbaydental.example", "p1");
  const before = (await hrApi().leave.list({ staff_id: own.id })).length;
  view(app).querySelector('[data-act="request"]').click(); await sleep(60);
  const rd = (() => { let d = new Date(); d.setDate(d.getDate() + 120); while (d.getDay() !== 2) d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  let rm = modal(app); rm.querySelector("[name=start_date]").value = rd; rm.querySelector("[name=end_date]").value = rd;
  ok("myhr: request form offers no maternity/paternity types", !/Maternity|Paternity/.test(rm.querySelector("[name=leave_type]").innerHTML));
  submit(app); await sleep(300);
  const after = await hrApi().leave.list({ staff_id: own.id });
  ok("myhr: request created as pending", after.length === before + 1 && after.some(l => l.start_date === rd && l.status === "pending"));
  view(app).querySelector('[data-act="request"]').click(); await sleep(60);
  rm = modal(app); const far = (() => { let d = new Date(); d.setDate(d.getDate() + 200); return d.toISOString().slice(0, 10); })();
  const far2 = (() => { let d = new Date(); d.setDate(d.getDate() + 260); return d.toISOString().slice(0, 10); })();
  rm.querySelector("[name=start_date]").value = far; rm.querySelector("[name=end_date]").value = far2; submit(app); await sleep(200);
  ok("myhr: cannot request more annual leave than remaining", /only have/i.test(modal(app).querySelector(".modal-error").textContent));
  modal(app).querySelector("[data-close]").click();
  const cancelBtn = [...view(app).querySelectorAll('[data-act="cancel"]')][0];
  ok("myhr: can cancel own pending request", !!cancelBtn);
  cancelBtn.click(); await sleep(60); modal(app).querySelector('button[type="submit"]').click(); modal(app) && submit(app); await sleep(250);
  ok("myhr: cancelled request status", (await hrApi().leave.list({ staff_id: own.id })).some(l => l.status === "cancelled"));
  const sdeny = await hrApi().leave.update(after.filter(l => l.status === "pending")[0] ? after.filter(l => l.status === "pending")[0].id : "x", { status: "approved" }).then(() => "allowed", () => "denied");
  ok("myhr: staff cannot approve leave", sdeny === "denied");
  ok("myhr: staff has no HR management route", !app.doc.querySelector('#side-nav [data-route="hr"]'));
  app.dom.window.close();

  // Group HR (read-only) + audit
  app = await newApp("u_ga");
  await go(app, "hrgroup");
  ok("hrgroup: roll-up has a row per practice", view(app).querySelectorAll("table.data tbody tr").length === 3, String(view(app).querySelectorAll("table.data tbody tr").length));
  ok("hrgroup: directory lists staff across sites", /Callum Reid/.test(view(app).innerHTML) && /Gethin Morris/.test(view(app).innerHTML) && !/Emyr Hughes/.test(view(app).innerHTML));
  view(app).querySelector('#g-list [data-act="open"]').click(); await sleep(250);
  ok("hrgroup: group admin sees full record but no edit actions", !!modal(app) && !modal(app).querySelector('[data-act="edit"]') && !modal(app).querySelector('[data-act="recordleave"]'));
  ok("hrgroup: full leave detail visible", /Sick leave|Annual leave|Maternity/.test(modal(app).innerHTML));
  modal(app).querySelector("[data-close]").click();
  const gaud = await app.w.CC.api.audit.list({});
  ok("hrgroup: record view audited", gaud.some(a => a.action === "view_hr_record"));
  ok("hrgroup: cannot create staff or leave", await app.w.CC.api.hr.staff.create({ practice_id: "p1", full_name: "x" }).then(() => false, () => true));
  ok("hrgroup: cannot decide leave", await app.w.CC.api.hr.leave.update("x", { status: "approved" }).then(() => false, () => true));
  view(app).querySelector('[data-act="site"]').click(); await sleep(250);
  ok("hrgroup: open site HR is read-only", /read-only/.test(view(app).innerHTML) && !view(app).querySelector('[data-act="addstaff"]'));
  ok("hrgroup: no approve buttons for group admin", !view(app).querySelector('[data-act="approve"]'));
  app.dom.window.close();

  // Isolation
  app = await newApp("u_pr4");
  await go(app, "hr");
  ok("hr: independent practice sees only its own staff", /Nia Parry/.test(view(app).innerHTML) && !/Owen Evans|Callum Reid/.test(view(app).innerHTML));
  ok("hr: inspector has no HR", !(await newApp("u_insp")).doc.querySelector('#side-nav [data-route^="hr"], #side-nav [data-route="myhr"]'));
  app.dom.window.close();
  app = await newApp("u_pr1", "cy");
  await go(app, "myhr");
  ok("hr: Welsh strings render", /Fy Adnoddau Dynol|Ceisiadau|Hawl/.test(view(app).innerHTML) || /Mae eich cofnod|Nid yw eich cofnod/.test(view(app).innerHTML), view(app).innerHTML.slice(0, 200));
  await go(app, "hr"); ok("hr: Welsh people tab", /Adnoddau Dynol/.test(view(app).innerHTML));
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
