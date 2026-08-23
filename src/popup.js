const DEFAULTS = {
  enabled: true,
  showNextToShowMore: true,
  forceThreadlineCollapse: true,
  pauseChannelIntro: true,
};

const ids = Object.keys(DEFAULTS);

function render(values) {
  for (const id of ids) {
    const input = document.getElementById(id);
    if (input) input.checked = values[id] !== false;
  }
  document.getElementById("options").classList.toggle("is-disabled", values.enabled === false);
}

chrome.storage.sync.get(DEFAULTS, (stored) => {
  render({ ...DEFAULTS, ...stored });
});

for (const id of ids) {
  document.getElementById(id).addEventListener("change", (event) => {
    chrome.storage.sync.set({ [id]: event.target.checked });
    if (id === "enabled") {
      document.getElementById("options").classList.toggle("is-disabled", !event.target.checked);
    }
  });
}
