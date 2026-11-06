export function bindRandomTrackActions(root,{isMobile,play,queue,now=()=>Date.now(),windowMs=320}){
 let lastTap=null;
 root.querySelectorAll('[data-random-track]').forEach(button=>{
  button.onclick=()=>{
   const key=button.dataset.randomTrack,time=now();
   if(isMobile()&&lastTap?.key===key&&time-lastTap.time<=windowMs){
    lastTap=null;queue(button);return;
   }
   lastTap={key,time};play(button);
  };
 });
}
