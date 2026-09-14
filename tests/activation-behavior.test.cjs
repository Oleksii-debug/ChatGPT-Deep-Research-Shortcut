const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/activation.js'), 'utf8');

function makeHarness(options = {}) {
  const calls = [];
  const candidate = { id: 'native-menu-row' };
  const marker = { element: { id: 'selected-pill' }, evidenceKind: 'inline-selection-pill' };
  let findCandidateCalls = 0;
  let plusCalls = 0;
  let verifyCalls = 0;

  const dom = {
    OWNED_ATTR: 'data-accessible-tools-owned',
    INTERACTIVE_SELECTOR: 'button,[role="menuitem"]',
    findComposerToolMarker() {
      calls.push('find-marker-initial');
      return options.alreadySelected ? marker : null;
    },
    findToolCandidate() {
      findCandidateCalls += 1;
      calls.push('find-candidate');
      return options.openCandidate === false ? null : candidate;
    },
    findPlusButton() {
      plusCalls += 1;
      calls.push('find-plus');
      return options.plusMissing ? null : { id: 'plus' };
    },
    robustClick(element) { calls.push(`click:${element.id}`); },
    async waitForToolCandidate() {
      calls.push('wait-candidate');
      return options.candidateAfterPlus === false ? null : candidate;
    },
    async waitForComposerToolMarker() {
      verifyCalls += 1;
      calls.push('wait-marker');
      return options.verify === false ? null : marker;
    },
    safeElementSummary(element) { return { id: element?.id || '' }; },
    focusComposer() { calls.push('focus-composer'); },
    classifyComposerToolMarker() {},
    composerPillSnapshot() { return []; }
  };

  const announcements = [];
  const records = [];
  const diag = {
    VERSION: '0.5.0',
    newDiagnostics(reason, toolId) { records.push(['new', reason, toolId]); },
    setActivationInProgress(value) { records.push(['busy', value]); },
    startHeartbeat(toolId) { records.push(['heartbeat-start', toolId]); },
    stopHeartbeat() { records.push(['heartbeat-stop']); },
    record(event, details) { records.push([event, details]); },
    captureSafeState() { return { safe: true }; },
    announce(message) { announcements.push(message); },
    downloadDiagnostics() {},
    diagnosticReportText() { return ''; }
  };

  const context = {
    console,
    document: { querySelectorAll() { return []; } },
    ChatGPTToolPicker: {
      getTool(id) {
        if (id !== 'research') return null;
        return { id, label: 'Глибоке дослідження' };
      }
    },
    AccessibleToolsDom: dom,
    AccessibleToolsDiagnostics: diag
  };
  context.globalThis = context;
  vm.runInNewContext(source, context);

  return {
    activate: context.AccessibleToolsRuntime.activateTool,
    calls,
    announcements,
    records,
    counters: () => ({ findCandidateCalls, plusCalls, verifyCalls })
  };
}

test('already-open native menu candidate is clicked without toggling plus, then verified', async () => {
  const h = makeHarness({ openCandidate: true, verify: true });
  const result = await h.activate('research');
  assert.equal(result, true);
  assert.deepEqual(h.calls.slice(0, 4), [
    'find-marker-initial',
    'find-candidate',
    'click:native-menu-row',
    'wait-marker'
  ]);
  assert.equal(h.counters().plusCalls, 0, 'plus must not be touched when native menu is already open');
  assert.ok(h.announcements.some((m) => m.includes('підтверджено як вибране')));
});

test('click without a confirmed composer marker fails closed and never announces success', async () => {
  const h = makeHarness({ openCandidate: true, verify: false });
  const result = await h.activate('research');
  assert.equal(result, false);
  assert.equal(h.counters().plusCalls, 0);
  assert.ok(h.announcements.some((m) => m.includes('Не підтверджено')));
  assert.equal(h.announcements.some((m) => m.includes('підтверджено як вибране')), false);
  assert.ok(h.records.some(([event, details]) => event === 'activation-failed' && details?.reason === 'composer-marker-not-confirmed'));
});

test('closed menu path clicks plus once, waits for the menu row, then verifies selection', async () => {
  const h = makeHarness({ openCandidate: false, candidateAfterPlus: true, verify: true });
  const result = await h.activate('research');
  assert.equal(result, true);
  assert.deepEqual(h.calls.slice(0, 7), [
    'find-marker-initial',
    'find-candidate',
    'find-plus',
    'click:plus',
    'wait-candidate',
    'click:native-menu-row',
    'wait-marker'
  ]);
  assert.equal(h.counters().plusCalls, 1);
  assert.equal(h.counters().verifyCalls, 1);
});

test('missing plus button fails without pretending the tool was selected', async () => {
  const h = makeHarness({ openCandidate: false, plusMissing: true });
  const result = await h.activate('research');
  assert.equal(result, false);
  assert.ok(h.announcements.some((m) => m.includes('Не знайдено кнопку')));
  assert.equal(h.announcements.some((m) => m.includes('підтверджено як вибране')), false);
});
