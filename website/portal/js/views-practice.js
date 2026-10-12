/* Views: evidence, my records & training, team training, compliance check, team, inspector access */
(function () {
  "use strict";
  var CC = window.CC, S = CC.state, SC = window.CCScoring, esc = function (s) { return CC.esc(s); }, t = function (s, v) { return CC.t(s, v); };
  var MAX_BYTES = 10 * 1024 * 1024;
  var ACCEPT = ".pdf,.png,.jpg,.jpeg,.docx";

  function catOptions(sel, placeholder) {
    return CC.options(CC.CATS.map(function (c) { return { value: c.key, label: CC.catName(c.key) }; }), sel, placeholder);
  }
  function checkFile(f) {
    if (!f) return;
    if (f.size > MAX_BYTES) throw new Error(t("File is larger than 10 MB."));
    if (!/\.(pdf|png|jpe?g|docx)$/i.test(f.name)) throw new Error(t("Please upload a PDF, PNG, JPG or DOCX file."));
  }
  function nameOf(people, id) { var p = people.filter(function (x) { return x.id === id; })[0]; return p ? p.full_name || p.email : "—"; }
  function pct(n) { return '<div style="display:flex;align-items:center;gap:8px"><div class="progress" style="flex:1"><span style="width:' + n + '%"></span></div><span class="small">' + n + "%</span></div>"; }
  var TRAIN_CHIP = { assigned: ["none", "Not started"], in_progress: ["amber", "In progress"], completed: ["green", "Completed"] };
  var KIND_LABEL = { induction: "Induction", refresher: "Refresher training", pm: "Practice Manager Training" };
  function modTitle(m) { return CC.lang === "cy" && m.title_cy ? m.title_cy : m.title_en; }
  function modSummary(m) { return CC.lang === "cy" && m.summary_cy ? m.summary_cy : m.summary_en; }
  function modPoints(m) { return (CC.lang === "cy" && m.points_cy && m.points_cy.length ? m.points_cy : m.points_en) || []; }

  /* ------------------------------ Evidence ------------------------------ */
  CC.views.evidence = function (el) {
    var pid = S.practiceId;
    if (!pid) { el.innerHTML = '<div class="empty">' + esc(t("No practice selected.")) + "</div>"; return; }
    return Promise.all([CC.api.evidence.list(pid), CC.api.profiles.list({ practice_id: pid })]).then(function (r) {
      var rows = r[0], people = r[1], filt = { cat: "", st: "", q: "" };
      function draw() {
        var shown = rows.filter(function (e) {
          var st = SC.evidenceState(e);
          return (!filt.cat || e.category === filt.cat) && (!filt.st || st === filt.st) && (!filt.q || (e.title + " " + nameOf(people, e.staff_member)).toLowerCase().indexOf(filt.q.toLowerCase()) >= 0);
        });
        el.querySelector("#ev-body").innerHTML = shown.length ? shown.map(function (e) {
          var st = SC.evidenceState(e);
          return "<tr><td><strong>" + esc(e.title) + '</strong><div class="small muted">' + esc(e.file_name || t("No file")) + "</div></td><td>" + esc(CC.catName(e.category)) + "</td><td>" + esc(e.staff_member ? nameOf(people, e.staff_member) : "—") + "</td><td>" + esc(CC.fmtDate(e.expiry_date)) + "</td><td>" + CC.evChip(st) + "</td><td>v" + e.current_version + '</td><td class="actions-cell">' +
            '<button class="btn btn-secondary btn-sm" data-act="open" data-id="' + e.id + '">' + esc(t("View")) + "</button> " +
            (e.status !== "verified" ? '<button class="btn btn-secondary btn-sm" data-act="verify" data-id="' + e.id + '">' + esc(t("Verify")) + "</button> " : "") +
            (e.status !== "rejected" ? '<button class="btn btn-danger btn-sm" data-act="reject" data-id="' + e.id + '">' + esc(t("Reject")) + "</button> " : "") +
            '<button class="btn btn-secondary btn-sm" data-act="replace" data-id="' + e.id + '">' + esc(t("New version")) + "</button> " +
            '<button class="btn btn-secondary btn-sm" data-act="history" data-id="' + e.id + '">' + esc(t("History")) + "</button></td></tr>";
        }).join("") : '<tr><td colspan="7"><div class="empty">' + esc(t("No evidence matches.")) + "</div></td></tr>";
      }
      function load() { return CC.api.evidence.list(pid).then(function (x) { rows = x; draw(); }); }

      el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Evidence & certificates")) + "</h1><p class=\"muted\">" + esc(t("Everything HIW may ask to see, organised by inspection category. Expiry dates drive the dashboard.")) + "</p></div>" +
        '<div class="actions"><button class="btn btn-primary" data-act="add">+ ' + esc(t("Add evidence")) + "</button></div></div>" +
        '<div class="filters"><select id="f-cat">' + catOptions("", "All categories") + '</select><select id="f-st">' + CC.options([{ value: "valid", label: t("Valid") }, { value: "expiring", label: t("Expiring soon") }, { value: "expired", label: t("Expired") }, { value: "pending", label: t("Awaiting verification") }, { value: "rejected", label: t("Rejected") }], "", "All statuses") + '</select><input id="f-q" placeholder="' + esc(t("Search…")) + '"></div>' +
        '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Document")) + "</th><th>" + esc(t("Category")) + "</th><th>" + esc(t("Staff member")) + "</th><th>" + esc(t("Expiry")) + "</th><th>" + esc(t("Status")) + "</th><th>" + esc(t("Version")) + '</th><th></th></tr></thead><tbody id="ev-body"></tbody></table></div>';
      draw();
      el.querySelector("#f-cat").onchange = function (e) { filt.cat = e.target.value; draw(); };
      el.querySelector("#f-st").onchange = function (e) { filt.st = e.target.value; draw(); };
      el.querySelector("#f-q").oninput = function (e) { filt.q = e.target.value; draw(); };

      el.onclick = function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return;
        var act = b.getAttribute("data-act"), ev = rows.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0];
        if (act === "add") addEvidence(pid, people, load);
        else if (act === "open") CC.openFile(ev);
        else if (act === "verify" || act === "reject") {
          var status = act === "verify" ? "verified" : "rejected";
          CC.api.evidence.setStatus(ev.id, status).then(function () { CC.api.audit.log(act + "_evidence", "evidence", ev.id, pid, { title: ev.title }); CC.toast(t(act === "verify" ? "Marked as verified." : "Marked as rejected.")); return load(); }).catch(CC.fail);
        } else if (act === "replace") replaceEvidence(ev, pid, load);
        else if (act === "history") history(ev, people);
      };
    });
  };

  function addEvidence(pid, people, done, opts) {
    opts = opts || {};
    var staff = people.filter(function (p) { return p.active && ["staff", "practice_manager", "principal"].indexOf(p.role) >= 0; });
    var manage = CC.canManage();
    CC.modal({
      title: t("Add evidence"), submitLabel: "Upload",
      body: '<div class="field"><label>' + esc(t("Category")) + '</label><select name="category" required>' + catOptions("", "Choose…") + "</select></div>" +
        '<div class="field"><label>' + esc(t("Title")) + '</label><input name="title" required maxlength="160" placeholder="' + esc(t("e.g. Enhanced DBS — Jane Smith")) + '"></div>' +
        (manage && !opts.self ? '<div class="field"><label>' + esc(t("Staff member (if this belongs to a person)")) + '</label><select name="staff_member">' + CC.options(staff.map(function (p) { return { value: p.id, label: p.full_name || p.email }; }), "", "— Practice-level document —") + "</select></div>" : "") +
        '<div class="field"><label>' + esc(t("Expiry date (leave blank if it does not expire)")) + '</label><input type="date" name="expiry_date"></div>' +
        '<div class="field"><label>' + esc(t("File (PDF, PNG, JPG or DOCX, up to 10 MB)")) + '</label><input type="file" name="file" accept="' + ACCEPT + '"></div>' +
        (manage ? '<div class="field checkbox-field"><input type="checkbox" name="verified" value="1" checked id="ev-ver"><label for="ev-ver" style="margin:0;font-weight:500">' + esc(t("Mark as verified")) + "</label></div>" : '<p class="small muted">' + esc(t("Your Principal or Practice Manager will verify this document.")) + "</p>"),
      onSubmit: function (d) {
        checkFile(d.file);
        var row = { practice_id: pid, category: d.category, title: d.title.trim(), expiry_date: d.expiry_date || null, file: d.file };
        if (manage && !opts.self) { row.staff_member = d.staff_member || null; row.status = d.verified ? "verified" : "pending"; }
        else { row.staff_member = S.profile.id; row.status = "pending"; }
        return CC.api.evidence.add(row).then(function (ev) { CC.api.audit.log("upload_evidence", "evidence", ev.id, pid, { title: row.title }); CC.toast(t("Evidence added.")); return done(); });
      }
    });
  }

  function replaceEvidence(ev, pid, done) {
    var manage = CC.canManage();
    CC.modal({
      title: t("Upload a new version") + " — " + ev.title, submitLabel: "Upload",
      body: '<div class="field"><label>' + esc(t("New file")) + '</label><input type="file" name="file" accept="' + ACCEPT + '" required></div>' +
        '<div class="field"><label>' + esc(t("New expiry date")) + '</label><input type="date" name="expiry_date"></div>' +
        (manage ? '<div class="field checkbox-field"><input type="checkbox" name="verified" value="1" checked id="rp-ver"><label for="rp-ver" style="margin:0;font-weight:500">' + esc(t("Mark as verified")) + "</label></div>" : ""),
      onSubmit: function (d) {
        checkFile(d.file);
        return CC.api.evidence.replace(ev.id, pid, d.file, d.expiry_date || null, !!d.verified).then(function () { CC.api.audit.log("replace_evidence", "evidence", ev.id, pid, { title: ev.title }); CC.toast(t("New version saved.")); return done(); });
      }
    });
  }

  function history(ev, people) {
    CC.api.evidence.versions(ev.id).then(function (vs) {
      var m = CC.modal({
        title: t("Version history") + " — " + ev.title, hideSubmit: true, wide: true,
        body: vs.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Version")) + "</th><th>" + esc(t("File")) + "</th><th>" + esc(t("Expiry")) + "</th><th>" + esc(t("Uploaded by")) + "</th><th>" + esc(t("Date")) + "</th><th></th></tr></thead><tbody>" +
          vs.map(function (v, i) { return "<tr><td>v" + v.version + "</td><td>" + esc(v.file_name || "—") + "</td><td>" + esc(CC.fmtDate(v.expiry_date)) + "</td><td>" + esc(nameOf(people, v.uploaded_by)) + "</td><td>" + esc(CC.fmtDateTime(v.created_at)) + '</td><td><button type="button" class="btn btn-secondary btn-sm" data-ver="' + i + '">' + esc(t("View")) + "</button></td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">' + esc(t("No versions recorded.")) + "</div>"
      });
      m.el.addEventListener("click", function (e) {
        var b = e.target.closest("[data-ver]"); if (!b) return;
        var v = vs[+b.getAttribute("data-ver")]; if (v) CC.openFile({ id: ev.id, practice_id: ev.practice_id, title: ev.title, file_path: v.file_path });
      });
    }).catch(CC.fail);
  }

  /* ------------------------------ My records & training ------------------------------ */
  CC.views.my = function (el) {
    var me = S.profile, pid = me.practice_id;
    return Promise.all([CC.api.evidence.list(pid), CC.api.training.modules(), CC.api.training.assignments({ profile_id: me.id })]).then(function (r) {
      var mine = r[0].filter(function (e) { return e.staff_member === me.id || e.uploaded_by === me.id; }), modules = r[1], assigns = r[2];
      function reload() { CC.render(); }
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("My records & training")) + "</h1><p class=\"muted\">" + esc(t("Your own certificates and the training assigned to you.")) + "</p></div></div>" +
        '<div class="panel"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><h3 style="margin:0">' + esc(t("My certificates & evidence")) + '</h3><button class="btn btn-primary btn-sm" data-act="add">+ ' + esc(t("Upload certificate")) + "</button></div>" +
        (mine.length ? '<div class="table-wrap" style="margin-top:12px"><table class="data"><thead><tr><th>' + esc(t("Document")) + "</th><th>" + esc(t("Category")) + "</th><th>" + esc(t("Expiry")) + "</th><th>" + esc(t("Status")) + "</th><th></th></tr></thead><tbody>" +
          mine.map(function (e) { return "<tr><td>" + esc(e.title) + "</td><td>" + esc(CC.catName(e.category)) + "</td><td>" + esc(CC.fmtDate(e.expiry_date)) + "</td><td>" + CC.evChip(SC.evidenceState(e)) + '</td><td class="actions-cell"><button class="btn btn-secondary btn-sm" data-act="open" data-id="' + e.id + '">' + esc(t("View")) + '</button> <button class="btn btn-secondary btn-sm" data-act="replace" data-id="' + e.id + '">' + esc(t("New version")) + "</button></td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">' + esc(t("You have not uploaded anything yet.")) + "</div>") + "</div>" +
        '<div class="panel"><h3>' + esc(t("My training")) + "</h3>" +
        (assigns.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Module")) + "</th><th>" + esc(t("Type")) + "</th><th>" + esc(t("Due")) + "</th><th style=\"min-width:140px\">" + esc(t("Progress")) + "</th><th></th></tr></thead><tbody>" +
          assigns.map(function (a) {
            var m = modules.filter(function (x) { return x.id === a.module_id; })[0]; if (!m) return "";
            return "<tr><td><strong>" + esc(modTitle(m)) + '</strong><div class="small muted">' + esc(t("{n} min", { n: m.duration_mins })) + "</div></td><td>" + esc(t(KIND_LABEL[m.kind])) + "</td><td>" + esc(CC.fmtDate(a.due_date)) + "</td><td>" + pct(a.progress) + '</td><td class="actions-cell"><button class="btn btn-' + (a.status === "completed" ? "secondary" : "primary") + ' btn-sm" data-act="train" data-id="' + a.id + '">' + esc(t(a.status === "completed" ? "Review" : (a.status === "assigned" ? "Start" : "Continue"))) + "</button></td></tr>";
          }).join("") + "</tbody></table></div>" : '<div class="empty">' + esc(t("No training has been assigned to you yet.")) + "</div>") + "</div>";
      el.onclick = function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return;
        var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
        if (act === "add") addEvidence(pid, [me], reload, { self: true });
        else if (act === "open") CC.openFile(mine.filter(function (x) { return x.id === id; })[0]);
        else if (act === "replace") replaceEvidence(mine.filter(function (x) { return x.id === id; })[0], pid, reload);
        else if (act === "train") {
          var a = assigns.filter(function (x) { return x.id === id; })[0], m = modules.filter(function (x) { return x.id === a.module_id; })[0];
          CC.modal({
            title: modTitle(m), submitLabel: "Save progress", wide: true,
            body: "<p>" + esc(modSummary(m)) + '</p><h4>' + esc(t("What you will cover")) + '</h4><ul class="card-list">' + modPoints(m).map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" +
              '<p class="small muted">' + esc(t("Training content is a placeholder outline. Full learning material is added by Cymru Compliance.")) + "</p>" +
              '<div class="field"><label>' + esc(t("Your progress")) + '</label><select name="progress">' + CC.options([0, 25, 50, 75, 100].map(function (n) { return { value: n, label: n + "%" }; }), a.progress) + "</select></div>" +
              '<div class="field checkbox-field"><input type="checkbox" name="attest" value="1" id="tr-att"><label for="tr-att" style="margin:0;font-weight:500">' + esc(t("I confirm I have completed this module (required for 100%).")) + "</label></div>",
            onSubmit: function (d) {
              var p = +d.progress;
              if (p >= 100 && !d.attest) throw new Error(t("Please tick the confirmation box to mark this as completed."));
              return CC.api.training.progress(a.id, p).then(function () { CC.api.audit.log("training_progress", "training", a.id, pid, { module: m.title_en, progress: p }); CC.toast(t("Progress saved.")); reload(); });
            }
          });
        }
      };
    });
  };

  /* ------------------------------ Team training (manage) ------------------------------ */
  CC.views.training = function (el) {
    var pid = S.practiceId;
    return Promise.all([CC.api.training.modules(), CC.api.training.assignments({ practice_id: pid }), CC.api.profiles.list({ practice_id: pid })]).then(function (r) {
      var modules = r[0], assigns = r[1], people = r[2];
      var staff = people.filter(function (p) { return p.active && ["staff", "practice_manager", "principal"].indexOf(p.role) >= 0; });
      function reload() { CC.render(); }
      function modCard(kind) {
        return '<div class="panel"><h3>' + esc(t(KIND_LABEL[kind])) + "</h3><ul class=\"list\">" + modules.filter(function (m) { return m.kind === kind; }).map(function (m) {
          return "<li><span><strong>" + esc(modTitle(m)) + '</strong><div class="sub">' + esc(modSummary(m)) + " · " + esc(t("{n} min", { n: m.duration_mins })) + '</div></span><button class="btn btn-secondary btn-sm" data-act="assign" data-id="' + m.id + '">' + esc(t("Assign")) + "</button></li>";
        }).join("") + "</ul></div>";
      }
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Team training")) + "</h1><p class=\"muted\">" + esc(t("Assign induction, refresher and Practice Manager training. Completion feeds the dashboard.")) + "</p></div>" +
        '<div class="actions"><button class="btn btn-primary" data-act="assign-induction">' + esc(t("New starter: assign full induction")) + '</button><a class="btn btn-secondary" href="#/bookings">' + esc(t("Book Practice Manager training")) + "</a></div></div>" +
        '<div class="panel"><h3>' + esc(t("Team progress")) + "</h3>" +
        (assigns.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Person")) + "</th><th>" + esc(t("Module")) + "</th><th>" + esc(t("Due")) + "</th><th style=\"min-width:140px\">" + esc(t("Progress")) + "</th><th>" + esc(t("Status")) + "</th></tr></thead><tbody>" +
          assigns.map(function (a) {
            var m = modules.filter(function (x) { return x.id === a.module_id; })[0]; if (!m) return "";
            var overdue = a.status !== "completed" && a.due_date && SC.daysUntil(a.due_date) < 0;
            return "<tr><td>" + esc(nameOf(people, a.profile_id)) + "</td><td>" + esc(modTitle(m)) + "</td><td>" + esc(CC.fmtDate(a.due_date)) + (overdue ? " " + CC.chip("red", t("Overdue")) : "") + "</td><td>" + pct(a.progress) + "</td><td>" + CC.chip(TRAIN_CHIP[a.status][0], t(TRAIN_CHIP[a.status][1])) + "</td></tr>";
          }).join("") + "</tbody></table></div>" : '<div class="empty">' + esc(t("Nothing assigned yet.")) + "</div>") + "</div>" +
        '<div class="cols-2" style="margin-top:16px">' + modCard("induction") + modCard("refresher") + "</div>" + '<div style="margin-top:16px">' + modCard("pm") + "</div>";

      function assignModal(mods, label) {
        CC.modal({
          title: label, submitLabel: "Assign",
          body: '<div class="field"><label>' + esc(t("Who should complete it?")) + '</label><div class="checks">' + staff.map(function (p) { return '<label><input type="checkbox" name="who" value="' + p.id + '"> ' + esc(p.full_name || p.email) + " <span class=\"muted small\">(" + esc(CC.roleLabel(p.role)) + ")</span></label>"; }).join("") + "</div></div>" +
            '<div class="field"><label>' + esc(t("Due date")) + '</label><input type="date" name="due" value="' + CC.isoDate(14) + '"></div>',
          onSubmit: function (d) {
            var who = [].concat(d.who || []);
            if (!who.length) throw new Error(t("Choose at least one person."));
            var rows = []; who.forEach(function (pidp) { mods.forEach(function (m) { rows.push({ module_id: m.id, profile_id: pidp, practice_id: pid, due_date: d.due || null }); }); });
            return CC.api.training.assign(rows).then(function () { CC.api.audit.log("assign_training", "training", "", pid, { modules: mods.length, people: who.length }); CC.toast(t("Training assigned.")); reload(); });
          }
        });
      }
      el.onclick = function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return;
        if (b.getAttribute("data-act") === "assign") { var m = modules.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0]; assignModal([m], t("Assign") + ": " + modTitle(m)); }
        else assignModal(modules.filter(function (x) { return x.kind === "induction"; }), t("Assign full induction pathway"));
      };
    });
  };

  /* ------------------------------ Compliance check (self-assessment) ------------------------------ */
  var ANS = [["yes", "Yes"], ["partial", "Partly"], ["no", "No"], ["na", "N/A"]];
  function qText(q) { return CC.lang === "cy" && q.text_cy ? q.text_cy : q.text_en; }
  function scoreOf(answers) {
    var v = { yes: 1, partial: 0.5, no: 0 }, a = answers.filter(function (x) { return x.answer !== "na"; });
    return a.length ? Math.round(100 * a.reduce(function (s, x) { return s + v[x.answer]; }, 0) / a.length) : null;
  }

  CC.views.check = function (el) {
    var pid = S.practiceId;
    if (!pid) { el.innerHTML = '<div class="empty">' + esc(t("No practice selected.")) + "</div>"; return; }
    return Promise.all([CC.api.assessment.list(pid), CC.api.assessment.questions()]).then(function (r) {
      var list = r[0], questions = r[1];
      var open = list.filter(function (a) { return a.status === "in_progress"; })[0];
      var done = list.filter(function (a) { return a.status === "completed"; });
      if (open) return runForm(el, pid, open, questions);
      return overview(el, pid, done, questions);
    });
  };

  function overview(el, pid, done, questions) {
    el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Compliance check")) + "</h1><p class=\"muted\">" + esc(t("Mock-inspect your practice against the structure HIW uses. Results feed your dashboard and action list.")) + "</p></div>" +
      '<div class="actions"><button class="btn btn-primary" data-act="start">' + esc(done.length ? t("Start a new assessment") : t("Start your first assessment")) + "</button></div></div>" +
      '<div class="banner info"><span>' + esc(t("The questions below are illustrative starting content and should be reviewed against HIW's published framework by a dental compliance expert before you rely on the score.")) + "</span></div>" +
      '<div class="panel"><h3>' + esc(t("Past assessments")) + "</h3>" + (done.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Completed")) + "</th><th>" + esc(t("Score")) + "</th><th></th></tr></thead><tbody>" +
        done.map(function (a) { return "<tr><td>" + esc(CC.fmtDateTime(a.completed_at)) + "</td><td>" + (a.score === null ? "—" : a.score + "%") + '</td><td class="actions-cell"><button class="btn btn-secondary btn-sm" data-act="report" data-id="' + a.id + '">' + esc(t("Gap report")) + "</button></td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">' + esc(t("No assessments completed yet.")) + "</div>") + "</div>";
    el.onclick = function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      if (b.getAttribute("data-act") === "start") CC.api.assessment.start(pid, done[0] && done[0].id).then(function () { CC.api.audit.log("start_assessment", "assessment", "", pid); CC.render(); }).catch(CC.fail);
      else gapReport(b.getAttribute("data-id"), pid, questions, done);
    };
  }

  function runForm(el, pid, a, questions) {
    return CC.api.assessment.answers(a.id).then(function (saved) {
      var ans = {}; saved.forEach(function (x) { ans[x.question_id] = { answer: x.answer, note: x.note || "" }; });
      function progress() { var n = Object.keys(ans).length; return n + " / " + questions.length; }
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Compliance check")) + "</h1><p class=\"muted\">" + esc(t("Answers save automatically. Complete the assessment to generate your gap report.")) + "</p></div>" +
        '<div class="actions"><span class="chip chip-blue" id="prog">' + esc(t("Answered")) + " " + progress() + '</span><button class="btn btn-primary" data-act="complete">' + esc(t("Complete assessment")) + "</button></div></div>" +
        CC.CATS.map(function (c) {
          return '<div class="panel"><h3>' + esc(CC.catName(c.key)) + "</h3>" + questions.filter(function (q) { return q.category === c.key; }).map(function (q) {
            var cur = ans[q.id] || {};
            return '<div class="q-card" data-q="' + q.id + '"><div class="q-text"><span class="q-ref">' + esc(q.ref) + "</span>" + esc(qText(q)) + '</div><div class="answers">' +
              ANS.map(function (o) { return '<label><input type="radio" name="q' + q.id + '" value="' + o[0] + '"' + (cur.answer === o[0] ? " checked" : "") + '><span class="a-' + o[0] + '">' + esc(t(o[1])) + "</span></label>"; }).join("") + '</div><textarea placeholder="' + esc(t("Notes or action required (optional)")) + '" rows="1">' + esc(cur.note || "") + "</textarea></div>";
          }).join("") + "</div>";
        }).join("");
      function save(qid) { var c = ans[qid]; if (!c || !c.answer) return; CC.api.assessment.save(a.id, [{ question_id: +qid, answer: c.answer, note: c.note }]).catch(CC.fail); document.getElementById("prog").textContent = t("Answered") + " " + progress(); }
      el.onchange = function (e) {
        if (e.target.type !== "radio") return;
        var qid = e.target.closest("[data-q]").getAttribute("data-q");
        ans[qid] = { answer: e.target.value, note: (ans[qid] && ans[qid].note) || "" }; save(qid);
      };
      el.addEventListener("focusout", function (e) {
        if (e.target.tagName !== "TEXTAREA") return;
        var qid = e.target.closest("[data-q]").getAttribute("data-q");
        if (ans[qid]) { ans[qid].note = e.target.value; save(qid); }
      });
      el.onclick = function (e) {
        var b = e.target.closest("[data-act]"); if (!b || b.getAttribute("data-act") !== "complete") return;
        var missing = questions.filter(function (q) { return !ans[q.id]; }).length;
        if (missing) { CC.toast(t("{n} questions still need an answer.", { n: missing }), "err"); return; }
        var score = scoreOf(Object.keys(ans).map(function (k) { return ans[k]; }));
        CC.api.assessment.complete(a.id, score).then(function () { CC.api.audit.log("complete_assessment", "assessment", a.id, pid, { score: score }); CC.toast(t("Assessment completed.")); return CC.api.assessment.list(pid); }).then(function (list) {
          var done = list.filter(function (x) { return x.status === "completed"; });
          return CC.render().then(function () { gapReport(a.id, pid, questions, done); });
        }).catch(CC.fail);
      };
    });
  }

  function gapReport(aid, pid, questions, done) {
    var a = done.filter(function (x) { return x.id === aid; })[0] || {};
    CC.api.assessment.answers(aid).then(function (ans) {
      var order = { no: 0, partial: 1 };
      var gaps = ans.filter(function (x) { return x.answer === "no" || x.answer === "partial"; }).sort(function (x, y) { return order[x.answer] - order[y.answer]; });
      var body = '<p class="muted">' + esc(t("Completed {d}", { d: CC.fmtDateTime(a.completed_at) })) + " · " + esc(t("Score")) + ": <strong>" + (a.score === null || a.score === undefined ? "—" : a.score + "%") + "</strong></p>" +
        (gaps.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Ref")) + "</th><th>" + esc(t("Requirement")) + "</th><th>" + esc(t("Category")) + "</th><th>" + esc(t("Result")) + "</th><th>" + esc(t("Action / notes")) + "</th></tr></thead><tbody>" +
          gaps.map(function (g) { var q = questions.filter(function (x) { return x.id === g.question_id; })[0]; return "<tr><td><strong>" + esc(q.ref) + "</strong></td><td>" + esc(qText(q)) + "</td><td>" + esc(CC.catName(q.category)) + "</td><td>" + CC.chip(g.answer === "no" ? "red" : "amber", t(g.answer === "no" ? "No" : "Partly")) + "</td><td>" + esc(g.note || "") + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">' + esc(t("No gaps identified. Well done.")) + "</div>") +
        '<p><button type="button" class="btn btn-secondary btn-sm" onclick="window.print()">' + esc(t("Print / save as PDF")) + "</button></p>";
      CC.modal({ title: t("Gap report"), body: body, hideSubmit: true, wide: true });
    }).catch(CC.fail);
  }

  /* ------------------------------ Team ------------------------------ */
  CC.views.team = function (el) {
    var pid = S.practiceId, me = S.profile;
    return Promise.all([CC.api.profiles.list({ practice_id: pid }), CC.api.invites.list()]).then(function (r) {
      var people = r[0].filter(function (p) { return p.practice_id === pid; }), invites = r[1].filter(function (i) { return i.practice_id === pid && i.role !== "inspector"; });
      var inviteRoles = me.role === "principal" ? ["staff", "practice_manager"] : ["staff"];
      function canToggle(p) { return p.id !== me.id && (me.role === "principal" ? p.role !== "principal" : p.role === "staff"); }
      function reload() { CC.render(); }
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Team")) + "</h1><p class=\"muted\">" + esc(t("Invite colleagues and manage who has access to your practice.")) + "</p></div>" +
        '<div class="actions"><button class="btn btn-primary" data-act="invite">+ ' + esc(t("Invite team member")) + "</button></div></div>" +
        '<div class="panel"><h3>' + esc(t("People")) + '</h3><div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Name")) + "</th><th>" + esc(t("Email")) + "</th><th>" + esc(t("Role")) + "</th><th>" + esc(t("Access")) + "</th><th></th></tr></thead><tbody>" +
        people.map(function (p) { return "<tr><td><strong>" + esc(p.full_name || "—") + "</strong></td><td>" + esc(p.email) + "</td><td>" + esc(CC.roleLabel(p.role)) + "</td><td>" + CC.chip(p.active ? "green" : "none", t(p.active ? "Active" : "Deactivated")) + '</td><td class="actions-cell">' + (canToggle(p) ? '<button class="btn ' + (p.active ? "btn-danger" : "btn-secondary") + ' btn-sm" data-act="toggle" data-id="' + p.id + '" data-active="' + (p.active ? 1 : 0) + '">' + esc(t(p.active ? "Deactivate" : "Reactivate")) + "</button>" : "") + "</td></tr>"; }).join("") + "</tbody></table></div></div>" +
        (invites.length ? '<div class="panel"><h3>' + esc(t("Pending invites")) + '</h3><ul class="list">' + invites.map(function (i) { return "<li><span>" + esc(i.full_name || i.email) + '<div class="sub">' + esc(i.email) + " · " + esc(CC.roleLabel(i.role)) + '</div></span><button class="btn btn-secondary btn-sm" data-act="revoke" data-id="' + i.id + '">' + esc(t("Cancel invite")) + "</button></li>"; }).join("") + "</ul></div>" : "");
      el.onclick = function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return;
        var act = b.getAttribute("data-act"), id = b.getAttribute("data-id");
        if (act === "invite") CC.modal({
          title: t("Invite team member"), submitLabel: "Send invite",
          body: '<div class="field"><label>' + esc(t("Full name")) + '</label><input name="full_name" required></div><div class="field"><label>' + esc(t("Email")) + '</label><input type="email" name="email" required></div><div class="field"><label>' + esc(t("Role")) + '</label><select name="role">' + CC.options(inviteRoles.map(function (r) { return { value: r, label: CC.roleLabel(r) }; }), "staff") + "</select></div>" +
            '<p class="small muted">' + esc(t("They then open the portal, choose Create account and use this same email address.")) + "</p>",
          onSubmit: function (d) { return CC.api.invites.create({ email: d.email.trim(), full_name: d.full_name.trim(), role: d.role, practice_id: pid }).then(function () { CC.api.audit.log("invite_user", "invite", "", pid, { role: d.role }); CC.toast(t("Invite created.")); reload(); }); }
        });
        else if (act === "toggle") { var active = b.getAttribute("data-active") === "1"; CC.confirm(t(active ? "Deactivate this person? They will lose access immediately." : "Reactivate this person?")).then(function (ok) { if (ok) CC.api.profiles.setActive(id, !active).then(function () { CC.toast(t("Access updated.")); reload(); }).catch(CC.fail); }); }
        else if (act === "revoke") CC.api.invites.remove(id).then(function () { CC.toast(t("Invite cancelled.")); reload(); }).catch(CC.fail);
      };
    });
  };

  /* ------------------------------ Inspector access (Principal) ------------------------------ */
  CC.views.inspectors = function (el) {
    var pid = S.practiceId;
    return Promise.all([CC.api.grants.list(pid), CC.api.audit.list({ practice_id: pid, limit: 200 })]).then(function (r) {
      var grants = r[0], log = r[1].filter(function (a) { return a.actor_role === "inspector"; }).slice(0, 30);
      function state(g) { if (g.revoked) return ["none", "Revoked"]; var now = new Date(); if (new Date(g.expires_at) < now) return ["none", "Expired"]; if (new Date(g.starts_at) > now) return ["blue", "Scheduled"]; return ["green", "Active"]; }
      function reload() { CC.render(); }
      el.innerHTML = '<div class="page-head"><div><h1>' + esc(t("Inspector access")) + "</h1><p class=\"muted\">" + esc(t("Give an HIW inspector time-boxed, read-only access ahead of a visit. Access ends automatically, and everything they view is logged.")) + "</p></div>" +
        '<div class="actions"><button class="btn btn-primary" data-act="grant">+ ' + esc(t("Grant access")) + "</button></div></div>" +
        '<div class="panel"><h3>' + esc(t("Access grants")) + "</h3>" + (grants.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>' + esc(t("Inspector")) + "</th><th>" + esc(t("From")) + "</th><th>" + esc(t("Until")) + "</th><th>" + esc(t("Status")) + "</th><th></th></tr></thead><tbody>" +
          grants.map(function (g) { var st = state(g); return "<tr><td>" + esc(g.inspector_email) + "</td><td>" + esc(CC.fmtDateTime(g.starts_at)) + "</td><td>" + esc(CC.fmtDateTime(g.expires_at)) + "</td><td>" + CC.chip(st[0], t(st[1])) + '</td><td class="actions-cell">' + (st[1] === "Active" || st[1] === "Scheduled" ? '<button class="btn btn-danger btn-sm" data-act="revoke" data-id="' + g.id + '">' + esc(t("Revoke")) + "</button>" : "") + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">' + esc(t("No inspector access has been granted.")) + "</div>") + "</div>" +
        '<div class="panel"><h3>' + esc(t("What inspectors have viewed")) + "</h3>" + (log.length ? '<ul class="list">' + log.map(function (a) { return "<li><span>" + esc(a.actor_email) + " — " + esc(t(a.action.replace(/_/g, " "))) + (a.detail && a.detail.title ? ": " + esc(a.detail.title) : "") + '</span><span class="sub">' + esc(CC.fmtDateTime(a.at)) + "</span></li>"; }).join("") + "</ul>" : '<div class="empty">' + esc(t("No inspector activity yet.")) + "</div>") + "</div>";
      el.onclick = function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return;
        if (b.getAttribute("data-act") === "revoke") CC.api.grants.revoke(b.getAttribute("data-id")).then(function () { CC.toast(t("Access revoked.")); reload(); }).catch(CC.fail);
        else CC.modal({
          title: t("Grant inspector access"), submitLabel: "Grant access",
          body: '<div class="field"><label>' + esc(t("Inspector's email address")) + '</label><input type="email" name="email" required></div><div class="field"><label>' + esc(t("Inspector's name (optional)")) + '</label><input name="name"></div><div class="field"><label>' + esc(t("Access until")) + '</label><input type="date" name="until" required min="' + CC.isoDate(1) + '" max="' + CC.isoDate(90) + '" value="' + CC.isoDate(14) + '"></div>' +
            '<p class="small muted">' + esc(t("If the inspector has no portal account yet they will be invited to create one with this email. Maximum 90 days.")) + "</p>",
          onSubmit: function (d) {
            var email = d.email.trim(), expires = new Date(d.until + "T23:59:59").toISOString();
            return CC.api.invites.create({ email: email, full_name: d.name || null, role: "inspector", practice_id: pid }).catch(function () { /* already invited or has an account */ }).then(function () {
              return CC.api.grants.create({ practice_id: pid, inspector_email: email, expires_at: expires });
            }).then(function () { CC.api.audit.log("grant_inspector", "grant", "", pid, { inspector: email }); CC.toast(t("Inspector access granted.")); reload(); });
          }
        });
      };
    });
  };
})();
