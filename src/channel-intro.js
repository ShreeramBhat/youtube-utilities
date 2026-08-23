(() => {
  const DEFAULTS = {
    enabled: true,
    pauseChannelIntro: true,
  };

  let settings = { ...DEFAULTS };
  let observer = null;
  let userAllowed = false;
  let scanTimer = 0;
  const bound = new WeakSet();

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

  function isTrailerVideo(video) {
    if (!(video instanceof HTMLVideoElement)) return false;
    if (video.closest("ytd-watch-flexy") || video.closest("ytd-video-preview")) return false;
    return !!(
      video.closest("ytd-channel-video-player-renderer") ||
      video.closest("yt-channel-video-player-renderer") ||
      video.closest("#c4-player")
    );
  }

  function trailerVideos() {
    return [
      ...document.querySelectorAll(
        "ytd-channel-video-player-renderer video, yt-channel-video-player-renderer video, #c4-player video"
      ),
    ].filter(isTrailerVideo);
  }

  function syncFlag() {
    if (active()) {
      document.documentElement.setAttribute("data-ythide-pause-intro", "1");
    } else {
      document.documentElement.removeAttribute("data-ythide-pause-intro");
    }
  }

  function requestPause() {
    if (!active() || userAllowed) return;
    document.documentElement.setAttribute("data-ythide-cmd", "pause-intro");
    try {
      window.postMessage({ source: "ythide", action: "pause-intro" }, "*");
    } catch (_) {
      /* ignore */
    }
    trailerVideos().forEach((video) => {
      try {
        video.pause();
      } catch (_) {
        /* ignore */
      }
    });
  }

  function onTrailerPlaying(event) {
    if (!isTrailerVideo(event.target)) return;
    if (!active() || userAllowed) return;
    requestPause();
  }

  function bindVideos() {
    if (!active()) return;
    trailerVideos().forEach((video) => {
      if (bound.has(video)) return;
      bound.add(video);
      video.addEventListener("playing", onTrailerPlaying);
      if (!video.paused && !video.ended) requestPause();
    });
  }

  function scheduleBind() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = 0;
      bindVideos();
    }, 80);
  }

  function observe() {
    observer?.disconnect();
    if (!active()) return;
    observer = new MutationObserver(scheduleBind);
    const root =
      document.querySelector("ytd-browse, ytd-page-manager, #content") ||
      document.documentElement;
    observer.observe(root, { childList: true, subtree: true });
  }

  function onNavigate() {
    userAllowed = false;
    syncFlag();
    observe();
    bindVideos();
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

  window.addEventListener("yt-navigate-finish", onNavigate);
  window.addEventListener("yt-page-data-updated", () => {
    if (active()) scheduleBind();
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
