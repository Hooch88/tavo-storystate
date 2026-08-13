# Tavo StoryState

**Status:** Pre-alpha Phase 1C build (`0.1.0-dev.6`)

StoryState is a Tavo plugin project for persistent simulation state in long-running AI role-play. It is designed for narrator/simulation-master workflows where NPCs are created organically rather than represented by individual character cards.

StoryState is **not** a renamed Living World release. It is a new direction informed by lessons from the Living World 0.2.2 prototype and CCT Relationship 3.8.1 testing.

## Core responsibility

StoryState owns persistent, selectively injected state:

- canonical NPC identity and aliases;
- stable characterization anchors;
- evidence-gated residence;
- directional NPC → Protagonist and NPC → NPC relationships;
- consequential knowledge, secrets, false beliefs, and suspicions (planned Phase 4);
- finite world arcs after the NPC state loop is stable.

It does **not** replace the narrator preset, campaign card, memory system, or Lorebook.

## Current build

Phase 1 now implements the persistent manual state foundation on top of the initial integration scaffold:

- `specVersion: 2` manifest;
- chat sidebar entry;
- chat-scoped state namespace (`storyState.*`);
- after-assistant scan scheduling path;
- supported `generation:prepare` model-only context hook;
- canonical NPC IDs, aliases, rename-safe edits and duplicate merge;
- evidence-preserving residence field;
- separate directional relationship records using one chat-wide relationship model;
- manual NPC and relationship editing;
- JSON export/import and recovery snapshots;
- explicit, non-destructive Living World 0.2.2 import;
- relevant NPC and relationship state now influences narration through model-only context injection;
- narrator influence is enabled by default per chat and can be disabled in StoryState Settings;
- relationship values are translated into behavioral tendencies rather than injected as unexplained numbers;
- recent visible messages are used locally for relevance so pronoun follow-ups can retain the right NPC state;
- campaign/session handoff through a bounded global registry;
- fresh-chat continuation imports an independent StoryState copy while leaving the old session untouched;
- invalid old-chat message IDs are detached at the session boundary while evidence text and semantic state are preserved;
- optional continuation brief seeds the new session for four successful narrator replies, then expires automatically;
- no extraction yet (Phase 2).

## Repository lineage

The git tag `living-world-0.2.2-reference` points to an untouched import of the prior Living World 0.2.2 implementation. Current `main` deliberately does not carry that old source tree forward wholesale.

## Docs

- [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) — source of truth
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — responsibility boundaries and state loop
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — target schema
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phased implementation
- [`docs/LEGACY_AUDIT.md`](docs/LEGACY_AUDIT.md) — KEEP / REFACTOR / DELETE review of Living World 0.2.2
- [`docs/TAVO_API_NOTES.md`](docs/TAVO_API_NOTES.md) — verified host API assumptions
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — acceptance tests

## Build a `.tpg`

From the repository root:

```bash
zip -r ../tavo-storystate.tpg manifest.json entry.js locales ui
```

The manifest must remain at the package root.

## Safety

Use development builds only in a backup/disposable Tavo chat. State-changing extraction is not implemented in `0.1.0-dev.6`. Phase 1C session handoff should be device-tested in backup/disposable chats before Phase 2 begins.

## Relationship semantics

Relationship axes drive behavioral tendencies. **Relationship Status** is structural context (for example Friends, Dating, Partners, Rivals) rather than a competing emotion field. **Stance Summary** is the optional free-form psychological nuance.


### Axis definitions

- **Trust:** willingness to believe, rely on, and be vulnerable with the target.
- **Affinity:** how much the NPC likes the target and enjoys their company; warmth and goodwill, not romance by itself.
- **Respect:** how highly the NPC regards the target's judgment, competence, character, or standing.
- **Attraction:** romantic or physical pull; it does not imply affection, trust, consent, or obedience.
- **Loyalty:** willingness to remain aligned with, defend, or prioritize the target when doing so has a cost; it does not imply obedience.

The UI shows these same definitions that StoryState supplies to the narrator, so the visible meaning and model behavior stay aligned.

## Session handoff

Use **Settings → Campaign session handoff → Prepare new session…** near the end of a chat. StoryState saves a cross-chat handoff containing the exact structured state plus an optional continuation brief. Open a fresh Tavo chat with the same campaign/narrator setup, open StoryState, and choose **Continue here** on the prepared handoff.

The old chat is not modified. The new chat receives its own independent StoryState copy and increments the campaign session number. Old message IDs are cleared because they do not identify messages in the fresh chat; evidence text, NPC state, relationship state, knowledge arrays, arc arrays, settings, and manual overrides remain.


### dev.7 startup hotfix

- StoryState no longer replays a persisted sidebar-open command when Tavo starts. The app can return to its normal last-chat view until StoryState is explicitly opened.

- StoryState publishes `com.hooch88.tavo.campaignIdentity` as the stable cross-plugin campaign identity bridge for companion plugins such as Visual Library.
