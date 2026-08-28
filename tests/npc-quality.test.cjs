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

console.log('StoryState NPC quality regression tests passed.');
