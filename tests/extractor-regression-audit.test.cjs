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
function getElement(selector) {
  if (!elements.has(selector)) elements.set(selector, dummyElement());
  return elements.get(selector);
}

const vars = new Map();
let messages = [];
let generateCalls = [];
let generateHandler = async () => JSON.stringify({
  npcProposals: [], relationshipProposals: [], informationProposals: [], knowledgeProposals: [], arcProposals: []
});

const tavo = {
  get(key) { return vars.has(key) ? vars.get(key) : null; },
  set(key, value) { vars.set(key, value); },
  unset(key) { vars.delete(key); },
  message: {
    async count() { return messages.length; },
    async find(range) {
      if (!Array.isArray(range)) return [];
      return messages.slice(range[0], range[1] + 1);
    }
  },
  chat: { async current() { return { persona: { name: 'Hooch' }, characters: [{ name: '[Faerûn]' }] }; } },
  async generate(prompt, options) {
    generateCalls.push({ prompt, options });
    return generateHandler(prompt, options);
  },
  utils: { toast() {} }
};

const harness = {};
const context = {
  console, Math, Date, JSON, Object, Array, Set, Map, String, Number, Boolean, Promise, RegExp,
  tavo, __storyStateTestHarness: harness,
  document: {
    querySelector: getElement,
    querySelectorAll() { return []; },
    documentElement: { style: {} },
    body: dummyElement(),
    createElement() { return dummyElement(); },
    execCommand() { return true; }
  },
  navigator: { clipboard: { async writeText() {} } },
  setInterval() { return 1; }, clearInterval() {},
  setTimeout() { return 1; }, clearTimeout() {},
  confirm() { return true; }, prompt() { return null; },
  FormData: function FormData() {}, Blob: function Blob() {},
  URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} }
};

const panelPath = process.env.STORYSTATE_PANEL || path.join(__dirname, '..', 'ui', 'panel.html');
const html = fs.readFileSync(panelPath, 'utf8');
const scripts = [...html.matchAll(/<script>\n([\s\S]*?)\n<\/script>/g)];
vm.runInNewContext(scripts.at(-1)[1], context, { filename: panelPath });

const emptyResult = () => ({
  npcProposals: [], relationshipProposals: [], informationProposals: [], knowledgeProposals: [], arcProposals: []
});
const companionResult = () => ({
  npcProposals: [
    { action: 'create', name: 'Dreg', admissionReason: 'recurring', evidenceMessageIds: [601, 604], fields: { role: 'Goblin escape companion' } },
    { action: 'create', name: 'Wrenna', admissionReason: 'recurring', evidenceMessageIds: [602, 605], fields: { role: 'Human escape companion' } },
    { action: 'create', name: 'Harl', admissionReason: 'recurring', evidenceMessageIds: [603, 606], fields: { role: 'Trapper and guide' } }
  ],
  relationshipProposals: [], informationProposals: [], knowledgeProposals: [], arcProposals: []
});

function clearRuntimeKeys() {
  for (const key of [...vars.keys()]) if (key !== 'storyState.state') vars.delete(key);
  generateCalls = [];
  getElement('#ss-root').hidden = true;
}

