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

  // Audit gate 4: a syntactically valid empty model result still admits a strong recurring
  // identity locally instead of consuming the batch with no NPC state.
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
  const localFallback = harness.normalizeState(vars.get('storyState.state'));
  assert.strictEqual(generateCalls.length, 1, 'A syntactically valid empty result should not trigger JSON repair.');
  assert.strictEqual(localFallback.meta.scanStatus, 'idle');
  assert.strictEqual(localFallback.npcs.length, 1, 'Strong recurring identity should be admitted locally.');
  assert.strictEqual(localFallback.npcs[0].name, 'Dreg');
  assert.strictEqual(localFallback.meta.lastScannedFloor, 1);
  assert.strictEqual(localFallback.meta.lastScannedMessageId, 572);

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

  // Audit gate 6: recovery for already-consumed history is fully local and cannot alter
  // the normal cursor or non-NPC collections even when the chat-bound model/provider is broken.
  clearRuntimeKeys();
  const consumed = harness.newState();
  consumed.meta.lastScannedFloor = 5;
  consumed.meta.lastScannedMessageId = 606;
  consumed.knowledgeItems.push(harness.normalizeKnowledgeItem({ statement: 'Hooch is from another world.', truth: 'UNKNOWN', sensitivity: 'PRIVATE', updatedBy: 'manual' }));
  vars.set('storyState.state', consumed);
  generateHandler = async () => { throw new Error('provider must never be called by NPC recovery'); };
  await harness.runNpcBackfill();
  const recovered = harness.normalizeState(vars.get('storyState.state'));
  assert.strictEqual(generateCalls.length, 0, 'NPC recovery must not call the model/provider at all.');
  assert.deepStrictEqual(Array.from(recovered.npcs.map((npc) => npc.name).sort()), ['Dreg', 'Harl', 'Wrenna']);
  assert.strictEqual(recovered.meta.lastScannedFloor, 5);
  assert.strictEqual(recovered.meta.lastScannedMessageId, 606);
  assert.strictEqual(recovered.relationships.length, 0);
  assert.strictEqual(recovered.knowledgeItems.length, 1);
  assert.strictEqual(recovered.arcs.length, 0);
  assert(/No model request was used/.test(recovered.meta.lastScanSummary));

  // Audit gate 7: two saved assistant replies can admit an identity incrementally without
  // waiting for a model scan.
  clearRuntimeKeys();
  const liveState = harness.newState();
  vars.set('storyState.state', liveState);
  await harness.processLocalNpcDiscoveryMessage({ id: 701, role: 'assistant', hidden: false, content: 'Dreg answers Hooch and checks the trail.' });
  assert.strictEqual(harness.normalizeState(vars.get('storyState.state')).npcs.length, 0, 'One ordinary appearance should remain a candidate.');
  await harness.processLocalNpcDiscoveryMessage({ id: 702, role: 'assistant', hidden: false, content: 'Dreg follows Hooch into the trees and keeps watch.' });
  const liveAdmitted = harness.normalizeState(vars.get('storyState.state'));
  assert.strictEqual(liveAdmitted.npcs.length, 1, 'Second strong saved appearance should admit the recurring NPC locally.');
  assert.strictEqual(liveAdmitted.npcs[0].name, 'Dreg');
  assert.strictEqual(generateCalls.length, 0, 'Incremental local NPC admission must not call the model.');

  // An already tracked full name/alias must not become a missing identity gate.
  clearRuntimeKeys();
  messages=[{id:10301,role:'assistant',hidden:false,content:'Sadie says she wants to move into the room.'},{id:10303,role:'assistant',hidden:false,content:'Sadie asks Dakota about the roommate vacancy.'}];
  const sadieState=harness.newState();
  sadieState.npcs=[harness.normalizeNpc({id:'sadie-zheng',name:'Sadie Zheng',aliases:['Sadie']})];
  vars.set('storyState.state',sadieState);
  generateHandler=async()=>JSON.stringify({npcProposals:[],relationshipProposals:[],informationProposals:[],knowledgeProposals:[],arcProposals:[]});
  await harness.runExtractionScan({type:'scan',mode:'manual'});
  const sadieResult=harness.normalizeState(vars.get('storyState.state'));
  assert.strictEqual(sadieResult.meta.scanStatus,'idle');
  assert.strictEqual(sadieResult.meta.lastScannedMessageId,10303);
  assert.strictEqual(sadieResult.npcs.length,1,'Short-name evidence must not duplicate a tracked full-name NPC.');
  sadieState.npcs[0].aliases=[];
  assert.strictEqual(harness.resolveNpcRef(sadieState,null,'Sadie').id,'sadie-zheng');
  sadieState.npcs.push(harness.normalizeNpc({id:'other-sadie',name:'Sadie Jones'}));
  assert.strictEqual(harness.resolveNpcRef(sadieState,null,'Sadie'),null,'Shared first names must not guess an identity.');
  assert.strictEqual(harness.resolveNpcRef(sadieState,null,'Sadie Zheng').id,'sadie-zheng');
  const titles=harness.newState();titles.npcs=[harness.normalizeNpc({id:'huang',name:'Dr. Huang'})];
  assert.strictEqual(harness.resolveNpcRef(titles,null,'Huang').id,'huang');
  assert.strictEqual(harness.resolveNpcRef(titles,null,'Doctor Huang').id,'huang');
  const excluded=harness.auditedReservedNames({persona:{name:'Loving'}},{protagonistNames:'Loving, Dakota'});
  assert(excluded.has('loving')&&excluded.has('dakota'));
  const playerState=harness.newState();playerState.config.protagonistNames='Loving, Dakota';
  const playerMessages=[{id:20001,role:'assistant',content:'Dakota says hello. Loving asks for help.'},{id:20002,role:'assistant',content:'Dakota walks away. Loving follows him.'}];
  const playerCandidates=harness.collectAuditedNpcCandidates(playerMessages,excluded);
  assert(!playerCandidates.some(c=>/dakota|loving/i.test(c.name)));
  const playerProposals={npcProposals:[{action:'create',name:'Dakota',admissionReason:'recurring',fields:{},evidenceMessageIds:[20001,20002]},{action:'create',name:'Loving',admissionReason:'recurring',fields:{},evidenceMessageIds:[20001,20002]}],relationshipProposals:[],informationProposals:[],knowledgeProposals:[],arcProposals:[]};
  harness.applyExtractionProposals(playerState,playerProposals,new Map(playerMessages.map(m=>[m.id,m])),excluded);
  assert.strictEqual(playerState.npcs.length,0,'Player names must be excluded even when the model proposes them.');
  clearRuntimeKeys();
  const housekeeping=harness.newState();
  housekeeping.knowledgeItems=[harness.normalizeKnowledgeItem({id:'dinner',statement:'Dakota invited Sarah to dinner tomorrow.',sourceMessageId:100,updatedBy:'extraction',sensitivity:'NORMAL',truth:'TRUE'})];
  messages=[{id:201,role:'assistant',hidden:false,content:'Sarah says the dinner with Dakota is cancelled because she is leaving town.'}];
  const archiveProposal={action:'archive',informationId:'dinner',resolution:'cancelled_plan',reason:'Sarah explicitly cancelled the dinner.',evidenceMessageIds:[201],resolutionEvidence:[{messageId:201,quote:'the dinner with Dakota is cancelled'}]};
  const publicMessages=new Map(messages.map(m=>[m.id,m]));
  const protectionCases=[
    {statement:'Sarah was born in Oregon.'},
    {updatedBy:'manual'},
    {manualAuthorityThroughMessageId:50},
    {autoArchiveProtected:true},
    {sensitivity:'SECRET'},
    {sourceMessageId:300}
  ];
  for(const change of protectionCases){
    const protectedState=harness.normalizeState(JSON.parse(JSON.stringify(housekeeping)));Object.assign(protectedState.knowledgeItems[0],change);
    harness.applyKnowledgeArchives(protectedState,[archiveProposal],publicMessages);
    assert.strictEqual(protectedState.knowledgeItems[0].status,'active','Protected or enduring knowledge must remain active.');
  }
  const forged=harness.normalizeState(JSON.parse(JSON.stringify(housekeeping)));
  harness.applyKnowledgeArchives(forged,[{...archiveProposal,resolutionEvidence:[{messageId:201,quote:'a fabricated resolution not in the story'}]}],publicMessages);
  assert.strictEqual(forged.knowledgeItems[0].status,'active');
  const disabled=harness.normalizeState(JSON.parse(JSON.stringify(housekeeping)));disabled.config.autoArchiveKnowledge=false;
  harness.applyKnowledgeArchives(disabled,[archiveProposal],publicMessages);
  assert.strictEqual(disabled.knowledgeItems[0].status,'active');
  vars.set('storyState.state',housekeeping);
  const requestsBeforeArchive=generateCalls.length;
  generateHandler=async(prompt)=>{assert(prompt.includes('ARCHIVE REVIEW CANDIDATES'));return JSON.stringify({npcProposals:[],relationshipProposals:[],informationProposals:[archiveProposal],knowledgeProposals:[],arcProposals:[]})};
  await harness.runExtractionScan({type:'scan',mode:'manual'});
  const archivedState=harness.normalizeState(vars.get('storyState.state'));
  assert.strictEqual(archivedState.knowledgeItems.length,1,'Archiving must never delete the fact.');
  assert.strictEqual(archivedState.knowledgeItems[0].status,'archived');
  assert.strictEqual(archivedState.knowledgeItems[0].archiveReason,archiveProposal.reason);
  assert.strictEqual(archivedState.knowledgeItems[0].archiveEvidence[0].messageId,201);
  assert.strictEqual(generateCalls.length-requestsBeforeArchive,1,'Housekeeping must share the normal extraction request.');
  assert(vars.get('storyState.recovery')?.storyState,'Archiving must use normal scan recovery snapshots.');
  console.log('StoryState audited extractor regression tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
