  tavo.plugin.onSidebarAction("open-storystate", async () => {
    try {
      tavo.set(UI_COMMAND_KEY, {
        type: "open",
        tab: "overview",
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      }, "chat");
    } catch (error) {
      console.error(`[${PLUGIN_LABEL}] Could not open panel.`, error);
      tavo.utils.toast("StoryState could not open.");
    }
  });

  // Tavo saves message:added only after streaming completes. Assisted extraction is
  // scheduled from assistant messages so it never competes with the narrator request.
  tavo.plugin.on("message:added", async (event) => {
    try {
      const message = event?.message;
      if (!message || message.hidden || !["user", "assistant"].includes(message.role)) return;
      const content = String(message.content || "");
      // Companion plugins may append assistant-side utility bubble
      // markers. These are not story posts and must not advance extraction cadence.
      if (content.includes("<!-- TVL_VISUAL_REFERENCE -->")) return;

      const state = tavo.get(STATE_KEY, "chat");
      if (!state || typeof state !== "object" || Array.isArray(state)) return;

      const postsSinceScan = integer(state.meta?.postsSinceScan, 0, 1000000, 0) + 1;
      tavo.set(`${STATE_KEY}.meta.postsSinceScan`, postsSinceScan, "chat");

      const cadence = integer(state.config?.scanEveryPosts, 2, 100, 20);
      const assisted = state.config?.updateMode === "assisted";
      const scanIdle = (state.meta?.scanStatus || "idle") === "idle";

      if (message.role === "assistant" && assisted && scanIdle && postsSinceScan >= cadence) {
        tavo.set(SCAN_REQUEST_KEY, {
          type: "scan",
          mode: "automatic",
          nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        }, "chat");
        tavo.set(`${STATE_KEY}.meta.scanStatus`, "queued", "chat");
      }
    } catch (error) {
      console.error(`[${PLUGIN_LABEL}] Could not schedule state scan.`, error);
    }
  });

  // Primary StoryState feedback path. generation:prepare changes only the model request;
  // it does not modify the user's saved message.
  tavo.plugin.on("generation:prepare", async (event) => {
    try {
      const state = tavo.get(STATE_KEY, "chat");
      const snapshot = await buildRelevanceSnapshot(event?.text || "");
      const result = buildContextBlock(state, snapshot);
      const npcHintProtocol = buildStructuredNpcHintProtocol(state);
      try { tavo.set(CONTEXT_PREVIEW_KEY, makeContextPreview(state, result), "chat"); } catch (_) {}
      if (!result.block && !npcHintProtocol) return;
      event.text = [result.block, npcHintProtocol, event.text || ""].filter(Boolean).join("\n\n");
    } catch (error) {
      console.error(`[${PLUGIN_LABEL}] Context injection skipped.`, error);
    }
  });

  // A session handoff brief is intentionally short-lived. Count only successful
  // narrator generations so retries/errors do not consume the continuation window.
  tavo.plugin.on("generation:success", async () => {
    try {
      const state = tavo.get(STATE_KEY, "chat");
      if (!state?.config?.contextInjectionEnabled || !state?.campaign?.continuationActive) return;
      const remaining = integer(state.campaign.continuationRemaining, 0, 12, 0);
      if (remaining <= 0) return;
      const next = Math.max(0, remaining - 1);
      tavo.set(`${STATE_KEY}.campaign.continuationRemaining`, next, "chat");
      if (next === 0) tavo.set(`${STATE_KEY}.campaign.continuationActive`, false, "chat");
    } catch (error) {
      console.error(`[${PLUGIN_LABEL}] Could not advance continuation handoff window.`, error);
    }
  });
})();
