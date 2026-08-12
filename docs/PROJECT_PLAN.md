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

Primary mechanism: Tavo installed-plugin `generation:prepare` hook.

Hard default caps:

- max 5 NPC profiles;
- max 8 relationship edges;
- max 2 active arcs when arc injection is eventually enabled.

Knowledge injection receives its own small cap when implemented.

## Extraction

One batched extraction call after a completed assistant message, never concurrent with the narrator request.

One scan may propose:

- new NPCs;
- NPC updates;
- relationship additions/changes;
- knowledge changes (Phase 4);
- arc additions/changes after arc reintegration.

Unchanged records are omitted.

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
