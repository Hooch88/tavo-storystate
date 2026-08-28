# StoryState Release Notes

## 0.8.0-dev.6 — Release-integrity and extractor-schema validation

- Requires all five proposal arrays before extractor output can be accepted; schema-less JSON can no longer advance the scan cursor as an empty successful scan.
- Commits the generated panel containing the dev.5 runtime hardening.
- Makes tests fail when generated runtime files drift from modular source instead of silently rebuilding in CI.
- Adds behavioral regression coverage for schema validation, two-stage repair, pressure-response gating, and bounded batching.
- Corrects repair-attempt progress and diagnostic wording.
- Keeps state schema 12 and all persistence keys unchanged.

## 0.8.0-dev.5 — Thinking-model extractor hardening

- Removes closed `<think>` and `<analysis>` blocks before parsing extractor output.
- Allows up to two bounded syntax-only repair attempts, capped at 120 seconds and 60 seconds.
- Reduces extraction batches to 16 floors and 24,000 characters to reduce truncation risk.
- Requires an existing NPC, two evidence messages, and a clean psychological pattern before extraction can establish `pressureResponse`.
- Keeps state schema 12 and all persistence keys unchanged.

## 0.8.0-dev.4 — Structured voice hardening

- Structured NPC Hints no longer define Communication/Speech fields.
- Structured hint parsing ignores legacy `communication`, `voice`, and `speech` fields instead of persisting them.
- Stable `communicationSignature` is now learned only by extraction with at least two evidence messages.
- Extractor guidance requires repeated actual NPC dialogue evidence for a stable voice signature.
- No schema, relationship, Knowledge, World Arc, scan cadence, or persistence-key changes.

## 0.8.0-dev.3 — NPC personality quality

- Tightens NPC extraction semantics so Communication stores speech/voice rather than physical mannerisms.
- Clarifies Pressure Response, Core Value, Current Motive, Contradiction, and Appearance boundaries.
- Adds explicit `clearCurrentMotive` extraction behavior for completed or abandoned motives without changing StoryState schema 12.
- Narrator context now says to preserve personality while varying its expression and treats stored traits as tendencies rather than recurring stage directions.
- Narrator context labels dynamic motive state as **Last known motive** so newer scene evidence takes precedence.
- Structured NPC Hints now forbid body-language tics in the communication field.
- No relationship, Knowledge, World Arc, scan cadence, persistence-key, or schema changes.

## 0.8.0-dev.2

Tavo 1.x compatibility maintenance release based directly on the verified `0.8.0-dev.1` plugin package.

### Fixed

- Replaced legacy browser/WebView JSON export handling with Tavo's native file API.
- Replaced legacy hidden file-input JSON import handling with Tavo's native file picker and file loading API.
- Added the required `file` permission to the plugin manifest.

### Preserved

- No changes to automatic scan scheduling or extraction behavior.
- No changes to NPC, relationship, Knowledge, World Arc, Activity, or Settings behavior.
- No changes to StoryState schema or campaign data.
- No changes to the Phase 4 Knowledge & Secrets, Phase 5 adapter, Phase 6 World Arc, or Structured NPC Hint features.

### Validation

Verified on Tavo 1.2.7:

- StoryState panel opens with the current six-section mobile UI.
- JSON export produces a populated `tavo-storystate` file.
- Exported state includes schema version 12 data, NPCs, relationships, knowledge, arcs, diagnostics, and scan metadata.
- JSON import successfully restores the exported state.
- Existing StoryState campaign state remains intact after updating the plugin.

### Compatibility note

A prior experimental `0.2.0-dev.2` package was built from stale repository source and is not a valid successor to the 0.8.x line. Use `0.8.0-dev.2` or later.
