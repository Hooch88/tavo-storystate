const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function dummyElement() {
  const element = {
    hidden: false, value: '', checked: false, disabled: false, innerHTML: '', textContent: '',
    dataset: {}, style: {}, files: [],
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, removeEventListener() {}, scrollIntoView() {}, appendChild() {}, remove() {}, click() {}, reset() {}, closest() { return null; }
  };
  element.elements = new Proxy({}, { get(target, key) { if (!target[key]) { const child = dummyElement(); child.form = element; target[key] = child; } return target[key]; } });
  return element;
}
const elementMap = new Map();
function getElement(selector) { if (!elementMap.has(selector)) elementMap.set(selector, dummyElement()); return elementMap.get(selector); }
const variableStore = new Map();
const tavo = { get(name) { return variableStore.has(name) ? variableStore.get(name) : null; }, set(name, value) { variableStore.set(name, value); }, utils: { toast() {} } };
const harness = {};
const context = {
  console, Math, Date, JSON, Object, Array, Set, Map, String, Number, Boolean, Promise,
  tavo, __storyStateTestHarness: harness,
  document: { querySelector: getElement, querySelectorAll() { return []; }, documentElement: { style: {} }, body: dummyElement(), createElement() { return dummyElement(); } },
  setInterval() { return 1; }, clearInterval() {}, setTimeout(fn) { if (typeof fn === 'function') fn(); return 1; },
  confirm() { return true; }, prompt() { return null; }, FormData: function FormData() {}, Blob: function Blob() {},
  URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
};
const html = fs.readFileSync(path.join(__dirname, '..', 'ui', 'panel.html'), 'utf8');
const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
vm.runInNewContext(matches.at(-1)[1], context, { filename: 'ui/panel.html' });

const {
  newState, normalizeNpc, normalizeRelationship, applyExtractionProposals, parseExtractionResponse,
  buildExtractionPrompt, clampRelationshipTarget, evidenceLooksLikeResidence, evidenceLooksLikeResidenceMove
} = harness;

function mapMessages(messages) { return new Map(messages.map(m => [m.id, m])); }
function plain(v) { return JSON.parse(JSON.stringify(v)); }

// JSON parser tolerates common fenced output but still requires one JSON object.
{
  const parsed = parseExtractionResponse('```json\n{"npcProposals":[],"relationshipProposals":[]}\n```');
  assert.deepStrictEqual(plain(parsed), { npcProposals: [], relationshipProposals: [], informationProposals: [], knowledgeProposals: [], arcProposals: [] });
  assert.throws(() => parseExtractionResponse('not json'), /JSON object/);
}

// Residence safeguard: presence is not residence; explicit living evidence is.
{
  const presence = mapMessages([{ id: 10, role: 'assistant', content: 'Kendra waits inside Room 308 while Dakota knocks.' }]);
  const explicit = mapMessages([{ id: 11, role: 'assistant', content: 'Kendra lives in Room 308 with her roommate.' }]);
  assert.strictEqual(evidenceLooksLikeResidence([10], presence), false, 'Mere presence in a room must not establish residence.');
  assert.strictEqual(evidenceLooksLikeResidence([11], explicit), true, 'Explicit lives-in evidence should permit residence.');
  const moved = mapMessages([{ id: 12, role: 'assistant', content: 'Kendra moved into Room 412 and now lives there with a new roommate.' }]);
  assert.strictEqual(evidenceLooksLikeResidenceMove([12], moved), true, 'Explicit move evidence should permit a later residence change.');
}

// Recurring admission needs two distinct evidence messages.
{
  const state = newState();
  const one = mapMessages([{ id: 20, role: 'assistant', content: 'Mara waves from the doorway.' }]);
  let result = applyExtractionProposals(state, {
    npcProposals: [{ action: 'create', name: 'Mara Bell', admissionReason: 'recurring', evidenceMessageIds: [20], fields: {} }],
    relationshipProposals: []
  }, one, new Set());
  assert.strictEqual(state.npcs.length, 0);
  assert(result.skipped.some(x => /two evidence/i.test(x)));

  const two = mapMessages([
    { id: 20, role: 'assistant', content: 'Mara Bell waves from the doorway.' },
    { id: 21, role: 'assistant', content: 'Later, Mara Bell returns and joins the conversation.' }
  ]);
  result = applyExtractionProposals(state, {
    npcProposals: [{ action: 'create', name: 'Mara Bell', admissionReason: 'recurring', evidenceMessageIds: [20, 21], fields: { role: 'Resident assistant' } }],
    relationshipProposals: []
  }, two, new Set());
  assert.strictEqual(state.npcs.length, 1);
  assert.strictEqual(state.npcs[0].createdBy, 'extraction');
  assert.strictEqual(state.npcs[0].updatedBy, 'extraction');
}

