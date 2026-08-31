  // 0.8.0-dev.11: NPC identity must not depend on a second model request.
  // This conservative local admission layer only promotes named candidates after repeated
  // person-action evidence (or repeated evidence plus an explicit persistent-companion cue).
  const LOCAL_NPC_ACTION_WORDS="says?|said|asks?|asked|replies?|replied|answers?|answered|whispers?|whispered|shouts?|shouted|calls?|called|turns?|turned|walks?|walked|follows?|followed|joins?|joined|guides?|guided|leads?|led|takes?|took|holds?|held|nods?|nodded|shakes?|shook|steps?|stepped|moves?|moved|runs?|ran|sits?|sat|stands?|stood|laughs?|laughed|smiles?|smiled|frowns?|frowned|grabs?|grabbed|carries?|carried|watches?|watched|waits?|waited|keeps?|kept|steers?|steered|builds?|built|coughs?|coughed|hisses?|hissed|jerks?|jerked|stares?|stared|leans?|leaned|drops?|dropped|gives?|gave|helps?|helped|travels?|traveled|travels?|stays?|stayed|returns?|returned|comes?|came|goes?|went";
  function localNpcStrongActionEvidence(name,value){
    const escaped=String(name||"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),source=String(value||"");if(!escaped||!source)return false;
    const subject=new RegExp(`\\b${escaped}\\b[^.!?\\n]{0,36}\\b(?:${LOCAL_NPC_ACTION_WORDS})\\b`,`i`),object=new RegExp(`\\b(?:asks?|asked|tells?|told|calls?|called|follows?|followed|helps?|helped|guides?|guided|leads?|led|joins?|joined)\\b[^.!?\\n]{0,24}\\b${escaped}\\b`,`i`);
    return subject.test(source)||object.test(source);
  }
  function localNpcCandidateQualification(candidate){
    const evidence=Array.isArray(candidate?.evidence)?candidate.evidence:[],ids=new Set(evidence.map(e=>e?.id).filter(id=>id!=null)),strongCount=evidence.filter(e=>localNpcStrongActionEvidence(candidate?.name,e?.text)).length,companionCount=evidence.filter(e=>e?.companion).length,personCount=evidence.filter(e=>e?.person).length;
    const qualifies=ids.size>=2&&((companionCount>=1&&personCount>=2)||strongCount>=2)||(ids.size>=3&&personCount>=3);
    return {qualifies,distinctEvidence:ids.size,strongCount,companionCount,personCount};
  }
  function promoteLocalNpcCandidates(state,currentCandidates,reservedNames=new Set(),source="local-discovery"){
    const changes=[],skipped=[],combined=combinedNpcCandidateHints(state,currentCandidates);
    for(const candidate of combined){
      if(resolveNpcRef(state,null,candidate.name))continue;
      const qualification=localNpcCandidateQualification(candidate);if(!qualification.qualifies)continue;
      if(isReservedNpcName(candidate.name,reservedNames)){skipped.push(`${candidate.name}: reserved/generic candidate`);continue}
      const latest=Math.max(...candidate.evidence.map(e=>Number(e.id)||0)),npc=normalizeNpc({name:candidate.name,lastMeaningfulMessageId:latest||null,createdBy:source,updatedBy:source,manualOverrides:[]});
      if(!npc.name)continue;state.npcs.push(npc);changes.push(`+ NPC ${npc.name}`);
    }
    mergeNpcCandidateLedger(state,[]);
    return {changes,skipped};
  }
  async function processLocalNpcDiscoveryMessage(message){
    try{
      if(!message||message.hidden||message.role!=="assistant")return;
      const state=loadState(),chatInfo=await tavo.chat.current().catch(()=>null),reserved=auditedReservedNames(chatInfo||{}),candidates=collectAuditedNpcCandidates([{id:message.id,role:message.role,content:String(message.content||"")}],reserved);
      if(!candidates.length)return;mergeNpcCandidateLedger(state,candidates);
      const current=loadState();if(["queued","running"].includes(current.meta.scanStatus))return;
      const working=normalizeState(clone(current)),result=promoteLocalNpcCandidates(working,candidates,reserved,"local-discovery");if(!result.changes.length)return;
      const latest=loadState();if(latest.revision!==current.revision||["queued","running"].includes(latest.meta.scanStatus))return;
      addDiagnostic(working,"info",`Local NPC admission: ${result.changes.join(" · ")}`);saveRecovery("Before local NPC admission",latest);working.revision=latest.revision+1;working.schemaVersion=SCHEMA_VERSION;tavo.set(STATE_KEY,normalizeState(working),"chat");const verified=normalizeState(tavo.get(STATE_KEY,"chat"));if(verified.revision!==working.revision)throw new Error("Local NPC admission save verification failed.");stateCache=verified;publishCampaignIdentity(verified);if(!root.hidden)render();
    }catch(e){console.error("[StoryState] local NPC discovery failed",e)}
  }
  if(typeof __storyStateTestHarness!=="undefined"&&__storyStateTestHarness)Object.assign(__storyStateTestHarness,{localNpcStrongActionEvidence,localNpcCandidateQualification,promoteLocalNpcCandidates,processLocalNpcDiscoveryMessage});
