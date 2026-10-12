  function npcPortraitMarkup(n){
    const fallback=`<span class="ss-portrait-initials">${esc(initials(n?.name||""))}</span>`;
    return n?.portraitPath?`${fallback}<img class="ss-portrait-image" src="${esc(n.portraitPath)}" alt="${esc(n.name||"NPC")} portrait">`:fallback;
  }
  function renderNpcPortraitControls(n,id){
    renderVisualLibraryPortraitOptions(n,id);
    document.querySelector("#ss-portrait-preview").innerHTML=npcPortraitMarkup(n);
    document.querySelector("#ss-upload-portrait").disabled=!id;
    document.querySelector("#ss-remove-portrait").disabled=!id||!n?.portraitPath;
  }
  let npcPortraitImportBusy=false;
  async function uploadNpcPortrait(id){
    if(npcPortraitImportBusy)return;
    const before=loadState(),npc=npcById(before,id);if(!npc)return tavo.utils.toast("Save the NPC before uploading a portrait.");
    let imported=null,committed=false;npcPortraitImportBusy=true;
    try{
      if(!tavo.file?.import)throw new Error("Tavo image picker is unavailable.");
      const originalChat=await tavo.chat.current();
      const files=await tavo.file.import({multiple:false,scope:"global",extensions:["png","jpg","jpeg","webp","gif"],conflict:"rename"});
      imported=Array.isArray(files)?files[0]:null;if(!imported)return;
      if(!imported.path||!/^image\/(png|jpeg|webp|gif)$/i.test(imported.mimeType||""))throw new Error("Choose a PNG, JPG, WebP or GIF image.");
      if(!Number.isFinite(Number(imported.size))||Number(imported.size)<=0||Number(imported.size)>20*1024*1024)throw new Error("Choose a non-empty image no larger than 20 MB.");
      const currentChat=await tavo.chat.current();
      if(originalChat?.id!==currentChat?.id)throw new Error("Chat changed while choosing the image. Open the NPC again.");
      if(!npcById(loadState(),id))throw new Error("This NPC was deleted while choosing the image.");
      const validated=normalizeNpc({...npc,portraitPath:imported.path});if(!validated.portraitPath)throw new Error("The image picker returned an unsupported file path.");
      saveRecovery(`Before updating ${npc.name}'s portrait`,loadState());
      persist(state=>{const target=npcById(state,id);if(!target)throw new Error("NPC no longer exists.");target.portraitPath=validated.portraitPath;target.updatedAt=nowIso()},"NPC portrait saved.");committed=true;
      const latest=npcById(loadState(),id);renderNpcPortraitControls(latest,id);
      const detail=document.querySelector("#ss-npc-detail");if(detail&&!detail.hidden&&detail.dataset.npcId===id)renderNpcDetailUiVNext(id);
    }catch(error){console.error("[StoryState] Portrait import failed",error);tavo.utils.toast(`Portrait upload failed: ${error?.message||"unknown error"}`)}
    finally{npcPortraitImportBusy=false;if(imported?.path&&!committed&&tavo.file?.delete)try{await tavo.file.delete(imported.path)}catch(_){}}
  }
  function removeNpcPortrait(){
    const id=document.querySelector("#ss-npc-editor").elements.id.value,before=loadState(),npc=npcById(before,id);if(!npc?.portraitPath)return;
    saveRecovery(`Before removing ${npc.name}'s portrait`,before);
    persist(state=>{const target=npcById(state,id);if(target)target.portraitPath=""},"Portrait removed.");renderNpcPortraitControls(npcById(loadState(),id),id);
  }
  root.addEventListener("error",event=>{const img=event.target;if(img?.classList?.contains("ss-portrait-image"))img.hidden=true},true);
  root.addEventListener("click",event=>{const button=event.target.closest?.("[data-upload-npc-portrait]");if(button)uploadNpcPortrait(button.dataset.uploadNpcPortrait)});
  document.querySelector("#ss-upload-portrait").addEventListener("click",()=>uploadNpcPortrait(document.querySelector("#ss-npc-editor").elements.id.value));
  document.querySelector("#ss-remove-portrait").addEventListener("click",removeNpcPortrait);

  function collectVisualLibraryPortraits(state,read=(key,scope)=>tavo.get(key,scope)){
    const shared=read('com.hooch88.tavo.campaignIdentity','chat'),manual=read('tvl_campaign_selection_v1','chat');
    const campaignId=shared?.id||state.campaign?.id||manual?.id;
    const sources=[{label:'This chat',scope:'chat',items:read('tvl_catalog','chat')},{label:'Campaign',scope:'global',items:campaignId?read(`tvl_campaign_catalog_v1.${String(campaignId).slice(0,120)}`,'global'):[]},{label:'Global',scope:'global',items:read('tvl_catalog','global')}];
    const rows=[];
    for(const source of sources)for(const item of Array.isArray(source.items)?source.items:[]){
      if(item?.type!=='character')continue;
      const path=item.path||(item.fileName&&tavo.file?.url?tavo.file.url(item.fileName,item.fileScope||source.scope):'');
      const valid=normalizeNpc({portraitPath:path}).portraitPath;if(!valid)continue;
      rows.push({name:text(item.name,120)||'Untitled',aliases:Array.isArray(item.aliases)?item.aliases:[],path:valid,scope:source.label});
    }
    return rows;
  }
  let visualLibraryPortraitOptions=[];
  function renderVisualLibraryPortraitOptions(n,id){
    const select=document.querySelector('#ss-library-portrait'),button=document.querySelector('#ss-use-library-portrait');
    try{visualLibraryPortraitOptions=collectVisualLibraryPortraits(loadState())}catch(_){visualLibraryPortraitOptions=[]}
    const names=[n?.name,...(n?.aliases||[])].filter(Boolean).map(name=>String(name).trim().toLowerCase());
    visualLibraryPortraitOptions.sort((a,b)=>Number([b.name,...b.aliases].some(name=>names.includes(String(name).trim().toLowerCase())))-Number([a.name,...a.aliases].some(name=>names.includes(String(name).trim().toLowerCase()))));
    select.innerHTML=visualLibraryPortraitOptions.length?visualLibraryPortraitOptions.map((item,i)=>`<option value="${i}">${esc(item.name)} — ${esc(item.scope)}</option>`).join(''):'<option value="">No character images in Visual Library</option>';
    select.disabled=!id||!visualLibraryPortraitOptions.length;button.disabled=select.disabled;
  }
  function useVisualLibraryPortrait(){
    const form=document.querySelector('#ss-npc-editor'),id=form.elements.id.value,selection=document.querySelector('#ss-library-portrait').value;
    const chosen=selection!==''?visualLibraryPortraitOptions[Number(selection)]:null,before=loadState(),npc=npcById(before,id);if(!npc||!chosen)return;
    saveRecovery(`Before selecting ${npc.name}'s Visual Library portrait`,before);
    persist(state=>{const target=npcById(state,id);if(target){target.portraitPath=chosen.path;target.updatedAt=nowIso()}},'Visual Library portrait selected.');
    renderNpcPortraitControls(npcById(loadState(),id),id);
  }
  document.querySelector('#ss-use-library-portrait').addEventListener('click',useVisualLibraryPortrait);
