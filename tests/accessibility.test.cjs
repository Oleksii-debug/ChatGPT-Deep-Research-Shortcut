const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/picker.js'), 'utf8');

test('picker is a named modal dialog with native buttons', () => {
  assert.match(source, /setAttribute\('role','dialog'\)/);
  assert.match(source, /setAttribute\('aria-modal','true'\)/);
  assert.match(source, /aria-labelledby/);
  assert.match(source, /aria-describedby/);
  assert.match(source, /createElement\('button'\)/);
  assert.match(source, /b\.type='button'/);
});

test('keyboard contract covers Escape, arrows, Home, End and Tab', () => {
  for (const key of ['Escape','ArrowDown','ArrowUp','Home','End','Tab']) {
    assert.ok(source.includes(`event.key==='${key}'`), `missing ${key}`);
  }
});

test('diagnostics is keyboard reachable and separately named', () => {
  assert.match(source, /diag\.dataset\.diagnosticsDownload='true'/);
  assert.match(source, /Завантажити діагностичний звіт/);
  assert.match(source, /focusables\(d\)/);
});

test('picker never submits prompt text', () => {
  assert.doesNotMatch(source, /requestSubmit\(/);
  assert.doesNotMatch(source, /form\.submit\(/);
  assert.doesNotMatch(source, /KeyboardEvent/);
});
