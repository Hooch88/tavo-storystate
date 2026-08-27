const fs = require('fs');
const path = require('path');
const assert = require('assert');

const entry = fs.readFileSync(path.join(__dirname, '..', 'entry.js'), 'utf8');
const panel = fs.readFileSync(path.join(__dirname, '..', 'ui', 'panel.html'), 'utf8');

assert(entry.includes('NPC performance rule: Preserve personality, vary expression.'), 'Narrator context must tell models to vary expression while preserving personality.');
assert(entry.includes('Speech/voice:'), 'Communication state should be presented to the narrator as speech/voice.');
assert(entry.includes('Last known motive:'), 'Dynamic motives must be labeled as prior state rather than an imperative.');
assert(entry.includes('no gestures, facial expressions, posture, eye behavior, hand movements, or recurring physical mannerisms'), 'Structured NPC hints must keep physical tics out of communication.');
assert(panel.includes('communicationSignature = SPEECH/VOICE ONLY'), 'Extractor must separate speech/voice from stage business.');
assert(panel.includes('clearCurrentMotive=true'), 'Extractor must know how to retire a completed motive explicitly.');
assert(panel.includes('A single colorful behavior is scene behavior, not a stable personality trait.'), 'Extractor must not promote one-scene gestures into personality anchors.');

console.log('StoryState NPC quality regression tests passed.');
