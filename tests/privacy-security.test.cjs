const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const manifest = require('../manifest.json');
const runtime = [
  fs.readFileSync(path.join(__dirname, '../src/background.js'), 'utf8'),
  fs.readFileSync(path.join(__dirname, '../src/matcher.js'), 'utf8'),
  fs.readFileSync(path.join(__dirname, '../src/content.js'), 'utf8')
].join('\n');

test('extension remains scoped to chatgpt.com with minimal permission', () => {
  assert.deepEqual(manifest.permissions, ['activeTab']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://chatgpt.com/*']);
});

test('runtime makes no extension-owned network requests', () => {
  assert.doesNotMatch(runtime, /\bfetch\s*\(/);
  assert.doesNotMatch(runtime, /XMLHttpRequest/);
  assert.doesNotMatch(runtime, /WebSocket/);
  assert.doesNotMatch(runtime, /navigator\.sendBeacon/);
});

test('runtime does not persist or inspect browser storage/cookies', () => {
  assert.doesNotMatch(runtime, /localStorage|sessionStorage/);
  assert.doesNotMatch(runtime, /document\.cookie/);
  assert.doesNotMatch(runtime, /chrome\.storage/);
});

test('runtime does not read prompt contents for telemetry or submission', () => {
  assert.doesNotMatch(runtime, /prompt-textarea[^\n]*(innerText|textContent|value)/);
  assert.doesNotMatch(runtime, /requestSubmit\(|\.submit\(/);
});
