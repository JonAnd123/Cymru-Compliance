/* Cymru Compliance portal — core helpers (i18n, formatting, toast, modal) */
(function () {
  "use strict";
  var CC = window.CC = window.CC || {};

  CC.cfg = window.CC_CONFIG || {};
  CC.live = !!(CC.cfg.SUPABASE_URL && CC.cfg.SUPABASE_ANON_KEY);
  CC.lang = (function () { try { return localStorage.getItem("cc_lang") || "en"; } catch (e) { return "en"; } })();
  CC.CATS = window.CCScoring.CATS;
  CC.charts = [];
  CC.state = { user: null, profile: null, practices: [], groups: [], practiceId: null, route: null, mfaNudge: false };

  /* ---------- i18n: English text is the key, Welsh supplied in i18n.js ---------- */
  CC.t = function (s, vars) {
    var out = (CC.lang === "cy" && window.CC_CY && window.CC_CY[s]) || s;
    if (vars) out = out.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
    return out;
  };
  CC.setLang = function (l) {
    CC.lang = l;
    try { localStorage.setItem("cc_lang", l); } catch (e) {}
    document.documentElement.setAttribute("lang", l);
  };

  /* ---------- helpers ---------- */
  CC.esc = function (s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };
  CC.fmtDate = function (d) {
    if (!d) return "—";
    var x = new Date(d);
    if (isNaN(x)) return "—";
    return x.toLocaleDateString(CC.lang === "cy" ? "cy-GB" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  };
  CC.fmtDateTime = function (d) {
    if (!d) return "—";
    var x = new Date(d);
    if (isNaN(x)) return "—";
    return x.toLocaleString(CC.lang === "cy" ? "cy-GB" : "en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  CC.isoDate = function (offsetDays) {
    var d = new Date(); d.setDate(d.getDate() + (offsetDays || 0));
    return d.toISOString().slice(0, 10);
  };
  CC.catName = function (key) {
    var c = CC.CATS.filter(function (x) { return x.key === key; })[0];
    return c ? CC.t(c.en) : key;
  };
  var ROLE_LABELS = {
    platform_admin: "Platform admin", group_admin: "Group Admin", principal: "Principal",
    practice_manager: "Practice Manager", staff: "Staff", inspector: "Inspector (read-only)"
  };
  CC.roleLabel = function (r) { return CC.t(ROLE_LABELS[r] || r); };

  CC.chip = function (status, label) {
    return '<span class="chip chip-' + CC.esc(status) + '">' + CC.esc(label) + "</span>";
  };
  var STATUS_LABEL = { green: "Green", amber: "Amber", red: "Red", none: "No data" };
  CC.ragChip = function (status) { return CC.chip(status, CC.t(STATUS_LABEL[status] || status)); };
  var EV_LABEL = { valid: "Valid", expiring: "Expiring soon", expired: "Expired", pending: "Awaiting verification", rejected: "Rejected" };
  var EV_CLASS = { valid: "green", expiring: "amber", expired: "red", pending: "blue", rejected: "red" };
  CC.evChip = function (state) { return CC.chip(EV_CLASS[state], CC.t(EV_LABEL[state])); };

  CC.csv = function (rows, filename) {
    var out = rows.map(function (r) {
      return r.map(function (c) {
        c = c === null || c === undefined ? "" : String(c);
        return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
      }).join(",");
    }).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + out], { type: "text/csv" }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  };

  CC.uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
  };

  /* ---------- toast ---------- */
  CC.toast = function (msg, kind) {
    var host = document.getElementById("toasts");
    if (!host) return;
    var el = document.createElement("div");
    el.className = "toast toast-" + (kind || "ok");
    el.setAttribute("role", "status");
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () { el.classList.add("hide"); setTimeout(function () { el.remove(); }, 300); }, 4200);
  };
  CC.fail = function (e) {
    console.error(e);
    CC.toast((e && e.message) ? e.message : String(e), "err");
  };

  /* ---------- modal ---------- */
  // CC.modal({ title, body(html), submitLabel, onSubmit(data, ctx), wide, hideSubmit })
  CC.modal = function (opts) {
    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML =
      '<div class="modal' + (opts.wide ? " modal-wide" : "") + '" role="dialog" aria-modal="true" aria-label="' + CC.esc(opts.title) + '">' +
      '<div class="modal-head"><h3>' + CC.esc(opts.title) + '</h3><button type="button" class="icon-btn" data-close aria-label="' + CC.esc(CC.t("Close")) + '">&times;</button></div>' +
      '<form class="modal-body"><div class="modal-error" hidden></div>' + opts.body +
      '<div class="modal-foot">' +
      '<button type="button" class="btn btn-secondary" data-close>' + CC.esc(CC.t(opts.hideSubmit ? "Close" : "Cancel")) + "</button>" +
      (opts.hideSubmit ? "" : '<button type="submit" class="btn btn-primary">' + CC.esc(CC.t(opts.submitLabel || "Save")) + "</button>") +
      "</div></form></div>";
    document.body.appendChild(overlay);
    var form = overlay.querySelector("form");
    var errBox = overlay.querySelector(".modal-error");
    function close() { overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.closest("[data-close]")) close();
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!opts.onSubmit) { close(); return; }
      var data = {};
      new FormData(form).forEach(function (v, k) {
        if (v instanceof File) { data[k] = v.size ? v : null; return; }
        if (k in data) { if (!Array.isArray(data[k])) data[k] = [data[k]]; data[k].push(v); } else data[k] = v;
      });
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      errBox.hidden = true;
      Promise.resolve(opts.onSubmit(data, { close: close, form: form })).then(function (r) {
        if (r !== false) close();
      }).catch(function (err) {
        errBox.textContent = err && err.message ? err.message : String(err);
        errBox.hidden = false;
        if (btn) btn.disabled = false;
      });
    });
    var first = form.querySelector("input,select,textarea");
    if (first) setTimeout(function () { first.focus(); }, 30);
    return { close: close, el: overlay, form: form };
  };

  CC.confirm = function (message, okLabel) {
    return new Promise(function (resolve) {
      var done = false;
      var m = CC.modal({
        title: CC.t("Please confirm"),
        body: "<p>" + CC.esc(message) + "</p>",
        submitLabel: okLabel || "Confirm",
        onSubmit: function () { done = true; resolve(true); }
      });
      m.el.addEventListener("click", function (e) {
        if ((e.target === m.el || e.target.closest("[data-close]")) && !done) { done = true; resolve(false); }
      });
    });
  };

  CC.options = function (items, selected, placeholder) {
    var h = placeholder ? '<option value="">' + CC.esc(CC.t(placeholder)) + "</option>" : "";
    items.forEach(function (it) {
      h += '<option value="' + CC.esc(it.value) + '"' + (String(it.value) === String(selected) ? " selected" : "") + ">" + CC.esc(it.label) + "</option>";
    });
    return h;
  };

  CC.destroyCharts = function () {
    CC.charts.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    CC.charts = [];
  };
  CC.chart = function (canvas, cfg) {
    if (!window.Chart || !canvas) return null;
    var c = new window.Chart(canvas, cfg);
    CC.charts.push(c);
    return c;
  };

  CC.views = CC.views || {};
})();
