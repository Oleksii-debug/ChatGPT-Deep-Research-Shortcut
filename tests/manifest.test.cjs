const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../manifest.json');

test('uses Manifest V3 and the intended ChatGPT host', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.content_scripts?.[0]?.matches, ['https://chatgpt.com/*']);
  assert.equal(manifest.content_scripts?.[0]?.run_at, 'document_idle');
});

test('Ctrl+Shift+U opens the tool picker command on Windows', () => {
  const command = manifest.commands?.['open-tool-picker'];
  assert.ok(command, 'open-tool-picker command missing');
  assert.equal(command.suggested_key?.windows, 'Ctrl+Shift+U');
  assert.equal(command.suggested_key?.default, 'Ctrl+Shift+U');
});

test('extension version is the hardened direct-chat picker release', () => {
  assert.equal(manifest.version, '0.3.0');
  assert.match(manifest.name, /Tool Picker/i);
});

test('runtime permissions stay minimal', () => {
  assert.deepEqual(manifest.permissions, ['activeTab']);
  assert.equal(manifest.host_permissions, undefined);
});

test('content script dependency order is deterministic', () => {
  assert.deepEqual(manifest.content_scripts?.[0]?.js, ['src/matcher.js', 'src/content.js']);
});
