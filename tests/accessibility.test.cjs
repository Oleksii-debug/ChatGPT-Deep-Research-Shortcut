const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'content.js'), 'utf8');

test('picker is exposed as a modal dialog with accessible name and description', () => {
  assert.match(source, /setAttribute\('role', 'dialog'\)/);
  assert.match(source, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(source, /setAttribute\('aria-labelledby'/);
  assert.match(source, /setAttribute\('aria-describedby'/);
});

test('picker exposes exactly the requested three tool ids', () => {
  assert.match(source, /const TOOL_ORDER = \['image', 'web', 'research'\]/);
});

test('keyboard contract includes Escape, arrows, Home, End and Tab', () => {
  for (const key of ['Escape', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'Tab']) {
    assert.ok(source.includes(`event.key === '${key}'`), `missing ${key} keyboard handling`);
  }
});

test('buttons are native buttons and carry full accessible labels', () => {
  assert.match(source, /document\.createElement\('button'\)/);
  assert.match(source, /button\.type = 'button'/);
  assert.match(source, /button\.setAttribute\('aria-label', `\$\{tool\.label\}\. \$\{tool\.description\}`\)/);
});

test('focus is moved into picker and restored on close', () => {
  assert.match(source, /firstButton\?\.focus/);
  assert.match(source, /focusBeforePicker/);
  assert.match(source, /target\?\.focus/);
});

test('picker never submits a prompt itself', () => {
  assert.doesNotMatch(source, /requestSubmit\(/);
  assert.doesNotMatch(source, /form\.submit\(/);
  assert.doesNotMatch(source, /KeyboardEvent\([^)]*Enter/);
});
