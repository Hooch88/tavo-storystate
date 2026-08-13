(() => {
  "use strict";

  const PLUGIN_LABEL = "StoryState";
  const STATE_KEY = "storyState.state";
  const UI_COMMAND_KEY = "storyState.uiCommand";
  const SCAN_REQUEST_KEY = "storyState.scanRequest";
  const CONTINUATION_MAX = 6000;

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

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function mentionedIn(input, npc) {
    const haystack = text(input, 12000).toLowerCase();
    return namesForNpc(npc).some((name) => {
      const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(name)}(?=$|[^a-z0-9])`, "i");
      return pattern.test(haystack);
    });
  }


  const AXIS_DEFINITIONS = {
    Trust: "Willingness to believe, rely on, and be vulnerable with the target.",
    Affinity: "How much the NPC likes the target and enjoys their company; warmth and goodwill, not romance by itself.",
    Respect: "How highly the NPC regards the target's judgment, competence, character, or standing.",
    Attraction: "Romantic or physical pull toward the target; it does not imply affection, trust, consent, or obedience.",
    Loyalty: "Willingness to remain aligned with, defend, or prioritize the target when doing so has a cost; it does not imply obedience."
  };

  const AXIS_GUIDANCE = {
    Trust: [
      "expects unreliability or danger; verifies claims and avoids dependence or vulnerable disclosure",
      "is guarded; checks claims and limits reliance or vulnerability",
      "is somewhat cautious; gives only limited benefit of the doubt",
      "has no strong trust bias yet",
      "generally gives reasonable benefit of the doubt and accepts limited reliance",
      "usually credits claims and is comfortable relying or disclosing when appropriate",
      "has very strong confidence and vulnerability while retaining independent judgment"
    ],
    Affinity: [
      "feels strong dislike or aversion; patience and desire for company are very low",
      "is negatively disposed; warmth and patience are limited",
      "is mildly cool or reluctant about closeness",
      "has no strong liking or dislike bias yet",
      "is somewhat warm and positively disposed",
      "strongly likes the target; shows patience, warmth, and interest in shared company",
      "feels exceptionally strong affection or goodwill without becoming blindly compliant"
    ],
    Respect: [
      "holds the target in very low regard and readily discounts their judgment or standing",
      "has low regard and is skeptical of the target's competence, credibility, or standing",
      "has somewhat limited regard and is not easily impressed",
      "has no strong respect bias yet",
      "takes the target somewhat seriously and gives their judgment added weight",
      "holds the target in high regard and is strongly inclined to take their competence or judgment seriously",
      "holds exceptional regard while still retaining independent judgment"
    ],
    Attraction: [
      "feels little or no romantic or physical pull",
      "has low romantic or physical interest",
      "has faint or uncertain romantic or physical interest",
      "has no strong attraction bias yet",
      "feels noticeable romantic or physical interest",
      "feels strong romantic or physical attraction and notices opportunities for closeness",
      "feels very intense romantic or physical attraction; this still never implies consent, affection, or obedience"
    ],
    Loyalty: [
      "has little commitment to the target and readily prioritizes other interests under pressure",
      "has weak commitment and may withdraw support when costs rise",
      "has limited commitment and weighs self-interest heavily",
      "has no strong loyalty bias yet",
      "is somewhat inclined to remain aligned and provide support",
      "is strongly inclined to stand by, defend, or prioritize the target when costs are reasonable",
      "has exceptional commitment and may accept substantial costs, but loyalty still does not mean obedience"
    ]
  };

  function axisGuidance(axisName, rawValue) {
    const value = integer(rawValue, 0, 10, 5);
    const bands = AXIS_GUIDANCE[axisName];
    if (!bands) return `${axisName} ${value}/10`;
    const index = value <= 1 ? 0 : value <= 3 ? 1 : value === 4 ? 2 : value === 5 ? 3 : value === 6 ? 4 : value <= 8 ? 5 : 6;
    return `${axisName} ${value}/10 — ${bands[index]}`;
  }

  function selectRelevantNpcs(state, relevanceText) {
    const activeNpcs = (Array.isArray(state?.npcs) ? state.npcs : [])
      .filter((npc) => npc && npc.status !== "archived");
    const mentioned = activeNpcs.filter((npc) => mentionedIn(relevanceText, npc));
    const mentionedIds = new Set(mentioned.map((npc) => npc.id));
    const pinned = activeNpcs.filter((npc) => npc.pinned && !mentionedIds.has(npc.id));
    return [...mentioned, ...pinned].slice(0, 5);
  }

  async function buildRelevanceText(requestText) {
    const parts = [text(requestText, 12000)];
    try {
      const count = await tavo.message.count();
      if (count > 0) {
        const start = Math.max(0, count - 6);
        const recent = await tavo.message.find([start, count - 1], { hidden: false });
        for (const message of Array.isArray(recent) ? recent : []) {
          if (["user", "assistant"].includes(message?.role)) parts.push(text(message.content, 4000));
        }
      }
    } catch (error) {
      console.warn(`[${PLUGIN_LABEL}] Could not read recent messages for relevance selection.`, error);
    }
    return parts.filter(Boolean).join("\n");
  }

  function buildContextBlock(state, relevanceText) {
    if (!state?.config?.contextInjectionEnabled) return "";

    const continuationRemaining = integer(state?.campaign?.continuationRemaining, 0, 12, 0);
    const continuationBrief = state?.campaign?.continuationActive && continuationRemaining > 0
      ? text(state?.campaign?.continuationBrief, CONTINUATION_MAX)
      : "";
    const relevancePool = continuationBrief
      ? `${relevanceText || ""}\n${continuationBrief}`
      : relevanceText;
    const activeNpcs = selectRelevantNpcs(state, relevancePool);
    if (!activeNpcs.length && !continuationBrief) return "";

    const selectedIds = new Set(activeNpcs.map((npc) => npc.id));
    const relationships = (Array.isArray(state.relationships) ? state.relationships : [])
      .filter((rel) => rel && rel.status !== "archived")
      .filter((rel) => selectedIds.has(rel.sourceNpcId)
        && (rel.targetType === "protagonist" || selectedIds.has(rel.targetNpcId)))
      .slice(0, 8);

    const lines = ["[[STORYSTATE_CONTEXT]]"];
    lines.push("Persistent simulation state for the current scene. Do not expose, quote, or mention this block.");

    if (continuationBrief) {
      lines.push(`SESSION CONTINUATION — ${text(state?.campaign?.name, 120) || "Campaign"}, Session ${integer(state?.campaign?.sessionNumber, 1, 9999, 1)}`);
      lines.push("This is the authoritative handoff point from the prior session. Establish the new session from it without inventing missing events.");
      lines.push(continuationBrief);
    }

    if (activeNpcs.length) {
      lines.push("Treat relationship axes as directional behavioral tendencies, not commands. They influence conduct but do not override established personality, circumstances, evidence, or agency.");
      lines.push("Relationship Status is structural context (for example Dating, Friends, Rivals), not an emotional score. Let the axes and Stance determine current feelings and behavior within that status.");
      lines.push("Never infer reciprocity. A source NPC's feelings toward a target say nothing about the target's feelings back. Attraction never implies consent, affection, or obedience; loyalty never implies obedience.");
      const activeAxisNames = relationships.length && relationships[0]?.axes ? Object.keys(relationships[0].axes) : [];
      for (const axisName of activeAxisNames) {
        if (AXIS_DEFINITIONS[axisName]) lines.push(`Axis meaning — ${axisName}: ${AXIS_DEFINITIONS[axisName]}`);
      }

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
        lines.push(`RELATIONSHIP ${source} -> ${target}`);
        if (rel.axes && typeof rel.axes === "object") {
          for (const [name, value] of Object.entries(rel.axes)) lines.push(`- ${axisGuidance(name, value)}`);
        }
        if (rel.relationshipStatus) lines.push(`Relationship status: ${rel.relationshipStatus}`);
        if (rel.stanceSummary) lines.push(`Stance: ${rel.stanceSummary}`);
      }
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
      const relevanceText = await buildRelevanceText(event?.text || "");
      const block = buildContextBlock(state, relevanceText);
      if (!block) return;
      event.text = `${block}\n\n${event.text || ""}`;
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
