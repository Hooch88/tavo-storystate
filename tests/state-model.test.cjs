const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function dummyElement() {
  const element = {
    hidden: false,
    value: '',
    checked: false,
    disabled: false,
    innerHTML: '',
    textContent: '',
    dataset: {},
    style: {},
    files: [],
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {},
    removeEventListener() {},
    scrollIntoView() {},
    appendChild() {},
    remove() {},
    click() {},
    reset() {},
    closest() { return null; },
  };
  element.elements = new Proxy({}, {
    get(target, key) {
      if (!target[key]) {
        const child = dummyElement();
        child.form = element;
        target[key] = child;
      }
      return target[key];
    }
  });
  return element;
}

const elementMap = new Map();
function getElement(selector) {
  if (!elementMap.has(selector)) elementMap.set(selector, dummyElement());
  return elementMap.get(selector);
}

const variableStore = new Map();
const tavo = {
  get(name) { return variableStore.has(name) ? variableStore.get(name) : null; },
  set(name, value) { variableStore.set(name, value); },
  utils: { toast() {} }
};

const harness = {};
const context = {
  console,
  Math,
  Date,
  JSON,
  Object,
  Array,
  Set,
  Map,
  String,
  Number,
  Boolean,
  Promise,
  tavo,
  __storyStateTestHarness: harness,
  document: {
    querySelector: getElement,
    querySelectorAll() { return []; },
    documentElement: { style: {} },
    body: dummyElement(),
    createElement() { return dummyElement(); }
  },
  setInterval() { return 1; },
  clearInterval() {},
  setTimeout(fn) { if (typeof fn === 'function') fn(); return 1; },
  confirm() { return true; },
  prompt() { return null; },
  FormData: function FormData() {},
  Blob: function Blob() {},
  URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
};

const html = fs.readFileSync(path.join(__dirname, '..', 'ui', 'panel.html'), 'utf8');
const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (!matches.length) throw new Error('No panel script found.');
vm.runInNewContext(matches.at(-1)[1], context, { filename: 'ui/panel.html' });

const {
  SCHEMA_VERSION,
  newState,
  normalizeState,
  normalizeNpc,
  normalizeRelationship,
  relationshipAxisNames,
  validateRelationship,
  mergeNpcRecords,
  migrateLivingWorldState,
  markManualChanges,
  relationshipEdgeKey,
} = harness;

assert.strictEqual(SCHEMA_VERSION, 2, 'Phase 1 schema should be v2.');

{
  const state = newState();
  assert.strictEqual(state.config.updateMode, 'manual');
  assert.strictEqual(state.config.contextInjectionEnabled, false);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(relationshipAxisNames('general', false))), ['Trust', 'Affinity']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(relationshipAxisNames('dating', true))), ['Trust', 'Attraction', 'Investment']);
}

{
  const oldScaffold = {
    schemaVersion: 1,
    revision: 3,
    config: { relationshipPreset: 'general', contextInjectionEnabled: false },
    npcs: [{ id: 'npc-a', name: 'Reagan Mercer', role: 'Student' }],
    relationships: [],
    arcs: []
  };
  const normalized = normalizeState(oldScaffold);
  assert.strictEqual(normalized.schemaVersion, 2);
  assert.strictEqual(normalized.npcs[0].id, 'npc-a');
  assert.strictEqual(normalized.npcs[0].name, 'Reagan Mercer');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(normalized.npcs[0].aliases)), []);
}

{
  const relationship = normalizeRelationship({
    id: 'rel-1', sourceNpcId: 'npc-a', targetType: 'protagonist', axisPreset: 'dating',
    thirdAxisEnabled: true, axes: { Trust: 8, Attraction: 7, Investment: 4 }
  }, { relationshipPreset: 'general', optionalThirdAxis: false });
  assert.strictEqual(relationship.axisPreset, 'dating', 'Existing edge keeps its own preset.');
  assert.strictEqual(relationship.axes.Attraction, 7);
  assert.strictEqual(relationship.axes.Investment, 4);
}

{
  const state = newState();
  state.npcs = [normalizeNpc({ id: 'npc-a', name: 'A' }), normalizeNpc({ id: 'npc-b', name: 'B' })];
  const aToProtagonist = normalizeRelationship({ id: 'rel-a', sourceNpcId: 'npc-a', targetType: 'protagonist' }, state.config);
  const aToB = normalizeRelationship({ id: 'rel-b', sourceNpcId: 'npc-a', targetType: 'npc', targetNpcId: 'npc-b' }, state.config);
  assert.doesNotThrow(() => validateRelationship(state, aToProtagonist));
  assert.doesNotThrow(() => validateRelationship(state, aToB));
  const invalidSource = normalizeRelationship({ sourceNpcId: 'protagonist', targetType: 'protagonist' }, state.config);
  assert.throws(() => validateRelationship(state, invalidSource), /source must be an active NPC/i);
  const self = normalizeRelationship({ sourceNpcId: 'npc-a', targetType: 'npc', targetNpcId: 'npc-a' }, state.config);
  assert.throws(() => validateRelationship(state, self), /itself/i);
}

{
  const freshManual = normalizeNpc({ id: 'npc-new', name: 'New NPC', role: '', residence: 'Room 308' });
  const locks = markManualChanges(null, freshManual);
  assert(locks.includes('name'));
  assert(locks.includes('residence'));
  assert(!locks.includes('role'), 'Blank fields on a manually created NPC must remain fillable by later extraction.');
  assert(!locks.includes('currentMotive'), 'Dynamic motive must never become a permanent manual lock.');
}

