const COMMAND = "activate-deep-research";

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== COMMAND) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE_DEEP_RESEARCH" });
  } catch (error) {
    console.warn("[ChatGPT Deep Research Shortcut] Content script unavailable on this tab.", error);
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE_DEEP_RESEARCH" });
  } catch (error) {
    console.warn("[ChatGPT Deep Research Shortcut] Content script unavailable on this tab.", error);
  }
});
