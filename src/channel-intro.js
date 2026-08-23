(() => {
  const DEFAULTS = {
    enabled: true,
    pauseChannelIntro: true,
  };

  let settings = { ...DEFAULTS };
  let observer = null;
  let userAllowed = false;
  let scanTimer = 0;

  function isChannelHome() {
    const path = (location.pathname || "/").replace(/\/+$/, "") || "/";
    if (
      path.startsWith("/watch") ||
      path.startsWith("/shorts") ||
      path.startsWith("/results") ||
      path.startsWith("/feed") ||
      path.startsWith("/live/")
    ) {
      return false;
    }
    if (/^\/@[^/]+$/.test(path)) return true;
    if (/^\/@[^/]+\/featured$/.test(path)) return true;
    if (/^\/(channel|c|user)\/[^/]+$/.test(path)) return true;
    if (/^\/(channel|c|user)\/[^/]+\/featured$/.test(path)) return true;
    return false;
  }

  function active() {
    return settings.enabled && settings.pauseChannelIntro && isChannelHome();
  }

  function syncFlag() {
    if (active()) {
      document.documentElement.setAttribute("data-ythide-pause-intro", "1");
    } else {
      document.documentElement.removeAttribute("data-ythide-pause-intro");
    }
  }

  function requestPause() {
    if (!active() || userAllowed) {
      if (userAllowed) observer?.disconnect();
      return;
    }
    syncFlag();
    document.documentElement.setAttribute("data-ythide-cmd", "pause-intro");
    try {
      window.postMessage({ source: "ythide", action: "pause-intro" }, "*");
    } catch (_) {
      /* ignore */
    }
    document
      .querySelectorAll(
        "ytd-channel-video-player-renderer video, yt-channel-video-player-renderer video, #c4-player video"
      )
      .forEach((video) => {
        try {
          video.pause();
          video.autoplay = false;
        } catch (_) {
          /* ignore */
        }
      });
  }

  function schedulePause() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = 0;
      requestPause();
    }, 50);
  }

  function observe() {
    observer?.disconnect();
    if (!active()) return;
    observer = new MutationObserver(schedulePause);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function onNavigate() {
    userAllowed = false;
    syncFlag();
    observe();
    requestPause();
    requestAnimationFrame(() => {
      requestPause();
      setTimeout(requestPause, 250);
      setTimeout(requestPause, 1000);
    });
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      const node = event.target instanceof Element ? event.target : null;
      if (!node) return;
      if (
        node.closest("ytd-channel-video-player-renderer") ||
        node.closest("yt-channel-video-player-renderer") ||
        node.closest("#c4-player")
      ) {
        userAllowed = true;
      }
    },
    true
  );

  document.addEventListener(
    "play",
    (event) => {
      if (!(event.target instanceof HTMLVideoElement)) return;
      if (!active() || userAllowed) return;
      if (
        event.target.closest("ytd-channel-video-player-renderer") ||
        event.target.closest("yt-channel-video-player-renderer") ||
        event.target.closest("#c4-player")
      ) {
        requestPause();
      }
    },
    true
  );

  window.addEventListener("yt-navigate-finish", onNavigate);
  window.addEventListener("yt-page-data-updated", () => {
    if (active()) schedulePause();
  });

  try {
    chrome.storage.sync.get(DEFAULTS, (stored) => {
      settings = { ...DEFAULTS, ...stored };
      onNavigate();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      for (const [key, { newValue }] of Object.entries(changes)) {
        if (key in DEFAULTS) settings[key] = newValue;
      }
      userAllowed = false;
      onNavigate();
    });
  } catch (_) {
    onNavigate();
  }
})();
