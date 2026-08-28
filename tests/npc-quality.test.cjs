const fs = require('fs');
const path = require('path');
const assert = require('assert');

const entry = fs.readFileSync(path.join(__dirname, '..', 'entry.js'), 'utf8');
const panel = fs.readFileSync(path.join(__dirname, '..', 'ui', 'panel.html'), 'utf8');

assert(entry.includes('NPC performance rule: Preserve personality, vary expression.'), 'Narrator context must tell models to vary expression while preserving personality.');
assert(entry.includes('Speech/voice:'), 'Communication state should be presented to the narrator as speech/voice.');
assert(entry.includes('Last known motive:'), 'Dynamic motives must be labeled as prior state rather than an imperative.');
assert(!entry.includes('communication: concise speech/voice signature'), 'Structured NPC hints must not define communication signatures.');
assert(entry.includes('Speech/voice is learned by StoryState extraction from repeated dialogue evidence'), 'Structured hints must defer speech/voice learning to extraction.');
assert(panel.includes('communicationSignature = SPEECH/VOICE ONLY'), 'Extractor must separate speech/voice from stage business.');
assert(panel.includes('at least two distinct evidence messages where the NPC actually speaks'), 'Extractor must require repeated dialogue evidence before establishing a communication signature.');
assert(panel.includes('allowCommunication=ids.length>=2'), 'Runtime must enforce repeated evidence before storing extracted communication.');
assert(!panel.includes('communicationSignature:text(fields.communication||fields.voice||fields.speech,700)'), 'Structured NPC hint parsing must ignore communication fields even from older/malformed hints.');
assert(panel.includes('clearCurrentMotive=true'), 'Extractor must know how to retire a completed motive explicitly.');
assert(panel.includes('A single colorful behavior is scene behavior, not a stable personality trait.'), 'Extractor must not promote one-scene gestures into personality anchors.');

assert(panel.includes('PRESSURE RESPONSE EVIDENCE — mandatory'), 'V5 must explicitly require conservative pressure-response evidence.');
assert(panel.includes('const allowPressure=!!existing&&new Set(ids).size>=2&&dev5PressureResponseIsClean(value)'), 'V5 runtime must reject pressure responses on NPC creation and require repeated evidence for updates.');
assert(panel.includes('Never put physical tells or stage directions in pressureResponse'), 'V5 pressure response prompt must reject body-language contamination.');
assert(panel.includes('THINKING-MODEL OUTPUT CONTRACT — mandatory'), 'V5 must harden extraction for reasoning/thinking models.');
assert(panel.includes('Your FIRST character must be { and your LAST character must be }'), 'V5 must require a bare JSON object.');
assert(panel.includes('Never write phrases such as "Let me analyze"'), 'V5 JSON repair must explicitly reject visible reasoning preambles.');
assert(panel.includes('arcProposals. Missing categories must be empty arrays.'), 'V5 JSON repair schema must preserve arcProposals as the fifth array.');
assert(panel.includes('after two repair attempts'), 'V5 must allow a second syntax-only repair before pausing automatic scans.');
assert(panel.includes('DEV5_SCAN_MAX_FLOORS=16,DEV5_SCAN_MAX_CHARS=24000'), 'V5 must use smaller bounded extraction batches for thinking models.');

console.log('StoryState NPC quality regression tests passed.');
