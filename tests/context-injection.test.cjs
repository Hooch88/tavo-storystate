const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const handlers = {};
let currentState = null;
let recentMessages = [];
const tavo = {
  plugin: {
    on(name, fn) { handlers[name] = fn; },
    onSidebarAction() {},
  },
  get(name) { return name === 'storyState.state' ? currentState : null; },
  set() {},
  utils: { toast() {} },
  message: {
    async count() { return recentMessages.length; },
    async find(range, filter = {}) {
      const [start, end] = range;
      return recentMessages.slice(start, end + 1).filter((m) => filter.hidden === undefined || m.hidden === filter.hidden);
    }
  }
};

const context = { console, tavo, Math, Date, JSON, Object, Array, Set, Map, String, Number, Boolean, Promise };
const source = fs.readFileSync(path.join(__dirname, '..', 'entry.js'), 'utf8');
vm.runInNewContext(source, context, { filename: 'entry.js' });
assert.strictEqual(typeof handlers['generation:prepare'], 'function', 'generation:prepare handler must be registered.');

function baseState() {
  return {
    schemaVersion: 4,
    config: { contextInjectionEnabled: true, relationshipPreset: 'dating', optionalThirdAxis: true },
    npcs: [
      {
        id: 'npc-reagan', name: 'Reagan Mercer', aliases: ['Reagan'], role: 'Student', status: 'active', pinned: false,
        communicationSignature: 'Dry, concise, understated sarcasm', pressureResponse: 'Becomes controlled and withholding',
        coreValue: 'Personal independence', currentMotive: 'Decide whether the protagonist is trustworthy',
        contradiction: 'Wants closeness but resents dependence'
      },
      { id: 'npc-sadie', name: 'Sadie Brooks', aliases: ['Sadie'], role: 'Student', status: 'active', pinned: false }
    ],
    relationships: [
      {
        id: 'rel-rp', sourceNpcId: 'npc-reagan', targetType: 'protagonist', targetNpcId: null, status: 'active',
        axes: { Trust: 3, Affinity: 8, Attraction: 7 }, condition: 'cautious / repairing', stanceSummary: 'Interested but unwilling to give automatic benefit of the doubt'
      },
      {
        id: 'rel-sr', sourceNpcId: 'npc-sadie', targetType: 'npc', targetNpcId: 'npc-reagan', status: 'active',
        axes: { Trust: 6, Affinity: 9, Attraction: 5 }, condition: '', stanceSummary: ''
      }
    ]
  };
}

(async () => {
  currentState = baseState();
  recentMessages = [
    { role: 'assistant', hidden: false, content: 'Reagan folds her arms beside the door.' },
    { role: 'user', hidden: false, content: 'I look at her.' }
  ];
  const event = { text: 'I ask what she thinks.' };
  await handlers['generation:prepare'](event);
  assert(event.text.startsWith('[[STORYSTATE_CONTEXT]]'), 'Relevant state should be prepended to the model request.');
  assert(event.text.includes('NPC: Reagan Mercer'), 'Recent-message relevance should resolve Reagan even without her name in the newest user text.');
  assert(event.text.includes('Trust 3/10 — is guarded; checks claims and limits reliance or vulnerability'), 'Low trust must produce behavioral guidance.');
  assert(event.text.includes('Affinity 8/10 — strongly likes the target'), 'High affinity must produce behavioral guidance.');
  assert(event.text.includes('Attraction 7/10 — feels strong romantic or physical attraction'), 'High attraction must produce behavioral guidance.');
  assert(event.text.includes('Never infer reciprocity'), 'Context must explicitly protect directional meaning.');
  assert(event.text.includes('Attraction never implies consent, affection, or obedience'), 'Attraction guidance must not imply consent or compliance.');
  assert(!event.text.includes('RELATIONSHIP Sadie Brooks -> Reagan Mercer'), 'Unrelated source NPC relationships should stay out when Sadie is not relevant.');
  assert(event.text.endsWith('I ask what she thinks.'), 'Original user text must remain intact after the model-only context block.');

  currentState = baseState();
  currentState.config.contextInjectionEnabled = false;
  recentMessages = [{ role: 'assistant', hidden: false, content: 'Reagan waits.' }];
  const disabled = { text: 'I answer her.' };
  await handlers['generation:prepare'](disabled);
  assert.strictEqual(disabled.text, 'I answer her.', 'Disabled narrator influence must leave the model request untouched.');

  currentState = baseState();
  currentState.npcs = [{ id: 'npc-ros', name: 'Rosario Castellano', aliases: ['Ros'], status: 'active', pinned: false }];
  currentState.relationships = [];
  recentMessages = [];
  const falseAlias = { text: 'I walk across the room.' };
  await handlers['generation:prepare'](falseAlias);
  assert.strictEqual(falseAlias.text, 'I walk across the room.', 'Short aliases must not match inside unrelated words.');

  currentState = baseState();
  currentState.npcs[0].pinned = true;
  recentMessages = [];
  const pinned = { text: 'I walk down the hallway.' };
  await handlers['generation:prepare'](pinned);
  assert(pinned.text.includes('NPC: Reagan Mercer'), 'Pinned NPCs should remain relevant without a textual mention.');

  console.log('StoryState Phase 1B context-injection tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
