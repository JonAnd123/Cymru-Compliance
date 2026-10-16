// Sends expiry reminder e-mails. Run on a schedule (see .github/workflows/alert-digest.yml).
// Needs: SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, MAIL_FROM, PORTAL_URL (optional), DRY_RUN=1 (optional)
// Node 18+ (global fetch). The service key bypasses RLS: keep it ONLY in GitHub Actions secrets.
const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, MAIL_FROM, PORTAL_URL = "", DRY_RUN } = process.env;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const LABEL = { evidence: "Evidence", gdc: "GDC registration", indemnity: "Indemnity", dbs: "DBS", training: "Training overdue", task: "Task", maintenance: "Maintenance" };
const T = {
  en: { subj: (n) => `Cymru Compliance: ${n} item${n === 1 ? "" : "s"} need attention`, hi: "Hello", intro: "These items have expired or are about to expire:", open: "Open the portal", expired: (d) => `expired ${-d} day${d === -1 ? "" : "s"} ago`, today: "today", inn: (d) => `in ${d} days`, off: "You can turn these reminders off in the portal under Alerts.", cols: ["Item", "Type", "Person", "Date", "When"] },
  cy: { subj: (n) => `Cymru Compliance: mae ${n} eitem angen sylw`, hi: "Helo", intro: "Mae'r eitemau hyn wedi dod i ben neu ar fin dod i ben:", open: "Agor y porth", expired: (d) => `daeth i ben ${-d} diwrnod yn ôl`, today: "heddiw", inn: (d) => `ymhen ${d} diwrnod`, off: "Gallwch ddiffodd y nodiadau atgoffa hyn yn y porth o dan Rhybuddion.", cols: ["Eitem", "Math", "Person", "Dyddiad", "Pryd"] }
};

export function buildEmail(rows, lang = "en") {
  const L = T[lang === "cy" ? "cy" : "en"];
  const sorted = [...rows].sort((a, b) => a.days_left - b.days_left);
  const when = (d) => (d < 0 ? L.expired(d) : d === 0 ? L.today : L.inn(d));
  const tr = sorted.map((r) => `<tr><td>${esc(r.title)}</td><td>${esc(LABEL[r.kind] || r.kind)}</td><td>${esc(r.who)}</td><td>${esc(r.due_date)}</td><td style="color:${r.days_left < 0 ? "#b02f2f" : "#8a5e00"}">${esc(when(r.days_left))}</td></tr>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1e293b"><p>${L.hi} ${esc(rows[0].full_name || "")},</p><p>${L.intro}</p>` +
    `<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#e2e8f0"><tr style="background:#f1f5f9">${L.cols.map((c) => `<th align="left">${c}</th>`).join("")}</tr>${tr}</table>` +
    (PORTAL_URL ? `<p><a href="${esc(PORTAL_URL)}#/alerts">${L.open}</a></p>` : "") + `<p style="color:#64748b;font-size:12px">${L.off}</p></div>`;
  return { subject: L.subj(rows.length), html };
}

// group rows by recipient
export function groupByRecipient(rows) {
  const m = new Map();
  for (const r of rows) { if (!m.has(r.profile_id)) m.set(r.profile_id, []); m.get(r.profile_id).push(r); }
  return [...m.values()];
}

async function rpc(name, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${name} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function send(to, msg) {
  const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: MAIL_FROM, to: [to], subject: msg.subject, html: msg.html }) });
  if (!res.ok) throw new Error(`send to ${to} failed: ${res.status} ${await res.text()}`);
}

async function main() {
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"]) if (!process.env[k]) throw new Error(`${k} is not set`);
  if (!DRY_RUN) for (const k of ["RESEND_API_KEY", "MAIL_FROM"]) if (!process.env[k]) throw new Error(`${k} is not set`);
  const rows = await rpc("alerts_due", { p_window: 60 });
  console.log(`${rows.length} reminder rows due`);
  let sent = 0;
  for (const group of groupByRecipient(rows)) {
    const msg = buildEmail(group, group[0].language);
    try {
      if (DRY_RUN) console.log(`[dry run] ${group[0].email}: ${msg.subject}`);
      else await send(group[0].email, msg);
      if (!DRY_RUN) await rpc("alerts_mark_sent", { p_rows: group.map((g) => ({ profile_id: g.profile_id, key: g.key })) });
      sent++;
    } catch (e) { console.error(e.message); process.exitCode = 1; }   // keep going; unsent rows retry tomorrow
  }
  console.log(`${sent} e-mails ${DRY_RUN ? "(dry run) " : ""}processed`);
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href) main().catch((e) => { console.error(e); process.exit(1); });
