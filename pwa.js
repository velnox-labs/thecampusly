/* Campusly PWA helper: registers the service worker, keeps the browser colour in sync with the theme,
   offers "Install app", and tells people when a new version is ready. */
(function () {
  "use strict";
  if (window.parent !== window) {   // inside the shell: only forward the Install item to the shell
    document.addEventListener("DOMContentLoaded", function () {
      var item = document.getElementById("installMenu"); if (!item) return;
      function ref() { try { item.hidden = !window.parent.CampuslyPWA.canInstall(); } catch (e) {} }
      item.addEventListener("click", function () { try { window.parent.CampuslyPWA.install(); } catch (e) {} });
      ref(); setInterval(ref, 1500);
    });
    return;
  }
  var DISMISS = "campusly-install-dismissed", deferred = null;
  var standalone = function () { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; };
  var ios = (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) && !window.MSStream;
  function el(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text) e.textContent = text; return e; }

  /* browser / status-bar colour follows light or dark theme */
  var meta = document.querySelector('meta[name="theme-color"]');
  function syncColor() {
    if (!meta) return;
    var bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    if (/^#[0-9a-f]{6}$/i.test(bg)) meta.setAttribute("content", bg);
  }
  new MutationObserver(syncColor).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  syncColor();

  /* small bottom bar used for the install and update messages */
  var BAR = "position:fixed;left:12px;right:12px;bottom:calc(86px + env(safe-area-inset-bottom));z-index:80;max-width:460px;margin:0 auto;display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:16px;background:var(--card,#fff);color:var(--text,#182542);border:1px solid var(--border,#E1E8F5);box-shadow:0 10px 30px rgba(20,38,79,.22);font:500 .9rem system-ui,sans-serif";
  var BTN = "min-height:40px;padding:0 14px;border:0;border-radius:12px;background:var(--blue,#356DFF);color:#fff;font:600 .88rem inherit;cursor:pointer;flex:none";
  var GHOST = "min-height:40px;padding:0 10px;border:0;background:none;color:var(--muted,#74819A);font:600 .88rem inherit;cursor:pointer;flex:none";
  function bar(id, text, actions) {
    var old = document.getElementById(id); if (old) old.remove();
    var b = el("div", BAR); b.id = id; b.setAttribute("role", "status");
    var t = el("span", "flex:1;line-height:1.35", text); b.appendChild(t);
    actions.forEach(function (a) { var x = el("button", a.ghost ? GHOST : BTN, a.label); x.type = "button"; x.addEventListener("click", function () { b.remove(); a.fn(); }); b.appendChild(x); });
    document.body.appendChild(b); return b;
  }

  /* update flow */
  function showUpdate(reg) {
    bar("pwa-update", "A new version of Campusly is ready.", [{ label: "Refresh", fn: function () { if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING"); } }, { label: "Later", ghost: true, fn: function () {} }]);
  }
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").then(function (reg) {
        if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg);
        reg.addEventListener("updatefound", function () {
          var w = reg.installing; if (!w) return;
          w.addEventListener("statechange", function () { if (w.state === "installed" && navigator.serviceWorker.controller) showUpdate(reg); });
        });
        setInterval(function () { reg.update().catch(function () {}); }, 60 * 60 * 1000);
      }).catch(function () {});
      var reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", function () { if (reloading) return; reloading = true; window.location.reload(); });
    });
  }

  /* install flow */
  function canInstall() { return !standalone() && (!!deferred || ios); }
  function iosHelp() {
    var ov = el("div", "position:fixed;inset:0;z-index:90;background:rgba(10,20,48,.55);display:grid;place-items:end center;padding:16px");
    var box = el("div", "width:min(420px,100%);background:var(--card,#fff);color:var(--text,#182542);border-radius:20px;padding:20px;padding-bottom:calc(20px + env(safe-area-inset-bottom));font:500 .95rem/1.5 system-ui,sans-serif");
    box.appendChild(el("h2", "margin:0 0 8px;font-size:1.1rem", "Install Campusly on iPhone"));
    box.appendChild(el("p", "margin:0 0 14px;color:var(--muted,#74819A)", "Open this page in Safari, tap the Share button, then choose Add to Home Screen."));
    var ok = el("button", BTN + ";width:100%", "Got it"); ok.type = "button"; ok.addEventListener("click", function () { ov.remove(); });
    box.appendChild(ok); ov.appendChild(box); ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); }); document.body.appendChild(ov);
  }
  function install() {
    if (deferred) { var d = deferred; deferred = null; d.prompt(); d.userChoice.then(refresh, refresh); }
    else if (ios) iosHelp();
  }
  function dismissed() { try { return Date.now() - (+localStorage.getItem(DISMISS) || 0) < 7 * 864e5; } catch (e) { return false; } }
  function refresh() {
    var item = document.getElementById("installMenu"); if (item) item.hidden = !canInstall();
    var onHome = /\/(index\.html)?$/.test(location.pathname);
    if (onHome && canInstall() && !dismissed() && !document.getElementById("pwa-install")) {
      bar("pwa-install", ios ? "Install Campusly: tap Share, then Add to Home Screen." : "Install Campusly for quick access, even offline.",
        [{ label: ios ? "How" : "Install", fn: install }, { label: "Not now", ghost: true, fn: function () { try { localStorage.setItem(DISMISS, String(Date.now())); } catch (e) {} } }]);
    }
    if (!canInstall()) { var b = document.getElementById("pwa-install"); if (b) b.remove(); }
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; refresh(); });
  window.addEventListener("appinstalled", function () { deferred = null; refresh(); });
  document.addEventListener("DOMContentLoaded", function () {
    var item = document.getElementById("installMenu"); if (item) item.addEventListener("click", install);
    setTimeout(refresh, 1200);
  });
  window.CampuslyPWA = { install: install, canInstall: canInstall };
})();
