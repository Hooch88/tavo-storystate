# StoryState Release Notes

## 0.8.0-dev.6 — UI vNext preview

- Rebuilds the StoryState panel around a mobile-first dark interface inspired by the approved UI direction.
- Character cards are now compact full-width mobile rows with prominent circular avatar slots, names, roles, residence chips, pin state, and clearer tap affordance.
- NPC avatars default to initials generated from the NPC name; no image is required and no avatar data is added to StoryState schema 12.
- Character, relationship, knowledge, world-arc, activity, and settings views receive a consistent card, spacing, typography, navigation, and status treatment.
- NPC, relationship, knowledge, arc, and session-handoff editors now open as focused overlay sheets instead of expanding into the list beneath them.
- Settings accordions, relationship bars, knowledge sensitivity states, world-arc urgency states, activity history, search/toolbars, and the bottom navigation were visually refined for mobile use.
- Existing extraction, scan cadence, context injection, StoryState persistence keys, relationship semantics, knowledge semantics, world-arc behavior, and schema remain unchanged.
- Portrait/image assignment is intentionally not implemented in this preview. The initials slot is designed so a future optional Visual Library image can replace it without changing card layout.

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
