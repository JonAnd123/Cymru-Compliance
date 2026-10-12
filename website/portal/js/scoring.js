/* Compliance scoring — pure functions, same code path for every role and for demo mode.
   Input shape = result of practice_inputs() (see supabase/01_schema.sql). */
(function (root) {
  "use strict";

  var CATS = [
    { key: "registration",    en: "Registration & documentation" },
    { key: "staff_training",  en: "Staff training & DBS" },
    { key: "decontamination", en: "Decontamination (WHTM 01-05)" },
    { key: "radiation",       en: "Radiation protection (IR(ME)R)" },
    { key: "health_safety",   en: "Health & safety" },
    { key: "policies",        en: "Policies" }
  ];

  var ANSWER_VALUE = { yes: 1, partial: 0.5, no: 0 };
  var TRAIN_VALUE = { completed: 1, in_progress: 0.5, assigned: 0 };

  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function daysUntil(dateStr, now) {
    if (!dateStr) return null;
    var a = startOfDay(now || new Date()), b = startOfDay(dateStr);
    return Math.round((b - a) / 86400000);
  }

  // expiry state of one evidence item
  function evidenceState(ev, now) {
    var d = daysUntil(ev.expiry_date, now);
    if (ev.status === "rejected") return "rejected";
    if (d !== null && d < 0) return "expired";
    if (ev.status === "pending") return "pending";
    if (d !== null && d <= 30) return "expiring";
    return "valid";
  }
  var EVIDENCE_VALUE = { valid: 1, expiring: 0.8, pending: 0.5, rejected: 0, expired: 0 };

  function statusFor(score) {
    if (score === null || score === undefined) return "none";
    if (score >= 85) return "green";
    if (score >= 60) return "amber";
    return "red";
  }
  function mean(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }

  function computeScores(inputs, now) {
    inputs = inputs || {};
    var evidence = inputs.evidence || [];
    var answers = (inputs.assessment && inputs.assessment.answers) || [];
    var training = (inputs.training || []).filter(function (t) { return t.kind !== "pm"; });

    var cats = CATS.map(function (c) {
      var parts = [];
      var counts = { expired: 0, expiring: 0, pending: 0, rejected: 0, gaps: 0, training: 0, evidence: 0 };

      var ev = evidence.filter(function (e) { return e.category === c.key; });
      counts.evidence = ev.length;
      if (ev.length) {
        var vals = ev.map(function (e) {
          var s = evidenceState(e, now);
          if (s in counts) counts[s]++;
          return EVIDENCE_VALUE[s];
        });
        parts.push(mean(vals));
      }

      var ans = answers.filter(function (a) { return a.category === c.key && a.answer !== "na"; });
      if (ans.length) {
        parts.push(mean(ans.map(function (a) { return ANSWER_VALUE[a.answer]; })));
        counts.gaps = ans.filter(function (a) { return a.answer !== "yes"; }).length;
      }

      if (c.key === "staff_training" && training.length) {
        parts.push(mean(training.map(function (t) { return TRAIN_VALUE[t.status] || 0; })));
        counts.training = training.filter(function (t) { return t.status !== "completed"; }).length;
      }

      var score = parts.length ? Math.round(100 * mean(parts)) : null;
      return {
        key: c.key, en: c.en, score: score, status: statusFor(score), counts: counts,
        outstanding: counts.expired + counts.expiring + counts.pending + counts.rejected + counts.gaps + counts.training
      };
    });

    var scored = cats.filter(function (c) { return c.score !== null; }).map(function (c) { return c.score; });
    var overall = scored.length ? Math.round(mean(scored)) : null;
    return { cats: cats, overall: overall, status: statusFor(overall),
             outstanding: cats.reduce(function (s, c) { return s + c.outstanding; }, 0) };
  }

  // evidence expiry buckets for the bar chart
  function expiryBuckets(evidence, now) {
    var b = { expired: 0, d30: 0, d60: 0, d90: 0, later: 0 };
    (evidence || []).forEach(function (e) {
      var d = daysUntil(e.expiry_date, now);
      if (d === null || e.status === "rejected") return;
      if (d < 0) b.expired++; else if (d <= 30) b.d30++; else if (d <= 60) b.d60++; else if (d <= 90) b.d90++; else b.later++;
    });
    return b;
  }

  var api = { CATS: CATS, computeScores: computeScores, evidenceState: evidenceState, statusFor: statusFor,
              daysUntil: daysUntil, expiryBuckets: expiryBuckets };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CCScoring = api;
})(typeof window !== "undefined" ? window : globalThis);
