const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const picker = fs.readFileSync(path.join(__dirname, '../src/picker.js'), 'utf8');
const activation = fs.readFileSync(path.join(__dirname, '../src/activation.js'), 'utf8');

test('content page listens directly for Ctrl+Shift+U and diagnostics shortcut', () => {
  assert.match(picker, /document\.addEventListener\('keydown'/);
  assert.match(picker, /isPickerShortcutEvent\(event\)/);
  assert.match(picker, /isDiagnosticsShortcutEvent/);
  assert.match(picker, /stopImmediatePropagation/);
});

test('extension command and page shortcut converge on one deduplicated picker', () => {
  assert.match(picker, /OPEN_DEDUPE_MS=350/);
  assert.match(picker, /lastOpen/);
  assert.match(picker, /openPicker\('page-keydown'\)/);
  assert.match(picker, /openPicker\('chrome-command'\)/);
});

test('overlay is viewport-relative for windowed/maximized/fullscreen', () => {
  assert.match(picker, /position:'fixed'/);
  assert.match(picker, /inset:'0'/);
  assert.match(picker, /100vw/);
  assert.match(picker, /100dvh/);
  assert.doesNotMatch(picker, /screen\.width|screen\.height/);
});

test('activation never leaves the page or submits prompt', () => {
  assert.doesNotMatch(picker + activation, /window\.open\(|chrome:\/\/extensions|location\.href\s*=/);
  assert.doesNotMatch(picker + activation, /requestSubmit\(|form\.submit\(/);
  assert.match(activation, /focusComposer\(\)/);
});
