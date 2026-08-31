const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function dummyElement() {
  const element = {
    hidden: true, value: '', checked: false, disabled: false, innerHTML: '', textContent: '',
    dataset: {}, style: {}, files: [], parentElement: null,
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
const emptyExtraction = () => ({ npcProposals: [], relationshipProposals: [], informationProposals: [], knowledgeProposals: [], arcProposals: [] });
const companionExtraction = () => ({
  npcProposals: [
    { action: 'create', name: 'Dreg', admissionReason: 'recurring', evidenceMessageIds: [301, 304], fields: { role: 'Escape companion', currentMotive: 'Reach safety with the group' } },
    { action: 'create', name: 'Harl', admissionReason: 'recurring', evidenceMessageIds: [302, 305], fields: { role: 'Traveling companion', currentMotive: 'Guide the group toward safety' } },
    { action: 'create', name: 'Wrenna', admissionReason: 'recurring', evidenceMessageIds: [303, 306], fields: { role: 'Traveling companion', currentMotive: 'Stay alive and reach safety' } }
  ],
  relationshipProposals: [], informationProposals: [], knowledgeProposals: [], arcProposals: []
});
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
    if (generateMode === 'repair-empty') {
      if (/Repair the following StoryState extractor output/.test(prompt)) return JSON.stringify(emptyExtraction());
      return '{"npcProposals": [';
    }
    if (generateMode === 'companions') return JSON.stringify(companionExtraction());
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

  // Regression: malformed output repaired into empty arrays must NOT consume the scan batch.
  messages = [
    { id: 201, role: 'assistant', hidden: false, content: 'Dreg watches the camp while Wrenna whispers to Dakota.' },
    { id: 202, role: 'assistant', hidden: false, content: 'Dreg returns with Wrenna and prepares to travel with Dakota.' }
  ];
  vars.delete('storyState.scanRequest');
  vars.delete('storyState.scanProgress');
  const repairedState = harness.newState();
  repairedState.config.updateMode = 'assisted';
  vars.set('storyState.state', repairedState);
  generateMode = 'repair-empty';
  const repairCallsBefore = generateCalls.length;
  await harness.runExtractionScan({ type: 'scan', mode: 'manual' });
  const repairedEmpty = harness.normalizeState(vars.get('storyState.state'));
  assert.strictEqual(generateCalls.length - repairCallsBefore, 2, 'Malformed extraction should use exactly one bounded repair call.');
  assert.strictEqual(repairedEmpty.meta.scanStatus, 'error', 'Repaired-empty extraction must pause instead of being accepted.');
  assert.strictEqual(repairedEmpty.meta.lastScannedFloor, null, 'Repaired-empty extraction must not advance the scan floor.');
  assert.strictEqual(repairedEmpty.meta.lastScannedMessageId, null, 'Repaired-empty extraction must not advance the message cursor.');
  assert(/repaired response contained no proposals/i.test(repairedEmpty.meta.lastScanSummary));

  // Regression based on the fresh Faerun story: NPC recovery is fully local and can recover
  // recurring companions from consumed history without calling the model or touching other state.
  messages = [
    { id: 301, role: 'assistant', hidden: false, content: 'Dreg answers Dakota and stays close as the captives plan their escape.' },
    { id: 302, role: 'assistant', hidden: false, content: 'Harl takes the lead down the slope and tells the fugitives where to step.' },
    { id: 303, role: 'assistant', hidden: false, content: 'Wrenna follows Dakota and Dreg into the trees.' },
    { id: 304, role: 'assistant', hidden: false, content: 'Dreg travels with the group toward safety.' },
    { id: 305, role: 'assistant', hidden: false, content: 'Harl keeps guiding the four fugitives along the road.' },
    { id: 306, role: 'assistant', hidden: false, content: 'Wrenna stays with Dreg and Harl as the fugitives make camp together.' }
  ];
  vars.delete('storyState.scanRequest');
  vars.delete('storyState.scanProgress');
  const consumed = harness.newState();
  consumed.meta.lastScannedFloor = 5;
  consumed.meta.lastScannedMessageId = 306;
  consumed.meta.lastScanAt = new Date().toISOString();
  consumed.knowledgeItems.push(harness.normalizeKnowledgeItem({ statement: 'Dakota is from another world.', truth: 'UNKNOWN', sensitivity: 'PRIVATE', updatedBy: 'manual' }));
  vars.set('storyState.state', consumed);
  const backfillCallsBefore = generateCalls.length;
  await harness.runNpcBackfill();
  const backfilled = harness.normalizeState(vars.get('storyState.state'));
  assert.strictEqual(generateCalls.length - backfillCallsBefore, 0, 'NPC recovery must never call the model.');
  assert.deepStrictEqual(Array.from(backfilled.npcs.map((npc) => npc.name).sort()), ['Dreg', 'Harl', 'Wrenna']);
  assert.strictEqual(backfilled.meta.lastScannedFloor, 5, 'NPC recovery must preserve the normal scan floor.');
  assert.strictEqual(backfilled.meta.lastScannedMessageId, 306, 'NPC recovery must preserve the normal message cursor.');
  assert.strictEqual(backfilled.relationships.length, 0, 'NPC recovery must not create relationships.');
  assert.strictEqual(backfilled.knowledgeItems.length, 1, 'NPC recovery must not alter knowledge.');
  assert.strictEqual(backfilled.arcs.length, 0, 'NPC recovery must not create arcs.');
  assert(/No model request was used/.test(backfilled.meta.lastScanSummary));
  assert(/Normal scan cursor unchanged/.test(backfilled.meta.lastScanSummary));

  console.log('StoryState Phase 2 extraction-run integration tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
