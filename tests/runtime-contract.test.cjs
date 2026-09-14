const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const manifest = require('../manifest.json');
const content = fs.readFileSync(path.join(__dirname, '../src/content.js'), 'utf8');
const background = fs.readFileSync(path.join(__dirname, '../src/background.js'), 'utf8');

test('extension remains scoped to chatgpt.com with minimal permission', () => {
  assert.deepEqual(manifest.content_scripts?.[0]?.matches, ['https://chatgpt.com/*']);
  assert.deepEqual(manifest.permissions, ['activeTab']);
  assert.equal(manifest.host_permissions, undefined);
});

test('runtime makes no extension-owned network requests', () => {
  for (const source of [content, background]) {
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.doesNotMatch(source, /XMLHttpRequest/);
    assert.doesNotMatch(source, /WebSocket\s*\(/);
  }
});

test('runtime does not persist or inspect browser storage/cookies', () => {
  for (const source of [content, background]) {
    assert.doesNotMatch(source, /chrome\.storage/);
    assert.doesNotMatch(source, /chrome\.cookies/);
    assert.doesNotMatch(source, /localStorage/);
    assert.doesNotMatch(source, /sessionStorage/);
  }
});

test('runtime does not read prompt contents for telemetry or submission', () => {
  assert.doesNotMatch(content, /composer\.value/);
  assert.doesNotMatch(content, /findComposer\(\)\.textContent/);
  assert.doesNotMatch(content, /requestSubmit\(/);
  assert.doesNotMatch(content, /form\.submit\(/);
});

test('diagnostic export is local Blob download only', () => {
  assert.match(content, /new Blob\(\[report\]/);
  assert.match(content, /URL\.createObjectURL\(blob\)/);
  assert.match(content, /anchor\.download = diagnosticsFilename\(\)/);
  assert.doesNotMatch(content, /chrome\.downloads/);
});
