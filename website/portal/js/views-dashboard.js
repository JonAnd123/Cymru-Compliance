/* Views: practice dashboard, group overview, inspector view */
(function () {
  "use strict";
  var CC = window.CC, S = CC.state, SC = window.CCScoring, esc = function (s) { return CC.esc(s); }, t = function (s, v) { return CC.t(s, v); };
  function cv(n, d) { try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d; } catch (e) { return d; } }
  var RAG_COLOR = { green: "#1f9d55", amber: "#e0a100", red: "#d64545", none: "#c3ccd8" };

  CC.openFile = function (ev) {
    if (!ev.file_path) { CC.toast(t("No file attached to this item."), "err"); return; }
    return CC.api.evidence.url(ev.file_path).then(function (url) {
      window.open(url, "_blank", "noopener");
      if (CC.role() === "inspector") CC.api.audit.log("view_evidence", "evidence", ev.id, ev.practice_id, { title: ev.title });
    }).catch(CC.fail);
  };

  function catSummary(c) {
    var n = c.counts, bits = [];
    if (n.expired) bits.push(t("{n} expired", { n: n.expired }));
    if (n.expiring) bits.push(t("{n} expiring soon", { n: n.expiring }));
    if (n.pending) bits.push(t("{n} awaiting verification", { n: n.pending }));
    if (n.rejected) bits.push(t("{n} rejected", { n: n.rejected }));
    if (n.gaps) bits.push(t("{n} self-assessment gaps", { n: n.gaps }));
    if (n.training) bits.push(t("{n} training items open", { n: n.training }));
    return bits.length ? bits.join(" · ") : (c.score === null ? t("No evidence or assessment yet") : t("All clear"));
  }

  function daysLabel(d) {
    if (d === null) return t("Not scheduled");
    if (d < 0) return t("{n} days ago", { n: -d });
    if (d === 0) return t("Today");
    return t("In {n} days", { n: d });
  }

  /* ------------------------------ Dashboard ------------------------------ */
  CC.views.dashboard = function (el) {
    var pid = S.practiceId;
    if (!pid) { el.innerHTML = '<div class="empty">' + esc(t("No practice selected.")) + "</div>"; return; }
    var practice = CC.practice() || {};
    var role = CC.role();
    var canSnap = ["principal", "practice_manager", "platform_admin", "group_admin"].indexOf(role) >= 0;
    return CC.api.practiceInputs(pid).then(function (inputs) {
      var sc = SC.computeScores(inputs);
      var catObj = {}; sc.cats.forEach(function (c) { catObj[c.key] = c.score; });
      var save = canSnap && sc.overall !== null ? CC.api.saveSnapshot(pid, sc.overall, catObj).catch(function () {}) : Promise.resolve();
      var avgP = practice.group_id ? CC.api.groupAverage(pid).catch(function () { return null; }) : Promise.resolve(null);
      return Promise.all([save, avgP]).then(function (r) { return { inputs: inputs, sc: sc, avg: r[1] }; });
    }).then(function (d) {
      var inputs = d.inputs, sc = d.sc, avg = d.avg;
      var days = SC.daysUntil(practice.next_inspection);
      var counts = { green: 0, amber: 0, red: 0, none: 0 }; sc.cats.forEach(function (c) { counts[c.status]++; });
      var buckets = SC.expiryBuckets(inputs.evidence);
      var snaps = (inputs.snapshots || []).slice();
      if (sc.overall !== null && canSnap && !snaps.some(function (s) { return s.taken_on === CC.isoDate(0); })) snaps.push({ taken_on: CC.isoDate(0), score: sc.overall });

      var cmp = "";
      if (avg !== null && avg !== undefined && sc.overall !== null) {
        var diff = Math.round(sc.overall - avg);
        cmp = '<div class="kpi"><div class="label">' + esc(t("vs group average")) + '</div><div class="value">' + (diff >= 0 ? "+" : "") + diff + ' pts</div><div class="sub">' + esc(t("This practice {a}% · group {b}%", { a: sc.overall, b: Math.round(avg) })) + "</div></div>";
      } else {
        cmp = '<div class="kpi"><div class="label">' + esc(t("Practice manager credential")) + '</div><div class="value" style="font-size:1.2rem">' + (inputs.pm_trained ? "✔ " + esc(t("HIW-trained practice manager in post")) : esc(t("Not yet achieved"))) + '</div><div class="sub">' + esc(t("Earned by completing Practice Manager Training")) + "</div></div>";
      }

      el.innerHTML =
        '<div class="page-head"><div>' + (role === "platform_admin" || role === "group_admin" ? "" : '<div class="greet">' + esc(t("Hello") + ", " + String((S.profile.full_name || "").split(" ")[0] || "")) + "</div>") + "<h1>" + esc(practice.name || t("Dashboard")) + "</h1><p class=\"muted\">" +
        esc([practice.health_board, practice.hiw_registration].filter(Boolean).join(" · ")) + "</p></div>" +
        '<div class="actions"><button class="btn btn-secondary btn-sm" onclick="window.print()">' + esc(t("Print summary")) + "</button></div></div>" +
        (["platform_admin", "group_admin"].indexOf(role) >= 0 ? '<div class="banner info"><span>' + esc(t("You are viewing this practice read-only. Your access is recorded in the audit log.")) + "</span></div>" : "") +
        '<div class="grid-kpi">' +
        '<div class="kpi ' + sc.status + '"><div class="label">' + esc(t("Overall compliance")) + '</div><div class="value">' + (sc.overall === null ? "—" : sc.overall + "%") + '</div><div class="sub">' + CC.ragChip(sc.status) + "</div></div>" +
        '<div class="kpi"><div class="label">' + esc(t("Open actions")) + '</div><div class="value">' + sc.outstanding + '</div><div class="sub">' + esc(t("across {n} categories", { n: sc.cats.filter(function (c) { return c.outstanding > 0; }).length })) + "</div></div>" +
        '<div class="kpi ' + (days !== null && days <= 14 && days >= 0 ? "amber" : "") + '"><div class="label">' + esc(t("Next HIW inspection")) + '</div><div class="value" style="font-size:1.5rem">' + esc(practice.next_inspection ? CC.fmtDate(practice.next_inspection) : "—") + '</div><div class="sub">' + esc(daysLabel(days)) + "</div></div>" +
        cmp + "</div>" +
        '<div class="grid-charts">' +
        '<div class="panel"><h3>' + esc(t("Compliance score — last 6 months")) + '</h3><div class="chart-box"><canvas id="ch-trend"></canvas></div></div>' +
        '<div class="panel"><h3>' + esc(t("Category status")) + '</h3><div class="chart-box"><canvas id="ch-donut"></canvas></div></div>' +
        '<div class="panel"><h3>' + esc(t("Evidence expiry")) + '</h3><div class="chart-box"><canvas id="ch-expiry"></canvas></div></div></div>' +
        '<div class="panel" style="margin-bottom:16px"><h3>' + esc(t("Categories")) + ' <span class="muted small">— ' + esc(t("select one to see what is outstanding")) + "</span></h3><div class=\"cat-grid\">" +
        sc.cats.map(function (c) {
          return '<button class="cat-card ' + c.status + '" data-cat="' + c.key + '"><div class="row"><strong>' + esc(CC.catName(c.key)) + "</strong>" + CC.ragChip(c.status) + '</div><div class="score">' + (c.score === null ? "—" : c.score + "%") + '</div><div class="meta">' + esc(catSummary(c)) + "</div></button>";
        }).join("") + "</div></div>";

      // charts
      var labels = snaps.map(function (s) { return CC.fmtDate(s.taken_on); });
      CC.chart(document.getElementById("ch-trend"), { type: "line", data: { labels: labels, datasets: [{ data: snaps.map(function (s) { return s.score; }), borderColor: cv("--blue-600", cv("--blue-600", "#1467c7")), backgroundColor: cv("--sky-400", cv("--sky-400", "#4fb6e8")) + "2e", fill: true, tension: 0.3, pointRadius: 3 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, ticks: { callback: function (v) { return v + "%"; } } } } } });
      CC.chart(document.getElementById("ch-donut"), { type: "doughnut", data: { labels: [t("Green"), t("Amber"), t("Red"), t("No data")], datasets: [{ data: [counts.green, counts.amber, counts.red, counts.none], backgroundColor: [RAG_COLOR.green, RAG_COLOR.amber, RAG_COLOR.red, RAG_COLOR.none] }] },
        options: { maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom" } } } });
      CC.chart(document.getElementById("ch-expiry"), { type: "bar", data: { labels: [t("Expired"), "≤30d", "31–60d", "61–90d", ">90d"], datasets: [{ data: [buckets.expired, buckets.d30, buckets.d60, buckets.d90, buckets.later], backgroundColor: [RAG_COLOR.red, RAG_COLOR.amber, cv("--sky-300", "#8fd4f5"), cv("--sky-400", "#4fb6e8"), cv("--blue-600", "#1467c7")] }] },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });

      el.onclick = function (e) {
        var b = e.target.closest("[data-cat]"); if (!b) return;
        drill(b.getAttribute("data-cat"), sc, pid);
      };
    });
  };

  function drill(key, sc, pid) {
    var cat = sc.cats.filter(function (c) { return c.key === key; })[0];
    var role = CC.role(), detail = role === "principal" || role === "practice_manager" || role === "platform_admin";
    var body = '<p class="muted">' + esc(catSummary(cat)) + "</p>";
    var done = Promise.resolve();
    if (detail) {
      done = Promise.all([CC.api.evidence.list(pid), CC.api.assessment.list(pid), CC.api.assessment.questions()]).then(function (r) {
        var items = r[0].filter(function (e) { return e.category === key; }).map(function (e) { return { e: e, s: SC.evidenceState(e) }; }).filter(function (x) { return x.s !== "valid"; });
        var latest = r[1].filter(function (a) { return a.status === "completed"; })[0];
        var qs = r[2].filter(function (q) { return q.category === key; });
        return (latest ? CC.api.assessment.answers(latest.id) : Promise.resolve([])).then(function (ans) {
          var gaps = ans.filter(function (a) { return a.answer === "no" || a.answer === "partial"; }).map(function (a) { return { a: a, q: qs.filter(function (q) { return q.id === a.question_id; })[0] }; }).filter(function (x) { return x.q; });
          if (items.length) body += "<h4>" + esc(t("Evidence needing attention")) + '</h4><ul class="list">' + items.map(function (x) { return "<li><span>" + esc(x.e.title) + '<div class="sub">' + esc(t("Expiry")) + ": " + esc(CC.fmtDate(x.e.expiry_date)) + "</div></span>" + CC.evChip(x.s) + "</li>"; }).join("") + "</ul>";
          if (gaps.length) body += "<h4>" + esc(t("Self-assessment gaps")) + '</h4><ul class="list">' + gaps.map(function (x) { return "<li><span><strong>" + esc(x.q.ref) + "</strong> " + esc(CC.lang === "cy" && x.q.text_cy ? x.q.text_cy : x.q.text_en) + "</span>" + CC.chip(x.a.answer === "no" ? "red" : "amber", t(x.a.answer === "no" ? "No" : "Partly")) + "</li>"; }).join("") + "</ul>";
          if (!items.length && !gaps.length) body += '<div class="empty">' + esc(t("Nothing outstanding in this category.")) + "</div>";
          body += '<p><a class="btn btn-secondary btn-sm" href="#/evidence" data-close>' + esc(t("Open evidence")) + "</a></p>";
        });
      }).catch(function (e) { body += "<p>" + esc(e.message) + "</p>"; });
    } else {
      body += '<p class="small muted">' + esc(t("Item-level detail is only visible to the practice's Principal and Practice Manager.")) + "</p>";
    }
    done.then(function () { CC.modal({ title: CC.catName(key), body: body, hideSubmit: true, wide: true }); });
  }

  /* ------------------------------ Group overview ------------------------------ */
  CC.views.group = function (el) {
    var grp = S.groups[0];
    var practices = S.practices.filter(function (p) { return p.group_id; });
    if (!grp || !practices.length) { el.innerHTML = '<div class="empty">' + esc(t("No practices in your group yet.")) + ' <a href="#/practices">' + esc(t("Add a practice")) + "</a></div>"; return; }
    return Promise.all([Promise.all(practices.map(function (p) { return CC.api.practiceInputs(p.id).then(function (i) { return { p: p, inputs: i, sc: SC.computeScores(i) }; }); })), CC.api.profiles.list({})]).then(function (r) {
      var rows = r[0], people = r[1];
      var scored = rows.filter(function (x) { return x.sc.overall !== null; });
      var avg = scored.length ? Math.round(scored.reduce(function (s, x) { return s + x.sc.overall; }, 0) / scored.length) : null;
      var cnt = { green: 0, amber: 0, red: 0, none: 0 }; rows.forEach(function (x) { cnt[x.sc.status]++; });
      var soon = rows.filter(function (x) { var d = SC.daysUntil(x.p.next_inspection); return d !== null && d >= 0 && d <= 30; }).length;

      // ranked "needs attention"
      var items = [];
      rows.forEach(function (x) {
        var d = SC.daysUntil(x.p.next_inspection), sev;
        if (x.sc.status === "red") items.push({ sev: 100 - (x.sc.overall || 0) / 2, text: t("{p}: compliance is red ({s}%)", { p: x.p.name, s: x.sc.overall === null ? 0 : x.sc.overall }), p: x.p.id, chip: "red" });
        var exp = x.sc.cats.reduce(function (s, c) { return s + c.counts.expired; }, 0);
        if (exp) items.push({ sev: 80 + exp, text: t("{p}: {n} expired evidence items", { p: x.p.name, n: exp }), p: x.p.id, chip: "red" });
        if (d !== null && d >= 0 && d <= 30) { sev = 90 - d; items.push({ sev: sev, text: t("{p}: HIW inspection {when}", { p: x.p.name, when: daysLabel(d).toLowerCase() }), p: x.p.id, chip: d <= 14 ? "red" : "amber" }); }
        var soonExp = x.sc.cats.reduce(function (s, c) { return s + c.counts.expiring; }, 0);
        if (soonExp) items.push({ sev: 40 + soonExp, text: t("{p}: {n} items expiring within 30 days", { p: x.p.name, n: soonExp }), p: x.p.id, chip: "amber" });
        var pend = x.sc.cats.reduce(function (s, c) { return s + c.counts.pending; }, 0);
        if (pend) items.push({ sev: 20 + pend, text: t("{p}: {n} items awaiting verification", { p: x.p.name, n: pend }), p: x.p.id, chip: "blue" });
      });
      items.sort(function (a, b) { return b.sev - a.sev; });

      var perPrice = practices.length >= 6 ? 69 : 79;
      el.innerHTML =
        '<div class="page-head"><div><h1>' + esc(grp.name) + "</h1><p class=\"muted\">" + esc(t("Cross-practice compliance roll-up. Your access to this data is recorded in the audit log.")) + "</p></div></div>" +
        '<div class="grid-kpi">' +
        '<div class="kpi ' + SC.statusFor(avg) + '"><div class="label">' + esc(t("Group average")) + '</div><div class="value">' + (avg === null ? "—" : avg + "%") + '</div><div class="sub">' + esc(t("{n} practices", { n: practices.length })) + "</div></div>" +
        '<div class="kpi"><div class="label">' + esc(t("Status mix")) + '</div><div class="value" style="font-size:1.4rem"><span style="color:#1f9d55">' + cnt.green + '</span> / <span style="color:#c98a00">' + cnt.amber + '</span> / <span style="color:#d64545">' + cnt.red + '</span></div><div class="sub">' + esc(t("green / amber / red")) + "</div></div>" +
        '<div class="kpi ' + (soon ? "amber" : "") + '"><div class="label">' + esc(t("Inspections within 30 days")) + '</div><div class="value">' + soon + '</div><div class="sub">' + esc(t("across the group")) + "</div></div>" +
        '<div class="kpi"><div class="label">' + esc(t("Billing")) + '</div><div class="value" style="font-size:1.1rem">' + esc(t(grp.billing_mode === "consolidated" ? "One consolidated invoice" : "Billed per practice")) + '</div><div class="sub">' + esc(t("Illustrative: £{p}/practice/month (£{tot}/month)", { p: perPrice, tot: perPrice * practices.length })) + "</div></div></div>" +
        '<div class="cols-2"><div class="panel"><h3>' + esc(t("Compliance score by practice")) + '</h3><div class="chart-box" style="height:260px"><canvas id="ch-group"></canvas></div></div>' +
        '<div class="panel"><h3>' + esc(t("Needs attention")) + "</h3>" +
        (items.length ? '<ul class="list">' + items.slice(0, 8).map(function (i) { return '<li><span>' + esc(i.text) + '</span><button class="btn btn-secondary btn-sm" data-view="' + i.p + '">' + esc(t("View")) + "</button></li>"; }).join("") + "</ul>" : '<div class="empty">' + esc(t("Nothing urgent across the group.")) + "</div>") + "</div></div>" +
        '<div class="panel"><h3>' + esc(t("Practices")) + '</h3><div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Practice")) + "</th><th>" + esc(t("Principal")) + "</th><th>" + esc(t("Score")) + "</th><th>" + esc(t("vs group")) + "</th><th>" + esc(t("Status")) + "</th><th>" + esc(t("Next inspection")) + "</th><th></th></tr></thead><tbody>" +
        rows.map(function (x) {
          var pr = people.filter(function (u) { return u.practice_id === x.p.id && u.role === "principal"; })[0];
          var diff = x.sc.overall !== null && avg !== null ? x.sc.overall - avg : null;
          return "<tr><td><strong>" + esc(x.p.name) + "</strong></td><td>" + esc(pr ? pr.full_name : "—") + "</td><td>" + (x.sc.overall === null ? "—" : x.sc.overall + "%") + "</td><td>" + (diff === null ? "—" : (diff >= 0 ? "+" : "") + diff) + "</td><td>" + CC.ragChip(x.sc.status) + "</td><td>" + esc(CC.fmtDate(x.p.next_inspection)) + '</td><td class="actions-cell"><button class="btn btn-secondary btn-sm" data-view="' + x.p.id + '">' + esc(t("View")) + "</button></td></tr>";
        }).join("") + "</tbody></table></div></div>";

      CC.chart(document.getElementById("ch-group"), { type: "bar", data: { labels: rows.map(function (x) { return x.p.name; }), datasets: [{ data: rows.map(function (x) { return x.sc.overall; }), backgroundColor: rows.map(function (x) { return RAG_COLOR[x.sc.status]; }) }] },
        options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100 } } } });
      el.onclick = function (e) {
        var b = e.target.closest("[data-view]"); if (!b) return;
        CC.go("dashboard", b.getAttribute("data-view"));
      };
    });
  };

  /* ------------------------------ Inspector view ------------------------------ */
  CC.views.inspect = function (el) {
    var pid = S.practiceId;
    if (!pid) { el.innerHTML = '<div class="empty">' + esc(t("You have no active inspection access. Ask the practice's Principal to grant it.")) + "</div>"; return; }
    var practice = CC.practice() || {};
    return Promise.all([CC.api.practiceInputs(pid), CC.api.evidence.list(pid), CC.api.assessment.list(pid), CC.api.assessment.questions(), CC.api.grants.mine()]).then(function (r) {
      var inputs = r[0], evidence = r[1], assessments = r[2], questions = r[3], grants = r[4];
      var grant = grants.filter(function (g) { return g.practice_id === pid && !g.revoked; }).sort(function (a, b) { return String(b.expires_at).localeCompare(String(a.expires_at)); })[0];
      var sc = SC.computeScores(inputs);
      var latest = assessments.filter(function (a) { return a.status === "completed"; })[0];
      return (latest ? CC.api.assessment.answers(latest.id) : Promise.resolve([])).then(function (ans) {
        el.innerHTML =
          '<div class="page-head"><div><h1>' + esc(practice.name) + "</h1><p class=\"muted\">" + esc([practice.health_board, practice.hiw_registration].filter(Boolean).join(" · ")) + "</p></div></div>" +
          '<div class="banner info"><span>' + esc(t("Read-only access granted by the practice. Everything you open is recorded.")) + (grant ? " " + esc(t("Access expires {d}.", { d: CC.fmtDateTime(grant.expires_at) })) : "") + "</span></div>" +
          '<div class="grid-kpi"><div class="kpi ' + sc.status + '"><div class="label">' + esc(t("Overall compliance")) + '</div><div class="value">' + (sc.overall === null ? "—" : sc.overall + "%") + '</div><div class="sub">' + CC.ragChip(sc.status) + "</div></div>" +
          '<div class="kpi"><div class="label">' + esc(t("Last self-assessment")) + '</div><div class="value" style="font-size:1.2rem">' + esc(latest ? CC.fmtDate(latest.completed_at) : "—") + '</div></div>' +
          '<div class="kpi"><div class="label">' + esc(t("Next HIW inspection")) + '</div><div class="value" style="font-size:1.2rem">' + esc(CC.fmtDate(practice.next_inspection)) + '</div></div>' +
          '<div class="kpi"><div class="label">' + esc(t("Practice manager credential")) + '</div><div class="value" style="font-size:1.1rem">' + (inputs.pm_trained ? "✔ " + esc(t("HIW-trained")) : "—") + "</div></div></div>" +
          sc.cats.map(function (c) {
            var ev = evidence.filter(function (e) { return e.category === c.key; });
            var qs = questions.filter(function (q) { return q.category === c.key; });
            var gaps = ans.filter(function (a) { return qs.some(function (q) { return q.id === a.question_id; }) && a.answer !== "yes" && a.answer !== "na"; });
            return '<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="margin:0">' + esc(CC.catName(c.key)) + "</h3><div>" + (c.score === null ? "" : "<strong>" + c.score + "%</strong> ") + CC.ragChip(c.status) + "</div></div>" +
              (ev.length ? '<div class="table-wrap" style="margin-top:12px"><table class="data"><thead><tr><th>' + esc(t("Document")) + "</th><th>" + esc(t("Expiry")) + "</th><th>" + esc(t("Status")) + "</th><th></th></tr></thead><tbody>" +
                ev.map(function (e) { return "<tr><td>" + esc(e.title) + "</td><td>" + esc(CC.fmtDate(e.expiry_date)) + "</td><td>" + CC.evChip(SC.evidenceState(e)) + '</td><td class="actions-cell"><button class="btn btn-secondary btn-sm" data-open="' + e.id + '">' + esc(t("View")) + "</button></td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="muted small" style="margin-top:10px">' + esc(t("No documents uploaded in this category.")) + "</p>") +
              (gaps.length ? "<h4 style=\"margin-top:14px\">" + esc(t("Self-assessment gaps")) + '</h4><ul class="list">' + gaps.map(function (a) { var q = qs.filter(function (x) { return x.id === a.question_id; })[0]; return "<li><span><strong>" + esc(q.ref) + "</strong> " + esc(CC.lang === "cy" && q.text_cy ? q.text_cy : q.text_en) + "</span>" + CC.chip(a.answer === "no" ? "red" : "amber", t(a.answer === "no" ? "No" : "Partly")) + "</li>"; }).join("") + "</ul>" : "") + "</div>";
          }).join("");
        el.onclick = function (e) {
          var b = e.target.closest("[data-open]"); if (!b) return;
          var ev = evidence.filter(function (x) { return x.id === b.getAttribute("data-open"); })[0];
          if (ev) CC.openFile(ev);
        };
      });
    });
  };
})();
