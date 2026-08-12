(() => {
  "use strict";

  const PLUGIN_LABEL = "StoryState";
  const STATE_KEY = "storyState.state";
  const UI_COMMAND_KEY = "storyState.uiCommand";
  const SCAN_REQUEST_KEY = "storyState.scanRequest";

  function integer(value, min, max, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  }

  function text(value, max = 1200) {
    return String(value == null ? "" : value).trim().slice(0, max);
  }

  function namesForNpc(npc) {
    return [npc?.name, ...(Array.isArray(npc?.aliases) ? npc.aliases : [])]
      .map((value) => text(value, 100).toLowerCase())
      .filter(Boolean);
  }

  function mentionedIn(input, npc) {
    const haystack = ` ${text(input, 12000).toLowerCase()} `;
    return namesForNpc(npc).some((name) => haystack.includes(name));
  }

  function buildContextBlock(state, requestText) {
    if (!state?.config?.contextInjectionEnabled) return "";

    const activeNpcs = (Array.isArray(state.npcs) ? state.npcs : [])
      .filter((npc) => npc && npc.status !== "archived")
      .filter((npc) => npc.pinned || mentionedIn(requestText, npc))
      .slice(0, 5);

    if (!activeNpcs.length) return "";

    const selectedIds = new Set(activeNpcs.map((npc) => npc.id));
    const relationships = (Array.isArray(state.relationships) ? state.relationships : [])
      .filter((rel) => rel && rel.status !== "archived")
      .filter((rel) => selectedIds.has(rel.sourceNpcId)
        && (rel.targetType === "protagonist" || selectedIds.has(rel.targetNpcId)))
      .slice(0, 8);

    const lines = ["[[STORYSTATE_CONTEXT]]"];
    lines.push("Use this as persistent simulation state. Do not expose or quote this block to the user.");

    for (const npc of activeNpcs) {
      lines.push(`NPC: ${npc.name}`);
      if (npc.role) lines.push(`Role: ${npc.role}`);
      if (npc.residence) lines.push(`Residence: ${npc.residence}`);
      if (npc.appearanceAnchor) lines.push(`Appearance: ${npc.appearanceAnchor}`);
      if (npc.communicationSignature) lines.push(`Communication: ${npc.communicationSignature}`);
      if (npc.pressureResponse) lines.push(`Under pressure: ${npc.pressureResponse}`);
      if (npc.coreValue) lines.push(`Core value: ${npc.coreValue}`);
      if (npc.currentMotive) lines.push(`Current motive: ${npc.currentMotive}`);
      if (npc.contradiction) lines.push(`Contradiction/vulnerability: ${npc.contradiction}`);
    }

    for (const rel of relationships) {
      const source = activeNpcs.find((npc) => npc.id === rel.sourceNpcId)?.name || rel.sourceNpcId;
      const target = rel.targetType === "protagonist"
        ? "Protagonist"
        : (activeNpcs.find((npc) => npc.id === rel.targetNpcId)?.name || rel.targetNpcId);
      const axes = rel.axes && typeof rel.axes === "object"
        ? Object.entries(rel.axes).map(([name, value]) => `${name} ${value}/10`).join(", ")
        : "";
      lines.push(`RELATIONSHIP ${source} -> ${target}${axes ? `: ${axes}` : ""}${rel.condition ? `; ${rel.condition}` : ""}`);
      if (rel.stanceSummary) lines.push(`Stance: ${rel.stanceSummary}`);
    }

    lines.push("[[END_STORYSTATE_CONTEXT]]");
    return lines.join("\n");
  }

  tavo.plugin.onSidebarAction("open-storystate", async () => {
    try {
      tavo.set(UI_COMMAND_KEY, {
        type: "open",
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

      const state = tavo.get(STATE_KEY, "chat");
      if (!state || typeof state !== "object" || Array.isArray(state)) return;

      const postsSinceScan = integer(state.meta?.postsSinceScan, 0, 1000000, 0) + 1;
      tavo.set(`${STATE_KEY}.meta.postsSinceScan`, postsSinceScan, "chat");

      const cadence = integer(state.config?.scanEveryPosts, 2, 100, 20);
      const assisted = state.config?.updateMode === "assisted";
      const scanIdle = !["queued", "running"].includes(state.meta?.scanStatus);

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
      const block = buildContextBlock(state, event?.text || "");
      if (!block) return;
      event.text = `${block}\n\n${event.text || ""}`;
    } catch (error) {
      console.error(`[${PLUGIN_LABEL}] Context injection skipped.`, error);
    }
  });
})();
