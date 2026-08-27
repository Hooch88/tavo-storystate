# StoryState Maintenance Refactor

## Goal

Reduce change risk without changing StoryState behavior, state schema, saved keys, or Tavo integration contracts.

The `0.8.0-dev.2` runtime artifacts are the behavioral baseline. The initial refactor is intentionally **source-organization only**: `entry.js` and `ui/panel.html` are generated from modular source and must remain byte-for-byte reproducible.

## Non-goals

This maintenance refactor does not:

- change schema 12;
- rename `storyState.*` variables;
- alter assisted scan cadence or extraction prompts;
- alter scan ownership, leases, recovery, or retries;
- change relationship semantics;
- change Knowledge, World Arc, Pura, or Structured NPC Hint behavior;
- change the six-tab user interface;
- change campaign handoff behavior;
- add features.

## Module boundaries

### Entry runtime

`src/entry/01-core.js`
: shared constants, text helpers, axis definitions, basic relevance helpers.

`src/entry/02-context.js`
: relevance ranking, knowledge/arc selection, structured-hint protocol, context block construction and preview data.

`src/entry/03-hooks.js`
: Tavo lifecycle and sidebar registrations.

### Panel runtime

`src/ui/styles.css`
: panel styling only.

`src/ui/markup.html`
: panel DOM structure only.

`src/ui/runtime/01-state.js`
: schema normalization, migrations, persistence, recovery, relationships, knowledge, arcs, campaign identity.

`02-rendering-editors.js`
: rendering, tabs, NPC/relationship/knowledge/arc editors and manual edits.

`03-scan-controls-handoff.js`
: scan UI settings, scan progress controls, campaign handoff controls.

`04-extraction-parser.js`
: extractor JSON parsing, repair, evidence resolution helpers.

`05-npc-hint-adapters.js`
: Pura and Structured NPC Hint parsing/application.

`06-proposal-application.js`
: extraction proposal validation/application and extraction prompt construction.

`07-scan-runner.js`
: message batch collection, scan ownership/lease, timeout/recovery, extraction execution and atomic commit.

`08-io-bootstrap.js`
: JSON import/export, Living World import, recovery restore, context-preview copy, DOM event binding and startup polling.

## Guardrails

1. Edit modular `src/` files, not generated runtime artifacts.
2. Run `npm run build` after source changes.
3. Run `npm test`; build parity and baseline regression must pass.
4. Schema or persistence changes require a separate release and migration tests.
5. Feature work should not be combined with structural refactoring.
6. A known-good `.tpg` must be retained before device testing.
