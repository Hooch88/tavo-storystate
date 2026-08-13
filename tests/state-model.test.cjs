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
assert(!html.includes('name="axisPreset"'), 'Relationship editor must not expose per-edge axis presets.');
assert(!html.includes('name="thirdAxisEnabled"'), 'Relationship editor must not expose per-edge third-axis mode.');
assert(html.includes('id="ss-chat-preset"'), 'Chat settings must own the relationship preset.');
assert(html.includes('id="ss-chat-third-axis"'), 'Chat settings must own third-axis mode.');
assert(html.includes('id="ss-context-injection"'), 'Chat settings must expose narrator influence.');
assert(html.includes('name="relationshipStatus"'), 'Relationship editor must expose structural Relationship Status.');
assert(!html.includes('name="condition"'), 'Legacy free-form Condition control must be removed.');
assert(html.includes('.ss-form [hidden]'), 'Author CSS must honor hidden relationship controls.');
assert(html.includes('id="ss-prepare-handoff"'), 'Settings must expose Prepare new session.');
assert(html.includes('id="ss-handoff-list"'), 'Settings must expose prepared global handoffs.');
assert(html.includes('name="continuationBrief"'), 'Session handoff must accept an immediate continuation brief.');
assert(html.includes('lastCommandNonce=String(initialCommand?.nonce||"")'), 'Startup must prime the last UI-command nonce so stale open commands are not replayed.');
assert(html.includes('com.hooch88.tavo.campaignIdentity'), 'StoryState must publish a stable cross-plugin campaign identity key.');
assert(html.includes('tavo.set(UI_COMMAND_KEY,null,"chat")'), 'Consumed StoryState UI open commands should be cleared.');
vm.runInNewContext(matches.at(-1)[1], context, { filename: 'ui/panel.html' });

const {
  SCHEMA_VERSION,
  newState,
  normalizeState,
  normalizeNpc,
  normalizeRelationship,
  relationshipAxisNames,
  relationshipAxesForConfig,
  remapRelationshipAxes,
  applyRelationshipModel,
  validateRelationship,
  mergeNpcRecords,
  migrateLivingWorldState,
  markManualChanges,
  relationshipEdgeKey,
  normalizeRelationshipStatus,
  migrateLegacyCondition,
  updateTargetVisibility,
  normalizeCampaign,
  normalizeHandoffRegistry,
  createHandoffRecord,
  buildContinuationState,
  detachSessionMessageReferences,
  stateHasMeaningfulData,
  CONTINUATION_GENERATIONS,
} = harness;

function clone(value) { return JSON.parse(JSON.stringify(value)); }

assert.strictEqual(SCHEMA_VERSION, 7, 'Phase 2 extraction schema should be v7.');

{
  const form = dummyElement();
  form.elements.targetType.value = 'protagonist';
  form.elements.targetNpcId.value = 'npc-b';
  updateTargetVisibility(form);
  assert.strictEqual(getElement('[data-npc-target]').hidden, true, 'Target NPC field must hide for Protagonist target.');
  assert.strictEqual(form.elements.targetNpcId.disabled, true, 'Target NPC selector must be disabled for Protagonist target.');
  assert.strictEqual(form.elements.targetNpcId.value, '', 'Switching to Protagonist must clear stale NPC target selection.');
}

{
  const state = newState();
  assert.strictEqual(state.config.updateMode, 'assisted');
  assert.strictEqual(state.config.contextInjectionEnabled, true);
  assert(state.campaign.id.startsWith('campaign-'), 'A new chat should receive a stable campaign id.');
  assert.strictEqual(state.campaign.name, 'Campaign');
  assert.strictEqual(state.campaign.sessionNumber, 1);
  assert.strictEqual(state.campaign.continuationActive, false);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(relationshipAxisNames('general', false))), ['Trust', 'Affinity']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(relationshipAxisNames('dating', true))), ['Trust', 'Affinity', 'Attraction']);
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
  assert.strictEqual(normalized.schemaVersion, 7);
  assert.strictEqual(normalized.npcs[0].id, 'npc-a');
  assert.strictEqual(normalized.npcs[0].name, 'Reagan Mercer');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(normalized.npcs[0].aliases)), []);
  assert.strictEqual(normalized.config.contextInjectionEnabled, true, 'Pre-v4 chats should enable narrator influence on upgrade.');
}

