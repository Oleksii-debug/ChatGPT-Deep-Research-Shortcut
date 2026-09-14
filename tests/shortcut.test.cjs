const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/matcher.js');
const api = globalThis.ChatGPTToolPicker;

function keyEvent(overrides = {}) {
  return {
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
    metaKey: false,
    repeat: false,
    code: 'KeyU',
    key: 'u',
    ...overrides
  };
}

test('Ctrl+Shift+U is recognized from physical KeyU', () => {
  assert.equal(api.isPickerShortcutEvent(keyEvent()), true);
});

test('physical KeyU works even when keyboard layout changes event.key', () => {
  assert.equal(api.isPickerShortcutEvent(keyEvent({ key: 'г' })), true);
});

test('textual u fallback works when code is unavailable', () => {
  assert.equal(api.isPickerShortcutEvent(keyEvent({ code: '', key: 'U' })), true);
});

test('shortcut rejects missing modifiers and conflicting modifiers', () => {
  assert.equal(api.isPickerShortcutEvent(keyEvent({ ctrlKey: false })), false);
  assert.equal(api.isPickerShortcutEvent(keyEvent({ shiftKey: false })), false);
  assert.equal(api.isPickerShortcutEvent(keyEvent({ altKey: true })), false);
  assert.equal(api.isPickerShortcutEvent(keyEvent({ metaKey: true })), false);
});

test('shortcut rejects key repeat and unrelated keys', () => {
  assert.equal(api.isPickerShortcutEvent(keyEvent({ repeat: true })), false);
  assert.equal(api.isPickerShortcutEvent(keyEvent({ code: 'KeyI', key: 'i' })), false);
});

test('shortcut is intentionally valid while focus is in an editable composer', () => {
  const event = keyEvent({ target: { isContentEditable: true, tagName: 'DIV' } });
  assert.equal(api.isPickerShortcutEvent(event), true);
});
