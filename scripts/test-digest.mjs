import assert from "node:assert/strict";
import { buildEmail, groupByRecipient } from "./send-alert-digests.mjs";
const rows = [
  { profile_id: "a", email: "a@x", full_name: "Dr <Sian>", language: "en", kind: "evidence", title: "Fire risk assessment", who: "", due_date: "2026-10-20", days_left: 5 },
  { profile_id: "a", email: "a@x", full_name: "Dr <Sian>", language: "en", kind: "gdc", title: "GDC registration", who: "Owen Evans", due_date: "2026-10-10", days_left: -5 },
  { profile_id: "b", email: "b@x", full_name: "Rhian", language: "cy", kind: "training", title: "Induction 1", who: "Rhian", due_date: "2026-10-15", days_left: 0 }
];
const g = groupByRecipient(rows); assert.equal(g.length, 2);
const en = buildEmail(g[0], "en");
assert.match(en.subject, /2 items need attention/);
assert.ok(en.html.includes("Dr &lt;Sian&gt;"), "escapes html");
assert.ok(en.html.indexOf("GDC registration") < en.html.indexOf("Fire risk"), "most urgent first");
assert.match(en.html, /expired 5 days ago/);
const cy = buildEmail(g[1], "cy"); assert.match(cy.subject, /1 eitem/); assert.match(cy.html, /heddiw/);
console.log("digest email tests passed");
