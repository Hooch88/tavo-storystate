  try{
    if(tavo.plugin?.on)tavo.plugin.on("message:added",async event=>{await processLocalNpcDiscoveryMessage(event?.message)});
  }catch(e){console.warn("[StoryState] Local NPC discovery event hook unavailable",e)}
