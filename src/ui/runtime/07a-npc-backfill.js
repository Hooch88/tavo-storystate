  const NPC_BACKFILL_MAX_FLOORS=32,NPC_BACKFILL_CHUNK_MESSAGES=8,NPC_BACKFILL_CHUNK_CHARS=12000;
  async function collectNpcBackfillBatch(){
    const count=await tavo.message.count();
    if(!count)return {messages:[],startFloor:0,endFloor:-1};
    const endFloor=count-1,startFloor=Math.max(0,endFloor-NPC_BACKFILL_MAX_FLOORS+1),raw=await tavo.message.find([startFloor,endFloor]),messages=[];
    for(let i=0;i<(Array.isArray(raw)?raw.length:0);i+=1){
      const m=raw[i];
      if(!m||m.hidden||!["user","assistant"].includes(m.role))continue;
      const content=text(stripStructuredNpcHints(m.content),5000);
      if(!content||content.includes("<!-- TVL_VISUAL_REFERENCE -->"))continue;
      messages.push({id:int(m.id,0,1e9,null),role:m.role,content});
    }
    return {messages,startFloor,endFloor};
  }
  function chunkNpcBackfillMessages(messages){
    const chunks=[];let current=[],chars=0;
    for(const message of Array.isArray(messages)?messages:[]){
      const size=String(message?.content||"").length;
      if(current.length&&(current.length>=NPC_BACKFILL_CHUNK_MESSAGES||chars+size>NPC_BACKFILL_CHUNK_CHARS)){chunks.push(current);current=[];chars=0}
      current.push(message);chars+=size;
    }
    if(current.length)chunks.push(current);
    return chunks;
  }
  function npcOnlyProposals(proposals){return {npcProposals:Array.isArray(proposals?.npcProposals)?proposals.npcProposals:[],relationshipProposals:[],informationProposals:[],knowledgeProposals:[],arcProposals:[]}}
  function buildNpcDiscoveryPrompt(state,messages,chatInfo={}){
    const directory=(state.npcs||[]).filter(active).slice(0,120).map(n=>({id:n.id,name:n.name,aliases:n.aliases||[]}));
    const protagonist=text(chatInfo?.persona?.name,120)||"the protagonist";
    const story=messages.map(m=>`[${m.id}] ${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    return `You are StoryState's lightweight NPC discovery pass. Your ONLY job is to identify named story characters who may deserve an NPC record. Do not analyze personality, speech style, pressure response, relationships, secrets, knowledge, world arcs, themes, or prose quality. Think silently and return JSON immediately.\n\nOUTPUT CONTRACT:\nReturn exactly one valid JSON object with these five arrays: npcProposals, relationshipProposals, informationProposals, knowledgeProposals, arcProposals. The last four arrays MUST be empty. No markdown, commentary, reasoning, code fences, ellipses, or text outside the JSON object.\n\nEach npcProposals item may contain ONLY:\n- action: \"create\" or \"update\"\n- npcId: existing NPC id when known\n- name: canonical character name\n- aliases: optional array of clearly established aliases\n- admissionReason: \"candidate\", \"recurring\", or \"obvious_recurring_or_major\"\n- evidenceMessageIds: message IDs from the supplied chunk\n- fields: optional object containing ONLY role, age, pronouns\n\nDISCOVERY RULES:\n- Return a candidate for a named character who meaningfully participates in the supplied story, even if this chunk contains only one meaningful appearance. Use admissionReason=\"candidate\" for that case. StoryState will combine evidence across chunks before deciding whether to admit the NPC.\n- Use admissionReason=\"recurring\" only when this supplied chunk itself contains at least two meaningful appearances with at least two evidence IDs.\n- Use admissionReason=\"obvious_recurring_or_major\" when one supplied message explicitly establishes an ongoing role such as traveling companion, party member, escape companion, roommate, coworker, guide, prisoner escaping with the protagonist, or another clearly persistent attachment to ${protagonist}.\n- Do not return unnamed extras, generic labels, crowds, the narrator, ${protagonist}, or app/system entities.\n- Existing NPCs may be returned as action=\"update\" only to fill basic role/age/pronouns when clearly stated.\n- Do not infer or output current motive, appearance, communication signature, pressure response, core value, contradiction, relationship scores, knowledge, or arc data.\n\nEXISTING NPC DIRECTORY:\n${JSON.stringify(directory)}\n\nSTORY CHUNK:\n${story}`;
  }
  function sanitizeNpcDiscoveryProposal(proposal,messageMap){
    const name=text(proposal?.name,120),npcId=text(proposal?.npcId,120),action=proposal?.action==="update"?"update":"create";
    if(!name&&!npcId)return null;
    const evidenceMessageIds=unique((Array.isArray(proposal?.evidenceMessageIds)?proposal.evidenceMessageIds:[]).map(v=>String(int(v,0,1e9,-1)))).map(Number).filter(id=>messageMap.has(id)).slice(-6);
    if(!evidenceMessageIds.length)return null;
    const aliases=unique((Array.isArray(proposal?.aliases)?proposal.aliases:[]).map(v=>text(v,120)).filter(Boolean)).slice(0,8),rawFields=proposal?.fields&&typeof proposal.fields==="object"?proposal.fields:{},fields={};
    for(const [key,max] of [["role",180],["age",80],["pronouns",80]]){const value=text(rawFields[key],max);if(value)fields[key]=value}
    const reason=["candidate","recurring","obvious_recurring_or_major"].includes(proposal?.admissionReason)?proposal.admissionReason:"candidate";
    return {action,npcId,name,aliases,admissionReason:reason,evidenceMessageIds,fields};
  }
  function aggregateNpcDiscoveryProposals(state,proposals,messageMap){
    const groups=new Map();
    for(const raw of Array.isArray(proposals)?proposals:[]){
      const proposal=sanitizeNpcDiscoveryProposal(raw,messageMap);if(!proposal)continue;
      const existing=resolveNpcRef(state,proposal.npcId,proposal.name),key=existing?`id:${existing.id}`:`name:${extractionNameKey(proposal.name)}`;
      if(!key||key==="name:")continue;
      if(!groups.has(key))groups.set(key,{existing,name:existing?.name||proposal.name,npcId:existing?.id||proposal.npcId||"",aliases:[],evidence:new Set(),fields:{},obvious:false});
      const group=groups.get(key);if(existing&&!group.existing){group.existing=existing;group.npcId=existing.id;group.name=existing.name}
      for(const alias of proposal.aliases)if(extractionNameKey(alias)!==extractionNameKey(group.name))group.aliases.push(alias);
      for(const id of proposal.evidenceMessageIds)group.evidence.add(id);
      for(const [field,value] of Object.entries(proposal.fields||{}))if(!group.fields[field]&&value)group.fields[field]=value;
      if(proposal.admissionReason==="obvious_recurring_or_major")group.obvious=true;
    }
    const out=[];
    for(const group of groups.values()){
      const evidenceMessageIds=[...group.evidence].filter(id=>messageMap.has(id)).sort((a,b)=>a-b).slice(-6),existing=group.existing||resolveNpcRef(state,group.npcId,group.name);
      if(existing){out.push({action:"update",npcId:existing.id,name:existing.name,aliases:unique(group.aliases),admissionReason:"candidate",evidenceMessageIds,fields:group.fields});continue}
      if(!group.obvious&&new Set(evidenceMessageIds).size<2)continue;
      out.push({action:"create",name:group.name,aliases:unique(group.aliases),admissionReason:group.obvious?"obvious_recurring_or_major":"recurring",evidenceMessageIds,fields:group.fields});
    }
    return out;
  }
  async function runNpcBackfill(){
    if(scanInFlight)return tavo.utils.toast("StoryState is already scanning.");
    let claimed=null,runId=uid("npc-backfill");
    try{
      const state=loadState();if(["queued","running"].includes(state.meta.scanStatus))return tavo.utils.toast("StoryState is already scanning.");
      state.meta.scanStatus="running";state.meta.scanStartedAt=nowIso();state.meta.scanRunId=runId;state.meta.scanOwnerId=RUNTIME_ID;state.revision+=1;tavo.set(STATE_KEY,normalizeState(state),"chat");
      claimed=normalizeState(tavo.get(STATE_KEY,"chat"));if(!scanOwnedByRuntime(runId,claimed))throw new Error("Could not acquire the StoryState scan lease for NPC backfill.");
      scanInFlight=true;setScanProgress(runId,"Reading recent history for missed NPCs");
      const batch=await collectNpcBackfillBatch();
      if(!batch.messages.length){
        const latest=loadState();if(scanOwnedByRuntime(runId,latest)){latest.meta.scanStatus="idle";clearScanLease(latest);latest.meta.lastScanAt=nowIso();latest.meta.lastScanSummary="NPC backfill found no recent narrative messages to inspect. Normal scan cursor unchanged.";addDiagnostic(latest,"info",latest.meta.lastScanSummary);latest.revision+=1;tavo.set(STATE_KEY,normalizeState(latest),"chat")}
        clearScanProgress(runId);if(!root.hidden)render();return;
      }
      const chunks=chunkNpcBackfillMessages(batch.messages),chatInfo=await tavo.chat.current().catch(()=>null),messageMap=new Map(batch.messages.map(m=>[m.id,m])),rawProposals=[];
      for(let index=0;index<chunks.length;index+=1){
        if(!scanOwnedByRuntime(runId))throw new Error("NPC backfill scan ownership changed before extraction.");
        const chunk=chunks[index];setScanProgress(runId,`Discovering NPCs in chunk ${index+1} of ${chunks.length}`);
        const prompt=buildNpcDiscoveryPrompt(claimed,chunk,chatInfo||{}),raw=await withTimeout(tavo.generate(prompt,{context:false,settings:{temperature:0.02,maxCompletionTokens:1800}}),SCAN_EXTRACT_TIMEOUT_MS,"StoryState NPC discovery");
        if(!scanOwnedByRuntime(runId))throw new Error("NPC backfill scan ownership changed before parsing.");
        setScanProgress(runId,`Parsing NPC discovery chunk ${index+1} of ${chunks.length}`);
        const parsedResult=await parseExtractionWithOneRepair(raw,()=>setScanProgress(runId,`Repairing NPC discovery JSON for chunk ${index+1} of ${chunks.length}`));
        rawProposals.push(...(parsedResult.proposals?.npcProposals||[]));
      }
      const latest=loadState();if(!scanOwnedByRuntime(runId,latest))throw new Error("NPC backfill scan ownership changed before commit.");if(latest.revision!==claimed.revision)throw new Error("StoryState changed while NPC backfill was running; no backfill result was applied.");
      const reserved=new Set(["tavo","narrator","simulation master",extractionNameKey(chatInfo?.persona?.name),...(Array.isArray(chatInfo?.characters)?chatInfo.characters.map(c=>extractionNameKey(c?.name)):[])].filter(Boolean)),aggregated=aggregateNpcDiscoveryProposals(latest,rawProposals,messageMap),working=normalizeState(clone(latest)),result=applyExtractionProposals(working,npcOnlyProposals({npcProposals:aggregated}),messageMap,reserved);
      working.meta.scanStatus="idle";clearScanLease(working);working.meta.lastScanAt=nowIso();working.meta.lastScanSummary=`NPC Backfill v2 scanned ${batch.messages.length} recent story message(s) in ${chunks.length} lightweight chunk${chunks.length===1?"":"s"}. ${result.changes.length?result.changes.slice(0,8).join(" · "):"No missed NPCs were recovered."}${result.skipped.length?` · ${result.skipped.length} proposal(s) skipped`:""} Normal scan cursor unchanged.`;addDiagnostic(working,"info",`StoryState NPC backfill: ${working.meta.lastScanSummary}`);
      saveRecovery("Before StoryState NPC backfill",latest);working.revision=latest.revision+1;working.schemaVersion=SCHEMA_VERSION;tavo.set(STATE_KEY,normalizeState(working),"chat");const verified=normalizeState(tavo.get(STATE_KEY,"chat"));if(verified.revision!==working.revision)throw new Error("NPC backfill save verification failed.");stateCache=verified;publishCampaignIdentity(verified);clearScanProgress(runId);if(!root.hidden)render();tavo.utils.toast(result.changes.length?`NPC backfill recovered ${result.changes.length} item(s).`:"NPC backfill found no missed NPCs.");
    }catch(e){
      console.error("[StoryState] NPC backfill failed",e);
      try{const state=normalizeState(tavo.get(STATE_KEY,"chat")||newState());if(scanOwnedByRuntime(runId,state)){state.meta.scanStatus="error";clearScanLease(state);state.meta.lastScanAt=nowIso();state.meta.lastScanSummary=`NPC backfill failed: ${text(e?.message||"unknown error",300)} Normal scan cursor was not changed.`;addDiagnostic(state,"error",state.meta.lastScanSummary);if(e?.rawPreview)addDiagnostic(state,"error",`NPC backfill malformed extractor preview: ${text(e.rawPreview,900)}`);if(e?.repairedPreview)addDiagnostic(state,"error",`NPC backfill repaired extractor preview: ${text(e.repairedPreview,900)}`);state.revision+=1;tavo.set(STATE_KEY,normalizeState(state),"chat");stateCache=normalizeState(tavo.get(STATE_KEY,"chat"))}clearScanProgress(runId);if(!root.hidden)render()}catch(_){ }
      tavo.utils.toast(`NPC backfill failed: ${e?.message||"unknown error"}`);
    }finally{scanInFlight=false;const finalState=normalizeState(tavo.get(STATE_KEY,"chat"));if(finalState.meta.scanStatus!=="running")clearScanProgress(runId)}
  }
  function installNpcBackfillControl(){try{if(document.querySelector("#ss-backfill-npcs"))return;const scanNow=document.querySelector("#ss-scan-now"),actions=scanNow?.parentElement;if(!scanNow||!actions||!document.createElement)return;const button=document.createElement("button");button.id="ss-backfill-npcs";button.type="button";button.textContent="Backfill NPCs";button.title="Re-check recent story history in lightweight NPC-only chunks without moving the normal scan cursor or changing relationships, knowledge, or world arcs.";button.addEventListener("click",runNpcBackfill);actions.appendChild(button)}catch(e){console.warn("[StoryState] Could not install NPC backfill control",e)}}
  installNpcBackfillControl();
  if(typeof __storyStateTestHarness!=="undefined"&&__storyStateTestHarness)Object.assign(__storyStateTestHarness,{collectNpcBackfillBatch,chunkNpcBackfillMessages,npcOnlyProposals,buildNpcDiscoveryPrompt,sanitizeNpcDiscoveryProposal,aggregateNpcDiscoveryProposals,runNpcBackfill});
