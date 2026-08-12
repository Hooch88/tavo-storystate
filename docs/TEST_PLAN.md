# StoryState Test Plan

## Phase 0 smoke test

- Tavo installs `.tpg`.
- Plugin name is Tavo StoryState.
- StoryState appears in Chat Settings/sidebar plugin section.
- Panel opens/closes.
- State is chat-scoped.
- Reset affects StoryState state, not chat messages.
- Context injection defaults OFF.
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
- injection context is capped and relevant.

## Knowledge tests (Phase 4)

- NPC can know a true secret;
- another NPC can merely suspect it;
- an NPC can believe a false statement without changing world truth;
- absence of knowledge record is not silently converted into KNOWS;
- irrelevant information is not promoted to tracked knowledge;
- consequential knowledge is injected only for relevant NPCs.
