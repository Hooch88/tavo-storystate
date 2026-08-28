  // 0.8.0-dev.5: harden stable pressure-response learning and JSON extraction.
  // Keep this as a narrow compatibility layer so the proven v4 extraction/apply code stays intact.
  const __ssV4ParseExtractionResponse=parseExtractionResponse;
  const __ssV4ApplyExtractionProposals=applyExtractionProposals;
  const __ssV4BuildExtractionPrompt=buildExtractionPrompt;

  function dev5SanitizeExtractorOutput(raw){
    return String(raw==null?"":raw)
      .replace(/^\uFEFF/,"")
      .replace(/<think>[\s\S]*?<\/think>/gi,"")
      .replace(/<analysis>[\s\S]*?<\/analysis>/gi,"")
      .replace(/:\s*\[\s*(?:\.{3}|…+)\s*\]/g,": []")
      .replace(/:\s*\{\s*(?:\.{3}|…+)\s*\}/g,": {}")
      .trim();
  }

  function dev5PressureResponseIsClean(value){
    const v=text(value,700);
    if(!v)return false;
    // Pressure Response is a durable decision/emotion pattern, never a bank of stage directions.
    // If a proposal mixes physical tells into the field, reject it and let a later clean proposal fill it.
    return !/\b(eye contact|eyes? (?:lock|narrow|widen|drop|flick|fix)|stare|stares|staring|gaze|breath|breathing|jaw|mouth|hands?|fingers?|knuckles?|shoulders?|posture|leans?|leaning|flinches?|flinching|freezes?|freezing|steps? back|backs? away|grips?|gripping|arms? fold|folded arms?|body|face (?:tightens|flushes|pales)|nods?|shakes? (?:his|her|their) head)\b/i.test(v);
  }

  parseExtractionResponse=function(raw){
    return __ssV4ParseExtractionResponse(dev5SanitizeExtractorOutput(raw));
  };

  buildExtractionRepairPrompt=function(raw){
    return `You are a JSON syntax repair tool for StoryState. Repair only the supplied extractor output; do not analyze the story again and do not invent proposals. Preserve complete proposals that are actually present. If material is truncated, discard incomplete trailing proposals.\n\nSTRICT OUTPUT CONTRACT:\n- Your FIRST character must be { and your LAST character must be }.\n- Return exactly one valid JSON object.\n- No reasoning, preamble, explanation, markdown, code fences, comments, or text after the object.\n- Never write phrases such as "Let me analyze" or "Let me work through".\n- Never use placeholders such as [...], {...}, ellipses, or pseudo-JSON. Use [] or {} when content is unavailable.\n- Use standard double-quoted JSON keys and strings.\n- The object must contain exactly these five top-level array keys: npcProposals, relationshipProposals, informationProposals, knowledgeProposals, arcProposals. Missing categories must be empty arrays.\n\nMALFORMED EXTRACTOR OUTPUT:\n${text(raw,18000)}`;
  };

  parseExtractionWithOneRepair=async function(raw,onRepair=null){
    try{return {proposals:parseExtractionResponse(raw),repaired:false}}
    catch(firstError){
      if(typeof onRepair==="function")onRepair();
      const firstRepairPrompt=buildExtractionRepairPrompt(raw),firstRepairedRaw=await withTimeout(tavo.generate(firstRepairPrompt,{context:false,settings:{temperature:0.01,maxCompletionTokens:6000}}),SCAN_REPAIR_TIMEOUT_MS,"JSON repair");
      try{return {proposals:parseExtractionResponse(firstRepairedRaw),repaired:true}}
      catch(secondError){
        if(typeof onRepair==="function")onRepair();
        const secondRepairPrompt=buildExtractionRepairPrompt(firstRepairedRaw),secondRepairedRaw=await withTimeout(tavo.generate(secondRepairPrompt,{context:false,settings:{temperature:0.01,maxCompletionTokens:6000}}),SCAN_REPAIR_TIMEOUT_MS,"JSON repair retry");
        try{return {proposals:parseExtractionResponse(secondRepairedRaw),repaired:true}}
        catch(thirdError){
          const err=new Error(`Extractor response was not usable JSON after two repair attempts. ${text(thirdError?.message||secondError?.message||firstError?.message||"",180)}`);
          err.rawPreview=text(raw,900);
          throw err;
        }
      }
    }
  };

  buildExtractionPrompt=function(state,messages,chatInfo={}){
    const base=__ssV4BuildExtractionPrompt(state,messages,chatInfo);
    return `${base}\n\nTHINKING-MODEL OUTPUT CONTRACT — mandatory:\n- Think silently. Do not expose analysis or chain-of-thought.\n- Your FIRST character must be { and your LAST character must be }.\n- Emit the JSON object immediately. No preamble such as "Let me analyze", no markdown/code fence, and no explanation after it.\n- Never abbreviate arrays or objects with [...], {...}, ellipses, comments, or pseudo-JSON. Every emitted proposal must be complete valid JSON.\n- Always include all five top-level arrays: npcProposals, relationshipProposals, informationProposals, knowledgeProposals, arcProposals.\n\nPRESSURE RESPONSE EVIDENCE — mandatory:\n- pressureResponse is a durable pattern in how an NPC thinks, prioritizes, judges risk, regulates emotion, or makes decisions under genuine pressure.\n- Never put physical tells or stage directions in pressureResponse: no leaning, staring/eye contact, breathing, jaw/mouth movement, hands/fingers, posture, flinching, freezing against a wall, or similar body-language description.\n- Do not establish pressureResponse on an NPC's introduction. Only propose it for an already-tracked NPC when at least two supplied evidence messages support the same durable pattern. Prefer evidence from distinct pressure situations; one dramatic reaction is not a stable trait.\n- If the clean psychological pattern cannot be stated without bodily tells, omit pressureResponse.`;
  };

  applyExtractionProposals=function(state,proposals,messageMap,reservedNames=new Set()){
    const hardened=clone(proposals||{});
    for(const proposal of hardened.npcProposals||[]){
      const fields=proposal?.fields&&typeof proposal.fields==="object"?proposal.fields:null;
      if(!fields||!Object.prototype.hasOwnProperty.call(fields,"pressureResponse"))continue;
      const ids=evidenceIdsForProposal(proposal,messageMap),existing=resolveNpcRef(state,proposal?.npcId,proposal?.name),value=text(fields.pressureResponse,700);
      const allowPressure=!!existing&&new Set(ids).size>=2&&dev5PressureResponseIsClean(value);
      if(!allowPressure)delete fields.pressureResponse;
    }
    return __ssV4ApplyExtractionProposals(state,hardened,messageMap,reservedNames);
  };

  // Smaller batches reduce the chance that reasoning-heavy models drift into prose or truncate JSON.
  // Existing backlog handling already schedules later bounded passes, so no story messages are discarded.
  const DEV5_SCAN_MAX_FLOORS=16,DEV5_SCAN_MAX_CHARS=24000;
  collectScanBatch=async function(state){
    const count=await tavo.message.count();
    if(!count)return {messages:[],startFloor:0,endFloor:-1,chatEndFloor:-1,hasMore:false,capped:false};
    const chatEndFloor=count-1,storedFloor=state.meta.lastScannedFloor;
    if(storedFloor!=null&&storedFloor>=chatEndFloor)return {messages:[],startFloor:chatEndFloor+1,endFloor:chatEndFloor,chatEndFloor,hasMore:false,capped:false};
    const initialStart=Math.max(0,chatEndFloor-Math.max(state.config.scanEveryPosts*2,24)+1),startFloor=storedFloor==null||storedFloor>chatEndFloor?initialStart:storedFloor+1,windowEnd=Math.min(chatEndFloor,startFloor+DEV5_SCAN_MAX_FLOORS-1),raw=await tavo.message.find([startFloor,windowEnd]),messages=[];
    let chars=0,processedEndFloor=startFloor-1;
    for(let i=0;i<(Array.isArray(raw)?raw.length:0);i+=1){
      const floor=startFloor+i,m=raw[i];
      if(!m){processedEndFloor=floor;continue}
      if(m.hidden||!["user","assistant"].includes(m.role)){processedEndFloor=floor;continue}
      const content=text(stripStructuredNpcHints(m.content),5000);
      if(!content||content.includes("<!-- TVL_VISUAL_REFERENCE -->")){processedEndFloor=floor;continue}
      if(chars+content.length>DEV5_SCAN_MAX_CHARS&&messages.length)break;
      chars+=content.length;messages.push({id:int(m.id,0,1e9,null),role:m.role,content});processedEndFloor=floor;
    }
    if(processedEndFloor<startFloor&&windowEnd>=startFloor)processedEndFloor=windowEnd;
    const hasMore=processedEndFloor<chatEndFloor;
    return {messages,startFloor,endFloor:processedEndFloor,chatEndFloor,hasMore,capped:hasMore};
  };
