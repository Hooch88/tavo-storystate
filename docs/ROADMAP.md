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

## Phase 1C — Campaign session handoff ✅

- stable campaign ID and session number in chat state;
- prepare a cross-chat handoff without cloning chat history;
- bounded global registry (max 10 prepared handoffs);
- source chat remains unchanged;
- target chat receives an independent StoryState copy;
- structured state carries forward: NPCs, relationships, settings, knowledge arrays, arcs, manual overrides, and evidence text;
- old source-message IDs are detached because they are invalid in the fresh chat;
- optional manual continuation brief seeds relevance and narration in the new session;
- continuation brief auto-expires after four successful narrator replies and can be stopped manually;
- target state is backed up before replacement.

Gate: prepare in Session N, continue in a fresh chat as Session N+1, verify identical semantic state and no old-chat message IDs.

## Phase 2 — Batched extraction 🚧

Implemented in `0.2.0-dev.1`:

- one post-assistant batch extraction request when cadence is reached; ✅
- Manual (`Scan Now`) and Assisted automatic modes; ✅
- relevant-state filtering plus a compact known-NPC directory before prompt assembly; ✅
- conservative NPC create/update proposals with explicit admission reasons; ✅
- directional NPC → Protagonist and NPC → NPC relationship proposals; ✅
- saved-message evidence-ID validation before mutation; ✅
- explicit residence safeguard: presence alone does not establish residence; ✅
- relationship score changes hard-bounded to ±2 per scan; ✅
- manual relationship authority marker prevents older evidence from overwriting a correction; ✅
- stable manually locked NPC fields are preserved while `currentMotive` remains dynamic; ✅
- one recovery snapshot + whole-state commit + exact re-read verification; ✅
- Visual Library utility bubbles excluded from cadence/evidence; ✅
- compact last-scan summary and diagnostics. ✅

Device gate still required: verify real-model JSON reliability, unchanged-scene non-churn, and that automatic extraction does not interfere with normal narrator generation on the user's configured API/model.

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

- Phase 1B cleanup: status/stance separation and target-NPC visibility are complete before Phase 2 extraction.