{
  const upgradedV6 = normalizeState({ schemaVersion: 6, config: { contextInjectionEnabled: false, updateMode: 'manual' } });
  assert.strictEqual(upgradedV6.config.contextInjectionEnabled, false, 'A v6 user choice to disable narrator influence must persist.');
  assert.strictEqual(upgradedV6.config.updateMode, 'assisted', 'Pre-v7 chats should enable Phase 2 assisted extraction on upgrade.');
  const manualV7 = normalizeState({ schemaVersion: 7, config: { updateMode: 'manual' } });
  assert.strictEqual(manualV7.config.updateMode, 'manual', 'A v7 user choice to use Manual scanning must persist.');
}

{
  const relationship = normalizeRelationship({
    id: 'rel-1', sourceNpcId: 'npc-a', targetType: 'protagonist', axisPreset: 'dating',
    thirdAxisEnabled: true, axes: { Trust: 8, Attraction: 7, Investment: 4 }
  }, { relationshipPreset: 'general', optionalThirdAxis: false });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(relationship.axes)), { Trust: 8, Affinity: 5 }, 'Chat config, not edge metadata, owns active axes.');
  assert.strictEqual('axisPreset' in relationship, false, 'Relationship record must not own a preset.');
  assert.strictEqual('thirdAxisEnabled' in relationship, false, 'Relationship record must not own third-axis mode.');
}

{
  const v2 = normalizeState({
    schemaVersion: 2,
    config: { relationshipPreset: 'dating', optionalThirdAxis: true },
    npcs: [{ id: 'npc-a', name: 'A' }],
    relationships: [{
      id: 'rel-old', sourceNpcId: 'npc-a', targetType: 'protagonist',
      axisPreset: 'dating', thirdAxisEnabled: true,
      axes: { Trust: 8, Attraction: 7, Investment: 4 }
    }]
  });
  assert.strictEqual(v2.schemaVersion, 7);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(v2.relationships[0].axes)), { Trust: 8, Affinity: 5, Attraction: 7 }, 'v2 migration should honor the chat model and preserve same-named values.');
  assert.strictEqual('axisPreset' in v2.relationships[0], false);
  assert(v2.diagnostics.some((d) => /chat-wide axis model/i.test(d.text)), 'v2 migration should record a diagnostic.');
}

{
  const structural = normalizeRelationship({
    id: 'rel-status', sourceNpcId: 'npc-a', targetType: 'protagonist',
    axes: { Trust: 5, Affinity: 5 }, condition: 'dating', stanceSummary: ''
  }, { relationshipPreset: 'general', optionalThirdAxis: false });
  assert.strictEqual(structural.relationshipStatus, 'Dating', 'Recognized legacy structural conditions should migrate to Relationship Status.');
  assert.strictEqual(structural.stanceSummary, '');
  assert.strictEqual('condition' in structural, false, 'Condition must not survive in the v5 record.');

  const emotional = normalizeRelationship({
    id: 'rel-love', sourceNpcId: 'npc-a', targetType: 'protagonist',
    axes: { Trust: 1, Affinity: 1 }, condition: 'love', stanceSummary: 'Guarded after an argument'
  }, { relationshipPreset: 'general', optionalThirdAxis: false });
  assert.strictEqual(emotional.relationshipStatus, '', 'Emotional legacy conditions must not masquerade as structural status.');
  assert(/Legacy relationship note: love/.test(emotional.stanceSummary), 'Unrecognized legacy condition should migrate into Stance Summary without data loss.');
  assert.strictEqual(normalizeRelationshipStatus('close FRIENDS'), 'Close friends');
}

