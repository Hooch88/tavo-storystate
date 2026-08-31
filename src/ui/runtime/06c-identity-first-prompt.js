  function compactExtractionState(state,messages){
    const scanText=messages.map(m=>m.content).join("\n"),relevant=scanRelevantNpcs(state,scanText).slice(0,8),relevantIds=new Set(relevant.map(n=>n.id));
    return {
      npcDirectory:(state.npcs||[]).filter(active).slice(0,80).map(n=>({id:n.id,name:n.name,aliases:n.aliases||[],role:text(n.role,120)})),
      relevantNpcs:relevant.map(n=>({id:n.id,name:n.name,role:text(n.role,120),residence:text(n.residence,120),appearanceAnchor:text(n.appearanceAnchor,180),communicationSignature:text(n.communicationSignature,180),pressureResponse:text(n.pressureResponse,180),coreValue:text(n.coreValue,140),currentMotive:text(n.currentMotive,180),contradiction:text(n.contradiction,180),manualOverrides:n.manualOverrides||[]})),
      relationships:(state.relationships||[]).filter(r=>active(r)&&relevantIds.has(r.sourceNpcId)&&(r.targetType==="protagonist"||relevantIds.has(r.targetNpcId))).slice(0,12).map(r=>({id:r.id,sourceNpcId:r.sourceNpcId,targetType:r.targetType,targetNpcId:r.targetNpcId,axes:r.axes,relationshipStatus:r.relationshipStatus,stanceSummary:text(r.stanceSummary,180),manualAuthorityThroughMessageId:r.manualAuthorityThroughMessageId})),
      information:(state.knowledgeItems||[]).filter(active).slice(-30).map(i=>({id:i.id,statement:text(i.statement,220),truth:i.truth,sensitivity:i.sensitivity,manualAuthorityThroughMessageId:i.manualAuthorityThroughMessageId})),
      knowledge:(state.knowledgeStates||[]).filter(k=>active(k)&&relevantIds.has(k.npcId)).slice(-30).map(k=>({npcId:k.npcId,informationId:k.informationId,state:k.state,manualAuthorityThroughMessageId:k.manualAuthorityThroughMessageId})),
      arcs:state.config.worldTrackingEnabled===false?[]:(state.arcs||[]).filter(a=>["active","dormant"].includes(a.status)).slice(0,10).map(a=>({id:a.id,title:a.title,actor:text(a.actor,120),goal:text(a.goal,180),currentSituation:text(a.currentSituation,220),nextLikelyMove:text(a.nextLikelyMove,160),trigger:text(a.trigger,140),resolutionTarget:text(a.resolutionTarget,180),stage:a.stage,status:a.status,directive:a.directive,manualAuthorityThroughMessageId:a.manualAuthorityThroughMessageId}))
    }
  }
  buildExtractionPrompt=function(state,messages,chatInfo={}){
    const reserved=auditedReservedNames(chatInfo),currentCandidates=collectAuditedNpcCandidates(messages,reserved),candidateHints=combinedNpcCandidateHints(state,currentCandidates).map(c=>({name:c.name,evidenceMessageIds:c.evidence.map(e=>e.id),current:c.current,personEvidence:c.personCount,companionEvidence:c.companionCount,qualifiesAsRecurring:c.strong,mayBeObviousCompanion:c.obvious,priorEvidence:c.evidence.filter(e=>!c.currentIds?.has?.(e.id)).slice(-2).map(e=>({id:e.id,text:e.text}))})),snapshot=compactExtractionState(state,messages),axes=relationshipAxesForConfig(state.config),story=messages.map(m=>`[${m.id}] ${String(m.role||"").toUpperCase()}: ${m.content}`).join("\n\n");
    return `You are StoryState's evidence-based state extractor. Analyze only the supplied saved messages. Do not continue the story. Return one valid JSON object, with no prose, reasoning, markdown, or code fence. Your first character must be { and your last character must be }.

PRIORITY ORDER:
1. NPC IDENTITY FIRST. Do not omit an eligible recurring or clearly important named character to spend tokens on personality detail or other categories.
2. Clear updates to already tracked NPCs.
3. Meaningful relationship, consequential knowledge, and finite world-arc deltas.
If output space is tight, omit low-priority detail; never omit an eligible NPC identity.

NPC RULES:
- Create only named story characters. Never create the protagonist, narrator, Tavo, system entities, unnamed crowds, or one-line extras.
- Admission reasons: recurring (at least two real evidence message IDs), substantial_protagonist_relationship, meaningful_existing_npc_relationship, important_arc, obvious_recurring_or_major.
- A clearly established traveling companion, party member, escape companion, guide, roommate, coworker, or similarly persistent attachment may use obvious_recurring_or_major from one strong message.
- For a NEW NPC, keep fields light: role, age, pronouns, residence, appearanceAnchor, currentMotive. Do not establish communicationSignature, pressureResponse, coreValue, or contradiction on creation.
- For an EXISTING NPC, stable personality fields are optional and require clear repeated evidence. communicationSignature is speech/voice only and needs two speaking messages. pressureResponse needs two genuine pressure messages. Never use gestures or stage directions as stable traits.
- Residence requires explicit evidence that the NPC lives there. Current motive may be replaced or cleared only when the story establishes it.

OTHER STATE:
- Relationships are directional NPC→Protagonist or NPC→NPC. Most scenes cause no change. Values use axes ${axes.join(" / ")} on 0–10; automatic movement is bounded later by StoryState.
- Track only consequential information. An NPC belief does not change world truth. Use KNOWS, BELIEVES, or SUSPECTS only with evidence.
- World arcs must be finite unresolved threads with actor, goal, current situation, and a concrete resolution target. Do not invent replacement arcs.
- Every proposal must cite supplied or pending-candidate message IDs. Return at most 8 NPC, 4 relationship, 4 information, 6 knowledge, and 2 arc proposals.

HEURISTIC NPC CANDIDATES (hints, not facts; classify carefully):
${JSON.stringify(candidateHints)}

CURRENT STORYSTATE:
${JSON.stringify(snapshot)}

SAVED MESSAGES:
${story}

OUTPUT SHAPE:
{"npcProposals":[{"action":"create|update","npcId":"existing id or null","name":"canonical name","aliases":[],"admissionReason":"recurring|substantial_protagonist_relationship|meaningful_existing_npc_relationship|important_arc|obvious_recurring_or_major","clearCurrentMotive":false,"fields":{"role":"","age":"","pronouns":"","residence":"","appearanceAnchor":"","communicationSignature":"existing NPC only","pressureResponse":"existing NPC only","coreValue":"existing NPC only","currentMotive":"","contradiction":"existing NPC only"},"evidenceMessageIds":[123]}],"relationshipProposals":[{"action":"create|update","sourceNpcId":"id or null","sourceName":"name","targetType":"protagonist|npc","targetNpcId":"id or null","targetName":"name or empty","axisTargets":{"${axes[0]||"Trust"}":5,"${axes[1]||"Affinity"}":5},"relationshipStatus":"","stanceSummary":"","stanceChanged":false,"evidenceMessageIds":[123]}],"informationProposals":[{"action":"create|update","informationId":"id or null","key":"short key","statement":"exact consequential proposition","truth":"TRUE|FALSE|UNKNOWN","sensitivity":"NORMAL|PRIVATE|SECRET","evidenceMessageIds":[123]}],"knowledgeProposals":[{"npcId":"id or null","npcName":"name","informationId":"id or null","informationKey":"key or empty","statement":"exact fallback or empty","state":"KNOWS|BELIEVES|SUSPECTS","evidenceMessageIds":[123]}],"arcProposals":[{"action":"create|update","arcId":"id or null","title":"","actor":"","goal":"","currentSituation":"","nextLikelyMove":"","trigger":"","resolutionTarget":"","stage":"distant|developing|approaching|imminent","playerKnownSummary":"","directorOnlyTruth":"","status":"active|dormant|resolved","outcomeSummary":"","progressed":false,"relevantNoProgress":false,"evidenceMessageIds":[123]}]}
Use empty arrays for categories with no meaningful delta.`;
  };
  buildExtractionRepairPrompt=function(raw){return `Repair only the JSON syntax of the supplied StoryState output. Do not analyze the story and do not invent data. Return exactly one JSON object with five array keys: npcProposals, relationshipProposals, informationProposals, knowledgeProposals, arcProposals. Preserve complete proposals already present; discard incomplete trailing material. Use [] for missing categories. No prose, markdown, reasoning, or text outside the object.\n\nOUTPUT TO REPAIR:\n${text(raw,16000)}`};
  parseExtractionWithOneRepair=async function(raw,onRepair=null){
    try{return {proposals:parseExtractionResponse(raw),repaired:false}}
    catch(firstError){
      if(typeof onRepair==="function")onRepair();
      const repairedRaw=await withTimeout(tavo.generate(buildExtractionRepairPrompt(raw),{context:false,settings:{temperature:0,maxCompletionTokens:2200}}),Math.min(SCAN_REPAIR_TIMEOUT_MS,60000),"JSON repair");
      try{
        const proposals=parseExtractionResponse(repairedRaw);
        if(extractionProposalCount(proposals)===0){const err=new Error("Extractor JSON required repair, but the repaired response contained no proposals. The scan cursor was not advanced so this batch can be retried safely.");err.rawPreview=text(raw,900);err.repairedPreview=text(repairedRaw,900);err.repairedEmpty=true;throw err}
        return {proposals,repaired:true};
      }catch(secondError){if(secondError?.repairedEmpty)throw secondError;const err=new Error(`Extractor response was not usable JSON after one repair attempt. ${text(secondError?.message||firstError?.message||"",180)}`);err.rawPreview=text(raw,900);err.repairedPreview=text(repairedRaw,900);throw err}
    }
  };
