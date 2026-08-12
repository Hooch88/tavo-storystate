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

- canonical name match;
- alias match;
- pinned NPC;
- recent meaningful NPC IDs;
- relationship adjacency to currently relevant NPCs;
- active arc actor references later.

## Failure behavior

Normal RP must work when StoryState is disabled, has corrupt state, or skips injection. Plugin failure must degrade to “no extra state,” not block generation.