{
  const state = newState();
  state.config.relationshipPreset = 'general';
  state.config.optionalThirdAxis = true;
  state.npcs = [normalizeNpc({ id: 'npc-a', name: 'A' })];
  state.relationships = [normalizeRelationship({
    id: 'rel-a', sourceNpcId: 'npc-a', targetType: 'protagonist',
    axes: { Trust: 8, Affinity: 6, Respect: 7 }
  }, state.config)];
  assert.deepStrictEqual(JSON.parse(JSON.stringify(relationshipAxesForConfig(state.config))), ['Trust', 'Affinity', 'Respect']);
  applyRelationshipModel(state, 'dating', true);
  assert.strictEqual(state.config.relationshipPreset, 'dating');
  assert.strictEqual(state.relationships[0].axes.Trust, 8);
  assert.strictEqual(state.relationships[0].axes.Affinity, 6);
  assert.strictEqual(state.relationships[0].axes.Attraction, 5, 'Newly introduced axis resets to neutral rather than inheriting unrelated meaning.');
  assert.strictEqual('Respect' in state.relationships[0].axes, false);
  applyRelationshipModel(state, 'dating', false);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(state.relationships[0].axes)), { Trust: 8, Affinity: 6 });
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
  assert.strictEqual(migrated.relationships[0].relationshipStatus, '', 'Legacy non-structural condition should not become Relationship Status.');
  assert(/Cautious/.test(migrated.relationships[0].stanceSummary));
  assert(/Legacy relationship note: repairing/.test(migrated.relationships[0].stanceSummary));
  assert.strictEqual(migrated.npcs[0].residence, 'Room 308');
  assert.strictEqual(migrated.npcs[0].residenceSourceMessageId, 123);
  assert.strictEqual(migrated.config.updateMode, 'manual', 'Migration must not activate unfinished extraction.');
  assert.strictEqual(migrated.config.contextInjectionEnabled, true);
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

{
  const panelSource = fs.readFileSync(path.join(__dirname, '..', 'ui', 'panel.html'), 'utf8');
  const entrySource = fs.readFileSync(path.join(__dirname, '..', 'entry.js'), 'utf8');
  const definitions = [
    "Willingness to believe, rely on, and be vulnerable with the target.",
    "How much the NPC likes the target and enjoys their company; warmth and goodwill, not romance by itself.",
    "How highly the NPC regards the target's judgment, competence, character, or standing.",
    "Romantic or physical pull toward the target; it does not imply affection, trust, consent, or obedience.",
    "Willingness to remain aligned with, defend, or prioritize the target when doing so has a cost; it does not imply obedience."
  ];
  for (const definition of definitions) {
    assert(panelSource.includes(definition), `Panel must expose canonical axis definition: ${definition}`);
    assert(entrySource.includes(definition), `Narrator injection must use canonical axis definition: ${definition}`);
  }
  assert(panelSource.includes('Scale: 0 = very low, 5 = neutral / uncertain, 10 = very high.'), 'UI must explain the relationship axis scale.');
}


