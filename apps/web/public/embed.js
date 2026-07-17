/*!
 * Tacto Embed SDK — embed.js
 * Drop a published Tacto guide onto any site: inline (auto-resizing iframe) or
 * as a popup. Dependency-free, origin-checked. The app origin is derived from
 * this script's own src, so nothing is hardcoded.
 *
 * Declarative:
 *   <script src="https://YOURAPP/embed.js" async></script>
 *   <div data-tacto-guide="SHAREID" data-tacto-mode="interactive"></div>
 *   <button data-tacto-guide-popup="SHAREID">Show me how</button>
 *   <div data-tacto-showcase="SLUG"></div>
 *   <button data-tacto-showcase-popup="SLUG">Explore</button>
 *
 * Programmatic:
 *   const inst = Tacto.embed("#el", { guide: "SHAREID", mode: "list", theme: "auto" });
 *   const sc   = Tacto.embed("#el", { showcase: "SLUG", theme: "auto" });
 *   const pop  = Tacto.open({ guide: "SHAREID", mode: "interactive" });
 *   Tacto.close(pop); Tacto.destroy(inst);
 *   Tacto.on("complete", fn); Tacto.off("complete", fn);
 *
 * Events: ready · open · close · step_change · complete · error · resize
 */
(function () {
  "use strict";
  if (window.Tacto && window.Tacto._ready) return;

  // Origin of THIS script = the Tacto app origin.
  var self = document.currentScript;
  if (!self) {
    var all = document.getElementsByTagName("script");
    for (var i = all.length - 1; i >= 0; i--) {
      if (/embed\.js(\?|$)/.test(all[i].src)) { self = all[i]; break; }
    }
  }
  var ORIGIN = self ? new URL(self.src, location.href).origin : location.origin;

  var instances = [];
  var seq = 0;
  var globalListeners = {};

  function on(map, evt, fn) { (map[evt] = map[evt] || []).push(fn); }
  function off(map, evt, fn) { if (map[evt]) map[evt] = map[evt].filter(function (f) { return f !== fn; }); }
  function emit(map, evt, payload, inst) {
    var fns = map[evt];
    if (!fns) return;
    for (var i = 0; i < fns.length; i++) { try { fns[i](payload, inst); } catch (e) { /* listener error */ } }
  }

  function buildUrl(opts) {
    var q = new URLSearchParams();
    if (opts.mode) q.set("mode", opts.mode);
    if (opts.theme) q.set("theme", opts.theme);
    if (opts.lang) q.set("lang", opts.lang);
    var qs = q.toString();
    var path = opts.showcase
      ? "/embed/showcase/" + encodeURIComponent(opts.showcase)
      : "/embed/g/" + encodeURIComponent(opts.guide);
    return ORIGIN + path + (qs ? "?" + qs : "");
  }

  function makeIframe(opts) {
    var f = document.createElement("iframe");
    f.src = buildUrl(opts);
    f.setAttribute("allow", "fullscreen");
    f.setAttribute("loading", "lazy");
    f.setAttribute("title", opts.showcase ? "Tacto showcase" : "Tacto guide");
    f.style.border = "0";
    f.style.width = "100%";
    f.style.display = "block";
    return f;
  }

  function register(inst) { instances.push(inst); return inst; }
  function unregister(inst) { instances = instances.filter(function (x) { return x !== inst; }); }

  // ── inline ────────────────────────────────────────────────────────────────
  function embed(target, opts) {
    var el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el || !opts || !(opts.guide || opts.showcase)) return null;
    var iframe = makeIframe(opts);
    iframe.style.height = (opts.height || Number(el.getAttribute && el.getAttribute("data-tacto-height")) || 520) + "px";
    el.innerHTML = "";
    el.appendChild(iframe);
    var listeners = {};
    var inst = {
      id: ++seq, type: "inline", iframe: iframe, el: el, _listeners: listeners, _autoResize: true,
      on: function (e, fn) { on(listeners, e, fn); return inst; },
      off: function (e, fn) { off(listeners, e, fn); return inst; },
      close: function () { inst.destroy(); },
      destroy: function () { unregister(inst); if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }
    };
    return register(inst);
  }

  // ── popup ─────────────────────────────────────────────────────────────────
  function open(opts) {
    if (!opts || !(opts.guide || opts.showcase)) return null;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var lastFocus = document.activeElement;
    var overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Guide");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(0,0,0,.5);padding:16px;opacity:0;" + (reduce ? "" : "transition:opacity .15s ease");
    var modal = document.createElement("div");
    modal.style.cssText =
      "position:relative;width:100%;max-width:920px;height:86vh;max-height:760px;border-radius:16px;" +
      "overflow:hidden;box-shadow:0 24px 60px -20px rgba(0,0,0,.6);" +
      (reduce ? "" : "transform:scale(.98);transition:transform .15s ease");
    var iframe = makeIframe(opts);
    iframe.style.height = "100%";
    iframe.style.borderRadius = "16px";
    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText =
      "position:absolute;top:10px;right:10px;z-index:1;width:32px;height:32px;border:0;border-radius:8px;" +
      "background:rgba(0,0,0,.55);color:#fff;font-size:15px;line-height:1;cursor:pointer";
    modal.appendChild(iframe);
    modal.appendChild(closeBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.style.opacity = "1"; modal.style.transform = "scale(1)"; });

    var listeners = {};
    var inst = {
      id: ++seq, type: "popup", iframe: iframe, el: overlay, _listeners: listeners, _autoResize: false, _open: true,
      on: function (e, fn) { on(listeners, e, fn); return inst; },
      off: function (e, fn) { off(listeners, e, fn); return inst; },
      close: function () { doClose(); },
      destroy: function () { doClose(); }
    };

    function doClose() {
      if (!inst._open) return;
      inst._open = false;
      document.removeEventListener("keydown", onKey);
      overlay.style.opacity = "0";
      modal.style.transform = "scale(.98)";
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 160);
      unregister(inst);
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
      emit(listeners, "close", {}, inst);
      emit(globalListeners, "close", {}, inst);
    }
    function onKey(e) { if (e.key === "Escape") doClose(); }
    overlay.addEventListener("click", function (e) { if (e.target === overlay) doClose(); });
    closeBtn.addEventListener("click", doClose);
    document.addEventListener("keydown", onKey);
    closeBtn.focus();

    register(inst);
    emit(listeners, "open", {}, inst);
    emit(globalListeners, "open", {}, inst);
    return inst;
  }

  function close(inst) {
    if (!inst) {
      for (var i = instances.length - 1; i >= 0; i--) { if (instances[i].type === "popup") { inst = instances[i]; break; } }
    }
    if (inst && inst.close) inst.close();
  }

  function destroy(inst) {
    if (inst) { inst.destroy(); return; }
    instances.slice().forEach(function (x) { x.destroy(); });
  }

  // ── message relay (origin-checked) ──────────────────────────────────────────
  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN) return;
    var d = e.data;
    if (!d || d.source !== "tacto-embed" || !d.type) return;
    var inst = null;
    for (var i = 0; i < instances.length; i++) {
      if (instances[i].iframe && instances[i].iframe.contentWindow === e.source) { inst = instances[i]; break; }
    }
    var type = String(d.type).toLowerCase();
    var payload = d.payload || {};
    if (type === "resize" && inst && inst._autoResize && payload.height) {
      inst.iframe.style.height = Math.ceil(payload.height) + "px";
    }
    if (inst) emit(inst._listeners, type, payload, inst);
    emit(globalListeners, type, payload, inst);
  });

  // ── declarative auto-init ───────────────────────────────────────────────────
  function scan() {
    var inl = document.querySelectorAll("[data-tacto-guide]");
    for (var i = 0; i < inl.length; i++) {
      var el = inl[i];
      if (el._tactoDone) continue;
      el._tactoDone = true;
      embed(el, {
        guide: el.getAttribute("data-tacto-guide"),
        mode: el.getAttribute("data-tacto-mode") || undefined,
        theme: el.getAttribute("data-tacto-theme") || undefined,
        lang: el.getAttribute("data-tacto-lang") || undefined
      });
    }
    var pops = document.querySelectorAll("[data-tacto-guide-popup]");
    for (var j = 0; j < pops.length; j++) {
      var btn = pops[j];
      if (btn._tactoDone) continue;
      btn._tactoDone = true;
      (function (b) {
        b.addEventListener("click", function () {
          open({
            guide: b.getAttribute("data-tacto-guide-popup"),
            mode: b.getAttribute("data-tacto-mode") || undefined,
            theme: b.getAttribute("data-tacto-theme") || undefined,
            lang: b.getAttribute("data-tacto-lang") || undefined
          });
        });
      })(btn);
    }
    // ── showcases ─────────────────────────────────────────────────────────────
    var scInl = document.querySelectorAll("[data-tacto-showcase]");
    for (var k = 0; k < scInl.length; k++) {
      var scEl = scInl[k];
      if (scEl._tactoDone) continue;
      scEl._tactoDone = true;
      embed(scEl, {
        showcase: scEl.getAttribute("data-tacto-showcase"),
        theme: scEl.getAttribute("data-tacto-theme") || undefined
      });
    }
    var scPops = document.querySelectorAll("[data-tacto-showcase-popup]");
    for (var m = 0; m < scPops.length; m++) {
      var scBtn = scPops[m];
      if (scBtn._tactoDone) continue;
      scBtn._tactoDone = true;
      (function (b) {
        b.addEventListener("click", function () {
          open({
            showcase: b.getAttribute("data-tacto-showcase-popup"),
            theme: b.getAttribute("data-tacto-theme") || undefined
          });
        });
      })(scBtn);
    }
  }

  window.Tacto = {
    _ready: true,
    version: 1,
    origin: ORIGIN,
    embed: embed,
    open: open,
    close: close,
    destroy: destroy,
    on: function (e, fn) { on(globalListeners, e, fn); return window.Tacto; },
    off: function (e, fn) { off(globalListeners, e, fn); return window.Tacto; },
    rescan: scan
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
})();
