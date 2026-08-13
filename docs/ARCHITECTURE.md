# Architecture

## Product identity

StoryState is a new plugin direction with Living World lineage. It is not a feature pile-on to Living World 0.2.2.

## State loop

```text
Normal RP request
      ↓
generation:prepare
      ↓
local relevance selector
      ↓
compact StoryState context
      ↓
Simulation Master generates normally
      ↓
assistant message is saved
      ↓
message:added
      ↓
(optional cadence reached)
      ↓
one batched extraction request
      ↓
validate evidence + schema
      ↓
atomic state commit + verification
```

The extraction request happens only after the assistant message is saved. The next normal RP request consumes locally assembled state through `generation:prepare`.

## State ownership

### Stable-ish NPC identity

Profile fields are filled conservatively and should not churn on every scan.

### Dynamic NPC state

`currentMotive` may change more frequently.

### Relationships

Stored separately from NPCs as directional edges. The **chat** owns one relationship axis model; individual edges store only values for those active axes. This keeps relationship scores comparable and gives extraction one consistent schema per campaign.

During `generation:prepare`, StoryState translates scores into behavioral tendencies. Directionality is explicit: source NPC → target. No reciprocal state is inferred. Relationship guidance influences conduct but cannot override established characterization, immediate circumstances, or agency.

### Knowledge

Stored separately from both NPCs and relationships. Knowledge is not automatically equivalent to world truth.

### Arcs

Separate module. Do not entwine arc state with relationship records.

## Evidence rule

The extractor proposes. StoryState validates. The database owns the current state.

Residence, relationship changes, and knowledge-state changes require real saved-message source IDs.

## Relevance

Selection must be local/deterministic before injection or extraction context assembly. No extra LLM call merely to decide what state is relevant.

Signals include:

- canonical name boundary match;
- alias boundary match;
- pinned NPC;
- names/aliases found in the recent visible-message window;
- recent meaningful NPC IDs after Phase 2;
- relationship adjacency to currently relevant NPCs;
- active arc actor references later.

## Session boundary

StoryState state is normally chat-scoped. A deliberate handoff is the exception:

```text
Old chat StoryState
      ↓ freeze snapshot
plugin-specific global handoff registry
      ↓ user chooses Continue here
Fresh chat StoryState copy
```

The source session is never live-linked to the target. Imported state is independent.

Message IDs are chat-local provenance and cannot cross the boundary safely. StoryState therefore clears old message-ID references at import while preserving the evidence text and semantic records. The continuation brief is injected temporarily and also participates in NPC relevance selection so a first message such as “Continue” can still recover the right active NPC state.

## Failure behavior

Normal RP must work when StoryState is disabled, has corrupt state, or skips injection. Plugin failure must degrade to “no extra state,” not block generation.
