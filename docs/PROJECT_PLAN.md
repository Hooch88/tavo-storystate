# StoryState Project Plan

## Goal

Build a persistent NPC state manager for Tavo narrator/simulation-master role-play.

The core loop is:

> **Extract → Store → Retrieve → Supply**

The plugin does not write the story. The narrator model does.

## Responsibility boundaries

| Layer | Owns |
|---|---|
| Preset | simulation behavior, agency, causality, dialogue, prose, physical/knowledge limits |
| Campaign/Narrator card | campaign-specific world truths and tone |
| StoryState | persistent NPC identity, relationships, knowledge state, relevant world state |
| Memory | episodic history of what happened |
| Lorebook | durable authored setting canon |

Tavo is the host application and is never an NPC or relationship entity merely because its name appears in system/plugin context.

## Core features

### NPC identity

- stable NPC IDs;
- canonical names and aliases;
- role/occupation;
- optional age/pronouns when established;
- explicit residence + source message;
- appearance anchor;
- communication signature;
- pressure response;
- core value;
- current motive;
- contradiction/vulnerability;
- archive, rename, merge, pin.

### Directional relationship graph

Relationships are separate records.

Supported automatic directions:

- NPC → Protagonist;
- NPC → NPC.

Never infer Protagonist → NPC feelings.

Relationship axes are a **per-chat setting**, never a per-edge setting. Every relationship in a chat uses the same model so scores stay comparable and Phase 2 extraction has one schema to follow.

Default relationship scale is 0–10 with two shared axes and an optional third axis.

Presets:

- General: Trust / Affinity / Respect;
- Social / Romance: Trust / Affinity / Attraction;
- Adventure / Faction: Trust / Affinity / Loyalty.

`Trust` and `Affinity` remain stable across presets. Switching the chat model preserves same-named axes; a newly introduced third axis starts at neutral `5/10` rather than inheriting an unrelated metric.

Relationship values must influence narration, not merely decorate the UI. StoryState translates each active score into compact behavioral guidance before normal generation:

- Trust affects reliance, disclosure, belief, vulnerability, and benefit of the doubt;
- Affinity affects liking, warmth, patience, and desire for company;
- Respect affects credibility, admiration, and how seriously judgment/status is taken;
- Attraction affects romantic/physical interest but never implies consent, affection, or obedience;
- Loyalty affects willingness to remain aligned, defend, or accept costs but never implies obedience.

Scores are directional tendencies, not scripts. They do not override personality, circumstances, evidence, or character agency, and no reciprocal feeling is inferred.

Most scenes produce no score change. Normal meaningful changes are ±1; unusually significant changes may be ±2. Every automatic change requires saved-message evidence.

### Knowledge & Secrets

Planned core Phase 4, after the state feedback loop is proven.

Track only consequential information asymmetry:

- `KNOWS`;
- `BELIEVES`;
- `SUSPECTS`;
- truth state: `TRUE`, `FALSE`, `UNKNOWN`;
- sensitivity: `NORMAL`, `PRIVATE`, `SECRET`;
- evidence/source message.

Secrets are information items whose distribution matters; they are not a separate parallel subsystem.

### Residence

Residence remains evidence-gated.

Being present in a room/building does not establish residence. Current location is explicitly out of scope until later.

### World arcs

Preserve the useful finite-arc concepts from Living World, but isolate them while the NPC state loop is rebuilt. Arc injection is later than NPC/relationship injection.

## Context feedback

StoryState must supply compact relevant state to normal narrator requests without adding fake visible chat messages and without making another model call.

Primary mechanism: Tavo installed-plugin `generation:prepare` hook. Phase 1B established this path for manual state; Phase 2 feeds conservatively extracted state through the same proven narrator-feedback path. Relevance is selected locally from the current request, a small recent-message window, aliases, and pinned NPCs.

Hard default caps:

- max 5 NPC profiles;
- max 8 relationship edges;
- max 2 active arcs when arc injection is eventually enabled.

Knowledge injection receives its own small cap when implemented.

## Session continuity

A Tavo chat is not assumed to run forever. StoryState must support clean campaign continuation when the current chat becomes too large.

Phase 1C uses two layers:

1. **Exact structured transfer** — frozen StoryState data is stored in a plugin-specific global handoff registry and copied into the fresh chat.
2. **Compressed narrative transfer** — an optional continuation brief states the immediate time/location, active situation, relevant NPCs, unresolved developments, and exact continuation point.

The old chat remains unchanged. The new chat is independent after import. Campaign identity persists, session number increments, and old chat message IDs are detached rather than falsely reused in the new chat.

The continuation brief is deliberately temporary: it seeds the first four successful narrator replies, participates in normal NPC relevance selection, and then auto-expires. This avoids permanently spending context on the old session summary.

## Extraction

One batched extraction call is queued only after saved narration. Assisted mode runs when cadence is reached; Manual mode runs only from **Scan Now**. The extractor receives a bounded explicit packet with `context: false` rather than the full RP context.

One scan may propose:

- new NPCs;
- NPC updates;
- relationship additions/changes;
- knowledge changes (Phase 4);
- arc additions/changes after arc reintegration.

Unchanged records are omitted. Phase 2 validates all evidence IDs, rejects generic/reserved NPCs, treats residence as explicit-evidence-only, clamps existing relationship score movement to ±2, and preserves manual corrections against older evidence. Successful changes use a recovery snapshot plus whole-state re-read verification.

## Non-goals

Do not add during the core build:

- Clowuds-sized character sheets;
- inventory;
- stats/levels/achievements;
- reputation/faction graphs;
- continuous current-location tracking;
- maps;
- economy simulation;
- automatic Lorebook synchronization;
- a second memory system;
- autonomous plugin storytelling;
- relationship visualization graphs;
- per-turn extraction.

## Relationship field semantics

Relationship Status is structural context only. Current feelings are represented by axes and optional Stance Summary. Legacy free-form Condition values are migrated: recognized structural values become Relationship Status; other values move into Stance Summary.


### Relationship semantic consistency

StoryState must show the same brief axis definitions to the user that it supplies to the narrator. Axis names may not be treated as unexplained game stats; each has a stable behavioral meaning used in both UI and injected context.
