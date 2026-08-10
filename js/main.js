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

  // Builds a mailto: link from a form's fields so the site can capture
  // enquiries with zero backend / zero cost. See README for upgrading to
  // a hosted form service (Formspree, Netlify Forms, etc.) later.
  function initMailtoForm(formId, toAddress, subjectFn) {
    var form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var lines = [];
      data.forEach(function (value, key) {
        var field = form.querySelector('[name="' + key + '"]');
        var label = field && field.closest(".field") ? field.closest(".field").querySelector("label") : null;
        var labelText = label ? label.textContent.trim() : key;
        if (value) lines.push(labelText + ": " + value);
      });
      var subject = typeof subjectFn === "function" ? subjectFn(data) : "New enquiry — Cymru Compliance";
      var body = lines.join("\n");
      var mailto = "mailto:" + toAddress + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      window.location.href = mailto;

      var success = form.parentElement.querySelector(".form-success");
      if (success) success.classList.add("show");
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

    initMailtoForm("contact-form", "jonathan.milton.anderson@gmail.com", function (data) {
      var path = data.get("enquiry-type") || "General enquiry";
      return "Cymru Compliance enquiry (" + path + ")";
    });
    initMailtoForm("waitlist-form", "jonathan.milton.anderson@gmail.com", function () {
      return "Cymru Compliance portal — waitlist signup";
    });
  });
})();
