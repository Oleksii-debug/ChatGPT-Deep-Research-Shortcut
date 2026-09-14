const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/content.js'), 'utf8');

test('activation is fail-closed and requires a composer marker after the click', () => {
  assert.match(source, /function findComposerToolMarker\(toolId\)/);
  assert.match(source, /function waitForComposerToolMarker\(toolId/);
  assert.match(source, /const verifiedMarker = await waitForComposerToolMarker\(toolId\)/);
  assert.match(source, /reason: 'composer-marker-not-confirmed'/);
  assert.match(source, /підтверджено як вибране/);
  assert.doesNotMatch(source, /announce\(`\$\{tool\.label\} вибрано\. Введіть запит/);
});

test('verification excludes extension-owned live region and editable prompt text', () => {
  assert.match(source, /const OWNED_ATTR = 'data-chatgpt-tool-picker-owned'/);
  assert.match(source, /function elementIsExtensionOwned\(element\)/);
  assert.match(source, /function isInEditable\(element\)/);
  assert.match(source, /!isVisible\(element\) \|\| elementIsExtensionOwned\(element\) \|\| isInEditable\(element\)/);
  assert.match(source, /#prompt-textarea, textarea, input, \[contenteditable="true"\], \[role="textbox"\]/);
});

test('diagnostics record a one-second heartbeat and elapsed timeline', () => {
  assert.match(source, /const HEARTBEAT_MS = 1000/);
  assert.match(source, /elapsedMs: Date\.now\(\) - diagnosticSession\.startedAt/);
  assert.match(source, /recordDiagnostic\('heartbeat', captureSafeState\(toolId\)\)/);
  assert.match(source, /window\.setInterval\(\(\) => \{/);
  assert.match(source, /\(entry\.elapsedMs \/ 1000\)\.toFixed\(3\)/);
});

test('diagnostic report is downloadable without downloads or storage APIs', () => {
  assert.match(source, /function downloadDiagnostics\(\)/);
  assert.match(source, /new Blob\(\[report\]/);
  assert.match(source, /URL\.createObjectURL\(blob\)/);
  assert.match(source, /anchor\.download = diagnosticsFilename\(\)/);
  assert.match(source, /data-chatgpt-diagnostics-download/);
  assert.match(source, /Завантажити діагностичний звіт/);
  assert.doesNotMatch(source, /chrome\.downloads/);
  assert.doesNotMatch(source, /chrome\.storage/);
});

test('diagnostics explicitly avoid capturing prompt and chat text', () => {
  assert.match(source, /Privacy: prompt\/chat text is intentionally not captured\./);
  assert.match(source, /matchedAccessibleText: matchedTool \? text\.slice\(0, 160\) : ''/);
  assert.doesNotMatch(source, /composer\.value/);
  assert.doesNotMatch(source, /findComposer\(\)\.textContent/);
});

test('diagnostics button is separate from the three tool choices', () => {
  assert.match(source, /getPickerToolButtons\(dialog\)/);
  assert.match(source, /\[data-chatgpt-tool-id\]/);
  assert.match(source, /getPickerFocusables\(dialog\)/);
  assert.match(source, /\[data-chatgpt-diagnostics-download\]/);
  assert.match(source, /diagnostics\.dataset\.chatgptDiagnosticsDownload = 'true'/);
});
