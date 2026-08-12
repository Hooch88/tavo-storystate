# Roadmap

## Phase 0 — Project initialization ✅

- distinct StoryState identity;
- dedicated repo structure;
- Living World 0.2.2 preserved in git tag/history;
- current Tavo plugin API verified;
- `generation:prepare` selected as primary context-feedback path;
- minimal installable dev scaffold.

## Phase 1 — State foundation & identity ✅

- new schema normalization/migration framework; ✅
- canonical NPC IDs; ✅
- aliases; ✅
- rename-safe references; ✅
- duplicate merge; ✅
- residence evidence preservation; ✅
- manual NPC editing; ✅
- backup/export/import; ✅
- relationship records separated from NPC objects; ✅
- manual NPC → Protagonist and NPC → NPC relationship editing; ✅
- one chat-wide relationship axis model with automatic edge remapping. ✅

Gate passed on-device for the Phase 1 manual state editor and chat-wide relationship model.

## Phase 1B — Manual state feedback ✅

- per-chat narrator influence toggle;
- enabled by default for new and upgraded pre-v4 chats;
- `generation:prepare` model-only state injection;
- deterministic recent-message + alias relevance;
- max 5 NPC profiles and max 8 relationship edges;
- compact behavioral interpretation for Trust, Affinity, Respect, Attraction, and Loyalty;
- explicit directionality/reciprocity safeguards;
- attraction never implies consent, affection, or obedience; loyalty never implies obedience;
- no additional model call for injection.

Gate: manual relationship changes materially alter the state supplied to the narrator while the visible saved chat remains unchanged.

## Phase 2 — Batched extraction

- one post-assistant extraction pass;
- relevant-state filtering before prompt assembly;
- propose NPC additions/updates;
- propose relationship additions/changes;
- validate evidence IDs;
- bounded changes;
- atomic commit + re-read verification;
- manual vs assisted modes.

Gate: no concurrent narrator/extractor request collisions; unchanged scenes do not churn state.

## Phase 3 — Context feedback hardening

- feed Phase 2 extracted state through the proven Phase 1B injection path;
- refine deterministic relevance using extraction-maintained meaningful-NPC metadata;
- keep max 5 NPC profiles and max 8 relationship edges;
- add diagnostics/preview of exactly what would be injected;
- pressure-test long chats and large NPC rosters for token bounds and false-positive relevance.

Gate: an NPC can disappear for many turns and return with preserved characterization and relationship state without irrelevant-state bloat.

## Phase 4 — Knowledge & Secrets

- information items;
- truth state (`TRUE`, `FALSE`, `UNKNOWN`);
- sensitivity (`NORMAL`, `PRIVATE`, `SECRET`);
- NPC states (`KNOWS`, `BELIEVES`, `SUSPECTS`);
- evidence IDs;
- selective injection;
- important explicit negative knowledge boundary when model omniscience is a risk.

Gate: NPCs can act on different information—including false beliefs—without converting those beliefs into world canon.

## Phase 5 — Optional Pura adapter

- parse supported structured NPC/relationship tags when present;
- use them as zero-cost hints;
- validation remains mandatory;
- StoryState still works without Pura tags.

## Phase 6 — World arc reintegration

- port/refactor proven finite arc logic;
- selective active-arc injection;
- retain manual advance/resolve/rethink workflows;
- avoid automatic endless-arc generation.

## Later only if playtesting justifies it

- explicit current-location state;
- faction/reputation model;
- richer knowledge distribution tooling;
- visualization graphs.
