  async function copyDiagnosticsText(){
    const diagnostics=document.querySelector("#ss-diagnostics");
    const value=String(diagnostics?.textContent||"").trim();
    if(!value||value==="No diagnostics.")return tavo.utils.toast("No diagnostics are available to copy.");
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
      else{
        const ta=document.createElement("textarea");
        ta.value=value;
        ta.style.position="fixed";
        ta.style.opacity="0";
        document.body.appendChild(ta);
        ta.select();
        if(!document.execCommand("copy"))throw new Error("Copy command failed");
        ta.remove();
      }
      tavo.utils.toast("StoryState diagnostics copied.");
    }catch(e){
      console.error("[StoryState] Diagnostics copy failed",e);
      tavo.utils.toast("Could not copy StoryState diagnostics.");
    }
  }

  function installDiagnosticsCopyButton(){
    if(document.querySelector("#ss-copy-diagnostics"))return;
    const diagnostics=document.querySelector("#ss-diagnostics");
    const section=diagnostics?.closest?.(".ss-section");
    if(!section)return;
    const actions=document.createElement("div");
    actions.className="ss-actions";
    actions.setAttribute("data-diagnostics-actions","");
    const button=document.createElement("button");
    button.id="ss-copy-diagnostics";
    button.type="button";
    button.textContent="⧉ Copy Diagnostics";
    button.setAttribute("aria-label","Copy StoryState diagnostics");
    button.addEventListener("click",copyDiagnosticsText);
    actions.appendChild(button);
    section.insertBefore(actions,diagnostics);
  }

  const __ssRenderBeforeDiagnosticsCopy=render;
  render=function(...args){
    const result=__ssRenderBeforeDiagnosticsCopy(...args);
    installDiagnosticsCopyButton();
    return result;
  };
  installDiagnosticsCopyButton();
