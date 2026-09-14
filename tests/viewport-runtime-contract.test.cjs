const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/content.js'), 'utf8');

test('content script listens for Ctrl+Shift+U directly in the ChatGPT page', () => {
  assert.match(source, /document\.addEventListener\('keydown'/);
  assert.match(source, /isPickerShortcutEvent\(event\)/);
  assert.match(source, /requestOpenPicker\('page-keydown'\)/);
  assert.match(source, /stopImmediatePropagation/);
});

test('extension command and in-page shortcut converge on one deduplicated open path', () => {
  assert.match(source, /OPEN_DEDUPE_MS/);
  assert.match(source, /lastOpenRequestAt/);
  assert.match(source, /requestOpenPicker\('extension-command'\)/);
  assert.match(source, /document\.getElementById\(PICKER_ID\)/);
});

test('picker overlay is viewport-relative for windowed and fullscreen layouts', () => {
  assert.match(source, /position:\s*'fixed'/);
  assert.match(source, /inset:\s*'0'/);
  assert.match(source, /100vw/);
  assert.match(source, /100dvh/);
  assert.doesNotMatch(source, /screen\.width|screen\.height/);
  assert.doesNotMatch(source, /document\.fullscreenElement\s*\?/);
});

test('picker does not require leaving ChatGPT for chrome extension UI', () => {
  assert.doesNotMatch(source, /chrome:\/\/extensions/i);
  assert.doesNotMatch(source, /window\.open\(/);
  assert.doesNotMatch(source, /location\.href\s*=/);
});

test('tool activation preserves the prompt and only returns focus to the composer', () => {
  assert.match(source, /focusComposer\(\)/);
  assert.doesNotMatch(source, /composer\.value\s*=/);
  assert.doesNotMatch(source, /prompt-textarea[^\n]*textContent\s*=/);
  assert.doesNotMatch(source, /form\.submit\(|requestSubmit\(/);
});