{
  const source = newState();
  source.revision = 14;
  source.campaign = normalizeCampaign({ id: 'campaign-omega', name: 'Whitmore', sessionNumber: 3, startedAt: '2026-08-01T00:00:00.000Z' });
  source.npcs = [normalizeNpc({
    id: 'npc-kendra', name: 'Kendra Marsh', residence: 'Room 308',
    residenceSourceMessageId: 91, lastMeaningfulMessageId: 102
  })];
  source.relationships = [normalizeRelationship({
    id: 'rel-kd', sourceNpcId: 'npc-kendra', targetType: 'protagonist',
    axes: { Trust: 8, Affinity: 9 }, relationshipStatus: 'Dating',
    evidence: [{ text: 'Kendra kissed Dakota in public.', sourceMessageId: 99 }],
    lastMeaningfulChangeMessageId: 99
  }, source.config)];
  source.knowledgeItems = [{ id: 'info-1', statement: 'The dean resigned.', sourceMessageId: 88 }];
  source.knowledgeStates = [{ npcId: 'npc-kendra', informationId: 'info-1', state: 'KNOWS', sourceMessageId: 89 }];
  source.arcs = [{ id: 'arc-1', title: 'Floor rumor', sourceMessageId: 75, nested: { lastScannedMessageId: 74 } }];
  source.meta.lastScannedMessageId = 103;

  const untouched = clone(source);
  const handoff = createHandoffRecord(
    source,
    'Whitmore',
    3,
    'Saturday 8:06 PM in the third-floor lounge. Kendra and Dakota are together after a public kiss; Priya and Tessa just left.'
  );

  assert.deepStrictEqual(clone(source), untouched, 'Preparing a handoff must never mutate the source session.');
  assert.strictEqual(handoff.campaignId, 'campaign-omega');
  assert.strictEqual(handoff.sessionNumber, 3);
  assert.strictEqual(handoff.state.npcs[0].id, 'npc-kendra');
  assert.strictEqual(handoff.state.relationships[0].axes.Trust, 8);
  assert.strictEqual(handoff.state.knowledgeItems[0].statement, 'The dean resigned.');
  assert.strictEqual(handoff.state.arcs[0].title, 'Floor rumor');

  const continued = buildContinuationState(handoff, 2);
  assert.strictEqual(continued.revision, 3, 'The new chat owns its own revision counter.');
  assert.strictEqual(continued.campaign.id, 'campaign-omega', 'Campaign identity must survive the session boundary.');
  assert.strictEqual(continued.campaign.name, 'Whitmore');
  assert.strictEqual(continued.campaign.sessionNumber, 4, 'Continuing a handoff should advance to the next session number.');
  assert.strictEqual(continued.campaign.sourceHandoffId, handoff.id);
  assert.strictEqual(continued.campaign.continuationActive, true);
  assert.strictEqual(continued.campaign.continuationRemaining, CONTINUATION_GENERATIONS);
  assert(/third-floor lounge/.test(continued.campaign.continuationBrief));
  assert.strictEqual(continued.npcs[0].residence, 'Room 308');
  assert.strictEqual(continued.relationships[0].axes.Trust, 8);
  assert.strictEqual(continued.relationships[0].evidence[0].text, 'Kendra kissed Dakota in public.');
  assert.strictEqual(continued.npcs[0].residenceSourceMessageId, null, 'Old chat message ids must not masquerade as ids in the new chat.');
  assert.strictEqual(continued.npcs[0].lastMeaningfulMessageId, null);
  assert.strictEqual(continued.relationships[0].evidence[0].sourceMessageId, null);
  assert.strictEqual(continued.relationships[0].lastMeaningfulChangeMessageId, null);
  assert.strictEqual(continued.knowledgeItems[0].sourceMessageId, null, 'Future knowledge evidence ids must also detach at a session boundary.');
  assert.strictEqual(continued.knowledgeStates[0].sourceMessageId, null);
  assert.strictEqual(continued.arcs[0].sourceMessageId, null);
  assert.strictEqual(continued.arcs[0].nested.lastScannedMessageId, null);
  assert.strictEqual(continued.meta.lastScannedMessageId, null);
  assert.strictEqual(continued.meta.lastScannedFloor, null);
  assert.strictEqual(continued.meta.scanStatus, 'idle');
  assert.strictEqual(continued.config.updateMode, 'assisted');
  assert.strictEqual(stateHasMeaningfulData(continued), true);
}

{
  const detached = detachSessionMessageReferences({
    sourceMessageId: 1,
    keep: 2,
    nested: [{ lastMeaningfulChangeMessageId: 3, manualAuthorityThroughMessageId: 4, lastScannedFloor: 9, text: 'keep me' }]
  });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(detached)), {
    sourceMessageId: null,
    keep: 2,
    nested: [{ lastMeaningfulChangeMessageId: null, manualAuthorityThroughMessageId: null, lastScannedFloor: null, text: 'keep me' }]
  });
}

{
  const seed = newState();
  const items = [];
  for (let i = 0; i < 12; i += 1) {
    items.push(createHandoffRecord(seed, `Campaign ${i}`, 1, `Brief ${i}`));
  }
  const registry = normalizeHandoffRegistry({ items });
  assert.strictEqual(registry.items.length, 10, 'Global handoff registry should stay bounded.');
}


{
  const state = newState();
  state.campaign = normalizeCampaign({ id: 'campaign-bridge', name: 'Bridge Test', sessionNumber: 3 });
  harness.publishCampaignIdentity(state);
  const identity = variableStore.get('com.hooch88.tavo.campaignIdentity');
  assert.strictEqual(identity.id, 'campaign-bridge');
  assert.strictEqual(identity.name, 'Bridge Test');
  assert.strictEqual(identity.sessionNumber, 3);
}

console.log('StoryState Phase 2 state-model tests passed.');
