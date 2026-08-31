# Tavo StoryState

**Current development baseline:** `0.8.0-dev.12`  
**State schema:** 12  
**Tavo plugin spec:** 2

StoryState is a persistent simulation-state plugin for long-running Tavo role-play. It tracks organically introduced NPCs and selected world state, then injects only relevant state into narrator requests so the story can remain consistent without turning every NPC into a separate character card.

## Current capabilities

StoryState 0.8 includes:

- canonical NPC identity, aliases, stable characterization anchors, residence, motives, and manual overrides;
- conservative **local NPC identity admission** from repeated saved-story evidence, independent of the chat model/provider;
- identity-first model extraction for NPC enrichment and broader state updates;
- cross-batch candidate evidence for recurring characters;
- directional NPC → protagonist and NPC → NPC relationships with configurable axes;
- consequential Knowledge & Secrets with directional NPC knowledge states;
- finite World Arcs with active/dormant/resolved lifecycle and manual director nudges;
- Home dashboard, NPC directory/detail pages, diagnostics, and initials-based avatar placeholders;
- conservative batched assisted extraction plus manual **Scan Now**;
- local **Recover NPCs** for recent already-consumed history with zero model calls and without moving the normal scan cursor;
- separate **Enrich NPCs** for filling missing profile fields from relevant saved history using the normal scan model contract;
- stale-scan ownership/lease protection and fail-closed malformed extraction handling;
- model-only context injection through `generation:prepare`;
- optional Structured NPC Hints and optional Pura adapter, both off by default;
- campaign/session handoff between fresh chats;
- recovery snapshots and Living World import;
- native Tavo JSON import/export and direct **Copy Diagnostics**;
- mobile-first UI vNext: Home, NPCs, Relations, Knowledge, World, Settings.

## Runtime boundaries

StoryState owns persistent simulation state. It does **not** replace the narrator preset, campaign card, memory system, Lorebook, Visual Library, or Willforge.

Basic recurring NPC identity no longer depends on successful model extraction. The local layer establishes only that a recurring named character exists. The model scan and optional **Enrich NPCs** pass remain responsible for richer evidence-based profile detail. Enrichment is deliberately isolated from relationship, Knowledge, World Arc, and normal scan-cursor state.

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
      02a-ui-vnext.js
      02b-diagnostics-copy.js
      03-scan-controls-handoff.js
      04-extraction-parser.js
      05-npc-hint-adapters.js
      06-proposal-application.js
      06a-extractor-hardening.js
      06b-npc-candidate-ledger.js
      06c-identity-first-prompt.js
      06d-audited-scan-guard.js
      06e-local-npc-admission.js
      07-scan-runner.js
      07a-npc-backfill.js
      07b-npc-enrichment.js
      08-io-bootstrap.js
      08a-local-npc-listener.js
```

This keeps Tavo's runtime package simple while making development safer and easier to review.

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

The regression suite includes the original behavioral tests plus audited scenarios for Dreg/Wrenna/Harl-style traveling companions, local fallback, zero-model recovery, incremental saved-message identity admission, targeted history enrichment, and provider-failure preservation.

## Packaging

The `.tpg` is a ZIP-format archive whose root must contain `manifest.json`. GitHub Actions builds from modular source, runs the full regression suite, validates manifest/package version parity, and packages the runtime files.

## Release safety

`0.8.0-dev.12` keeps schema 12 and UI vNext, preserves model-independent NPC recovery, and adds a separate best-effort history-enrichment pass for sparse NPC profiles. `Recover NPCs` can never be blocked by the model/provider. `Enrich NPCs` may use the provider, but if that request fails the recovered identities, existing profile data, relationships, Knowledge, World Arcs, and normal scan cursor remain unchanged.

Before testing a development build on a valued campaign, export StoryState first. Keep the last known-good `.tpg` available for rollback.
