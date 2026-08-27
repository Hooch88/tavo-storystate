# Tavo StoryState

**Current development baseline:** `0.8.0-dev.3`  
**State schema:** 12  
**Tavo plugin spec:** 2

StoryState is a persistent simulation-state plugin for long-running Tavo role-play. It tracks organically introduced NPCs and selected world state, then injects only relevant state into narrator requests so the story can remain consistent without turning every NPC into a separate character card.

## Current capabilities

StoryState 0.8 includes:

- canonical NPC identity, aliases, stable characterization anchors, residence, motives, and manual overrides;
- directional NPC → protagonist and NPC → NPC relationships with configurable axes;
- consequential Knowledge & Secrets with directional NPC knowledge states;
- finite World Arcs with active/dormant/resolved lifecycle and manual director nudges;
- Activity and Diagnostics views;
- conservative batched assisted extraction plus manual **Scan Now**;
- stale-scan ownership/lease protection and recovery;
- model-only context injection through `generation:prepare`;
- optional Structured NPC Hints and optional Pura adapter, both off by default;
- campaign/session handoff between fresh chats;
- recovery snapshots and Living World import;
- native Tavo JSON import/export on current Tavo builds;
- mobile-first six-tab UI: Characters, Relations, Knowledge, World, Activity, Settings.

## Runtime boundaries

StoryState owns persistent simulation state. It does **not** replace the narrator preset, campaign card, memory system, Lorebook, Visual Library, or Willforge.

Manual corrections remain authoritative over older extracted evidence. Relationship axes are directional behavioral tendencies, not commands; attraction never implies consent or affection, and loyalty never implies obedience.

## Source layout

The installed Tavo artifact remains deliberately simple:

```text
manifest.json
entry.js
locales/en.json
ui/panel.html
```

Development source is modular under `src/` and is assembled into the two runtime artifacts by `scripts/build.cjs`:

```text
src/
  entry/
    01-core.js
    02-context.js
    03-hooks.js
  ui/
    prefix.html
    styles.css
    markup.html
    runtime/
      01-state.js
      02-rendering-editors.js
      03-scan-controls-handoff.js
      04-extraction-parser.js
      05-npc-hint-adapters.js
      06-proposal-application.js
      07-scan-runner.js
      08-io-bootstrap.js
```

This keeps Tavo's runtime package unchanged while making development safer and easier to review.

## Development

Verify generated runtime artifacts are synchronized with modular source:

```bash
npm run build:check
```

Regenerate them after editing `src/`:

```bash
npm run build
```

Run the full regression suite:

```bash
npm test
```

The build-parity check is intentional: a pure maintenance refactor must be able to reproduce the known-good runtime artifact exactly unless a release deliberately changes behavior.

## Packaging

The `.tpg` is a ZIP-format archive whose root must contain `manifest.json`. GitHub Actions validates the build and packages the runtime files.

## Release safety

`0.8.0-dev.3` builds on the verified Tavo 1.2.7 file-API baseline. It intentionally changes only NPC extraction/injection semantics for personality quality; scan scheduling, schema 12, persistence keys, relationships, Knowledge, and World Arc behavior are unchanged.

Before testing a development build on a valued campaign, export StoryState first. Keep the last known-good `.tpg` available for rollback.

## Documentation

- [`RELEASE_NOTES.md`](RELEASE_NOTES.md) — current release notes
- [`docs/REFACTORING.md`](docs/REFACTORING.md) — maintenance-refactor rules and module boundaries
- [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) — original project plan and historical direction
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture notes
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — state model notes
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) — test strategy
