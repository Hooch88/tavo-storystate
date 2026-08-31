  // 0.8.0-dev.10: restore a compact identity-first extractor after the dev.3-dev.5
  // prompt grew large enough for reasoning models to spend their reply on analysis instead of JSON.
  // The UI is deliberately not involved here.
  const NPC_CANDIDATE_LEDGER_KEY="storyState.npcCandidateLedger.v1";
  const AUDITED_SCAN_MAX_FLOORS=8,AUDITED_SCAN_MAX_CHARS=12000,AUDITED_MAX_CANDIDATES=14;
  const NPC_CANDIDATE_STOPWORDS=new Set([
    "a","across","after","all","an","and","another","any","are","as","at","back","before","behind","blood","boss","but","by","camp","day","dialog","earth","every","faerun","faerûn","first","for","from","fuck","glass","goblin","goblins","he","her","here","hers","him","his","hoo","how","i","i'd","i'll","i'm","i've","if","in","into","is","it","its","just","lady","long","master","me","meat","mode","moon","my","night","no","not","now","ooc","of","ok","okay","on","one","only","or","orcs","our","red","road","sacrifice","safe","segoe","shaman","she","silver","so","sos","shapes","palisade","dad","slow","wtf","sumber","ten","that","that's","the","their","them","then","there","these","they","this","those","three","time","to","together","tuesday","twenty","ui","unknown","we","what","whatever","whatever's","when","where","which","while","who","why","with","without","you","your"
  ]);
  const NPC_PERSON_ACTION_RE=/^(?:\s|[,'’"“”])*?(?:says?|said|asks?|asked|replies?|replied|answers?|answered|whispers?|whispered|shouts?|shouted|calls?|called|looks?|looked|turns?|turned|walks?|walked|follows?|followed|joins?|joined|guides?|guided|leads?|led|takes?|took|holds?|held|nods?|nodded|shakes?|shook|steps?|stepped|moves?|moved|runs?|ran|sits?|sat|stands?|stood|laughs?|laughed|smiles?|smiled|frowns?|frowned|grabs?|grabbed|carries?|carried|watches?|watched|waits?|waited|keeps?|kept|steers?|steered|builds?|built|coughs?|coughed|hisses?|hissed|jerks?|jerked|stares?|stared|leans?|leaned|drops?|dropped|gives?|gave|gets?|got|is|was|has|had|does|did)\b/i;
  const NPC_OBJECT_ACTION_RE=/\b(?:ask(?:s|ed)?|tell(?:s|ing|told)?|call(?:s|ed)?|follow(?:s|ed|ing)?|join(?:s|ed|ing)?|beside|alongside|sees?|saw|helps?|helped|guides?|guided|leads?|led)\s*$/i;
  function auditedDirectCompanionEvidence(name,around){
    const escaped=String(name||"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&");if(!escaped)return false;
    const roles="travel(?:s|ed|ing)?(?:\\s+with)?|traveling companion|companion|party member|fellow escapee|escape companion|joins?|joined|follows?|followed|guides?|guided|leads?|led|roommate|coworker|crew member|team member|prisoner escaping|escapes? with|escaping with|makes? camp with";
    return new RegExp(`\\b${escaped}\\b[^.!?\\n]{0,140}\\b(?:${roles})\\b|\\b(?:${roles})\\b[^.!?\\n]{0,140}\\b${escaped}\\b`,"i").test(String(around||""));
  }
  function auditedCandidateText(value){return String(value==null?"":value).replace(/<[^>]*>/g," ").replace(/\[[A-Z][^\]]*\]|\[\/[A-Z]+\]/g," ").replace(/https?:\/\/\S+|data:[^\s]+/gi," ")}
  function auditedCandidateName(raw){
    const parts=String(raw||"").split(/\s+/).map(part=>part.replace(/[’']s$/i,"")).filter(Boolean);
    if(!parts.length||parts.length>2)return "";
    if(parts.some(part=>NPC_CANDIDATE_STOPWORDS.has(part.toLowerCase())||/^(?:i|we|you|he|she|they)['’](?:m|d|ll|ve|re|s)$/i.test(part)))return "";
    return parts.join(" ");
  }
  function auditedReservedNames(chatInfo={}){return new Set(["tavo","narrator","simulation master",extractionNameKey(chatInfo?.persona?.name),...(Array.isArray(chatInfo?.characters)?chatInfo.characters.map(c=>extractionNameKey(c?.name)):[])].filter(Boolean))}
  function collectAuditedNpcCandidates(messages,reservedNames=new Set()){
    const groups=new Map(),pattern=/\b[A-Z][A-Za-z'’\-]{1,35}(?:\s+[A-Z][A-Za-z'’\-]{1,35})?\b/g;
    for(const message of Array.isArray(messages)?messages:[]){
      const id=int(message?.id,0,1e9,null),content=auditedCandidateText(message?.content);if(id==null||!content)continue;
      let match;
      while((match=pattern.exec(content))){
        const name=auditedCandidateName(match[0]),key=extractionNameKey(name);if(!key||isReservedNpcName(name,reservedNames))continue;
        const before=content.slice(Math.max(0,match.index-90),match.index),after=content.slice(match.index+match[0].length,match.index+match[0].length+120),around=text(content.slice(Math.max(0,match.index-120),match.index+match[0].length+180).replace(/\s+/g," "),320),person=NPC_PERSON_ACTION_RE.test(after)||NPC_OBJECT_ACTION_RE.test(before),companion=auditedDirectCompanionEvidence(name,around),selfIntro=new RegExp(`["“]${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b[.!?,]`,`i`).test(content);
        if(!person&&!selfIntro)continue;
        if(!groups.has(key))groups.set(key,{key,name,evidence:new Map(),personIds:new Set(),companionIds:new Set(),currentIds:new Set()});
        const group=groups.get(key);group.currentIds.add(id);if(person)group.personIds.add(id);if(companion)group.companionIds.add(id);if(!group.evidence.has(id))group.evidence.set(id,{id,text:around,person:!!person,companion:!!companion});
      }
    }
    return [...groups.values()].map(group=>({...group,evidence:[...group.evidence.values()].sort((a,b)=>a.id-b.id)})).sort((a,b)=>b.personIds.size-a.personIds.size||b.evidence.length-a.evidence.length||a.name.localeCompare(b.name)).slice(0,AUDITED_MAX_CANDIDATES)
  }
  function loadNpcCandidateLedger(state){
    const raw=tavo.get(NPC_CANDIDATE_LEDGER_KEY,"chat"),campaignId=text(state?.campaign?.id,160);
    if(!raw||typeof raw!=="object"||Array.isArray(raw)||raw.campaignId!==campaignId||!Array.isArray(raw.items))return {campaignId,items:[]};
    return {campaignId,items:raw.items.map(item=>({key:extractionNameKey(item?.name),name:text(item?.name,120),evidence:(Array.isArray(item?.evidence)?item.evidence:[]).map(e=>({id:int(e?.id,0,1e9,null),text:text(e?.text,320),person:!!e?.person,companion:!!e?.companion})).filter(e=>e.id!=null&&e.text).slice(-6)})).filter(item=>item.key&&item.name)};
  }
  function mergeNpcCandidateLedger(state,currentCandidates){
    const ledger=loadNpcCandidateLedger(state),map=new Map(ledger.items.map(item=>[item.key,{...item,evidence:[...item.evidence]}]));
    for(const candidate of currentCandidates){
      const item=map.get(candidate.key)||{key:candidate.key,name:candidate.name,evidence:[]},evidenceMap=new Map(item.evidence.map(e=>[e.id,e]));
      for(const evidence of candidate.evidence)evidenceMap.set(evidence.id,evidence);
      item.name=candidate.name;item.evidence=[...evidenceMap.values()].sort((a,b)=>a.id-b.id).slice(-6);map.set(candidate.key,item);
    }
    const tracked=new Set((state.npcs||[]).filter(active).flatMap(n=>[n.name,...(n.aliases||[])]).map(extractionNameKey).filter(Boolean));
    ledger.items=[...map.values()].filter(item=>!tracked.has(item.key)).sort((a,b)=>(b.evidence.at(-1)?.id||0)-(a.evidence.at(-1)?.id||0)).slice(0,40);
    tavo.set(NPC_CANDIDATE_LEDGER_KEY,ledger,"chat");return ledger;
  }
  function combinedNpcCandidateHints(state,currentCandidates){
    const ledger=loadNpcCandidateLedger(state),currentKeys=new Set(currentCandidates.map(c=>c.key)),map=new Map();
    for(const item of ledger.items)map.set(item.key,{key:item.key,name:item.name,evidence:[...item.evidence],current:false});
    for(const candidate of currentCandidates){const existing=map.get(candidate.key)||{key:candidate.key,name:candidate.name,evidence:[],current:true},evidenceMap=new Map(existing.evidence.map(e=>[e.id,e]));for(const evidence of candidate.evidence)evidenceMap.set(evidence.id,evidence);existing.name=candidate.name;existing.current=true;existing.evidence=[...evidenceMap.values()].sort((a,b)=>a.id-b.id).slice(-6);map.set(candidate.key,existing)}
    return [...map.values()].map(item=>{const personCount=item.evidence.filter(e=>e.person).length,companionCount=item.evidence.filter(e=>e.companion).length,currentIds=new Set(currentCandidates.find(c=>c.key===item.key)?.evidence.map(e=>e.id)||[]);return {...item,currentIds,personCount,companionCount,strong:item.evidence.length>=2&&personCount>=2,obvious:item.evidence.length>=1&&personCount>=1&&companionCount>=1}}).sort((a,b)=>Number(b.current)-Number(a.current)||Number(b.obvious)-Number(a.obvious)||b.personCount-a.personCount||b.evidence.length-a.evidence.length).slice(0,AUDITED_MAX_CANDIDATES)
  }
