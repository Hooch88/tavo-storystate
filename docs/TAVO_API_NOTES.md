# Verified Tavo Plugin API Notes

Checked against the current Tavo Plugin Development and TavoJS documentation on 2026-08-12.

## Packaging

- Plugins are zip-format `.tpg` packages.
- `manifest.json` must be at package root.
- New plugins should use `specVersion: 2`.
- HTML chat fragments require Advanced Rendering.

## Surfaces StoryState uses

- sidebar action for opening the management panel;
- `/chat/body/end` HTML fragment for the panel;
- entry-script plugin hooks for message lifecycle and generation lifecycle.

## Generation feedback path

Installed plugin entry scripts may register `generation:prepare` with `tavo.plugin.on(...)` when the manifest declares `generate` permission.

`generation:prepare` fires before the normal model request. Its mutable `event.text` is the last user message sent to the model for that request. Changes affect the model request only and do not alter the saved chat message.

This is the primary StoryState context injection mechanism. Phase 1B uses it for manual stored state, and Phase 1C also uses it for the temporary continuation brief after a session handoff. It adds no visible chat message and requires no second model generation.

Tavo's documented generation lifecycle hooks apply to normal reply/continuation/regeneration flows and **do not fire for independent TavoJS `tavo.generate(...)` requests**. That matters for Phase 1C: the four-reply continuation window is decremented on `generation:success` without being accidentally consumed by the later Phase 2 extractor's one-off generation call.

Handler failure must degrade safely: Tavo ignores invalid/failed handler changes and continues generation.

## Relevance reads

Installed plugin entry scripts can use `tavo.message.count()` and `tavo.message.find(...)`. Phase 1B reads only a small recent visible-message window to resolve NPC relevance for pronoun/follow-up turns. This is local host data access, not an LLM call.

## Cross-chat handoff storage

The TavoJS variable API supports both `chat` and `global` scopes. Chat variables are isolated to the current chat; global variables remain available across conversations.

Phase 1C stores only prepared handoff snapshots in a plugin-specific global key. Normal live StoryState remains chat-scoped. After the user chooses a handoff in the fresh chat, StoryState copies it into that chat rather than maintaining a live global campaign database.

No additional permission is required beyond StoryState's existing `variable` permission.

## Extraction timing

`message:added` fires after a message is added and saved; it does not repeatedly fire during streaming. StoryState uses saved assistant messages as the trigger point for assisted extraction scheduling.

## Independent extraction generation

`tavo.generate(prompt, options)` is a one-off generation call. StoryState should invoke it only after the assistant reply is saved, not during the narrator request.

## References

- https://docs.tavoai.dev/en/guides/plugin-development/
- https://docs.tavoai.dev/en/guides/javascript-api/


## Shared campaign identity contract

StoryState publishes a compact chat-scoped campaign identity at `com.hooch88.tavo.campaignIdentity`:

```json
{
  "id": "campaign-...",
  "name": "Campaign name",
  "sessionNumber": 2,
  "source": "storyState"
}
```

Other Hooch88/Tavo plugins may read this key to share one campaign namespace without depending on StoryState's full internal schema. StoryState remains the owner of campaign identity.
