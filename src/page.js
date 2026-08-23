(() => {
  const VERSION = 7;
  if (window.__ythidePageHook === VERSION) return;

  window.__ythidePageAbort?.abort();
  const ac = new AbortController();
  window.__ythidePageAbort = ac;
  window.__ythidePageHook = VERSION;
  document.documentElement.setAttribute("data-ythide-main", String(VERSION));

  const REPLIES = "ytd-comment-replies-renderer";

  function topLevelReplies(from) {
    if (!from || !from.closest) return from;
    const nested = from.closest(REPLIES) || from;
    let thread = nested.closest?.("ytd-comment-thread-renderer");
    if (!thread) return nested;
    while (thread.parentElement?.closest("ytd-comment-thread-renderer")) {
      thread = thread.parentElement.closest("ytd-comment-thread-renderer");
    }
    return thread.querySelector(":scope > #replies > " + REPLIES) || nested;
  }

  function isOpen(renderer) {
    if (!renderer) return false;
    const threads = renderer.querySelector("#expanded-threads");
    if (threads && threads.getBoundingClientRect().height > 8) return true;
    return renderer.expanded === true;
  }

  function doCollapse(renderer) {
    try {
      if (typeof renderer.handleIsShowLessTap === "function") {
        renderer.handleIsShowLessTap();
      }
    } catch (_) {
      /* fall through */
    }
    if (!isOpen(renderer)) return;
    try {
      if (typeof renderer.toggleExpanded === "function" && renderer.expanded) {
        renderer.toggleExpanded();
      }
    } catch (_) {
      /* fall through */
    }
    if (!isOpen(renderer)) return;
    try {
      renderer.expanded = false;
    } catch (_) {
      /* fall through */
    }
    if (!isOpen(renderer)) return;
    const lessBtn =
      renderer.querySelector("#less-replies button") || renderer.querySelector("#less-replies");
    try {
      lessBtn?.click();
    } catch (_) {
      /* ignore */
    }
  }

  function collapseRenderer(renderer) {
    renderer = topLevelReplies(renderer);
    if (!renderer || !isOpen(renderer)) return;
    doCollapse(renderer);
    requestAnimationFrame(() => {
      if (isOpen(renderer)) doCollapse(renderer);
      setTimeout(() => {
        if (isOpen(renderer)) doCollapse(renderer);
      }, 60);
    });
  }

  function collapseFromNode(node) {
    const marked = document.querySelector("[data-ythide-target]");
    collapseRenderer(marked || node);
  }

  function onCommandAttr() {
    if (document.documentElement.getAttribute("data-ythide-cmd") !== "collapse") return;
    document.documentElement.removeAttribute("data-ythide-cmd");
    collapseFromNode(document.querySelector("[data-ythide-target]"));
  }

  document.addEventListener(
    "click",
    (event) => {
      const btn = event.target instanceof Element ? event.target.closest(".ythide-btn") : null;
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      collapseFromNode(btn);
    },
    { capture: true, signal: ac.signal }
  );

  document.addEventListener(
    "ythide-collapse",
    (event) => {
      collapseFromNode(event.target);
    },
    { signal: ac.signal }
  );

  window.addEventListener(
    "message",
    (event) => {
      if (event.source !== window) return;
      if (!event.data || event.data.source !== "ythide" || event.data.action !== "collapse") return;
      collapseFromNode(document.querySelector("[data-ythide-target]"));
    },
    { signal: ac.signal }
  );

  const mo = new MutationObserver(onCommandAttr);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-ythide-cmd"],
  });
  ac.signal.addEventListener("abort", () => mo.disconnect());

  window.__ythideCollapse = collapseRenderer;
})();
