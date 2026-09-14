const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dom = fs.readFileSync(path.join(__dirname, '../src/dom.js'), 'utf8');
const activation = fs.readFileSync(path.join(__dirname, '../src/activation.js'), 'utf8');
const diagnostics = fs.readFileSync(path.join(__dirname, '../src/diagnostics.js'), 'utf8');

test('verification is fail-closed and no click-only success string exists', () => {
  assert.match(activation, /composer-marker-not-confirmed/);
  assert.match(activation, /підтверджено як вибране/);
  assert.match(activation, /Не підтверджено/);
  assert.doesNotMatch(activation, /вибрано\. Введіть запит/);
});

test('menu surfaces and their descendants are rejected as selected state', () => {
  assert.match(dom, /MENU_SURFACE_SELECTOR/);
  assert.match(dom, /\.__menu-item/);
  assert.match(dom, /\[data-fill\]\[tabindex\]/);
  assert.match(dom, /if\(!\(el instanceof Element\)\|\|!isVisible\(el\)\|\|extensionOwned\(el\)\|\|menuLike\(el\)\)return null/);
});

test('inline selection pill is explicitly supported inside editable composer', () => {
  assert.match(dom, /api\.isToolSelectionPill\?\.\(toolId,el\)/);
  const inlineIndex = dom.indexOf('api.isToolSelectionPill?.(toolId,el)');
  const editableIndex = dom.indexOf('!inEditable(el)&&api.isSelected');
  assert.ok(inlineIndex >= 0 && editableIndex > inlineIndex);
});

test('diagnostics record one-second heartbeat and safe composer pill metadata', () => {
  assert.match(diagnostics, /HEARTBEAT_MS=1000/);
  assert.match(diagnostics, /composerPillSnapshot/);
  assert.match(diagnostics, /elapsedMs:Date\.now\(\)-session\.startedAt/);
  assert.doesNotMatch(diagnostics, /matchedAccessibleText/);
});
