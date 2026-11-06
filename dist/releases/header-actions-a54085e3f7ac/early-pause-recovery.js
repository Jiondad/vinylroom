// One retry for an observed early, error-free pause after an automatic mobile transition.
// This is a bounded workaround; it does not establish why the browser paused.
export function createEarlyPauseRecovery(audio,{
 diagnostics,enabled=()=>globalThis.matchMedia?.('(max-width:740px)')?.matches===true,
 hidden=()=>globalThis.document?.visibilityState==='hidden',clock=()=>Date.now(),
 schedule=(fn,ms)=>setTimeout(fn,ms),unschedule=id=>clearTimeout(id),
 pauseRevision=()=>0,canObserve=()=>false
}={}){
 let state=null,timer=null;
 const record=(event,reason)=>{try{diagnostics?.record(event,{reason,retryCount:state?.attempts||0},{immediate:true});}catch{}};
 function clearTimer(){if(timer!==null)unschedule(timer);timer=null;}
 function cancel(){clearTimer();state=null;}
 function valid(s){return state===s&&s.current()&&audio.getAttribute('src')===s.src&&pauseRevision()===s.revision;}
 function arm({current,start=0}){
  cancel();if(!enabled()||!canObserve())return;
  state={current,start,src:audio.getAttribute('src'),revision:pauseRevision(),playingAt:null,attempts:0,candidate:false};
 }
 const onPlaying=()=>{if(state&&state.playingAt===null)state.playingAt=clock();};
 const onPlay=()=>clearTimer();
 function onPause(){
  const s=state;
  if(!s||s.candidate||s.attempts||!valid(s)||!hidden()||!enabled()||!canObserve())return;
  const age=clock()-s.playingAt,position=Number(audio.currentTime)-s.start;
  if(s.playingAt===null||age<0||age>1500||!Number.isFinite(position)||position<0||position>1||audio.error||audio.ended||!audio.paused||audio.readyState<3)return;
  s.candidate=true;record('early-pause-recovery-candidate','automatic-mobile-transition');
  const detected=clock();
  timer=schedule(()=>{
   timer=null;
   if(!valid(s)||!hidden()||!enabled()||!canObserve()||!audio.paused||audio.error||audio.ended||audio.readyState<3||clock()-detected<0||clock()-detected>1500){record('early-pause-recovery-cancelled','state-or-intent-changed');return;}
   s.attempts=1;record('early-pause-recovery-attempt','same-source-same-position');
   let id;
   try{id=diagnostics?.playPromiseRequested();}catch{}
   try{
    const result=audio.play();
    Promise.resolve(result).then(()=>{
     try{diagnostics?.playPromiseResolved(id);}catch{}
     if(state===s)record('early-pause-recovery-resolved','play-promise-fulfilled');
    },error=>{
     try{diagnostics?.playPromiseRejected(id,error);}catch{}
     if(state===s)record('early-pause-recovery-failed','play-promise-rejected');
    });
   }catch(error){
    try{diagnostics?.playPromiseRejected(id,error);}catch{}
    record('early-pause-recovery-failed','play-threw');
   }
  },250);
 }
 const onEmptied=()=>{if(state&&(!state.current()||audio.getAttribute('src')!==state.src))cancel();};
 for(const [event,fn] of [['playing',onPlaying],['play',onPlay],['pause',onPause],['error',cancel],['emptied',onEmptied]])audio.addEventListener(event,fn);
 return {arm,cancel,dispose(){cancel();for(const [event,fn] of [['playing',onPlaying],['play',onPlay],['pause',onPause],['error',cancel],['emptied',onEmptied]])audio.removeEventListener(event,fn);}};
}
