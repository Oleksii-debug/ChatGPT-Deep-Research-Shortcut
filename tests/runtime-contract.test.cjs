const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dom = fs.readFileSync(path.join(__dirname, '../src/dom.js'), 'utf8');
const activation = fs.readFileSync(path.join(__dirname, '../src/activation.js'), 'utf8');
const diagnostics = fs.readFileSync(path.join(__dirname, '../src/diagnostics.js'), 'utf8');

test('activation checks an already-open native menu before toggling plus', () => {
  const candidateIndex = activation.indexOf("findToolCandidate(toolId,null,{requireMenuSurface:true})");
  const plusIndex = activation.indexOf('findPlusButton()');
  assert.ok(candidateIndex >= 0 && plusIndex >= 0 && candidateIndex < plusIndex);
});

test('success requires stable selected-marker verification after click', () => {
  assert.match(activation, /await dom\.waitForComposerToolMarker\(toolId\)/);
  assert.match(activation, /activation-verified/);
  assert.match(activation, /composer-marker-not-confirmed/);
  const clickIndex = activation.indexOf("tool-candidate-click-dispatched");
  const verifyIndex = activation.indexOf('await dom.waitForComposerToolMarker(toolId)');
  const successIndex = activation.indexOf('підтверджено як вибране');
  assert.ok(clickIndex >= 0 && verifyIndex > clickIndex && successIndex > verifyIndex);
  assert.match(dom, /VERIFY_STABLE_MS=300/);
});

test('selected marker scanner uses strong structural candidates only', () => {
  assert.match(dom, /\[data-inline-selection-pill\]/);
  assert.match(dom, /\[data-symbol="ecosystemMention"\]/);
  assert.match(dom, /button\.__composer-pill/);
  const markerBody = dom.slice(dom.indexOf('function findComposerToolMarker'), dom.indexOf('function safeElementSummary'));
  assert.doesNotMatch(markerBody, /querySelectorAll\('span,div'\)/);
});

test('diagnostics are a local Blob download', () => {
  assert.match(diagnostics, /new Blob\(\[report\]/);
  assert.match(diagnostics, /URL\.createObjectURL\(blob\)/);
  assert.doesNotMatch(diagnostics, /chrome\.downloads/);
});
