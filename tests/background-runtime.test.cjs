const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/background.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function createHarness() {
  let commandListener = null;
  let actionListener = null;
  const calls = [];

  const chrome = {
    commands: {
      onCommand: {
        addListener(fn) { commandListener = fn; }
      }
    },
    tabs: {
      async query(query) {
        calls.push({ type: 'query', query });
        return [{ id: 42 }];
      },
      async sendMessage(tabId, message) {
        calls.push({ type: 'message', tabId, message });
      }
    },
    action: {
      onClicked: {
        addListener(fn) { actionListener = fn; }
      }
    }
  };

  vm.runInNewContext(source, { chrome, console });
  return { calls, get commandListener() { return commandListener; }, get actionListener() { return actionListener; } };
}

test('registered Chrome command opens picker in current active tab', async () => {
  const h = createHarness();
  assert.equal(typeof h.commandListener, 'function');

  await h.commandListener('open-tool-picker');

  assert.deepEqual(plain(h.calls[0]), {
    type: 'query',
    query: { active: true, currentWindow: true }
  });
  assert.deepEqual(plain(h.calls[1]), {
    type: 'message',
    tabId: 42,
    message: { type: 'OPEN_TOOL_PICKER' }
  });
});

test('unrelated Chrome commands are ignored', async () => {
  const h = createHarness();
  await h.commandListener('something-else');
  assert.equal(h.calls.length, 0);
});

test('extension toolbar action uses the same picker message', async () => {
  const h = createHarness();
  assert.equal(typeof h.actionListener, 'function');
  await h.actionListener({ id: 7 });
  assert.deepEqual(plain(h.calls[0]), {
    type: 'message',
    tabId: 7,
    message: { type: 'OPEN_TOOL_PICKER' }
  });
});
