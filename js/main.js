/* ==========================================================================
   Cymru Compliance — shared site behaviour
   - Mobile nav toggle
   - EN / CY language switcher (persists via localStorage, no page reload)
   - Contact / waitlist forms (mailto-based — no backend required for free
     static hosting; swap for a real form endpoint later, see README)
   ========================================================================== */

(function () {
  "use strict";

  var LANG_KEY = "cc_lang";
  var originalContent = []; // { el, html }
  var originalAttrs = [];   // { el, attr, value }

  function currentLang() {
    return localStorage.getItem(LANG_KEY) || "en";
  }

  function getPageDict(page) {
    if (typeof CY_I18N === "undefined") return {};
    var common = CY_I18N.common || {};
    var pageDict = (page && CY_I18N[page]) || {};
    var merged = {};
    for (var k in common) merged[k] = common[k];
    for (var k2 in pageDict) merged[k2] = pageDict[k2];
    return merged;
  }

  function captureOriginals() {
    var nodes = document.querySelectorAll("[data-i18n]");
    nodes.forEach(function (el) {
      originalContent.push({ el: el, html: el.innerHTML });
    });
    var attrNodes = document.querySelectorAll("[data-i18n-placeholder]");
    attrNodes.forEach(function (el) {
      originalAttrs.push({ el: el, attr: "placeholder", value: el.getAttribute("placeholder") });
    });
    var titleNodes = document.querySelectorAll("[data-i18n-title]");
    titleNodes.forEach(function (el) {
      originalAttrs.push({ el: el, attr: "title", value: el.getAttribute("title") });
    });
  }

  function applyLanguage(lang) {
    var body = document.body;
    var page = body ? body.getAttribute("data-page") : "";
    var dict = getPageDict(page);

    document.documentElement.setAttribute("lang", lang);

    originalContent.forEach(function (item) {
      var key = item.el.getAttribute("data-i18n");
      if (lang === "cy" && dict[key]) {
        item.el.innerHTML = dict[key];
      } else {
        item.el.innerHTML = item.html;
      }
    });

    originalAttrs.forEach(function (item) {
      var key = item.el.getAttribute("data-i18n-" + item.attr);
      if (lang === "cy" && dict[key]) {
        item.el.setAttribute(item.attr, dict[key]);
      } else {
        item.el.setAttribute(item.attr, item.value);
      }
    });

    document.querySelectorAll(".lang-toggle button").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
    });

    localStorage.setItem(LANG_KEY, lang);
  }

  function initLangToggle() {
    document.querySelectorAll(".lang-toggle button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyLanguage(btn.getAttribute("data-lang"));
      });
    });
  }

  function initMobileNav() {
    var toggle = document.querySelector(".nav-toggle");
    var links = document.querySelector(".nav-links");
    if (!toggle || !links) return;
    toggle.addEventListener("click", function () {
      var isOpen = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function initActiveNav() {
    var path = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-links a").forEach(function (a) {
      var href = a.getAttribute("href");
      if (href === path || (path === "" && href === "index.html")) {
        a.classList.add("active");
      }
    });
  }

  function initFooterYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  // ---- Enquiry forms --------------------------------------------------------
  // When Supabase is configured (js/site-config.js) enquiries are saved to the
  // `enquiries` table and appear in the portal's admin area. Otherwise (or if the
  // request fails) we fall back to opening the visitor's email client.
  var CONTACT_EMAIL = "solutions@draigworks.uk";

  function backendConfigured() {
    var c = window.CC_CONFIG || {};
    return !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY);
  }

  function postEnquiry(row) {
    var c = window.CC_CONFIG;
    return fetch(c.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/enquiries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: c.SUPABASE_ANON_KEY,
        Authorization: "Bearer " + c.SUPABASE_ANON_KEY,
        Prefer: "return=minimal"
      },
      body: JSON.stringify(row)
    }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); });
  }

  function mailtoFallback(form, subject) {
    var data = new FormData(form), lines = [];
    data.forEach(function (value, key) {
      if (key === "website" || !value) return;
      var field = form.querySelector('[name="' + key + '"]');
      var label = field && field.closest(".field") ? field.closest(".field").querySelector("label") : null;
      lines.push((label ? label.textContent.trim() : key) + ": " + value);
    });
    window.location.href = "mailto:" + CONTACT_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
  }

  function showResult(form, sentOk) {
    var wrap = form.parentElement;
    var sent = wrap.querySelector(".form-sent"), fallback = wrap.querySelector(".form-success");
    if (sentOk && sent) sent.classList.add("show"); else if (fallback) fallback.classList.add("show");
    if (sentOk) form.reset();
  }

  // buildRow(data) -> row for the enquiries table; subject(row) -> email subject
  function initEnquiryForm(formId, buildRow, subjectFn) {
    var form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = new FormData(form);
      if (data.get("website")) { showResult(form, true); return; } // honeypot: bots only
      var row = buildRow(data);
      row.language = currentLang();
      var btn = form.querySelector('button[type="submit"]');
      if (!backendConfigured()) { mailtoFallback(form, subjectFn(row)); showResult(form, false); return; }
      if (btn) btn.disabled = true;
      postEnquiry(row).then(function () { showResult(form, true); }).catch(function () {
        mailtoFallback(form, subjectFn(row)); showResult(form, false);
      }).then(function () { if (btn) btn.disabled = false; });
    });
  }

  function initPathToggle() {
    document.querySelectorAll(".path-toggle").forEach(function (group) {
      var options = group.querySelectorAll(".path-option");
      var input = document.getElementById(group.getAttribute("data-input-target"));
      options.forEach(function (opt) {
        opt.addEventListener("click", function () {
          options.forEach(function (o) { o.classList.remove("selected"); });
          opt.classList.add("selected");
          if (input) input.value = opt.getAttribute("data-value");
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    captureOriginals();
    applyLanguage(currentLang());
    initLangToggle();
    initMobileNav();
    initActiveNav();
    initFooterYear();
    initPathToggle();

    initEnquiryForm("contact-form", function (d) {
      var num = parseInt(d.get("Number of practices"), 10);
      return {
        kind: d.get("enquiry-type") || "general",
        practice_type: d.get("practice-type") || null,
        name: (d.get("Name") || "").trim(),
        email: (d.get("Email") || "").trim(),
        practice_name: d.get("Practice or group name") || null,
        sites: isNaN(num) ? null : num,
        message: d.get("Message") || null
      };
    }, function (row) { return "Cymru Compliance enquiry (" + row.kind + " — " + (row.practice_type || "") + ")"; });

    initEnquiryForm("waitlist-form", function (d) {
      return {
        kind: "waitlist",
        name: (d.get("Name") || "").trim(),
        email: (d.get("Email") || "").trim(),
        practice_name: d.get("Practice or group name") || null,
        role: d.get("Role") || null
      };
    }, function () { return "Cymru Compliance portal — access request"; });
  });
})();

/* Draigworks "powered by" badge in the site footer */
(function () {
  function add() {
    var f = document.querySelector(".site-footer .container");
    if (!f || f.querySelector(".dw-badge")) return;
    f.insertAdjacentHTML("beforeend", '<a class="dw-badge" href="https://www.draigworks.uk" target="_blank" rel="noopener" title="Draigworks"><span>Powered by</span><img src="' + (document.querySelector('script[src$="js/main.js"]').getAttribute("src").replace("js/main.js", "") ) + 'img/draigworks-white.png" alt="Draigworks" width="110" height="29"></a>');
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add); else add();
})();
