const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function dummyElement() {
  const element = {
    hidden: true, value: '', checked: false, disabled: false, innerHTML: '', textContent: '',
    dataset: {}, style: {}, files: [],
    classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {}, removeEventListener() {},
    scrollIntoView() {}, appendChild() {}, remove() {}, click() {}, reset() {}, closest() { return null; }
  };
  element.elements = new Proxy({}, { get(target, key) { if (!target[key]) target[key] = dummyElement(); return target[key]; } });
  return element;
}
const elements = new Map();
function getElement(sel) { if (!elements.has(sel)) elements.set(sel, dummyElement()); return elements.get(sel); }

const vars = new Map();
let messages = [
  { id: 101, role: 'assistant', hidden: false, content: 'Mara Bell introduces herself and spends the evening talking with Dakota.' },
  { id: 102, role: 'user', hidden: false, content: 'I ask Mara Bell whether she is coming tomorrow.' },
  { id: 103, role: 'assistant', hidden: false, content: 'Mara Bell says yes and explains she is the resident assistant on the floor.' }
];
let generateCalls = [];
let generateMode = 'success';
const tavo = {
  get(key) { return vars.has(key) ? vars.get(key) : null; },
  set(key, value) { vars.set(key, value); },
  unset(key) { vars.delete(key); },
  message: {
    async count() { return messages.length; },
    async find(range) {
      if (!Array.isArray(range)) return [];
      const [start, end] = range;
      return messages.slice(start, end + 1);
    }
  },
  chat: { async current() { return { persona: { name: 'Dakota' }, characters: [{ name: 'Narrator' }] }; } },
  async generate(prompt, options) {
    generateCalls.push({ prompt, options });
    if (generateMode === 'fail') throw new Error('simulated extractor failure');
    return JSON.stringify({
      npcProposals: [{
        action: 'create', name: 'Mara Bell', admissionReason: 'recurring', evidenceMessageIds: [101, 103],
        fields: { role: 'Resident assistant', currentMotive: 'Return tomorrow' }
      }],
      relationshipProposals: [{
        action: 'create', sourceName: 'Mara Bell', targetType: 'protagonist',
        axisTargets: { Trust: 6, Affinity: 6 }, relationshipStatus: 'Acquaintances',
        evidenceMessageIds: [101, 103]
      }]
    });
  },
  utils: { toast() {} }
};
const harness = {};
const context = {
  console, Math, Date, JSON, Object, Array, Set, Map, String, Number, Boolean, Promise,
  tavo, __storyStateTestHarness: harness,
  document: { querySelector: getElement, querySelectorAll() { return []; }, documentElement: { style: {} }, body: dummyElement(), createElement() { return dummyElement(); } },
  setInterval() { return 1; }, clearInterval() {}, setTimeout() { return 1; }, clearTimeout() {},
  confirm() { return true; }, prompt() { return null; }, FormData: function FormData() {}, Blob: function Blob() {},
  URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
};
const html = fs.readFileSync(path.join(__dirname, '..', 'ui', 'panel.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
vm.runInNewContext(scripts.at(-1)[1], context, { filename: 'ui/panel.html' });

(async () => {
  const state = harness.newState();
  state.config.updateMode = 'assisted';
  vars.set('storyState.state', state);
  getElement('#ss-root').hidden = true;

  await harness.runExtractionScan({ type: 'scan', mode: 'manual' });
  const after = harness.normalizeState(vars.get('storyState.state'));
  assert.strictEqual(generateCalls.length, 1, 'One scan must make exactly one extraction generation request.');
  assert.strictEqual(generateCalls[0].options.context, false, 'Extractor must not inherit full chat context.');
  assert.strictEqual(after.meta.scanStatus, 'idle');
  assert.strictEqual(after.meta.lastScannedFloor, 2);
  assert.strictEqual(after.meta.lastScannedMessageId, 103);
  assert.strictEqual(after.npcs.length, 1);
  assert.strictEqual(after.npcs[0].name, 'Mara Bell');
  assert.strictEqual(after.relationships.length, 1);
  assert.strictEqual(after.relationships[0].sourceNpcId, after.npcs[0].id);
  assert(vars.get('storyState.recovery')?.storyState, 'A state-changing extraction should create a recovery snapshot.');

  // No new messages: no second generation call.
  await harness.runExtractionScan({ type: 'scan', mode: 'manual' });
  assert.strictEqual(generateCalls.length, 1, 'Scanning with no new narrative messages should not call the model.');

  // A later extractor failure should preserve semantic state and surface error status.
  messages.push({ id: 104, role: 'assistant', hidden: false, content: 'Mara Bell leaves for the night.' });
  generateMode = 'fail';
  await harness.runExtractionScan({ type: 'scan', mode: 'manual' });
  const failed = harness.normalizeState(vars.get('storyState.state'));
  assert.strictEqual(failed.npcs.length, 1, 'Extractor failure must not delete previously committed NPC state.');
  assert.strictEqual(failed.relationships.length, 1, 'Extractor failure must not delete previously committed relationship state.');
  assert.strictEqual(failed.meta.scanStatus, 'error');
  assert(/simulated extractor failure/.test(failed.meta.lastScanSummary));

  console.log('StoryState Phase 2 extraction-run integration tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
