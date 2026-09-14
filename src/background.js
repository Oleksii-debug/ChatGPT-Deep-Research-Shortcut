const COMMAND = 'open-tool-picker';
const MESSAGE = { type: 'OPEN_TOOL_PICKER' };

async function openPicker(tabId) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, MESSAGE);
  } catch (error) {
    console.warn('[ChatGPT Tool Picker] Content script unavailable on this tab.', error);
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== COMMAND) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await openPicker(tab?.id);
});

chrome.action.onClicked.addListener(async (tab) => {
  await openPicker(tab?.id);
});
