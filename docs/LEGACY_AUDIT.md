# Living World 0.2.2 — KEEP / REFACTOR / DELETE Audit

The local git tag `living-world-0.2.2-reference` preserves the untouched implementation.

## KEEP / REUSE CONCEPTS OR CODE

- chat-scoped state via Tavo variables;
- sidebar command → panel open mechanism;
- schedule assisted scans only after saved assistant messages;
- scan locks/status and interrupted-scan recovery;
- bounded history windows;
- generation timeouts and failure diagnostics;
- evidence normalization with source message IDs;
- residence only when explicitly established;
- atomic-ish full-state write with revision increments;
- re-read verification after assisted extraction;
- archive/restore semantics;
- finite world-arc resolution target and anti-stall concepts;
- theme-aware panel ideas where they remain useful.

## REFACTOR

- `newState` / `normalizeState` → StoryState schema;
- NPC normalization → aliases, optional demographics, no nested relationship;
- relationship presets → separate directional relationship records;
- `compactTrackedState` → relevance-bounded NPC/relationship/knowledge subsets;
- history scan prompt → batched StoryState extraction contract;
- `scanNpc` / `mergeNpc` → conservative identity merge + relationship updates;
- `applyScanResults` → multi-collection validation and one commit;
- character panel → identity + relationship subviews;
- `buildInjectionPreview` → real context builder consumed from entry hook;
- migration logic → explicit Living World 0.2.2 import/migration tool rather than implicit shape compatibility.

## DELETE / DO NOT PORT

- `npc.currentStance` as a profile field;
- `npc.relationship` nested under NPC;
- implicit “every relationship is toward protagonist” assumption;
- viewer-only injection as the final architecture;
- unused/reserved controls that do not work yet;
- automatic fuzzy duplicate merging;
- full old 2,600-line panel as the starting StoryState UI;
- any behavior that treats narrator/simulation master/Tavo application as NPCs.

## ISOLATE FOR LATER

- world arc UI and automation;
- arc injection;
- automatic repopulation/replacement.

These remain useful, but debugging them simultaneously with the new NPC/relationship core would be unnecessary complexity creep.
