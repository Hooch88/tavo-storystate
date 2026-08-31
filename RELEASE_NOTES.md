# StoryState Release Notes

## 0.8.0-dev.8 — Extraction recovery and NPC backfill

- Fixes a fresh-story scan failure where malformed extractor output could be repaired into empty proposal arrays, accepted as a successful scan, and permanently advance the scan cursor past recurring NPCs.
- A repaired extractor response containing zero proposals now fails closed: StoryState records an error, pauses automatic retries, preserves existing state, and leaves `lastScannedFloor` / `lastScannedMessageId` unchanged so the same batch can be retried safely.
- Corrects the JSON repair contract from four arrays to all five live extractor arrays: NPCs, relationships, information, NPC knowledge, and World Arcs.
- Adds a **Backfill NPCs** recovery action beside Scan Now. It re-checks the most recent bounded story history for missed recurring/important NPCs using one focused extraction request.
- NPC backfill is intentionally narrow: only NPC create/update proposals are applied. Relationships, Knowledge, World Arcs, normal scan cadence, and the normal scan cursor are left untouched.
- Backfill guidance explicitly recognizes clearly established traveling companions, escape companions, party members, roommates, coworkers, and similarly persistent companions as obvious recurring/supporting NPCs when the story strongly establishes that role.
- Adds regression coverage for repaired-empty scans and for recovering Dreg/Harl/Wrenna-style recurring companions from already-consumed recent history without altering other StoryState collections.
- Schema remains 12; no persistence-key migration is required.

## 0.8.0-dev.7 — Structural UI vNext rebuild

- Replaces the prior skin-only preview with the actual new StoryState information architecture.
- StoryState now opens to a **Home / Session State** dashboard rather than directly to the character roster.
- The dashboard contains live metric tiles, current campaign and scan state, Scan/Add NPC/Export/New Session quick actions, recent StoryState changes, and pinned characters.
- Bottom navigation is now **Home / NPCs / Relations / Knowledge / World / Settings**. The previous standalone Activity page is retained internally only for compatibility; recent activity is surfaced on Home.
- The NPC directory gains a dedicated screen header, search, All/Pinned/Active/Archived filters, richer character rows, motive preview, residence and updated-time chips, and initials-based avatars.
- Tapping an NPC opens a read-first profile view with identity metadata, stable character fields, current motive, connected relationships, relationship axes, and directional knowledge. Editing is a secondary action from the profile.
- Initials remain the default avatar placeholder. No portrait dependency or avatar field was added to schema 12.
- The UI vNext implementation is isolated to a runtime presentation module. Existing StoryState persistence, extraction, scan cadence, context injection, relationship semantics, Knowledge semantics, World Arc semantics, and schema remain unchanged.
- The header carries a visible **UI vNext** badge so testers can immediately distinguish this package from the earlier skin-only preview.

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
