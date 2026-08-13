# Target Data Model

This file describes the intended model, not necessarily every field present in the current dev scaffold.

## NPC

```json
{
  "id": "npc-...",
  "name": "Reagan Mercer",
  "aliases": ["Reagan", "Mercer"],
  "role": "Student",
  "age": "19",
  "pronouns": "she/her",
  "residence": "Room 308, Halloran Hall",
  "residenceSourceMessageId": 123,
  "appearanceAnchor": "...",
  "communicationSignature": "...",
  "pressureResponse": "...",
  "coreValue": "...",
  "currentMotive": "...",
  "contradiction": "...",
  "lastMeaningfulMessageId": 456,
  "pinned": false,
  "status": "active",
  "mergedIntoNpcId": null,
  "manualOverrides": ["name", "residence", "communicationSignature"],
  "createdBy": "manual",
  "createdAt": "2026-08-12T20:00:00.000Z",
  "updatedAt": "2026-08-12T20:00:00.000Z"
}
```

Age/pronouns/residence stay empty when not established.

### Manual overrides

Stable identity/characterization fields manually corrected by the user are recorded in `manualOverrides` so later extraction can fill missing canon without casually rewriting explicit corrections. Dynamic `currentMotive` is intentionally **not** permanently locked; it must be allowed to evolve from newer story evidence.

Residence remains separately evidence-gated. A manually set residence has no fabricated source-message ID and should be treated as authoritative unless the user changes it.

## Chat relationship model

Relationship axis ownership lives in chat-scoped config, not in each relationship record.

```json
{
  "relationshipPreset": "general",
  "optionalThirdAxis": false
}
```

Presets:

- `general`: Trust / Affinity / Respect
- `dating`: Trust / Affinity / Attraction
- `fantasy`: Trust / Affinity / Loyalty

With the optional third axis disabled, every preset uses only `Trust` and `Affinity`. Changing the chat model remaps every relationship edge at once, preserves axes with the same meaning, and initializes a newly introduced axis to `5/10`. Relationship records never store their own preset or third-axis mode.

## Relationship

```json
{
  "id": "rel-...",
  "sourceNpcId": "npc-reagan",
  "targetType": "protagonist",
  "targetNpcId": null,
  "axes": {
    "Trust": 4,
    "Affinity": 6
  },
  "relationshipStatus": "Dating",
  "stanceSummary": "Cautious / repairing; interested but unwilling to give benefit of the doubt.",
  "evidence": [
    {
      "text": "Caught the protagonist lying; later accepted part of the explanation.",
      "sourceMessageId": 207
    }
  ],
  "lastMeaningfulChangeMessageId": 207,
  "status": "active"
}
```

For NPC → NPC, set `targetType` to `npc` and provide `targetNpcId`.

No automatic Protagonist → NPC records.

## Knowledge item (Phase 4)

```json
{
  "id": "info-...",
  "statement": "The protagonist carries the immunity gene.",
  "truth": "TRUE",
  "sensitivity": "SECRET",
  "sourceMessageId": 311,
  "status": "active"
}
```

## NPC knowledge state (Phase 4)

```json
{
  "id": "know-...",
  "npcId": "npc-reagan",
  "informationId": "info-immunity",
  "state": "SUSPECTS",
  "sourceMessageId": 340
}
```

A false belief is represented by an information item whose `truth` is `FALSE` paired with an NPC state of `BELIEVES`.

No record means StoryState has no evidence that the NPC knows/believes/suspects the information.

## Arc

Retain the useful Living World finite-arc structure later:

- title;
- actor/faction;
- goal;
- current situation;
- next likely move;
- trigger/deadline;
- resolution target;
- stage;
- player-known summary;
- director-only truth;
- directive;
- status/outcome.

### Relationship Status

`relationshipStatus` describes the structural relationship (Friends, Dating, Partners, Rivals, etc.). It does not override axis values. Free-form emotional nuance belongs in `stanceSummary`.


## Canonical axis semantics

The user-facing definitions and narrator-injected definitions must remain identical:

- **Trust:** willingness to believe, rely on, and be vulnerable with the target.
- **Affinity:** how much the NPC likes the target and enjoys their company; warmth and goodwill, not romance by itself.
- **Respect:** how highly the NPC regards the target's judgment, competence, character, or standing.
- **Attraction:** romantic or physical pull toward the target; it does not imply affection, trust, consent, or obedience.
- **Loyalty:** willingness to remain aligned with, defend, or prioritize the target when doing so has a cost; it does not imply obedience.

Scale: **0 = very low, 5 = neutral/uncertain, 10 = very high**.
