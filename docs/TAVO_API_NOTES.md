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

This is the primary StoryState context injection mechanism. Phase 1B uses it for manual stored state; it adds no visible chat message and requires no second model generation.

Handler failure must degrade safely: Tavo ignores invalid/failed handler changes and continues generation.

## Relevance reads

Installed plugin entry scripts can use `tavo.message.count()` and `tavo.message.find(...)`. Phase 1B reads only a small recent visible-message window to resolve NPC relevance for pronoun/follow-up turns. This is local host data access, not an LLM call.

## Extraction timing

`message:added` fires after a message is added and saved; it does not repeatedly fire during streaming. StoryState uses saved assistant messages as the trigger point for assisted extraction scheduling.

## Independent extraction generation

`tavo.generate(prompt, options)` is a one-off generation call. StoryState should invoke it only after the assistant reply is saved, not during the narrator request.

## References

- https://docs.tavoai.dev/en/guides/plugin-development/
- https://docs.tavoai.dev/en/guides/javascript-api/
