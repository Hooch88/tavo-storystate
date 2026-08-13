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

The extraction request happens only after the assistant message is saved. In Assisted mode the entry script queues a scan only when cadence is reached; in Manual mode the user explicitly presses **Scan Now**. The HTML fragment then sends one independent `tavo.generate(...)` request with `context: false`, so the extractor sees only the bounded message/state packet StoryState supplies rather than inheriting the full RP context. The next normal RP request consumes the verified stored result through `generation:prepare`.

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

Residence and relationship changes require real saved-message IDs from the exact batch supplied to the extractor. Proposed IDs that are not in that batch are discarded. Residence also requires explicit living/residence wording; being physically present in a room is insufficient.

Existing relationship numeric changes are clamped to ±2 per scan. Manual relationship edits create an authority-through message marker; extractor evidence at or before that marker cannot overwrite the user's correction.

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

A failed Phase 2 extraction sets scan status to `error` and leaves the previously committed semantic state intact. A successful state-changing extraction saves a recovery snapshot, performs one whole-state write, then re-reads and compares the normalized state exactly; verification failure restores the previous state.
