(() => {
  const DEFAULTS = {
    enabled: true,
    showNextToShowMore: true,
    forceThreadlineCollapse: true,
  };

  const ATTR = "data-ythide";
  const BTN_CLASS = "ythide-btn";
  const TOP_CLASS = "ythide-top";
  const BOTTOM_CLASS = "ythide-bottom";
  const ROW_CLASS = "ythide-row";
  const OPEN_CLASS = "ythide-open";

  const REPLIES = "ytd-comment-replies-renderer";
  const HIT_SEL =
    ".thread-hitbox, .ytSubThreadThreadline, .ytSubThreadConnection, .ytSubThreadContinuation, .ytSubThreadShadow";

  let settings = { ...DEFAULTS };
  let scanTimer = 0;
  let observer = null;

  function hideLabel(renderer) {
    const native = renderer.querySelector("#less-replies");
    const text = native?.textContent?.trim();
    if (text) return text;
    return "Hide replies";
  }

  function isExpanded(renderer) {
    if (!renderer) return false;
    if (renderer.expanded === true) return true;
    if (renderer.expanded === false) return false;
    const threads = renderer.querySelector("#expanded-threads");
    if (threads && !threads.hidden && !threads.hasAttribute("hidden")) {
      return threads.getBoundingClientRect().height > 0;
    }
    const expander = renderer.querySelector("#expander");
    return !!(expander && expander.hasAttribute("expanded"));
  }

  function collapse(renderer) {
    if (!renderer) return;

    ensureMain();
    renderer.setAttribute("data-ythide-target", "1");
    document.documentElement.setAttribute("data-ythide-cmd", "collapse");
    try {
      window.postMessage({ source: "ythide", action: "collapse" }, "*");
    } catch (_) {
      /* ignore */
    }
    renderer.dispatchEvent(
      new CustomEvent("ythide-collapse", { bubbles: true, composed: true })
    );
    setTimeout(() => {
      renderer.removeAttribute("data-ythide-target");
    }, 800);
  }

  function assignScriptUrl(script, url) {
    try {
      const policy = window.trustedTypes?.createPolicy?.("ythide", {
        createScriptURL: (value) => value,
      });
      if (policy?.createScriptURL) {
        script.src = policy.createScriptURL(url);
        return;
      }
    } catch (_) {
      /* page may already define this policy name */
    }
    try {
      script.src = url;
    } catch (_) {
      script.setAttribute("src", url);
    }
  }

  function installPageHook() {
    if (document.documentElement.getAttribute("data-ythide-main")) return;
    try {
      const script = document.createElement("script");
      assignScriptUrl(script, chrome.runtime.getURL("src/page.js"));
      script.addEventListener("load", () => script.remove());
      script.addEventListener("error", () => script.remove());
      (document.head || document.documentElement).appendChild(script);
    } catch (_) {
      /* background MAIN inject is the fallback */
    }
  }

  function ensureMain() {
    if (document.documentElement.getAttribute("data-ythide-main")) return;
    installPageHook();
    try {
      chrome.runtime.sendMessage({ type: "inject-main" });
    } catch (_) {
      /* ignore */
    }
  }

  function chevronUp() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.setAttribute("aria-hidden", "true");
    svg.style.pointerEvents = "none";
    svg.style.display = "inherit";
    svg.style.width = "100%";
    svg.style.height = "100%";
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M5.293 15.207a1 1 0 001.414 0L12 9.914l5.293 5.293a1 1 0 001.414-1.414L12 7.086l-6.707 6.707a1 1 0 000 1.414z"
    );
    svg.appendChild(path);
    return svg;
  }

  function makeButton(label, onClick, colorSource) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = BTN_CLASS;
    btn.setAttribute(ATTR, "1");
    btn.setAttribute("aria-label", label);
    const text = document.createElement("span");
    text.textContent = label;
    const icon = document.createElement("span");
    icon.className = "ythide-btn-icon";
    icon.appendChild(chevronUp());
    btn.append(text, icon);
    const sample = colorSource?.querySelector?.("button") || colorSource;
    if (sample instanceof Element) {
      const color = getComputedStyle(sample).color;
      if (color) btn.style.color = color;
    }
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      onClick();
    });
    return btn;
  }

  function isTopLevelReplies(renderer) {
    const thread = renderer.closest("ytd-comment-thread-renderer");
    if (!thread) return false;
    if (thread.parentElement?.closest("ytd-comment-thread-renderer")) return false;
    return thread.querySelector(":scope > #replies > " + REPLIES) === renderer;
  }

  function isRepliesContinuation(cont) {
    if (cont.classList.contains("replies-continuation")) return true;
    const label = (
      cont.querySelector("button")?.getAttribute("aria-label") ||
      cont.textContent ||
      ""
    ).toLowerCase();
    return /repl/.test(label);
  }

  function isNestedInReply(cont, renderer) {
    const comment = cont.closest(
      "ytd-comment-view-model, ytd-comment-renderer, yt-comment-view-model, ytd-comment-thread-renderer"
    );
    return !!(comment && renderer.contains(comment) && comment !== renderer);
  }

  function ownContinuations(renderer) {
    return [...renderer.querySelectorAll("ytd-continuation-item-renderer")].filter((cont) => {
      if (cont.closest(REPLIES) !== renderer) return false;
      if (isNestedInReply(cont, renderer)) return false;
      if (!isRepliesContinuation(cont)) return false;
      return cont.getBoundingClientRect().height > 0;
    });
  }

  function placeNextTo(native, renderer) {
    const slot = native.closest("#button") || native.parentElement || native;
    slot.classList.add(ROW_CLASS);
    native.insertAdjacentElement(
      "afterend",
      makeButton(hideLabel(renderer), () => collapse(renderer), native)
    );
  }

  function mountBottom(renderer) {
    const thread = renderer.closest("ytd-comment-thread-renderer") || renderer;
    thread.querySelectorAll(`[${ATTR}]`).forEach((node) => node.remove());
    thread.querySelectorAll(`.${ROW_CLASS}`).forEach((node) => node.classList.remove(ROW_CLASS));

    const conts = ownContinuations(renderer);
    const last = conts[conts.length - 1] || null;

    if (last) {
      const slot = last.querySelector("#button") || last;
      const native = slot.querySelector("ytd-button-renderer, yt-button-renderer, button");
      if (!native) return;
      placeNextTo(native, renderer);
      return;
    }

    const expanded = renderer.querySelector("#expanded-threads");
    if (!expanded || expanded.hidden || expanded.hasAttribute("hidden")) return;

    const wrap = document.createElement("div");
    wrap.className = BOTTOM_CLASS;
    wrap.setAttribute(ATTR, "1");
    const sample = renderer.querySelector("#more-replies-sub-thread, #more-replies, #less-replies");
    wrap.appendChild(makeButton(hideLabel(renderer), () => collapse(renderer), sample));
    expanded.appendChild(wrap);
  }

  function clearInjected(root) {
    root.querySelectorAll(`[${ATTR}]`).forEach((node) => node.remove());
    root.querySelectorAll(`.${ROW_CLASS}`).forEach((node) => node.classList.remove(ROW_CLASS));
    root.querySelectorAll(`.${OPEN_CLASS}`).forEach((node) => node.classList.remove(OPEN_CLASS));
  }

  function enhance(renderer) {
    if (!settings.enabled) {
      clearInjected(renderer);
      return;
    }

    if (!isTopLevelReplies(renderer) || !isExpanded(renderer)) {
      renderer.classList.remove(OPEN_CLASS);
      renderer.querySelectorAll(`[${ATTR}]`).forEach((node) => node.remove());
      renderer.querySelectorAll(`.${ROW_CLASS}`).forEach((node) => node.classList.remove(ROW_CLASS));
      return;
    }

    renderer.classList.add(OPEN_CLASS);

    if (settings.showNextToShowMore) mountBottom(renderer);
    else renderer.querySelectorAll(`[${ATTR}]`).forEach((node) => node.remove());
  }

  function scan() {
    ensureMain();
    document.querySelectorAll(REPLIES).forEach(enhance);
    document.documentElement.classList.toggle("ythide-on", settings.enabled);
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = 0;
      scan();
    }, 80);
  }

  function repliesFromHit(hit) {
    if (hit.classList.contains("thread-hitbox")) {
      const thread = hit.closest("ytd-comment-thread-renderer");
      const direct = thread?.querySelector(":scope > #replies > " + REPLIES);
      if (direct) return direct;
    }
    return hit.closest(REPLIES);
  }

  function onDocumentClick(event) {
    if (!settings.enabled || !settings.forceThreadlineCollapse) return;
    const hit = event.target instanceof Element ? event.target.closest(HIT_SEL) : null;
    if (!hit) return;
    const renderer = repliesFromHit(hit);
    if (!renderer) return;

    requestAnimationFrame(() => {
      setTimeout(() => {
        if (settings.enabled && settings.forceThreadlineCollapse && isExpanded(renderer)) {
          collapse(renderer);
        }
      }, 0);
    });
  }

  function observeComments() {
    observer?.disconnect();
    observer = new MutationObserver(scheduleScan);
    const roots = document.querySelectorAll(
      "ytd-comments, ytd-engagement-panel-section-list-renderer"
    );
    const targets = roots.length ? roots : [document.documentElement];
    targets.forEach((root) => {
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["hidden", "aria-expanded", "expanded"],
      });
    });
  }

  function start() {
    ensureMain();
    observeComments();
    scan();
  }

  document.addEventListener("click", onDocumentClick, true);
  window.addEventListener("yt-navigate-finish", () => {
    observeComments();
    scheduleScan();
  });
  window.addEventListener("yt-page-data-updated", scheduleScan);

  try {
    chrome.storage.sync.get(DEFAULTS, (stored) => {
      settings = { ...DEFAULTS, ...stored };
      start();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      for (const [key, { newValue }] of Object.entries(changes)) {
        if (key in DEFAULTS) settings[key] = newValue;
      }
      if (!settings.enabled) {
        clearInjected(document);
        document.documentElement.classList.remove("ythide-on");
        return;
      }
      scan();
    });
  } catch (_) {
    start();
  }
})();
