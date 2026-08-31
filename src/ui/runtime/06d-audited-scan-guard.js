  collectScanBatch=async function(state){
    const count=await tavo.message.count();if(!count)return {messages:[],startFloor:0,endFloor:-1,chatEndFloor:-1,hasMore:false,capped:false};
    const chatEndFloor=count-1,storedFloor=state.meta.lastScannedFloor;if(storedFloor!=null&&storedFloor>=chatEndFloor)return {messages:[],startFloor:chatEndFloor+1,endFloor:chatEndFloor,chatEndFloor,hasMore:false,capped:false};
    const initialStart=Math.max(0,chatEndFloor-Math.max(state.config.scanEveryPosts*2,24)+1),startFloor=storedFloor==null||storedFloor>chatEndFloor?initialStart:storedFloor+1,windowEnd=Math.min(chatEndFloor,startFloor+AUDITED_SCAN_MAX_FLOORS-1),raw=await tavo.message.find([startFloor,windowEnd]),messages=[];let chars=0,processedEndFloor=startFloor-1;
    for(let i=0;i<(Array.isArray(raw)?raw.length:0);i+=1){const floor=startFloor+i,m=raw[i];if(!m){processedEndFloor=floor;continue}if(m.hidden||!["user","assistant"].includes(m.role)){processedEndFloor=floor;continue}const content=text(stripStructuredNpcHints(m.content),5000);if(!content||content.includes("<!-- TVL_VISUAL_REFERENCE -->")){processedEndFloor=floor;continue}if((messages.length>=AUDITED_SCAN_MAX_FLOORS||chars+content.length>AUDITED_SCAN_MAX_CHARS)&&messages.length)break;chars+=content.length;messages.push({id:int(m.id,0,1e9,null),role:m.role,content});processedEndFloor=floor}
    if(processedEndFloor<startFloor&&windowEnd>=startFloor)processedEndFloor=windowEnd;const hasMore=processedEndFloor<chatEndFloor;return {messages,startFloor,endFloor:processedEndFloor,chatEndFloor,hasMore,capped:hasMore};
  };
  const __ssPreAuditApplyExtractionProposals=applyExtractionProposals;
  applyExtractionProposals=function(state,proposals,messageMap,reservedNames=new Set()){
    const currentCandidates=collectAuditedNpcCandidates([...messageMap.values()],reservedNames),ledger=mergeNpcCandidateLedger(state,currentCandidates),augmentedMap=new Map(messageMap);
    for(const item of ledger.items)for(const evidence of item.evidence)if(!augmentedMap.has(evidence.id))augmentedMap.set(evidence.id,{id:evidence.id,role:"assistant",content:evidence.text});
    const beforeNames=new Set((state.npcs||[]).filter(active).map(n=>extractionNameKey(n.name))),result=__ssPreAuditApplyExtractionProposals(state,proposals,augmentedMap,reservedNames),afterNames=new Set((state.npcs||[]).filter(active).map(n=>extractionNameKey(n.name))),newNames=[...afterNames].filter(name=>!beforeNames.has(name));
    // Purge candidate-ledger entries that just became tracked before evaluating what remains.
    mergeNpcCandidateLedger(state,[]);
    const pending=combinedNpcCandidateHints(state,currentCandidates).filter(c=>c.current&&!afterNames.has(c.key)&&(c.strong||c.obvious));
    if(!newNames.length&&pending.length){const names=pending.slice(0,5).map(c=>c.name).join(", ");const err=new Error(`Extractor omitted strong recurring NPC candidate${pending.length===1?"":"s"}: ${names}. The scan cursor was not advanced; retrying will use the preserved candidate evidence.`);err.rawPreview=`Pending NPC candidates: ${pending.slice(0,8).map(c=>`${c.name} [${c.evidence.map(e=>e.id).join(", ")}]`).join(" · ")}`;throw err}
    return result;
  };
  if(typeof __storyStateTestHarness!=="undefined"&&__storyStateTestHarness)Object.assign(__storyStateTestHarness,{NPC_CANDIDATE_LEDGER_KEY,AUDITED_SCAN_MAX_FLOORS,AUDITED_SCAN_MAX_CHARS,auditedCandidateName,auditedReservedNames,collectAuditedNpcCandidates,loadNpcCandidateLedger,mergeNpcCandidateLedger,combinedNpcCandidateHints,compactExtractionState,auditedDirectCompanionEvidence,buildExtractionPrompt,buildExtractionRepairPrompt,parseExtractionWithOneRepair});
