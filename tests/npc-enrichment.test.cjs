const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function dummyElement() {
  const element = {
    hidden: true, value: '', checked: false, disabled: false, innerHTML: '', textContent: '',
    dataset: {}, style: {}, files: [], parentElement: null,
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, scrollIntoView() {},
    appendChild(child) { if (child) child.parentElement = this; return child; },
    insertBefore(child) { if (child) child.parentElement = this; return child; },
    prepend() {}, append() {}, insertAdjacentElement() {}, remove() {}, click() {}, reset() {},
    closest() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    setAttribute() {}, select() {}
  };
  element.elements = new Proxy({}, { get(target, key) { if (!target[key]) target[key] = dummyElement(); return target[key]; } });
  return element;
}
const elements = new Map();
function getElement(selector) { if (!elements.has(selector)) elements.set(selector, dummyElement()); return elements.get(selector); }

const vars = new Map();
const messages = [
  { id: 301, role: 'assistant', hidden: false, content: 'Dreg answers Hooch and stays close while the captives plan their escape.' },
  { id: 302, role: 'assistant', hidden: false, content: 'Harl leads the fugitives down the slope and warns them where to step.' },
  { id: 303, role: 'assistant', hidden: false, content: 'Wrenna follows Hooch and Dreg into the trees.' },
  { id: 304, role: 'assistant', hidden: false, content: 'Dreg travels with the group toward safety, carrying his strange phone.' },
  { id: 305, role: 'assistant', hidden: false, content: 'Harl keeps guiding the group toward Red Larch.' },
  { id: 306, role: 'assistant', hidden: false, content: 'Wrenna stays beside Dreg and Harl as they make camp with Hooch.' }
];
let generateCalls = [];
let generateHandler;
const tavo = {
  get(key) { return vars.has(key) ? vars.get(key) : null; },
  set(key, value) { vars.set(key, value); },
  unset(key) { vars.delete(key); },
  message: {
    async count() { return messages.length; },
    async find(range) { return Array.isArray(range) ? messages.slice(range[0], range[1] + 1) : []; }
  },
  chat: { async current() { return { persona: { name: 'Hooch' }, characters: [{ name: '[Faerûn]' }] }; } },
  async generate(prompt, options) { generateCalls.push({ prompt, options }); return generateHandler(prompt, options); },
  utils: { toast() {} }
};
const harness = {};
const context = {
  console, Math, Date, JSON, Object, Array, Set, Map, String, Number, Boolean, Promise, RegExp,
  tavo, __storyStateTestHarness: harness,
  document: {
    querySelector: getElement, querySelectorAll() { return []; }, documentElement: { style: {} }, body: dummyElement(),
    createElement() { return dummyElement(); }, execCommand() { return true; }
  },
  navigator: { clipboard: { async writeText() {} } },
  setInterval() { return 1; }, clearInterval() {}, setTimeout() { return 1; }, clearTimeout() {},
  confirm() { return true; }, prompt() { return null; }, FormData: function FormData() {}, Blob: function Blob() {},
  URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} }
};
const html = fs.readFileSync(path.join(__dirname, '..', 'ui', 'panel.html'), 'utf8');
const scripts = [...html.matchAll(/<script>\n([\s\S]*?)\n<\/script>/g)];
vm.runInNewContext(scripts.at(-1)[1], context, { filename: 'ui/panel.html' });

