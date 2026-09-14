const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/matcher.js');
const api = globalThis.ChatGPTDR;

function fakeElement({
  text = '',
  tagName = 'DIV',
  attrs = {}
} = {}) {
  return {
    tagName,
    innerText: text,
    textContent: text,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name);
    }
  };
}

test('recognizes current English and Ukrainian labels', () => {
  assert.equal(api.isDeepResearchLabel('Deep research'), true);
  assert.equal(api.isDeepResearchLabel('Поглиблене дослідження'), true);
  assert.equal(api.isDeepResearchLabel('Глибоке дослідження'), true);
});

test('recognizes normalized localized labels', () => {
  assert.equal(api.isDeepResearchLabel('Hĺbkový výskum'), true);
  assert.equal(api.isDeepResearchLabel('Hloubkový výzkum'), true);
  assert.equal(api.isDeepResearchLabel('Recherche approfondie'), true);
  assert.equal(api.isDeepResearchLabel('Investigación profunda'), true);
  assert.equal(api.isDeepResearchLabel('Gründliche Recherche'), true);
});

test('does not accept generic research wording', () => {
  assert.equal(api.isDeepResearchLabel('Research'), false);
  assert.equal(api.isDeepResearchLabel('Search the web'), false);
  assert.equal(api.isDeepResearchLabel('Add files and more'), false);
});

test('menu item with exact label receives a strong score', () => {
  const el = fakeElement({
    text: 'Deep research',
    tagName: 'BUTTON',
    attrs: { role: 'menuitem', tabindex: '0' }
  });
  assert.ok(api.scoreDeepResearchCandidate(el) >= 135);
});

test('data-testid fallback works even when visible text changes', () => {
  const el = fakeElement({
    text: 'Advanced investigation',
    tagName: 'BUTTON',
    attrs: { 'data-testid': 'composer-deep-research-item', role: 'menuitem' }
  });
  assert.ok(api.scoreDeepResearchCandidate(el) >= 100);
});

test('internal connector id fallback works without readable label', () => {
  const el = fakeElement({
    text: '',
    tagName: 'BUTTON',
    attrs: { 'data-connector-id': 'connector_openai_deep_research', role: 'menuitem' }
  });
  assert.ok(api.scoreDeepResearchCandidate(el) >= 140);
});

test('selected state supports ARIA and data-state conventions', () => {
  assert.equal(api.isSelected(fakeElement({ attrs: { 'aria-checked': 'true' } })), true);
  assert.equal(api.isSelected(fakeElement({ attrs: { 'aria-pressed': 'true' } })), true);
  assert.equal(api.isSelected(fakeElement({ attrs: { 'data-state': 'checked' } })), true);
  assert.equal(api.isSelected(fakeElement()), false);
});
