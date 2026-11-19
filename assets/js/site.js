/* ============================================================
   Suchet Kapoor — shared site behaviour
   Theme toggle, reading progress, reading time, TOC, copy link.
   Vanilla JS. No dependencies.
   ============================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Theme ---------- */

  var themeBtn = document.querySelector("[data-theme-toggle]");
  var themeMeta = document.querySelector("#theme-color");

  function currentTheme() {
    return root.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function paintTheme(theme, persist) {
    if (theme === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme");
    }
    if (themeMeta) {
      themeMeta.setAttribute("content", theme === "light" ? "#f7f8f5" : "#0a0d12");
    }
    if (themeBtn) {
      var next = theme === "light" ? "dark" : "light";
      themeBtn.setAttribute("aria-label", "Switch to " + next + " theme");
      themeBtn.setAttribute("title", "Switch to " + next + " theme");
    }
    if (persist) {
      try { localStorage.setItem("theme", theme); } catch (e) {}
    }
  }

  if (themeBtn) {
    paintTheme(currentTheme(), false);
    themeBtn.addEventListener("click", function () {
      paintTheme(currentTheme() === "light" ? "dark" : "light", true);
    });
  }

  /* ---------- Footer year ---------- */

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- Article helpers ---------- */

  var prose = document.querySelector(".prose");
  var progressBar = document.querySelector("#readBar");
  var tocList = document.querySelector(".toc ol");

  /* Reading time */
  var readTimeSlots = document.querySelectorAll("[data-readtime]");
  if (prose && readTimeSlots.length) {
    var text = (prose.textContent || "").replace(/\s+/g, " ").trim();
    var words = text ? text.split(" ").length : 0;
    var minutes = Math.max(1, Math.round(words / 220));
    readTimeSlots.forEach(function (slot) {
      slot.textContent = minutes + " min read";
    });
  }

  /* Table of contents */
  function slugify(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  var headings = [];
  if (prose && tocList) {
    var usedIds = {};
    prose.querySelectorAll("h2, h3").forEach(function (heading, index) {
      var id = heading.id;
      if (!id) {
        id = slugify(heading.textContent) || "section-" + index;
        if (usedIds[id]) id += "-" + index;
        heading.id = id;
      }
      usedIds[id] = true;

      var li = document.createElement("li");
      li.className = heading.tagName === "H3" ? "lvl-3" : "lvl-2";

      var link = document.createElement("a");
      link.href = "#" + id;
      link.textContent = heading.textContent.trim();
      li.appendChild(link);
      tocList.appendChild(li);

      headings.push({ heading: heading, link: link });
    });

    if (!headings.length) {
      var toc = document.querySelector(".toc");
      if (toc) toc.classList.add("is-empty");
    }
  }

  /* Progress + active TOC heading, throttled to animation frames */
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;

      if (prose && progressBar) {
        var rect = prose.getBoundingClientRect();
        var top = window.scrollY + rect.top;
        var height = Math.max(prose.offsetHeight - window.innerHeight * 0.35, 1);
        var progress = (window.scrollY - top) / height;
        progressBar.style.width = Math.min(1, Math.max(0, progress)) * 100 + "%";
      }

      if (headings.length) {
        var active = null;
        for (var i = 0; i < headings.length; i++) {
          if (headings[i].heading.getBoundingClientRect().top <= 128) {
            active = headings[i];
          } else {
            break;
          }
        }
        headings.forEach(function (entry) {
          entry.link.classList.toggle("active", entry === active);
        });
      }
    });
  }

  if (prose || headings.length) {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
  }

  /* Copy current article link */
  document.querySelectorAll("[data-copy-link]").forEach(function (button) {
    var label = button.querySelector("span");
    var resetTimer = null;

    function feedback(message) {
      if (!label) return;
      var original = label.getAttribute("data-original") || label.textContent;
      label.setAttribute("data-original", original);
      label.textContent = message;
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(function () {
        label.textContent = original;
      }, 1800);
    }

    button.addEventListener("click", function () {
      var url = window.location.href;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(
          function () { feedback("Copied!"); },
          function () { fallbackCopy(url); }
        );
      } else {
        fallbackCopy(url);
      }
    });

    function fallbackCopy(value) {
      var input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(input);
      feedback(ok ? "Copied!" : "Copy failed");
    }
  });

  /* Smooth-scroll TOC links while respecting reduced motion */
  if (tocList && !reduceMotion.matches) {
    tocList.addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (!link) return;
      var target = document.getElementById(link.getAttribute("href").slice(1));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", link.getAttribute("href"));
    });
  }
})();