(async () => {
  // Audit gate 1: the local candidate index recognizes the real companion pattern but
  // does not promote capitalized scenery such as "Shapes" into a strong NPC candidate.
  const sample = [
    { id: 501, role: 'assistant', content: 'Shapes moved beyond the flames while Dreg answered Hooch.' },
    { id: 502, role: 'assistant', content: 'Wrenna followed Hooch and Dreg toward the trees.' },
    { id: 503, role: 'assistant', content: 'Harl led the fugitives down the slope.' },
    { id: 504, role: 'assistant', content: 'Dreg traveled with the group and kept the strange phone.' },
    { id: 505, role: 'assistant', content: 'Wrenna stayed beside the others as they made camp.' },
    { id: 506, role: 'assistant', content: 'Harl kept guiding Hooch, Wrenna, and Dreg toward Red Larch.' }
  ];
  const reserved = harness.auditedReservedNames({ persona: { name: 'Hooch' }, characters: [{ name: '[Faerûn]' }] });
  const candidates = harness.collectAuditedNpcCandidates(sample, reserved);
  const byName = new Map(candidates.map((candidate) => [candidate.name, candidate]));
  for (const name of ['Dreg', 'Wrenna', 'Harl']) assert(byName.has(name), `${name} should be recognized as a plausible NPC candidate.`);
  const shapes = byName.get('Shapes');
  assert(!shapes || (shapes.personIds.size < 2 && shapes.companionIds.size === 0), 'Capitalized scenery must not become a strong/obvious NPC candidate.');
  assert(!byName.has('Red Larch'), 'Locations must not become NPC candidates.');

  // Audit gate 2: normal scans are actually smaller, and the current prompt is identity-first
  // rather than the dev.5 double-contract that spent output on personality analysis.
  messages = sample.concat([
    { id: 507, role: 'user', content: 'We keep moving.' },
    { id: 508, role: 'assistant', content: 'Dreg, Wrenna, and Harl continue south with Hooch.' },
    { id: 509, role: 'assistant', content: 'An unrelated extra passes once.' }
  ]).map((message) => ({ ...message, hidden: false }));
  const promptState = harness.newState();
  const batch = await harness.collectScanBatch(promptState);
  assert(batch.messages.length <= harness.AUDITED_SCAN_MAX_FLOORS, 'Audited scan floor cap must be enforced.');
  assert(batch.messages.reduce((total, message) => total + message.content.length, 0) <= harness.AUDITED_SCAN_MAX_CHARS, 'Audited scan character cap must be enforced.');
  const auditedPrompt = harness.buildExtractionPrompt(promptState, batch.messages, await tavo.chat.current());
  assert(auditedPrompt.includes('NPC IDENTITY FIRST'), 'Audited prompt must prioritize NPC identity.');
  assert(!auditedPrompt.includes('THINKING-MODEL OUTPUT CONTRACT'), 'The dev.5 duplicate thinking-model contract must not remain in the active prompt.');
  assert(!auditedPrompt.includes('PRESSURE RESPONSE EVIDENCE — mandatory'), 'The active prompt must not append the dev.5 pressure-analysis block.');
  assert(auditedPrompt.length < 20000, `Representative audited prompt is still too large (${auditedPrompt.length} chars).`);

  // Audit gate 3: evidence survives bounded scan batches. A later one-message proposal can
  // cite one real prior candidate message plus one current message and be admitted safely.
  clearRuntimeKeys();
  const ledgerState = harness.newState();
  vars.set('storyState.state', ledgerState);
  const firstEvidence = [{ id: 551, role: 'assistant', hidden: false, content: 'Dreg answered Hooch and hid the phone under his tunic.' }];
  harness.mergeNpcCandidateLedger(ledgerState, harness.collectAuditedNpcCandidates(firstEvidence, reserved));
  const currentEvidence = [{ id: 552, role: 'assistant', hidden: false, content: 'Dreg followed Hooch down the road and stayed with the group.' }];
  const proposalMap = new Map(currentEvidence.map((message) => [message.id, message]));
  const applied = harness.applyExtractionProposals(ledgerState, {
    npcProposals: [{ action: 'create', name: 'Dreg', admissionReason: 'recurring', evidenceMessageIds: [551, 552], fields: { role: 'Goblin companion' } }],
    relationshipProposals: [], informationProposals: [], knowledgeProposals: [], arcProposals: []
  }, proposalMap, reserved);
  assert.strictEqual(applied.changes.length, 1);
  assert.strictEqual(ledgerState.npcs.length, 1);
  assert.strictEqual(ledgerState.npcs[0].name, 'Dreg');
  assert.strictEqual(harness.loadNpcCandidateLedger(ledgerState).items.some((item) => item.name === 'Dreg'), false, 'Promoted NPC must be purged from the candidate ledger.');

  // Audit gate 4: a valid-but-empty extractor result cannot silently consume a batch that
  // contains a strong recurring NPC candidate.
  clearRuntimeKeys();
  messages = [
    { id: 571, role: 'assistant', hidden: false, content: 'Dreg answers Hooch and helps plan the escape.' },
    { id: 572, role: 'assistant', hidden: false, content: 'Dreg follows Hooch and leads him toward the trees.' }
  ];
  const emptyState = harness.newState();
  emptyState.config.updateMode = 'assisted';
  vars.set('storyState.state', emptyState);
  generateHandler = async () => JSON.stringify(emptyResult());
  await harness.runExtractionScan({ type: 'scan', mode: 'manual' });
  const rejectedEmpty = harness.normalizeState(vars.get('storyState.state'));
  assert.strictEqual(generateCalls.length, 1, 'A syntactically valid empty result should not trigger JSON repair.');
  assert.strictEqual(rejectedEmpty.meta.scanStatus, 'error');
  assert.strictEqual(rejectedEmpty.meta.lastScannedFloor, null, 'Strong-candidate omission must preserve scan floor.');
  assert.strictEqual(rejectedEmpty.meta.lastScannedMessageId, null, 'Strong-candidate omission must preserve message cursor.');
  assert(/omitted strong recurring NPC candidate/i.test(rejectedEmpty.meta.lastScanSummary));

  // Audit gate 5: the same companion pattern succeeds in one normal identity-first scan.
  clearRuntimeKeys();
  messages = [
    { id: 601, role: 'assistant', hidden: false, content: 'Dreg answers Hooch while the captives plan their escape.' },
    { id: 602, role: 'assistant', hidden: false, content: 'Wrenna follows Hooch and Dreg into the trees.' },
    { id: 603, role: 'assistant', hidden: false, content: 'Harl leads the fugitives down the slope.' },
    { id: 604, role: 'assistant', hidden: false, content: 'Dreg travels with the group toward safety.' },
    { id: 605, role: 'assistant', hidden: false, content: 'Wrenna stays beside the group as they make camp.' },
    { id: 606, role: 'assistant', hidden: false, content: 'Harl keeps guiding Dreg, Wrenna, and Hooch toward Red Larch.' }
  ];
  const scanState = harness.newState();
  scanState.config.updateMode = 'assisted';
  vars.set('storyState.state', scanState);
  generateHandler = async () => JSON.stringify(companionResult());
  await harness.runExtractionScan({ type: 'scan', mode: 'manual' });
  const scanned = harness.normalizeState(vars.get('storyState.state'));
  assert.deepStrictEqual(Array.from(scanned.npcs.map((npc) => npc.name).sort()), ['Dreg', 'Harl', 'Wrenna']);
  assert.strictEqual(scanned.meta.scanStatus, 'idle');
  assert.strictEqual(scanned.meta.lastScannedFloor, 5);
  assert.strictEqual(scanned.meta.lastScannedMessageId, 606);
  assert.strictEqual(generateCalls.length, 1, 'Successful normal scan must remain one extraction request.');

  // Audit gate 6: recovery for already-consumed history is one compact identity-only request
  // and cannot alter the normal cursor or non-NPC collections.
  clearRuntimeKeys();
  const consumed = harness.newState();
  consumed.meta.lastScannedFloor = 5;
  consumed.meta.lastScannedMessageId = 606;
  consumed.knowledgeItems.push(harness.normalizeKnowledgeItem({ statement: 'Hooch is from another world.', truth: 'UNKNOWN', sensitivity: 'PRIVATE', updatedBy: 'manual' }));
  vars.set('storyState.state', consumed);
  generateHandler = async (prompt) => {
    assert(prompt.includes('NPC identity recovery tool'));
    assert(!prompt.includes('PRESSURE RESPONSE EVIDENCE'));
    assert(!prompt.includes('relationshipProposals":[{'), 'Recovery prompt must not request relationship analysis.');
    return JSON.stringify(companionResult());
  };
  await harness.runNpcBackfill();
  const recovered = harness.normalizeState(vars.get('storyState.state'));
  assert.strictEqual(generateCalls.length, 1, 'NPC recovery must use one focused model request.');
  assert.deepStrictEqual(Array.from(recovered.npcs.map((npc) => npc.name).sort()), ['Dreg', 'Harl', 'Wrenna']);
  assert.strictEqual(recovered.meta.lastScannedFloor, 5);
  assert.strictEqual(recovered.meta.lastScannedMessageId, 606);
  assert.strictEqual(recovered.relationships.length, 0);
  assert.strictEqual(recovered.knowledgeItems.length, 1);
  assert.strictEqual(recovered.arcs.length, 0);
  assert(/one identity-only request/.test(recovered.meta.lastScanSummary));

  console.log('StoryState audited extractor regression tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