{
  const existing = normalizeNpc({ id: 'npc-a', name: 'Reagan', residence: 'Room 308' });
  const changed = normalizeNpc({ ...existing, name: 'Reagan Mercer', residence: 'Room 309' });
  const locks = markManualChanges(existing, changed);
  assert(locks.includes('name'));
  assert(locks.includes('residence'));
  assert(!locks.includes('role'));
}

{
  const legacy = {
    schemaVersion: 3,
    config: { characterEnabled: true, worldEnabled: true, relationshipPreset: 'general', optionalThirdAxis: false, updateMode: 'assisted' },
    npcs: [
      {
        id: 'npc-reagan', name: 'Reagan Mercer', role: 'Student', residence: 'Room 308', residenceSourceMessageId: 123,
        appearanceAnchor: 'Tall, copper-red hair', communicationSignature: 'Dry and concise', pressureResponse: 'Withdraws', coreValue: 'Independence',
        currentMotive: 'Test the protagonist', contradiction: 'Wants closeness but dislikes dependence', currentStance: 'Cautious',
        relationship: { axes: { Trust: 4, Affinity: 6 }, condition: 'repairing', evidence: [{ text: 'Caught a lie', sourceMessageId: 207 }] },
        lastMeaningfulMessageId: 207, status: 'active'
      },
      {
        id: 'npc-clerk', name: 'Desk Clerk', role: 'Clerk', relationship: { axes: { Trust: 5, Affinity: 5 }, condition: '', evidence: [] }, status: 'active'
      }
    ],
    arcs: [{ id: 'arc-1', title: 'Dorm dispute', status: 'active' }],
    meta: { lastScannedMessageId: 220 }
  };
  const migrated = migrateLivingWorldState(legacy);
  assert.strictEqual(migrated.npcs.length, 2);
  assert.strictEqual(migrated.relationships.length, 1, 'Neutral default legacy relationship should not create noise.');
  assert.strictEqual(migrated.relationships[0].sourceNpcId, 'npc-reagan');
  assert.strictEqual(migrated.relationships[0].targetType, 'protagonist');
  assert.strictEqual(migrated.relationships[0].stanceSummary, 'Cautious');
  assert.strictEqual(migrated.npcs[0].residence, 'Room 308');
  assert.strictEqual(migrated.npcs[0].residenceSourceMessageId, 123);
  assert.strictEqual(migrated.config.updateMode, 'manual', 'Migration must not activate unfinished extraction.');
  assert.strictEqual(migrated.config.contextInjectionEnabled, false);
  assert.strictEqual(migrated.arcs.length, 1);
}

{
  const state = newState();
  state.npcs = [
    normalizeNpc({ id: 'npc-primary', name: 'Rosario Castellano', aliases: ['Rosario'], residence: 'Room 305' }),
    normalizeNpc({ id: 'npc-dupe', name: 'Ros', aliases: ['R. Castellano'], communicationSignature: 'Practical and grounded' }),
    normalizeNpc({ id: 'npc-third', name: 'Sadie' })
  ];
  state.relationships = [
    normalizeRelationship({ id: 'rel-1', sourceNpcId: 'npc-primary', targetType: 'npc', targetNpcId: 'npc-third', axes: { Trust: 6, Affinity: 5 }, evidence: [{ text: 'Primary evidence', sourceMessageId: 10 }], lastMeaningfulChangeMessageId: 10 }, state.config),
    normalizeRelationship({ id: 'rel-2', sourceNpcId: 'npc-dupe', targetType: 'npc', targetNpcId: 'npc-third', axes: { Trust: 8, Affinity: 7 }, evidence: [{ text: 'Newer evidence', sourceMessageId: 20 }], lastMeaningfulChangeMessageId: 20 }, state.config),
    normalizeRelationship({ id: 'rel-self-after-merge', sourceNpcId: 'npc-third', targetType: 'npc', targetNpcId: 'npc-dupe' }, state.config)
  ];
  mergeNpcRecords(state, 'npc-primary', 'npc-dupe');
  const primary = state.npcs.find((npc) => npc.id === 'npc-primary');
  const duplicate = state.npcs.find((npc) => npc.id === 'npc-dupe');
  assert.strictEqual(duplicate.status, 'archived');
  assert.strictEqual(duplicate.mergedIntoNpcId, 'npc-primary');
  assert(primary.aliases.some((alias) => alias === 'Ros'));
  assert.strictEqual(primary.communicationSignature, 'Practical and grounded');
  const edgesToSadie = state.relationships.filter((rel) => rel.status === 'active' && relationshipEdgeKey(rel) === 'npc-primary::npc::npc-third');
  assert.strictEqual(edgesToSadie.length, 1, 'Duplicate relationship edges should merge after NPC merge.');
  assert.strictEqual(edgesToSadie[0].axes.Trust, 8, 'Newer relationship state should win when duplicate edges merge.');
  assert.strictEqual(edgesToSadie[0].evidence.length, 2, 'Evidence should be combined within cap.');
  const reverse = state.relationships.find((rel) => rel.id === 'rel-self-after-merge');
  assert(reverse && reverse.targetNpcId === 'npc-primary', 'Third-party edge should re-key duplicate target to primary.');
}

console.log('StoryState Phase 1 state-model tests passed.');