(async () => {
  const state = harness.newState();
  state.meta.lastScannedFloor = 5;
  state.meta.lastScannedMessageId = 306;
  state.npcs.push(
    harness.normalizeNpc({ name: 'Dreg', lastMeaningfulMessageId: 304 }),
    harness.normalizeNpc({ name: 'Harl', lastMeaningfulMessageId: 305 }),
    harness.normalizeNpc({ name: 'Wrenna', lastMeaningfulMessageId: 306 })
  );
  state.knowledgeItems.push(harness.normalizeKnowledgeItem({ statement: 'Hooch is from another world.', truth: 'UNKNOWN', sensitivity: 'PRIVATE', updatedBy: 'manual' }));
  vars.set('storyState.state', state);
  getElement('#ss-root').hidden = true;

  generateHandler = async (prompt, options) => {
    assert(prompt.includes("NPC profile enrichment pass"));
    assert(prompt.includes('Dreg') && prompt.includes('Wrenna') && prompt.includes('Harl'));
    assert.strictEqual(options.context, false);
    assert.strictEqual(options.settings.temperature, 0.1, 'Enrichment must use the normal scan temperature.');
    assert.strictEqual(options.settings.maxCompletionTokens, 5000, 'Enrichment must use the normal scan completion-token budget.');
    return JSON.stringify({
      npcProposals: [
        { action: 'update', name: 'Dreg', fields: { role: 'Goblin escape companion', currentMotive: 'Reach safety with the group' }, evidenceMessageIds: [301, 304] },
        { action: 'update', name: 'Harl', fields: { role: 'Trapper and guide', currentMotive: 'Guide the group toward Red Larch' }, evidenceMessageIds: [302, 305] },
        { action: 'update', name: 'Wrenna', fields: { role: 'Human escape companion', currentMotive: 'Reach safety with the other fugitives' }, evidenceMessageIds: [303, 306] }
      ],
      relationshipProposals: [{ action: 'create', sourceName: 'Dreg', targetType: 'protagonist', evidenceMessageIds: [301, 304] }],
      informationProposals: [{ action: 'create', key: 'should-be-ignored', statement: 'Ignored', truth: 'TRUE', sensitivity: 'NORMAL', evidenceMessageIds: [301] }],
      knowledgeProposals: [], arcProposals: []
    });
  };
  await harness.runNpcEnrichment();
  let enriched = harness.normalizeState(vars.get('storyState.state'));
  assert.strictEqual(generateCalls.length, 1, 'Enrichment should make exactly one focused model request.');
  assert.deepStrictEqual(Array.from(enriched.npcs.map(n => [n.name, n.role]).sort()), [
    ['Dreg', 'Goblin escape companion'], ['Harl', 'Trapper and guide'], ['Wrenna', 'Human escape companion']
  ]);
  assert(enriched.npcs.every(n => n.currentMotive), 'Enrichment should fill supported current motives.');
  assert.strictEqual(enriched.meta.lastScannedFloor, 5, 'Enrichment must not move the normal scan floor.');
  assert.strictEqual(enriched.meta.lastScannedMessageId, 306, 'Enrichment must not move the normal message cursor.');
  assert.strictEqual(enriched.relationships.length, 0, 'Enrichment must ignore relationship proposals.');
  assert.strictEqual(enriched.knowledgeItems.length, 1, 'Enrichment must not alter Knowledge.');
  assert.strictEqual(enriched.arcs.length, 0, 'Enrichment must not alter World Arcs.');
  assert(/NPC enrichment reviewed/.test(enriched.meta.lastScanSummary));

  // A provider failure during optional enrichment must not damage the already recovered identity/profile state.
  const snapshot = JSON.stringify(enriched.npcs);
  const cursor = [enriched.meta.lastScannedFloor, enriched.meta.lastScannedMessageId];
  generateHandler = async () => { throw new Error('simulated provider failure'); };
  await harness.runNpcEnrichment();
  enriched = harness.normalizeState(vars.get('storyState.state'));
  assert.strictEqual(generateCalls.length, 2, 'A second enrichment attempt may contact the provider once.');
  assert.strictEqual(JSON.stringify(enriched.npcs), snapshot, 'Provider failure must preserve recovered/enriched NPC profiles.');
  assert.deepStrictEqual([enriched.meta.lastScannedFloor, enriched.meta.lastScannedMessageId], cursor, 'Provider failure must preserve the normal scan cursor.');
  assert(enriched.diagnostics.some(d => /NPC enrichment failed: simulated provider failure/.test(d.message)), 'Provider failure should be visible in diagnostics.');

  console.log('StoryState recovered-NPC enrichment tests passed.');
})().catch((error) => { console.error(error); process.exit(1); });
