// Delay only mobile click dispatch so double-tap can be queue-only.
export function bindTrackTaps(root,{selector,key,play,queue,isMobile=()=>true,windowMs=320,schedule=setTimeout,cancel=clearTimeout}){
 let pending=null;
 const clear=()=>{if(pending)cancel(pending.timer);pending=null;};
 root.addEventListener?.('album-page-close',clear,{once:true});
 const connected=button=>root.isConnected!==false&&button.isConnected!==false;
 root.querySelectorAll(selector).forEach(button=>{button.onclick=()=>{
  if(!isMobile()){clear();play(button);return;}
  if(pending?.key===key(button)){clear();if(connected(button))queue(button);return;}
  clear();const entry={button,key:key(button),timer:null};pending=entry;
  entry.timer=schedule(()=>{if(pending!==entry)return;pending=null;if(connected(button))play(button);},windowMs);
 };});return clear;
}