// Reserved entities cannot become NPCs even if the model proposes them.
{
  const state = newState();
  const messages = mapMessages([{ id: 30, role: 'assistant', content: 'Tavo displays the chat.' }]);
  const result = applyExtractionProposals(state, {
    npcProposals: [{ action: 'create', name: 'Tavo', admissionReason: 'obvious_recurring_or_major', evidenceMessageIds: [30], fields: {} }],
    relationshipProposals: []
  }, messages, new Set(['tavo']));
  assert.strictEqual(state.npcs.length, 0);
  assert(result.skipped.some(x => /reserved/i.test(x)));
}

// Manual stable NPC canon is never overwritten; dynamic motive may still advance.
{
  const state = newState();
  state.npcs.push(normalizeNpc({
    id: 'npc-k', name: 'Kendra Marsh', role: 'Student', currentMotive: 'Get ice cream',
    manualOverrides: ['role'], createdBy: 'manual', updatedBy: 'manual'
  }));
  const messages = mapMessages([{ id: 40, role: 'assistant', content: 'Kendra decides to confront Priya about the rumor.' }]);
  applyExtractionProposals(state, {
    npcProposals: [{ action: 'update', npcId: 'npc-k', name: 'Kendra Marsh', evidenceMessageIds: [40], aliases: [], fields: { role: 'Influencer', currentMotive: 'Confront Priya about the rumor' } }],
    relationshipProposals: []
  }, messages, new Set());
  assert.strictEqual(state.npcs[0].role, 'Student');
  assert.strictEqual(state.npcs[0].currentMotive, 'Confront Priya about the rumor');
  assert.strictEqual(state.npcs[0].updatedBy, 'extraction');
}

// An extracted residence may change only with explicit move evidence; a manual residence remains locked.
{
  const state = newState();
  state.npcs.push(normalizeNpc({ id: 'npc-r', name: 'Reagan Mercer', residence: 'Room 308', residenceSourceMessageId: 50, createdBy: 'extraction', updatedBy: 'extraction' }));
  let messages = mapMessages([{ id: 60, role: 'assistant', content: 'Reagan spends the evening in Room 412 with friends.' }]);
  applyExtractionProposals(state, { npcProposals: [{ action: 'update', npcId: 'npc-r', name: 'Reagan Mercer', evidenceMessageIds: [60], fields: { residence: 'Room 412' } }], relationshipProposals: [] }, messages, new Set());
  assert.strictEqual(state.npcs[0].residence, 'Room 308', 'Presence elsewhere must not move residence.');
  messages = mapMessages([{ id: 61, role: 'assistant', content: 'Reagan moved into Room 412 and now lives there.' }]);
  applyExtractionProposals(state, { npcProposals: [{ action: 'update', npcId: 'npc-r', name: 'Reagan Mercer', evidenceMessageIds: [61], fields: { residence: 'Room 412' } }], relationshipProposals: [] }, messages, new Set());
  assert.strictEqual(state.npcs[0].residence, 'Room 412', 'Explicit move evidence should update an extracted residence.');
}

