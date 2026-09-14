const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const matcherSource = fs.readFileSync(path.join(__dirname, '../src/matcher.js'), 'utf8');
const domSource = fs.readFileSync(path.join(__dirname, '../src/dom.js'), 'utf8');
const activationSource = fs.readFileSync(path.join(__dirname, '../src/activation.js'), 'utf8');
const diagnosticsSource = fs.readFileSync(path.join(__dirname, '../src/diagnostics.js'), 'utf8');

class FakeElement {
  constructor({ tagName = 'SPAN', attrs = {}, text = '', menuLike = false, editable = false, owned = false } = {}) {
    this.tagName = tagName.toUpperCase();
    this.attrs = { ...attrs };
    this.textContent = text;
    this.innerText = text;
    this.className = attrs.class || '';
    this.hidden = false;
    this.menuLike = menuLike;
    this.editable = editable;
    this.owned = owned;
    this.parentElement = null;
  }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? String(this.attrs[name]) : null; }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name); }
  getClientRects() { return [{ width: 100, height: 20 }]; }
  focus() {}
  scrollIntoView() {}
  click() {}
  matches(selector) {
    if (selector === 'button.__composer-pill') return this.tagName === 'BUTTON' && String(this.className).split(/\s+/).includes('__composer-pill');
    if (selector.includes('[data-inline-selection-pill]') && this.hasAttribute('data-inline-selection-pill')) return true;
    return false;
  }
  closest(selector) {
    if (selector.includes('data-accessible-tools-owned') || selector.includes('accessible-tools-dialog') || selector.includes('accessible-tools-status')) {
      return this.owned ? this : null;
    }
    if (selector.includes('[role="menu"]') || selector.includes('[role="menuitem"]') || selector.includes('.__menu-item') || selector.includes('[data-fill][tabindex]') || selector.includes('[popover]')) {
      return this.menuLike ? this : null;
    }
    if (selector.includes('#prompt-textarea') || selector.includes('contenteditable') || selector.includes('[role="textbox"]')) {
      return this.editable ? this : null;
    }
    return null;
  }
  querySelectorAll() { return []; }
}

const documentElement = new FakeElement({ tagName: 'HTML' });
const body = new FakeElement({ tagName: 'BODY' });
const document = {
  body,
  documentElement,
  visibilityState: 'visible',
  fullscreenElement: null,
  activeElement: null,
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return new FakeElement({ tagName: 'DIV' }); }
};

const context = {
  console,
  document,
  location: { origin: 'https://chatgpt.com', pathname: '/c/test', href: 'https://chatgpt.com/c/test?secret=1#frag' },
  chrome: { runtime: { onMessage: { addListener() {} } } },
  Element: FakeElement,
  HTMLElement: FakeElement,
  MutationObserver: class { observe() {} disconnect() {} },
  MouseEvent: class {},
  PointerEvent: class {},
  Blob: class {},
  URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
  window: {
    innerWidth: 1280,
    innerHeight: 800,
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout() { return 1; },
    clearTimeout() {},
    getComputedStyle() { return { display: 'block', visibility: 'visible' }; }
  },
  setTimeout() { return 1; },
  clearTimeout() {},
  setInterval() { return 1; },
  clearInterval() {},
  Date,
  Math
};
context.globalThis = context;
context.window.getComputedStyle = context.window.getComputedStyle;
context.getComputedStyle = context.window.getComputedStyle;

vm.runInNewContext(matcherSource, context);
vm.runInNewContext(domSource, context);
const api = context.ChatGPTToolPicker;
const picker = context.AccessibleToolsDom;

test('recognizes current Deep Research inline selection-pill identities', () => {
  for (const dataId of ['plugin:connector_openai_deep_research', 'connector:connector_openai_deep_research']) {
    const el = new FakeElement({ attrs: {
      'data-inline-selection-pill': '',
      'data-id': dataId,
      'data-system-hint-type': dataId,
      'data-symbol': 'ecosystemMention',
      'data-keyword': 'Deep research'
    }, text: 'Deep research', editable: true });
    assert.equal(api.isToolSelectionPill('research', el), true);
    assert.equal(picker.classifyComposerToolMarker('research', el)?.evidenceKind, 'inline-selection-pill');
  }
});

test('accepts selected tool pill inside contenteditable composer', () => {
  const el = new FakeElement({ attrs: {
    'data-inline-selection-pill': '',
    'data-id': 'connector:connector_openai_deep_research',
    'data-symbol': 'ecosystemMention',
    'data-keyword': 'Поглиблене дослідження'
  }, text: 'Поглиблене дослідження', editable: true });
  assert.ok(picker.classifyComposerToolMarker('research', el));
});

test('rejects identical connector metadata when it is a native menu row', () => {
  const el = new FakeElement({ attrs: {
    'data-inline-selection-pill': '',
    'data-id': 'connector:connector_openai_deep_research',
    'data-symbol': 'ecosystemMention',
    'data-keyword': 'Deep research',
    role: 'menuitem'
  }, text: 'Deep research', menuLike: true });
  assert.equal(picker.classifyComposerToolMarker('research', el), null);
});

test('plain typed Deep research text is never a selected marker', () => {
  const el = new FakeElement({ text: 'Deep research', editable: true });
  assert.equal(api.isToolSelectionPill('research', el), false);
  assert.equal(picker.classifyComposerToolMarker('research', el), null);
});

test('recognizes current web-search and image inline identities', () => {
  const web = new FakeElement({ attrs: { 'data-inline-selection-pill': '', 'data-id': 'search', 'data-system-hint-type': 'search', 'data-symbol': 'ecosystemMention', 'data-keyword': 'Web search' }, text: 'Web search', editable: true });
  const image = new FakeElement({ attrs: { 'data-inline-selection-pill': '', 'data-system-hint-type': 'image_gen', 'data-symbol': 'ecosystemMention', 'data-keyword': 'Create image' }, text: 'Create image', editable: true });
  assert.equal(api.isToolSelectionPill('web', web), true);
  assert.equal(api.isToolSelectionPill('image', image), true);
});

test('source requires stable confirmation and checks an already-open menu before pressing plus', () => {
  assert.match(domSource, /VERIFY_STABLE_MS=300|VERIFY_STABLE_MS = 300/);
  const candidateFirst = activationSource.indexOf('findToolCandidate(toolId,null,{requireMenuSurface:true})');
  const plusLookup = activationSource.indexOf('findPlusButton()', candidateFirst);
  assert.ok(candidateFirst >= 0 && plusLookup > candidateFirst);
  assert.match(domSource, /MENU_SURFACE_SELECTOR/);
  assert.match(domSource, /div\.__menu-item/);
  assert.match(domSource, /\[data-fill\]\[tabindex\]/);
});

test('diagnostics do not include raw matched composer text or URL query/hash', () => {
  assert.doesNotMatch(domSource + diagnosticsSource, /matchedAccessibleText/);
  assert.match(diagnosticsSource, /location\.origin/);
  assert.match(diagnosticsSource, /location\.pathname/);
  assert.doesNotMatch(diagnosticsSource, /location\.href/);
});
