# Tavo StoryState

**Status:** Pre-alpha architecture scaffold (`0.1.0-dev.1`)

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

## Current scaffold

The initial dev build proves the project identity and Tavo integration surfaces:

- `specVersion: 2` manifest;
- chat sidebar entry;
- chat-scoped state namespace (`storyState.*`);
- after-assistant scan scheduling path;
- supported `generation:prepare` model-only context hook;
- minimal StoryState panel;
- no extraction or destructive migration yet;
- context injection disabled by default.

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

Use development builds only in a backup/disposable Tavo chat. State-changing extraction is not implemented in `0.1.0-dev.1`.
