const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/matcher.js');
const api = globalThis.ChatGPTToolPicker;

function fakeElement({ text = '', tagName = 'DIV', attrs = {} } = {}) {
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

test('exports exactly the three requested tools in canonical order data', () => {
  assert.deepEqual(Object.keys(api.TOOL_DEFINITIONS), ['image', 'web', 'research']);
  assert.equal(api.getTool('image').label, 'Створити зображення');
  assert.equal(api.getTool('web').label, 'Пошук в Інтернеті');
  assert.equal(api.getTool('research').label, 'Глибоке дослідження');
});

test('recognizes exact Ukrainian labels captured from the live ChatGPT menu', () => {
  assert.equal(api.isToolLabel('image', 'Створити зображення'), true);
  assert.equal(api.isToolLabel('web', 'Пошук в Інтернеті'), true);
  assert.equal(api.isToolLabel('research', 'Глибоке дослідження'), true);
});

test('recognizes live Ukrainian descriptions as fallbacks', () => {
  assert.equal(api.isToolDescription('image', 'Візуалізуйте все'), true);
  assert.equal(api.isToolDescription('web', 'Знаходьте актуальні новини й інформацію'), true);
  assert.equal(api.isToolDescription('research', 'Отримати докладний звіт'), true);
});

test('recognizes English fallbacks for the three tools', () => {
  assert.equal(api.isToolLabel('image', 'Create image'), true);
  assert.equal(api.isToolLabel('web', 'Search the web'), true);
  assert.equal(api.isToolLabel('research', 'Deep research'), true);
});

test('does not cross-match different tools', () => {
  assert.equal(api.isToolLabel('image', 'Search the web'), false);
  assert.equal(api.isToolLabel('web', 'Deep research'), false);
  assert.equal(api.isToolLabel('research', 'Create image'), false);
});

test('combined menu item text still matches the intended label', () => {
  assert.equal(api.isToolLabel('image', 'Створити зображення Візуалізуйте все'), true);
  assert.equal(api.isToolLabel('web', 'Пошук в Інтернеті Знаходьте актуальні новини й інформацію'), true);
  assert.equal(api.isToolLabel('research', 'Глибоке дослідження Отримати докладний звіт'), true);
});

test('menu item roles increase confidence without being required', () => {
  for (const [toolId, text] of [
    ['image', 'Створити зображення Візуалізуйте все'],
    ['web', 'Пошук в Інтернеті Знаходьте актуальні новини й інформацію'],
    ['research', 'Глибоке дослідження Отримати докладний звіт']
  ]) {
    const el = fakeElement({ text, tagName: 'BUTTON', attrs: { role: 'menuitem', tabindex: '0' } });
    assert.ok(api.scoreToolCandidate(toolId, el) >= 175, `${toolId} should score strongly`);
  }
});

test('internal Deep Research connector id remains a fallback', () => {
  const el = fakeElement({
    text: '',
    tagName: 'BUTTON',
    attrs: { 'data-connector-id': 'connector_openai_deep_research', role: 'menuitem' }
  });
  assert.ok(api.scoreToolCandidate('research', el) >= 130);
});

test('semantic signature fallbacks identify image and web search', () => {
  const image = fakeElement({
    text: '',
    tagName: 'BUTTON',
    attrs: { 'data-testid': 'composer-create-image', role: 'menuitem' }
  });
  const web = fakeElement({
    text: '',
    tagName: 'BUTTON',
    attrs: { 'data-testid': 'search-the-web-tool', role: 'menuitem' }
  });
  assert.ok(api.scoreToolCandidate('image', image) >= 130);
  assert.ok(api.scoreToolCandidate('web', web) >= 130);
});

test('selected state supports ARIA and data-state conventions', () => {
  assert.equal(api.isSelected(fakeElement({ attrs: { 'aria-checked': 'true' } })), true);
  assert.equal(api.isSelected(fakeElement({ attrs: { 'aria-pressed': 'true' } })), true);
  assert.equal(api.isSelected(fakeElement({ attrs: { 'data-state': 'checked' } })), true);
  assert.equal(api.isSelected(fakeElement()), false);
});
