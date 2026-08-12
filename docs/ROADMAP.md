# Roadmap

## Phase 0 — Project initialization ✅

- distinct StoryState identity;
- dedicated repo structure;
- Living World 0.2.2 preserved in git tag/history;
- current Tavo plugin API verified;
- `generation:prepare` selected as primary context-feedback path;
- minimal installable dev scaffold.

## Phase 1 — State foundation & identity 🚧

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

Gate: local state-model tests pass; device verification is still required after the chat-wide axis migration to confirm NPCs/relationships survive reload/restart and model changes apply across all edges.

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

## Phase 3 — Context feedback

- deterministic recent-message relevance;
- max 5 NPC profiles;
- max 8 relationship edges;
- `generation:prepare` injection;
- no visible fake messages;
- no extra model call for injection;
- diagnostics/preview of exactly what would be injected.

Gate: an NPC can disappear for many turns and return with preserved characterization and relationship state.

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
