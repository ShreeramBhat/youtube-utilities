const MATCH =
  /^https:\/\/(www\.|m\.)?youtube\.com\//;

function injectMain(tabId) {
  if (tabId == null) return;
  chrome.scripting
    .executeScript({
      target: { tabId },
      world: "MAIN",
      files: ["src/page.js"],
    })
    .catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: ["https://www.youtube.com/*", "https://m.youtube.com/*", "https://youtube.com/*"] }, (tabs) => {
    for (const tab of tabs) injectMain(tab.id);
  });
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (!tab.url || !MATCH.test(tab.url)) return;
  if (info.status === "complete" || info.url) injectMain(tabId);
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "inject-main" && sender.tab?.id != null) {
    injectMain(sender.tab.id);
  }
});
