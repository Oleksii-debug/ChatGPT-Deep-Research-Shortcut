const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/matcher.js'), 'utf8');

function loadApi() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.ChatGPTToolPicker;
}

test('Ctrl+Alt+Shift+D triggers direct diagnostics download shortcut', () => {
  const api = loadApi();
  assert.equal(api.isDiagnosticsShortcutEvent({
    ctrlKey: true,
    shiftKey: true,
    altKey: true,
    metaKey: false,
    repeat: false,
    code: 'KeyD',
    key: 'd'
  }), true);
});

test('physical KeyD survives keyboard layout changes', () => {
  const api = loadApi();
  assert.equal(api.isDiagnosticsShortcutEvent({
    ctrlKey: true,
    shiftKey: true,
    altKey: true,
    metaKey: false,
    repeat: false,
    code: 'KeyD',
    key: 'в'
  }), true);
});

test('diagnostics shortcut rejects missing Alt and key repeat', () => {
  const api = loadApi();
  assert.equal(api.isDiagnosticsShortcutEvent({
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
    metaKey: false,
    repeat: false,
    code: 'KeyD',
    key: 'd'
  }), false);
  assert.equal(api.isDiagnosticsShortcutEvent({
    ctrlKey: true,
    shiftKey: true,
    altKey: true,
    metaKey: false,
    repeat: true,
    code: 'KeyD',
    key: 'd'
  }), false);
});