// Relationship updates are bounded to +/-2 and old evidence cannot override a newer manual correction.
{
  const state = newState();
  state.config.relationshipPreset = 'dating';
  state.config.optionalThirdAxis = true;
  state.npcs.push(normalizeNpc({ id: 'npc-k', name: 'Kendra Marsh' }));
  state.relationships.push(normalizeRelationship({
    id: 'rel-kd', sourceNpcId: 'npc-k', targetType: 'protagonist',
    axes: { Trust: 2, Affinity: 2, Attraction: 2 }, manualAuthorityThroughMessageId: 100, updatedBy: 'manual'
  }, state.config));

  let messages = mapMessages([{ id: 90, role: 'assistant', content: 'Kendra smiles at Dakota.' }]);
  let result = applyExtractionProposals(state, { npcProposals: [], relationshipProposals: [{
    action: 'update', sourceNpcId: 'npc-k', sourceName: 'Kendra Marsh', targetType: 'protagonist',
    axisTargets: { Trust: 10, Affinity: 10, Attraction: 10 }, evidenceMessageIds: [90]
  }] }, messages, new Set());
  assert.deepStrictEqual(plain(state.relationships[0].axes), { Trust: 2, Affinity: 2, Attraction: 2 });
  assert(result.skipped.some(x => /manual state/i.test(x)));

  messages = mapMessages([{ id: 110, role: 'assistant', content: 'Kendra openly reconciles with Dakota and asks him to stay.' }]);
  result = applyExtractionProposals(state, { npcProposals: [], relationshipProposals: [{
    action: 'update', sourceNpcId: 'npc-k', sourceName: 'Kendra Marsh', targetType: 'protagonist',
    axisTargets: { Trust: 10, Affinity: 10, Attraction: 10 }, evidenceMessageIds: [110]
  }] }, messages, new Set());
  assert.deepStrictEqual(plain(state.relationships[0].axes), { Trust: 4, Affinity: 4, Attraction: 4 }, 'Even extreme model targets must move at most +2 per scan.');
  assert.strictEqual(state.relationships[0].updatedBy, 'extraction');
  assert.strictEqual(state.relationships[0].lastMeaningfulChangeMessageId, 110);
}

// NPC->NPC edges are directional and can be created independently.
{
  const state = newState();
  state.npcs = [normalizeNpc({ id: 'npc-k', name: 'Kendra Marsh' }), normalizeNpc({ id: 'npc-p', name: 'Priya Shah' })];
  const messages = mapMessages([{ id: 120, role: 'assistant', content: 'Kendra distrusts Priya after catching her spreading the rumor.' }]);
  applyExtractionProposals(state, { npcProposals: [], relationshipProposals: [{
    action: 'create', sourceNpcId: 'npc-k', sourceName: 'Kendra Marsh', targetType: 'npc', targetNpcId: 'npc-p', targetName: 'Priya Shah',
    axisTargets: { Trust: 2, Affinity: 3 }, relationshipStatus: 'Rivals', stanceSummary: 'Kendra is wary of Priya.', evidenceMessageIds: [120]
  }] }, messages, new Set());
  assert.strictEqual(state.relationships.length, 1);
  assert.strictEqual(state.relationships[0].sourceNpcId, 'npc-k');
  assert.strictEqual(state.relationships[0].targetNpcId, 'npc-p');
  assert.strictEqual(state.relationships.some(r => r.sourceNpcId === 'npc-p' && r.targetNpcId === 'npc-k'), false, 'Reverse feelings must never be inferred automatically.');
}

// The extraction prompt codifies the important safety/behavior rules.
{
  const state = newState();
  state.npcs.push(normalizeNpc({ id: 'npc-k', name: 'Kendra Marsh' }));
  const prompt = buildExtractionPrompt(state, [{ id: 200, role: 'assistant', content: 'Kendra enters the lounge.' }], { persona: { name: 'Dakota' }, characters: [{ name: 'Narrator' }] });
  assert(/Tavo is the app name, never a person/.test(prompt));
  assert(/Most scenes cause NO score change/.test(prompt));
  assert(/mere presence at a location is not residence/i.test(prompt));
  assert(/Never infer Protagonist→NPC feelings/.test(prompt));
}

assert.strictEqual(clampRelationshipTarget(2, 10), 4);
assert.strictEqual(clampRelationshipTarget(8, 0), 6);

const entrySource = fs.readFileSync(path.join(__dirname, '..', 'entry.js'), 'utf8');
assert(entrySource.includes('<!-- TVL_VISUAL_REFERENCE -->'), 'Visual Library utility bubbles must not advance StoryState scan cadence.');

console.log('StoryState Phase 2 extraction tests passed.');
