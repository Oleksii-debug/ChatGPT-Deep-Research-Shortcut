const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../manifest.json');
const runtime = ['background.js','matcher.js','dom.js','diagnostics.js','activation.js','picker.js']
  .map((f) => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n');

test('runtime remains scoped and least-privileged', () => {
  assert.deepEqual(manifest.permissions, ['activeTab']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://chatgpt.com/*']);
  assert.equal(manifest.host_permissions, undefined);
});

test('runtime has no extension-owned network, storage or cookie access', () => {
  assert.doesNotMatch(runtime, /\bfetch\s*\(/);
  assert.doesNotMatch(runtime, /XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(runtime, /chrome\.storage|chrome\.cookies|localStorage|sessionStorage|document\.cookie/);
});

test('runtime does not submit or rewrite the prompt', () => {
  assert.doesNotMatch(runtime, /requestSubmit\(|form\.submit\(/);
  assert.doesNotMatch(runtime, /prompt-textarea[^\n]*(textContent|innerText|value)\s*=/);
});

test('diagnostic URL strips query and hash and report declares prompt privacy', () => {
  const diagnostics = fs.readFileSync(path.join(__dirname, '../src/diagnostics.js'), 'utf8');
  assert.match(diagnostics, /location\.origin/);
  assert.match(diagnostics, /location\.pathname/);
  assert.match(diagnostics, /\[redacted\]/);
  assert.match(diagnostics, /const sensitive=new Set\(\['c','g','share','project','projects'\]\)/);
  assert.doesNotMatch(diagnostics, /location\.href/);
  assert.match(diagnostics, /Конфіденційність: текст запиту\/чату не записується/);
});
