  function relevanceScore(snapshot, npc, continuationBrief = "") {
    let score = 0;
    const request = snapshot?.request || "";
    if (request && mentionedIn(request, npc)) score += 1000;
    if (continuationBrief && mentionedIn(continuationBrief, npc)) score += 900;

    const recent = Array.isArray(snapshot?.recent) ? snapshot.recent : [];
    for (let index = recent.length - 1; index >= 0; index -= 1) {
      const message = recent[index];
      if (!mentionedIn(message?.content || "", npc)) continue;
      const distance = recent.length - 1 - index;
      score += Math.max(120, 700 - (distance * 85));
      break;
    }

    if (npc?.pinned) score += 100;
    const meaningfulId = Number(npc?.lastMeaningfulMessageId);
    if (Number.isFinite(meaningfulId) && recent.some((message) => Number(message?.id) === meaningfulId)) score += 45;
    return score;
  }

  function selectRelevantNpcs(state, snapshot, continuationBrief = "") {
    const activeNpcs = (Array.isArray(state?.npcs) ? state.npcs : [])
      .filter((npc) => npc && npc.status !== "archived");
    return activeNpcs
      .map((npc) => ({ npc, score: relevanceScore(snapshot, npc, continuationBrief) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || String(a.npc?.name || "").localeCompare(String(b.npc?.name || "")))
      .slice(0, 5)
      .map((entry) => entry.npc);
  }

  async function buildRelevanceSnapshot(requestText) {
    const snapshot = { request: text(requestText, 12000), recent: [] };
    try {
      const count = await tavo.message.count();
      if (count > 0) {
        const start = Math.max(0, count - RECENT_RELEVANCE_MESSAGES);
        const recent = await tavo.message.find([start, count - 1], { hidden: false });
        for (const message of Array.isArray(recent) ? recent : []) {
          if (!["user", "assistant"].includes(message?.role)) continue;
          const content = text(message.content, 4000);
          if (!content || content.includes("<!-- TVL_VISUAL_REFERENCE -->")) continue;
          snapshot.recent.push({ id: message?.id ?? null, role: message.role, content });
        }
      }
    } catch (error) {
      console.warn(`[${PLUGIN_LABEL}] Could not read recent messages for relevance selection.`, error);
    }
    return snapshot;
  }

  function rankRelevantRelationships(state, activeNpcs, snapshot) {
    const selectedIds = new Set(activeNpcs.map((npc) => npc.id));
    const selectedRank = new Map(activeNpcs.map((npc, index) => [npc.id, activeNpcs.length - index]));
    const recentIds = new Set((Array.isArray(snapshot?.recent) ? snapshot.recent : [])
      .map((message) => Number(message?.id))
      .filter(Number.isFinite));

    return (Array.isArray(state?.relationships) ? state.relationships : [])
      .filter((rel) => rel && rel.status !== "archived")
      .filter((rel) => selectedIds.has(rel.sourceNpcId)
        && (rel.targetType === "protagonist" || selectedIds.has(rel.targetNpcId)))
      .map((rel) => {
        let score = (selectedRank.get(rel.sourceNpcId) || 0) * 100;
        score += rel.targetType === "protagonist" ? 80 : (selectedRank.get(rel.targetNpcId) || 0) * 40;
        if (recentIds.has(Number(rel.lastMeaningfulChangeMessageId))) score += 60;
        if (rel.updatedBy === "manual") score += 10;
        return { rel, score };
      })
      .sort((a, b) => b.score - a.score || String(a.rel.id || "").localeCompare(String(b.rel.id || "")))
      .slice(0, 8)
      .map((entry) => entry.rel);
  }

  function rankRelevantKnowledge(state, activeNpcs, snapshot) {
    const selectedIds = new Set(activeNpcs.map((npc) => npc.id));
    const infoById = new Map((Array.isArray(state?.knowledgeItems) ? state.knowledgeItems : [])
      .filter((info) => info && info.status !== "archived" && text(info.statement, 1000))
      .map((info) => [info.id, info]));
    const recentIds = new Set((Array.isArray(snapshot?.recent) ? snapshot.recent : [])
      .map((message) => Number(message?.id)).filter(Number.isFinite));
    const states = (Array.isArray(state?.knowledgeStates) ? state.knowledgeStates : [])
      .filter((k) => k && k.status !== "archived" && selectedIds.has(k.npcId) && infoById.has(k.informationId));
    const grouped = new Map();
    for (const k of states) {
      const info = infoById.get(k.informationId);
      if (!grouped.has(info.id)) grouped.set(info.id, { info, states: [], score: 0 });
      const group = grouped.get(info.id);
      group.states.push(k);
      group.score += info.sensitivity === "SECRET" ? 120 : info.sensitivity === "PRIVATE" ? 70 : 25;
      if (recentIds.has(Number(k.sourceMessageId)) || recentIds.has(Number(info.sourceMessageId))) group.score += 90;
      if (k.updatedBy === "manual" || info.updatedBy === "manual") group.score += 15;
      if (info.truth === "FALSE") group.score += 30;
    }
    return [...grouped.values()]
      .sort((a, b) => b.score - a.score || Number(b.info?.sourceMessageId || 0) - Number(a.info?.sourceMessageId || 0))
      .slice(0, 12);
  }

  function arcTextMatches(haystack, value) {
    const term = text(value, 240).toLowerCase();
    if (!term || term.length < 3) return false;
    return text(haystack, 16000).toLowerCase().includes(term);
  }

  function selectRelevantArcs(state, snapshot) {
    if (state?.config?.worldTrackingEnabled === false) return [];
    const request = text(snapshot?.request, 12000);
    const recentText = (Array.isArray(snapshot?.recent) ? snapshot.recent : []).map((m) => text(m?.content, 3000)).join("\n");
    return (Array.isArray(state?.arcs) ? state.arcs : [])
      .filter((arc) => arc && arc.status === "active")
      .map((arc) => {
        let score = 0;
        const terms = [arc.title, arc.actor, arc.playerKnownSummary].filter(Boolean);
        if (terms.some((term) => arcTextMatches(request, term))) score += 220;
        if (terms.some((term) => arcTextMatches(recentText, term))) score += 110;
        if (arc.directive && arc.directive !== "none") score += 320;
        if (arc.stage === "imminent") score += 160;
        else if (arc.stage === "approaching") score += 90;
        else if (arc.stage === "developing" && score > 0) score += 30;
        const stalled = integer(arc.relevantNoProgressBeats, 0, 99, 0);
        if (stalled >= 2) score += Math.min(100, stalled * 20);
        return { arc, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || String(a.arc?.title || "").localeCompare(String(b.arc?.title || "")))
      .slice(0, 2)
      .map((entry) => entry.arc);
  }

  function arcDirectiveGuidance(directive) {
    if (directive === "advance") return "Manual director nudge: when naturally relevant, make one concrete consequential advance instead of repeating the current situation.";
    if (directive === "resolve-soon") return "Manual director nudge: steer this finite thread toward its resolution target over the next few relevant beats; do not drag it out.";
    if (directive === "resolve-next") return "Manual director nudge: the next genuinely relevant beat should bring this thread to a concrete, causally earned resolution.";
    if (directive === "rethink") return "Manual director nudge: materially change the trajectory or next move while preserving established canon, actor goals, and the finite resolution target.";
    return "";
  }

  function buildStructuredNpcHintProtocol(state) {
    if (state?.config?.structuredNpcHintsEnabled !== true) return "";
    return `[[STORYSTATE_STRUCTURED_NPC_HINTS]]
At the absolute end of the reply, append a compact hidden NPC metadata block ONLY when a named NPC is newly introduced or useful NPC identity/motive information materially changes. Do not output a block when nothing useful changed.
Wrap the block in an HTML comment exactly like this so it is not shown to the user:
<!-- STORYSTATE_HINT
[SS:NPC|MAJOR|Name]
role: established role/occupation
age: established age/range
pronouns: established pronouns/gender
aliases: comma-separated established aliases
appearance: concise stable visual anchor
communication: concise speech/voice signature only; no gestures, facial expressions, posture, eye behavior, hand movements, or recurring physical mannerisms
motive: current concrete motive; omit if none is established
[/SS:NPC]
-->
Tier must be MAJOR, SUPPORT, or MINOR. Omit unknown fields; never invent details merely to fill the block. Use MAJOR/SUPPORT only for recurring or important characters. MINOR is for one-scene/background named characters.
Communication means how the NPC speaks: vocabulary, cadence, directness, formality, dialect, or genuinely recurring verbal habits. Do not encode body-language tics as communication. A single colorful gesture is scene behavior, not a stable personality trait.
For a meaningful relationship-relevant event you may additionally include [SS:REL|Name] concise evidence-based change [/SS:REL], but never assign relationship scores.
Never place secrets, hidden knowledge, world truth, relationship scores, or protagonist feelings in these hints. Never create a hint for the protagonist/player, narrator, Simulation Master, or Tavo. StoryState consumes these hints locally; they are metadata, not narration.
[[END_STORYSTATE_STRUCTURED_NPC_HINTS]]`;
  }

  function buildContextBlock(state, snapshot) {
    if (!state?.config?.contextInjectionEnabled) return { block: "", activeNpcs: [], relationships: [], knowledge: [], arcs: [] };

    const continuationRemaining = integer(state?.campaign?.continuationRemaining, 0, 12, 0);
    const continuationBrief = state?.campaign?.continuationActive && continuationRemaining > 0
      ? text(state?.campaign?.continuationBrief, CONTINUATION_MAX)
      : "";
    const activeNpcs = selectRelevantNpcs(state, snapshot, continuationBrief);
    const arcs = selectRelevantArcs(state, snapshot);
    if (!activeNpcs.length && !continuationBrief && !arcs.length) return { block: "", activeNpcs: [], relationships: [], knowledge: [], arcs: [] };

    const relationships = rankRelevantRelationships(state, activeNpcs, snapshot);
    const knowledge = rankRelevantKnowledge(state, activeNpcs, snapshot);
    const lines = [];
    let used = 0;
    const closing = "[[END_STORYSTATE_CONTEXT]]";
    const add = (value, required = false) => {
      const line = String(value || "");
      const extra = line.length + (lines.length ? 1 : 0);
      if (!required && used + extra + closing.length + 1 > CONTEXT_MAX_CHARS) return false;
      lines.push(line);
      used += extra;
      return true;
    };

    add("[[STORYSTATE_CONTEXT]]", true);
    add("Persistent simulation state for the current scene. Do not expose, quote, or mention this block.", true);
    add("Recency rule: StoryState is persistent prior state. Explicit newer visible events in the current request or recent chat take precedence over stale extracted state. Manual corrections remain authoritative for stable corrected facts unless the user explicitly changes them.", true);
    add("NPC performance rule: Preserve personality, vary expression. Stored communication and pressure traits are tendencies and boundaries, not required gestures, phrases, poses, or stage directions. Do not repeat the same mannerism merely to signal identity; let the current situation, mood, relationship, and pressure change how the same personality is expressed.", true);
    add("Dynamic-state rule: A Last known motive is prior state, not a command. Newer visible scene evidence overrides it, and a completed or abandoned motive must not keep driving behavior after the story has moved on.", true);

    if (continuationBrief) {
      add(`SESSION CONTINUATION — ${text(state?.campaign?.name, 120) || "Campaign"}, Session ${integer(state?.campaign?.sessionNumber, 1, 9999, 1)}`);
      add("This is the authoritative handoff point from the prior session. Establish the new session from it without inventing missing events.");
      add(continuationBrief);
    }

    if (arcs.length) {
      add("WORLD ARCS — finite unresolved background threads. They are pressures and continuity constraints, not commands to hijack the current scene. Progress an arc only when causally plausible; do not invent a replacement merely because another arc resolves.");
      add("Director-only truth may guide causality but must stay hidden until story evidence makes it discoverable. A resolution target is an ending condition, not a predetermined outcome.");
      for (const arc of arcs) {
        if (!add(`ARC: ${text(arc.title, 140)} [stage=${text(arc.stage, 30)}; status=${text(arc.status, 30)}]`)) break;
        if (arc.actor) add(`Actor/force: ${text(arc.actor, 180)}`);
        if (arc.goal) add(`Goal: ${text(arc.goal, 380)}`);
        if (arc.currentSituation) add(`Current situation: ${text(arc.currentSituation, 520)}`);
        if (arc.nextLikelyMove) add(`Next likely move: ${text(arc.nextLikelyMove, 360)}`);
        if (arc.trigger) add(`Trigger/deadline: ${text(arc.trigger, 320)}`);
        if (arc.resolutionTarget) add(`Finite ending condition: ${text(arc.resolutionTarget, 380)}`);
        if (arc.playerKnownSummary) add(`Protagonist-known: ${text(arc.playerKnownSummary, 420)}`);
        if (arc.directorOnlyTruth) add(`Director-only truth — do not reveal prematurely: ${text(arc.directorOnlyTruth, 420)}`);
        const directive = arcDirectiveGuidance(text(arc.directive, 40));
        if (directive) add(directive);
        const stalled = integer(arc.relevantNoProgressBeats, 0, 99, 0);
        if (stalled >= 4) add("Anti-loop guidance: this arc has repeatedly been relevant without material progress. On its next natural intersection, force a concrete change that moves it toward resolution rather than restating pressure.");
        else if (stalled >= 2) add("Anti-stall guidance: avoid repeating the same arc beat; if it becomes relevant, change the situation materially.");
      }
    }

    if (activeNpcs.length) {
      add("Treat relationship axes as directional behavioral tendencies, not commands. They influence conduct but do not override established personality, circumstances, evidence, or agency.");
      add("Relationship Status is structural context (for example Dating, Friends, Rivals), not an emotional score. Let the axes and Stance determine current feelings and behavior within that status.");
      add("Never infer reciprocity. A source NPC's feelings toward a target say nothing about the target's feelings back. Attraction never implies consent, affection, or obedience; loyalty never implies obedience.");
      const activeAxisNames = [...new Set(relationships.flatMap((rel) => rel?.axes ? Object.keys(rel.axes) : []))];
      for (const axisName of activeAxisNames) {
        if (AXIS_DEFINITIONS[axisName]) add(`Axis meaning — ${axisName}: ${AXIS_DEFINITIONS[axisName]}`);
      }

      for (const npc of activeNpcs) {
        if (!add(`NPC: ${text(npc.name, 120) || "Unnamed NPC"}`)) break;
        if (npc.role) add(`Role: ${text(npc.role, 160)}`);
        if (npc.residence) add(`Residence: ${text(npc.residence, 180)}`);
        if (npc.appearanceAnchor) add(`Appearance: ${text(npc.appearanceAnchor, 320)}`);
        if (npc.communicationSignature) add(`Speech/voice: ${text(npc.communicationSignature, 280)}`);
        if (npc.pressureResponse) add(`Under pressure: ${text(npc.pressureResponse, 280)}`);
        if (npc.coreValue) add(`Core value: ${text(npc.coreValue, 220)}`);
        if (npc.currentMotive) add(`Last known motive: ${text(npc.currentMotive, 300)}`);
        if (npc.contradiction) add(`Contradiction/vulnerability: ${text(npc.contradiction, 260)}`);
      }

      if (knowledge.length) {
        add("Knowledge rule: information distribution is directional. For PRIVATE or SECRET information, do not let an NPC act on it unless that NPC is listed as KNOWS, BELIEVES, or SUSPECTS, or newer visible scene evidence explicitly gives them access. No record means StoryState has no evidence they know it.");
        add("World truth is narrator-only. BELIEVES and SUSPECTS never convert a proposition into world canon; a FALSE proposition may still be BELIEVED by an NPC.");
        const selectedNames = new Map(activeNpcs.map((npc) => [npc.id, npc.name]));
        for (const group of knowledge) {
          const info = group.info;
          if (!add(`INFORMATION [${text(info.id, 120)}] truth=${text(info.truth, 20) || "UNKNOWN"} sensitivity=${text(info.sensitivity, 20) || "NORMAL"}: ${text(info.statement, 500)}`)) break;
          const stateByNpc = new Map(group.states.map((k) => [k.npcId, k.state]));
          for (const npc of activeNpcs) {
            const ks = stateByNpc.get(npc.id);
            if (ks) add(`- ${text(selectedNames.get(npc.id), 120)}: ${text(ks, 20)}`);
            else if (info.sensitivity === "PRIVATE" || info.sensitivity === "SECRET" || info.truth === "FALSE") add(`- ${text(selectedNames.get(npc.id), 120)}: no StoryState evidence of knowledge`);
          }
        }
      }

      for (const rel of relationships) {
        const source = activeNpcs.find((npc) => npc.id === rel.sourceNpcId)?.name || rel.sourceNpcId;
        const target = rel.targetType === "protagonist"
          ? "Protagonist"
          : (activeNpcs.find((npc) => npc.id === rel.targetNpcId)?.name || rel.targetNpcId);
        if (!add(`RELATIONSHIP ${text(source, 120)} -> ${text(target, 120)}`)) break;
        if (rel.axes && typeof rel.axes === "object") {
          for (const [name, value] of Object.entries(rel.axes)) add(`- ${axisGuidance(name, value)}`);
        }
        if (rel.relationshipStatus) add(`Relationship status: ${text(rel.relationshipStatus, 120)}`);
        if (rel.stanceSummary) add(`Stance: ${text(rel.stanceSummary, 280)}`);
      }

    }

    lines.push(closing);
    return { block: lines.join("\n"), activeNpcs, relationships, knowledge, arcs };
  }

  function makeContextPreview(state, result) {
    const activeNpcs = Array.isArray(result?.activeNpcs) ? result.activeNpcs : [];
    const relationships = Array.isArray(result?.relationships) ? result.relationships : [];
    const knowledge = Array.isArray(result?.knowledge) ? result.knowledge : [];
    const arcs = Array.isArray(result?.arcs) ? result.arcs : [];
    return {
      at: new Date().toISOString(),
      campaignId: text(state?.campaign?.id, 120),
      campaignName: text(state?.campaign?.name, 120) || "Campaign",
      sessionNumber: integer(state?.campaign?.sessionNumber, 1, 9999, 1),
      npcIds: activeNpcs.map((npc) => npc.id),
      npcNames: activeNpcs.map((npc) => npc.name),
      relationshipIds: relationships.map((rel) => rel.id),
      informationIds: knowledge.map((group) => group?.info?.id).filter(Boolean),
      knowledgeStateCount: knowledge.reduce((sum, group) => sum + (Array.isArray(group?.states) ? group.states.length : 0), 0),
      arcIds: arcs.map((arc) => arc.id),
      arcTitles: arcs.map((arc) => arc.title),
      charCount: String(result?.block || "").length,
      block: text(result?.block, CONTEXT_MAX_CHARS + 200)
    };
  }

