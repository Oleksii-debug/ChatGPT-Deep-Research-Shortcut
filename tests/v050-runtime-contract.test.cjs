const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');
const picker = read('picker.js');
const activation = read('activation.js');
const dom = read('dom.js');
const diagnostics = read('diagnostics.js');
const runtime = ['background.js','matcher.js','dom.js','diagnostics.js','activation.js','picker.js'].map(read).join('\n');

test('active v0.5 runtime has no network/storage/cookie side channel', () => {
  assert.doesNotMatch(runtime, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(runtime, /chrome\.storage|chrome\.cookies|localStorage|sessionStorage|document\.cookie/);
});

test('active runtime never submits or rewrites the prompt', () => {
  assert.doesNotMatch(runtime, /requestSubmit\(|form\.submit\(/);
  assert.doesNotMatch(runtime, /prompt-textarea[^\n]*(textContent|innerText|value)\s*=/);
});

test('NVDA picker remains a modal native-button surface with full keyboard contract', () => {
  assert.match(picker, /setAttribute\('role','dialog'\)/);
  assert.match(picker, /setAttribute\('aria-modal','true'\)/);
  assert.match(picker, /createElement\('button'\)/);
  for (const key of ['Escape','ArrowDown','ArrowUp','Home','End','Tab']) assert.ok(picker.includes(`event.key==='${key}'`), `missing ${key}`);
  assert.match(picker, /isPickerShortcutEvent\(event\)/);
  assert.match(picker, /isDiagnosticsShortcutEvent/);
});

test('activation uses menu-first then stable verification then success', () => {
  const menuFirst = activation.indexOf('findToolCandidate(toolId,null,{requireMenuSurface:true})');
  const plus = activation.indexOf('findPlusButton()', menuFirst);
  const click = activation.indexOf('tool-candidate-click-dispatched');
  const verify = activation.indexOf('await dom.waitForComposerToolMarker(toolId)');
  const success = activation.indexOf('підтверджено як вибране');
  assert.ok(menuFirst >= 0 && plus > menuFirst);
  assert.ok(click >= 0 && verify > click && success > verify);
  assert.match(dom, /VERIFY_STABLE_MS=300/);
});

test('native menus and plain ChatGPT rows are excluded from selected-marker proof', () => {
  assert.match(dom, /MENU_SURFACE_SELECTOR/);
  assert.match(dom, /div\.__menu-item/);
  assert.match(dom, /\[data-fill\]\[tabindex\]/);
  assert.match(dom, /menuLike\(el\)\)return null/);
});

test('diagnostics are local, one-second, and do not expose URL query/hash', () => {
  assert.match(diagnostics, /HEARTBEAT_MS=1000/);
  assert.match(diagnostics, /new Blob\(\[report\]/);
  assert.match(diagnostics, /location\.origin/);
  assert.match(diagnostics, /location\.pathname/);
  assert.doesNotMatch(diagnostics, /location\.href|chrome\.downloads|chrome\.storage/);
});
