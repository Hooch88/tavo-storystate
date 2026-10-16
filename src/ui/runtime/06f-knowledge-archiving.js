  // Archive only transient public plans with newer, quoted resolution evidence.
  // Preserve durable facts, protected edits and the directional knowledge ledger.
  function isTemporaryKnowledge(item){
    // A time word alone must never make a durable rule or personal fact disposable.
    if(/\b(law|laws|policy|policies|rule|rules|permanent|enduring|always|every|belief|believes?|promise|promised|consequence|consequences)\b/i.test(item?.statement||""))return false;
    return /\b(plan(?:s|ned)? to|scheduled|invited?|invitation|appointment|deadline|expires?|temporary|reserved|reservation|rain check|meeting|meet at|meet on|tonight|tomorrow|this (?:evening|afternoon|morning)|due (?:on|by|at)|vacan(?:t|cy))\b/i.test(item?.statement||"");
  }
  function knowledgeArchiveCandidates(state){
    if(state.config.autoArchiveKnowledge===false)return [];
    const eligible=state.knowledgeItems.filter(i=>active(i)&&i.updatedBy==="extraction"&&i.manualAuthorityThroughMessageId==null&&!i.autoArchiveProtected&&i.sensitivity==="NORMAL"&&i.sourceMessageId!=null&&isTemporaryKnowledge(i));
    if(!eligible.length)return [];
    const offset=Math.max(0,Number(state.meta.lastScannedFloor)||0)%eligible.length;
    return [...eligible.slice(offset),...eligible.slice(0,offset)].slice(0,24);
  }
  const buildPromptBeforeKnowledgeArchive=buildExtractionPrompt;
  buildExtractionPrompt=function(state,messages,chatInfo={}){
    const prompt=buildPromptBeforeKnowledgeArchive(state,messages,chatInfo),candidates=knowledgeArchiveCandidates(state);
    if(!candidates.length)return prompt;
    return prompt+`\n\nOPTIONAL KNOWLEDGE ARCHIVING — conservative, never required:\nReview these existing temporary public plans against the SAVED MESSAGES above. Propose at most 3 archives ONLY when a newer message explicitly proves a plan was completed, cancelled, expired, or replaced by a different plan. Old age, silence, a topic change, speculation, or vague lack of importance are NEVER reasons. An invitation/appointment can expire; a completed event, enduring personal fact, consequence, promise, relationship, law, policy, secret or belief may still matter and must stay. Do not archive a fact just because it became public or turned out false. If uncertain, propose nothing.\nUse the existing informationProposals array (keep the five-array JSON contract) with {"action":"archive","informationId":"exact candidate id","resolution":"completed_plan|cancelled_plan|expired_plan|superseded_plan","reason":"brief explanation","evidenceMessageIds":[123],"resolutionEvidence":[{"messageId":123,"quote":"exact verbatim words from that saved message explicitly establishing the resolution"}]}. Each quote must contain at least 12 characters. Cite newer evidence, not the original plan. Never output archive for any item outside this candidate list. No story deletion.\nARCHIVE REVIEW CANDIDATES:\n${JSON.stringify(candidates.map(i=>({id:i.id,statement:i.statement,sourceMessageId:i.sourceMessageId})))}`;
  };
  function applyKnowledgeArchives(state,proposals,messageMap){
    const changes=[],skipped=[],eligible=new Set(knowledgeArchiveCandidates(state).map(i=>i.id)),seen=new Set(),types=new Set(['completed_plan','cancelled_plan','expired_plan','superseded_plan']);
    for(const proposal of (proposals||[]).slice(0,3)){
      const item=knowledgeItemById(state,text(proposal?.informationId,120));
      if(!item||seen.has(item.id)||!eligible.has(item.id)||!types.has(proposal.resolution)||!text(proposal.reason,400)){skipped.push('Knowledge archive rejected: ineligible or protected item.');continue}
      const ids=evidenceIdsForProposal(proposal,messageMap),quotes=Array.isArray(proposal.resolutionEvidence)?proposal.resolutionEvidence:[];
      const evidence=quotes.filter(e=>{const id=Number(e?.messageId),quote=String(e?.quote||'').trim(),message=messageMap.get(id);return ids.includes(id)&&id>Number(item.sourceMessageId)&&quote.length>=12&&quote.length<=1000&&message&&String(message.content||'').includes(quote)});
      if(!evidence.length){skipped.push('Knowledge archive rejected: missing newer verbatim resolution evidence.');continue}
      seen.add(item.id);item.status='archived';item.archiveReason=text(proposal.reason,400);item.archiveResolution=proposal.resolution;item.archiveEvidence=evidence.slice(0,3).map(e=>({messageId:Number(e.messageId),quote:text(e.quote,1000)}));item.archivedAt=nowIso();item.updatedAt=nowIso();
      changes.push(`Archived knowledge: ${item.statement}`);
      addDiagnostic(state,'info',`Knowledge auto-archived (${proposal.resolution}): ${text(item.statement,180)} Reason: ${item.archiveReason}`);
    }
    return {changes,skipped};
  }
  const applyBeforeKnowledgeArchives=applyExtractionProposals;
  applyExtractionProposals=function(state,proposals,messageMap,reservedNames=new Set()){
    const archive=(proposals.informationProposals||[]).filter(p=>p?.action==='archive'),ordinary={...proposals,informationProposals:(proposals.informationProposals||[]).filter(p=>p?.action!=='archive')};
    // Evaluate against pre-update candidates so the model cannot create and archive an item in one request.
    const archiveReview=normalizeState(clone(state)),baseline=new Map(archiveReview.knowledgeItems.map(i=>[i.id,JSON.stringify(i)]));
    const result=applyBeforeKnowledgeArchives(state,ordinary,messageMap,reservedNames);
    const archived=applyKnowledgeArchives(archiveReview,archive,messageMap);
    for(const item of archiveReview.knowledgeItems){
      if(item.status!=='archived'||!item.archivedAt||JSON.stringify(item)===baseline.get(item.id))continue;
      const target=knowledgeItemById(state,item.id);
      // Concurrent ordinary updates win; the next scan can review the updated fact.
      if(!target||JSON.stringify(target)!==baseline.get(item.id)){result.skipped.push('Knowledge archive deferred: item changed in this scan.');continue}
      Object.assign(target,item);result.changes.push(`Archived knowledge: ${item.statement}`);
      addDiagnostic(state,'info',`Knowledge auto-archived: ${text(item.statement,180)} Reason: ${item.archiveReason}`);
    }
    result.skipped.push(...archived.skipped);return result;
  };
  if(typeof __storyStateTestHarness!=="undefined"&&__storyStateTestHarness)Object.assign(__storyStateTestHarness,{knowledgeArchiveCandidates,applyKnowledgeArchives,isTemporaryKnowledge});
