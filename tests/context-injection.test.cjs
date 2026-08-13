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
  set(name, value) {
    if (name === 'storyState.state') { currentState = value; return; }
    if (!name.startsWith('storyState.state.') || !currentState) return;
    const parts = name.slice('storyState.state.'.length).split('.');
    let cursor = currentState;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') cursor[parts[i]] = {};
      cursor = cursor[parts[i]];
    }
    cursor[parts.at(-1)] = value;
  },
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
assert.strictEqual(typeof handlers['generation:success'], 'function', 'generation:success handler must be registered for handoff expiry.');

function baseState() {
  return {
    schemaVersion: 6,
    campaign: {
      id: 'campaign-test', name: 'Campus', sessionNumber: 1,
      continuationBrief: '', continuationActive: false, continuationRemaining: 0
    },
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
        axes: { Trust: 3, Affinity: 8, Attraction: 7 }, relationshipStatus: 'Dating', stanceSummary: 'Interested but unwilling to give automatic benefit of the doubt'
      },
      {
        id: 'rel-sr', sourceNpcId: 'npc-sadie', targetType: 'npc', targetNpcId: 'npc-reagan', status: 'active',
        axes: { Trust: 6, Affinity: 9, Attraction: 5 }, relationshipStatus: 'Friends', stanceSummary: ''
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
  assert(event.text.includes('Axis meaning — Trust: Willingness to believe, rely on, and be vulnerable with the target.'), 'Injected Trust definition must match StoryState semantics.');
  assert(event.text.includes('Axis meaning — Affinity: How much the NPC likes the target and enjoys their company; warmth and goodwill, not romance by itself.'), 'Injected Affinity definition must match StoryState semantics.');
  assert(event.text.includes('Axis meaning — Attraction: Romantic or physical pull toward the target; it does not imply affection, trust, consent, or obedience.'), 'Injected Attraction definition must match StoryState semantics.');
  assert(event.text.includes('Relationship status: Dating'), 'Structural relationship status should be supplied separately from emotional axes.');
  assert(event.text.includes('Relationship Status is structural context'), 'The model must be told status is structural rather than an emotional override.');
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


  currentState = baseState();
  currentState.campaign = {
    id: 'campaign-test',
    name: 'Campus',
    sessionNumber: 2,
    continuationBrief: 'Saturday 8:06 PM in the third-floor lounge. Reagan is sitting beside the protagonist after Priya and Tessa left. Continue from that exact moment.',
    continuationActive: true,
    continuationRemaining: 4
  };
  recentMessages = [];
  const handoffStart = { text: 'Continue.' };
  await handlers['generation:prepare'](handoffStart);
  assert(handoffStart.text.includes('SESSION CONTINUATION — Campus, Session 2'), 'A fresh session must receive its continuation brief even when the newest user message names no NPC.');
  assert(handoffStart.text.includes('authoritative handoff point from the prior session'), 'The narrator must understand the brief is the cross-session starting point.');
  assert(handoffStart.text.includes('NPC: Reagan Mercer'), 'NPC names inside the continuation brief should seed normal StoryState relevance selection.');
  assert(handoffStart.text.includes('RELATIONSHIP Reagan Mercer -> Protagonist'), 'Relevant relationship state should accompany a continuation brief.');
  await handlers['generation:success']();
  assert.strictEqual(currentState.campaign.continuationRemaining, 3, 'Only successful narrator generations should consume the continuation window.');
  assert.strictEqual(currentState.campaign.continuationActive, true);

  await handlers['generation:success']();
  await handlers['generation:success']();
  await handlers['generation:success']();
  assert.strictEqual(currentState.campaign.continuationRemaining, 0);
  assert.strictEqual(currentState.campaign.continuationActive, false, 'Continuation brief should auto-expire after the bounded handoff window.');

  recentMessages = [];
  const afterExpiry = { text: 'Continue.' };
  await handlers['generation:prepare'](afterExpiry);
  assert.strictEqual(afterExpiry.text, 'Continue.', 'Expired continuation brief must stop consuming context.');

  currentState = baseState();
  currentState.npcs = [];
  currentState.relationships = [];
  currentState.campaign = {
    id: 'campaign-empty',
    name: 'No NPC Test',
    sessionNumber: 3,
    continuationBrief: 'Midnight. The protagonist is alone in the observatory as the power fails.',
    continuationActive: true,
    continuationRemaining: 2
  };
  recentMessages = [];
  const briefOnly = { text: 'Continue.' };
  await handlers['generation:prepare'](briefOnly);
  assert(briefOnly.text.startsWith('[[STORYSTATE_CONTEXT]]'), 'A continuation brief alone must be enough to create a context block.');
  assert(briefOnly.text.includes('The protagonist is alone in the observatory'), 'Brief-only handoffs must reach the narrator.');

  console.log('StoryState Phase 1C context-injection tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
