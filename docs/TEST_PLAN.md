# StoryState Test Plan

## Phase 0 smoke test

- Tavo installs `.tpg`.
- Plugin name is Tavo StoryState.
- StoryState appears in Chat Settings/sidebar plugin section.
- Panel opens/closes.
- State is chat-scoped.
- Reset affects StoryState state, not chat messages.
- Narrator influence defaults ON for new and upgraded pre-v4 chats and can be disabled per chat.
- Normal narration works with plugin enabled.

## Identity tests

- narrator/simulation master never becomes NPC;
- Tavo is never treated as a character/entity merely because it is the app name;
- protagonist is never automatically created as NPC;
- recurring NPC is admitted;
- one-scene extra is usually ignored;
- alias resolves to canonical NPC;
- rename preserves relationship references;
- merge preserves data and evidence.

## Residence tests

- explicit “lives in Room 308” is captured;
- standing in Room 308 does not establish residence;
- explicit later move can update residence;
- unsupported inference cannot overwrite established residence.

## Relationship tests

- NPC → Protagonist works;
- NPC A → NPC B works;
- reverse direction can differ;
- Protagonist → NPC is never inferred;
- relationship preset is stored once per chat, not per edge;
- every edge uses the same active chat axes;
- switching presets preserves `Trust` and `Affinity`;
- a newly introduced third axis starts at `5/10`;
- disabling the third axis removes it from every active edge;
- no meaningful event = no score change;
- normal change bounded to ±1;
- unusually significant change bounded to ±2;
- every automatic change has valid saved-message evidence.

## Generation safety

- no extraction request starts during the narrator request;
- manual mode makes no unsolicited extraction calls;
- one scan = one extraction request;
- StoryState failure does not block normal RP;
- injection adds no visible fake chat message;
- injection makes no extra model call;
- injection context is capped and relevant;
- recent-message relevance supports pronoun follow-ups;
- short aliases do not match inside unrelated words;
- low/high relationship scores produce distinct behavioral guidance;
- directionality is explicit and reciprocity is never inferred;
- Attraction never implies consent/affection/obedience; Loyalty never implies obedience;
- disabling narrator influence leaves the generation request untouched.

## Session handoff tests

- preparing a handoff does not mutate the source session;
- campaign ID survives and session number increments in the fresh chat;
- NPC IDs, aliases, characterization, residence text, relationships, axes, status/stance, settings, knowledge arrays, arc arrays, and manual overrides survive;
- evidence text survives;
- old chat message IDs are cleared at import rather than reused;
- target chat receives a recovery snapshot before replacement;
- a fresh chat with no NPC name in the first user message still receives the continuation brief;
- NPC names inside the continuation brief seed normal relevance selection;
- continuation brief decrements only after successful narrator generations;
- continuation brief expires after four successful replies or can be stopped manually;
- source and target states are independent after import;
- global prepared-handoff registry remains bounded.


## Phase 2 extraction tests

- Assisted mode is the v7 default; Manual mode persists when explicitly chosen in v7.
- `/Scan Now/` can queue one scan independently of Assisted cadence.
- extractor JSON parser accepts one fenced JSON object but rejects non-JSON output.
- every proposed evidence ID must exist in the supplied scan batch.
- recurring NPC admission requires at least two distinct evidence messages.
- Tavo, narrator/simulation master, protagonist, and generic extras are rejected as NPC creates.
- stable manual NPC fields are not overwritten; dynamic current motive may update.
- standing in Room 308 does not establish residence; explicit “lives in Room 308” can.
- older evidence cannot overwrite a relationship manually corrected later.
- newer evidence can move that relationship again.
- any existing-axis movement is capped to ±2 even if the extractor proposes an extreme target.
- NPC → NPC creation never implies the reverse edge.
- a neutral/no-op relationship proposal is not created.
- Visual Library `TVL_VISUAL_REFERENCE` utility bubbles do not count toward scan cadence.
- successful commit is re-read and verified exactly; failed extraction leaves prior semantic state available.

## Knowledge tests (Phase 4)

- NPC can know a true secret;
- another NPC can merely suspect it;
- an NPC can believe a false statement without changing world truth;
- absence of knowledge record is not silently converted into KNOWS;
- irrelevant information is not promoted to tracked knowledge;
- consequential knowledge is injected only for relevant NPCs.

### Relationship editor cleanup

- Target NPC control is hidden and disabled when Target type is Protagonist.
- Relationship Status is structural and does not compete with relationship axes.
- Legacy free-form Condition values migrate without data loss into Status or Stance Summary.


### Axis-definition consistency

- UI shows a brief definition for every active axis.
- Relationship editor shows the same definition next to the corresponding score.
- Narrator context uses the same canonical definition strings.
- Tests fail if UI and injected semantic definitions drift apart.
