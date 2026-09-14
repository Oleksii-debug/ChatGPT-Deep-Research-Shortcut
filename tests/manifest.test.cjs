const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../manifest.json');

test('Manifest V3 and the intended host stay exact', () => {
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

test('v0.5.0 visible extension name is Ukrainian', () => {
  assert.equal(manifest.version, '0.5.0');
  assert.equal(manifest.name, 'Доступні інструменти');
  assert.doesNotMatch(manifest.name, /chat\s*gpt/i);
});

test('runtime permissions stay minimal', () => {
  assert.deepEqual(manifest.permissions, ['activeTab']);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.permissions.includes('downloads'), false);
  assert.equal(manifest.permissions.includes('storage'), false);
});

test('active runtime module order is deterministic', () => {
  assert.deepEqual(manifest.content_scripts?.[0]?.js, [
    'src/matcher.js',
    'src/dom.js',
    'src/diagnostics.js',
    'src/activation.js',
    'src/picker.js'
  ]);
  assert.equal(manifest.content_scripts[0].js.includes('src/content.js'), false);
});
