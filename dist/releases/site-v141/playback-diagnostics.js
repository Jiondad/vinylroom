const STORAGE_KEY='vinyl-room-playback-diagnostics-v1';
const VERSION=1,MAX_EVENTS=400,RETENTION_MS=7*24*60*60*1000,FLUSH_MS=750;
const IMPORTANT=/error|fail|candidate|forced-stop|source-change|ended|pagehide|visibility|transition-start|next-selection|play-promise|diagnostics-/i;
const ALLOWED_DETAILS=new Set(['requestId','requestKind','status','errorName','errorCode','action','intent','reason','sourcePresent','timerDelayMs','progressDelta','elapsedMs','milestone','retryCount','playingObserved','pauseCorrelation','pauseIntent','previousQueueIndex','pauseApiObserved']);
const uuid=()=>{try{return crypto.randomUUID();}catch{return 's'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);}};
const safeDetails=value=>{
 const out={};if(!value||typeof value!=='object')return out;
 for(const [key,raw] of Object.entries(value)){
  if(!ALLOWED_DETAILS.has(key))continue;
  if(typeof raw==='string')out[key]=raw.slice(0,96);
  else if(typeof raw==='number'&&Number.isFinite(raw))out[key]=raw;
  else if(typeof raw==='boolean'||raw===null)out[key]=raw;
 }
 return out;
};
const safeNumber=value=>Number.isFinite(Number(value))?Math.round(Number(value)*1000)/1000:null;

export class PlaybackDiagnostics{
 constructor({storage=globalThis.localStorage,clock=()=>Date.now(),monotonic=()=>globalThis.performance?.now?.()??0,page=globalThis}={}){
  this.storage=storage;this.clock=clock;this.monotonic=monotonic;this.page=page;this.sessionId=uuid();this.enabled=false;this.events=[];this.audio=null;this.snapshot=()=>({});this.transitionId=null;this.transitionSequence=0;this.requestSequence=0;this.playSequence=0;this.sourceGeneration=0;this.lastPersist=0;this.flushTimer=null;this.uiTimer=null;this.playTimer=null;this.playingTimer=null;this.playPendingTimer=null;this.playPendingTimers=new Map();this.progressTimer=null;this.lastTimeupdate=0;this.lastProgress=null;this.stillSamples=0;this.lastPlaybackState=null;this.lastPlayingTransition=null;this.lastPauseIntent=null;this.lastApiPause=null;this.pauseObserver=null;this.pendingPlayAttempts=new Map();this.pendingRequests=new Map();this.bound=false;this.storageAvailable=true;
 }
 initialize(audio,snapshot=()=>({})){
  if(this.audio===audio&&this.bound)return;
  if(this.bound)this.detach();
  this.audio=audio;this.snapshot=snapshot;this.load();this.installPauseObserver(audio);
  if(!audio?.addEventListener)return;
  for(const name of ['play','playing','pause','ended','waiting','stalled','suspend','emptied','abort','error','loadstart','loadedmetadata','canplay','seeking','seeked'])audio.addEventListener(name,event=>this.onAudioEvent(event));
  audio.addEventListener('timeupdate',()=>this.onTimeupdate());
  this.page.document?.addEventListener?.('visibilitychange',()=>this.record('visibilitychange',{reason:this.page.document.visibilityState},{immediate:true}));
  this.page.addEventListener?.('pagehide',event=>this.record('pagehide',{reason:event.persisted?'bfcache':'unload'},{immediate:true}));
  this.page.addEventListener?.('pageshow',event=>this.record('pageshow',{reason:event.persisted?'bfcache':'navigation'},{immediate:true}));
  this.bound=true;
  if(this.enabled)this.record('diagnostics-session-start',{reason:'reload'},{immediate:true});
 }
 installPauseObserver(audio){
  if(!audio||typeof audio.pause!=='function')return;
  const diagnostics=this,original=audio.pause,own=Object.getOwnPropertyDescriptor(audio,'pause');
  function observedPause(...args){
   if(this===audio&&diagnostics.enabled){
    try{
     diagnostics.lastApiPause={at:diagnostics.clock(),sourceGeneration:diagnostics.sourceGeneration};
     diagnostics.record('audio-pause-api-called',{reason:'instance-pause-method'},{immediate:true});
    }catch{} // Observation must not suppress or replace the original call.
   }
   return Reflect.apply(original,this,args);
  }
  try{
   Object.defineProperty(audio,'pause',{value:observedPause,writable:true,configurable:true,enumerable:own?.enumerable??false});
   this.pauseObserver={audio,original,own,wrapped:observedPause};
  }catch{
   try{this.record('pause-api-observer-unavailable',{reason:'method-not-overridable'},{immediate:true});}catch{}
  }
 }
 removePauseObserver(){
  const observer=this.pauseObserver;this.pauseObserver=null;this.lastApiPause=null;
  if(!observer)return;
  try{
   const {audio,own,wrapped}=observer;
   if(Object.getOwnPropertyDescriptor(audio,'pause')?.value!==wrapped)return;
   if(own)Object.defineProperty(audio,'pause',own);else delete audio.pause;
  }catch{}
 }
 detach(){
  this.removePauseObserver();
  if(this.playTimer!==null)this.page.clearTimeout?.(this.playTimer);
  if(this.playingTimer!==null)this.page.clearTimeout?.(this.playingTimer);
  if(this.playPendingTimer!==null)this.page.clearTimeout?.(this.playPendingTimer);for(const timer of this.playPendingTimers.values())this.page.clearTimeout?.(timer);this.playPendingTimers.clear();
  if(this.progressTimer!==null)this.page.clearInterval?.(this.progressTimer);
  if(this.flushTimer!==null)this.page.clearTimeout?.(this.flushTimer);
  if(this.uiTimer!==null)this.page.clearTimeout?.(this.uiTimer);
  this.playTimer=this.playingTimer=this.playPendingTimer=this.progressTimer=this.flushTimer=this.uiTimer=null;this.audio=null;this.bound=false;
 }
 load(){
  try{
   const saved=JSON.parse(this.storage?.getItem(STORAGE_KEY)||'null');
   if(saved?.version!==VERSION)return;
   this.enabled=saved.enabled===true;
   const cutoff=this.clock()-RETENTION_MS;
   this.events=Array.isArray(saved.events)?saved.events.filter(event=>event&&typeof event.timestamp==='number'&&event.timestamp>=cutoff).slice(-MAX_EVENTS):[];
  }catch{this.storageAvailable=false;this.events=[];this.enabled=false;}
 }
 context(override={}){
  let current={};try{current=this.snapshot?.()||{};}catch{}
  return {...current,...override};
 }
 record(eventName,details={},options={}){
  if(!this.enabled)return null;
  const audio=options.audio||this.audio,context=this.context(options.context||{}),mediaError=audio?.error;
  const event={
   sessionId:this.sessionId,
   transitionId:Object.hasOwn(details,'transitionId')?details.transitionId:(context.transitionId||this.transitionId||null),
   sourceGeneration:Number.isInteger(context.sourceGeneration)?context.sourceGeneration:this.sourceGeneration,
   trackId:context.trackId||null,
   queueIndex:Number.isInteger(context.queueIndex)?context.queueIndex:null,
   eventName:String(eventName).slice(0,100),
   timestamp:this.clock(),
   monotonicMs:safeNumber(this.monotonic()),
   paused:typeof audio?.paused==='boolean'?audio.paused:null,
   ended:typeof audio?.ended==='boolean'?audio.ended:null,
   readyState:Number.isFinite(audio?.readyState)?audio.readyState:null,
   networkState:Number.isFinite(audio?.networkState)?audio.networkState:null,
   audioErrorCode:Number.isFinite(mediaError?.code)?mediaError.code:null,
   audioErrorName:typeof mediaError?.name==='string'?mediaError.name.slice(0,48):null,
   currentTime:safeNumber(audio?.currentTime),
   duration:safeNumber(audio?.duration),
   playbackState:context.playbackState||null,
   visibilityState:this.page.document?.visibilityState||'unknown',
   sourceAttribution:options.nativeEvent?'native-event-origin-unknown':'explicit-instrumentation',
   ...safeDetails(details)
  };
  this.events.push(event);this.prune();this.emitChanged();
  if(options.immediate||IMPORTANT.test(event.eventName))this.persist();else this.schedulePersist();
  return event;
 }
 beginTransition(item,index,reason='play'){
  this.transitionSequence++;
  this.transitionId=`${this.sessionId}:t${this.transitionSequence}`;
  const trackId=trackIdentity(item);
  this.record('transition-start',{reason},{context:{trackId,queueIndex:index,transitionId:this.transitionId},immediate:true});
  return this.transitionId;
 }
 beginRequest(requestKind,item,index,transitionId=this.transitionId){
  const requestId=`${this.sessionId}:r${++this.requestSequence}`,trace={trackId:trackIdentity(item),queueIndex:index,transitionId,sourceGeneration:this.sourceGeneration};
  this.pendingRequests.set(requestId,trace);while(this.pendingRequests.size>50)this.pendingRequests.delete(this.pendingRequests.keys().next().value);
  this.record('nas-request-start',{requestId,requestKind,transitionId},{context:trace,immediate:true});
  return requestId;
 }
 getRequestContext(requestId){return {...(this.pendingRequests.get(requestId)||{})};}
 requestResult(requestId,requestKind,status,item,index,transitionId=this.transitionId){
  const trace=this.pendingRequests.get(requestId)||{trackId:trackIdentity(item),queueIndex:index,transitionId,sourceGeneration:this.sourceGeneration};this.pendingRequests.delete(requestId);
  this.record(status>=200&&status<300?'nas-request-success':'nas-request-http-error',{requestId,requestKind,status,transitionId:trace.transitionId},{context:trace,immediate:true});
 }
 requestFailure(requestId,requestKind,error,item,index,transitionId=this.transitionId){
  const trace=this.pendingRequests.get(requestId)||{trackId:trackIdentity(item),queueIndex:index,transitionId,sourceGeneration:this.sourceGeneration};this.pendingRequests.delete(requestId);
  this.record('nas-request-failure',{requestId,requestKind,errorName:error?.name||'Error',status:Number.isInteger(error?.status)?error.status:null,transitionId:trace.transitionId},{context:trace,immediate:true});
 }
 sourceChanged(action,sourcePresent=true){
  if(this.playPendingTimer!==null)this.page.clearTimeout?.(this.playPendingTimer);this.playPendingTimer=null;for(const timer of this.playPendingTimers.values())this.page.clearTimeout?.(timer);this.playPendingTimers.clear();
  this.lastApiPause=null;this.sourceGeneration++;
  this.record('source-change',{action,sourcePresent},{immediate:true});
  return this.sourceGeneration;
 }
 requestPause(intent){
  this.lastPauseIntent={intent,at:this.clock(),sourceGeneration:this.sourceGeneration};
  this.record('audio-pause-requested',{intent},{immediate:true});
 }
 sourceRemovalRequested(reason){this.record('source-removal-requested',{reason,sourcePresent:!!this.audio?.getAttribute?.('src')},{immediate:true});}
 playbackStateChanged(state){
  if(state===this.lastPlaybackState)return;
  this.lastPlaybackState=state;this.record('media-session-playback-state',{reason:state},{immediate:true});
 }
 playPromiseRequested(){
  const playAttemptId=`${this.sessionId}:p${++this.playSequence}`,sourceGeneration=this.sourceGeneration,transitionId=this.transitionId,context=this.context();
  const attempt={sourceGeneration,transitionId,trackId:context.trackId||null,queueIndex:Number.isInteger(context.queueIndex)?context.queueIndex:null};
  this.pendingPlayAttempts.set(playAttemptId,attempt);while(this.pendingPlayAttempts.size>20)this.pendingPlayAttempts.delete(this.pendingPlayAttempts.keys().next().value);
  this.record('audio-play-requested',{requestId:playAttemptId,milestone:'audio.play-called'},{context:{...attempt},immediate:true});
  const started=this.monotonic();
  const timer=this.page.setTimeout?.(()=>{
   this.playPendingTimers.delete(playAttemptId);if(this.playPendingTimer===timer)this.playPendingTimer=null;if(!this.enabled||sourceGeneration!==this.sourceGeneration||!this.pendingPlayAttempts.has(playAttemptId))return;
   const delay=this.monotonic()-started;
   if(delay>15000){this.record('watchdog-delay-observed',{timerDelayMs:Math.round(delay)},{context:{...attempt},immediate:true});return;}
   this.record('play-promise-unsettled-candidate',{requestId:playAttemptId,elapsedMs:Math.round(delay)},{context:{...attempt},immediate:true});
  },10000)??null;this.playPendingTimer=timer;if(timer!==null)this.playPendingTimers.set(playAttemptId,timer);
  return playAttemptId;
 }
 playPromiseResolved(playAttemptId){
  const attempt=this.pendingPlayAttempts.get(playAttemptId)||{sourceGeneration:this.sourceGeneration,transitionId:this.transitionId,...this.context()};
  this.pendingPlayAttempts.delete(playAttemptId);const pendingTimer=this.playPendingTimers.get(playAttemptId);if(pendingTimer!==undefined)this.page.clearTimeout?.(pendingTimer);this.playPendingTimers.delete(playAttemptId);if(this.playPendingTimer===pendingTimer)this.playPendingTimer=null;
  if(this.playingTimer!==null)this.page.clearTimeout?.(this.playingTimer);
  const started=this.monotonic(),generation=attempt.sourceGeneration,transitionId=attempt.transitionId,prior=Number(this.audio?.currentTime)||0,context={...attempt};
  this.record('play-promise-resolved',{requestId:playAttemptId,milestone:'promise-fulfilled'},{context,immediate:true});
  if(generation!==this.sourceGeneration)return;
  this.playingTimer=this.page.setTimeout?.(()=>{
   this.playingTimer=null;if(!this.enabled||generation!==this.sourceGeneration)return;
   const delay=this.monotonic()-started;
   if(delay>15000){this.record('watchdog-delay-observed',{timerDelayMs:Math.round(delay)},{context,immediate:true});return;}
   if(this.lastPlayingTransition===transitionId)return;
   this.record('play-succeeded-playing-not-observed-candidate',{requestId:playAttemptId,elapsedMs:Math.round(delay),playingObserved:false,progressDelta:safeNumber((Number(this.audio?.currentTime)||0)-prior)},{context,immediate:true});
  },7000)??null;
 }
 playPromiseRejected(playAttemptId,error){
  const attempt=this.pendingPlayAttempts.get(playAttemptId)||{sourceGeneration:this.sourceGeneration,transitionId:this.transitionId,...this.context()};
  this.pendingPlayAttempts.delete(playAttemptId);const pendingTimer=this.playPendingTimers.get(playAttemptId);if(pendingTimer!==undefined)this.page.clearTimeout?.(pendingTimer);this.playPendingTimers.delete(playAttemptId);if(this.playPendingTimer===pendingTimer)this.playPendingTimer=null;
  this.record('play-promise-rejected',{requestId:playAttemptId,errorName:error?.name||'Error'},{context:{...attempt},immediate:true});
 }
 setEnabled(enabled){
  const next=enabled===true;if(this.enabled===next){this.persist();return;}
  if(!next)this.record('diagnostics-disabled',{reason:'admin-toggle'},{immediate:true});
  this.enabled=next;
  if(next)this.record('diagnostics-enabled',{reason:'admin-toggle'},{immediate:true});else this.persist();
  this.emitChanged();
 }
 clear(){this.events=[];this.persist();this.emitChanged();}
 getEvents(){this.prune();return this.events.map(event=>({...event}));}
 exportData(){return {format:'vinyl-room-playback-diagnostics',version:VERSION,exportedAt:this.clock(),retentionDays:7,sessionId:this.sessionId,enabled:this.enabled,events:this.getEvents()};}
 prune(){const cutoff=this.clock()-RETENTION_MS;this.events=this.events.filter(event=>event.timestamp>=cutoff).slice(-MAX_EVENTS);}
 schedulePersist(){
  if(this.flushTimer!==null)return;
  this.flushTimer=this.page.setTimeout?.(()=>{this.flushTimer=null;this.persist();},FLUSH_MS)??null;
 }
 persist(){
  if(!this.storage)return;
  this.prune();
  try{this.storage.setItem(STORAGE_KEY,JSON.stringify({version:VERSION,enabled:this.enabled,events:this.events}));this.storageAvailable=true;this.lastPersist=this.clock();}
  catch{this.storageAvailable=false;}
 }
 emitChanged(){if(this.uiTimer!==null)return;this.uiTimer=this.page.setTimeout?.(()=>{this.uiTimer=null;try{this.page.dispatchEvent?.(new CustomEvent('vinyl-playback-diagnostics-change'));}catch{}},250)??null;}
 onAudioEvent(event){
  if(!this.enabled)return;
  const snapshot=this.context();
  const pauseRecent=this.lastPauseIntent&&this.lastPauseIntent.sourceGeneration===this.sourceGeneration&&this.clock()-this.lastPauseIntent.at<3000;
  this.record(`audio-${event.type}`,event.type==='pause'?{pauseCorrelation:pauseRecent?'nearby-instrumented-pause-intent':'no-recent-instrumented-pause-intent',pauseIntent:pauseRecent?this.lastPauseIntent.intent:'unknown',pauseApiObserved:!!(this.lastApiPause&&this.lastApiPause.sourceGeneration===this.sourceGeneration&&this.clock()-this.lastApiPause.at>=0&&this.clock()-this.lastApiPause.at<3000)}:{}, {nativeEvent:true,immediate:['error','ended','stalled','waiting','pause','emptied','abort'].includes(event.type)});
  if(event.type==='playing'){
   if(this.playingTimer!==null)this.page.clearTimeout?.(this.playingTimer);this.playingTimer=null;this.lastPlayingTransition=this.transitionId;
   this.lastProgress={time:Number(this.audio?.currentTime)||0,at:this.monotonic()};this.stillSamples=0;
   if(this.progressTimer!==null)this.page.clearInterval?.(this.progressTimer);
   this.progressTimer=this.page.setInterval?.(()=>this.checkProgress(),5000)??null;
  }else if(event.type==='pause'||event.type==='ended'||event.type==='error'||event.type==='emptied'){
   if(this.progressTimer!==null)this.page.clearInterval?.(this.progressTimer);this.progressTimer=null;this.lastProgress=null;this.stillSamples=0;
  }
  if(event.type==='error')this.record('audio-error-candidate',{errorCode:Number.isFinite(this.audio?.error?.code)?this.audio.error.code:null,errorName:this.audio?.error?.name||'MediaError'},{nativeEvent:true,immediate:true});
  if(event.type==='playing')this.startPlayingWatch(snapshot);
 }
 onTimeupdate(){
  if(!this.enabled)return;
  const now=this.monotonic();if(now-this.lastTimeupdate<5000)return;
  this.lastTimeupdate=now;this.record('timeupdate-sample',{milestone:'sampled-5s'},{nativeEvent:true});
 }
 startPlayingWatch(snapshot){
  if(this.playTimer!==null)this.page.clearTimeout?.(this.playTimer);
  const started=this.monotonic(),generation=this.sourceGeneration,prior=Number(this.audio?.currentTime)||0;
  this.playTimer=this.page.setTimeout?.(()=>{
   this.playTimer=null;if(!this.enabled||generation!==this.sourceGeneration)return;
   const delay=this.monotonic()-started;
   if(delay>15000){this.record('watchdog-delay-observed',{timerDelayMs:Math.round(delay)},{immediate:true});return;}
   if(this.audio?.paused||this.audio?.ended)return;
   if(Number.isFinite(prior)&&Number.isFinite(this.audio?.currentTime)&&this.audio.currentTime<=prior+.05){
    this.record('playing-without-time-progress-candidate',{elapsedMs:Math.round(delay),progressDelta:safeNumber(this.audio.currentTime-prior)},{immediate:true});
   }
  },7000)??null;
 }
 checkProgress(){
  if(!this.enabled||!this.audio||this.audio.paused||this.audio.ended)return;
  const now=this.monotonic(),time=Number(this.audio.currentTime)||0;
  if(!this.lastProgress){this.lastProgress={time,at:now};return;}
  const elapsed=now-this.lastProgress.at,delta=time-this.lastProgress.time;
  if(elapsed>15000){this.record('watchdog-delay-observed',{timerDelayMs:Math.round(elapsed)},{immediate:true});this.lastProgress={time,at:now};this.stillSamples=0;return;}
  if(delta<=.05)this.stillSamples++;else this.stillSamples=0;
  if(this.stillSamples>=2){this.record('time-progress-not-observed-candidate',{elapsedMs:Math.round(elapsed),progressDelta:safeNumber(delta)},{immediate:true});this.stillSamples=0;}
  this.record('progress-sample',{elapsedMs:Math.round(elapsed),progressDelta:safeNumber(delta)});
  this.lastProgress={time,at:now};
 }
}

export function trackIdentity(item){
 if(!item)return null;
 if(item.top100_folder&&Number.isInteger(item.top100_rank))return `top100:${String(item.top100_folder).slice(0,80)}:${item.top100_rank}`;
 const album=typeof item.album_id==='string'?item.album_id.slice(0,80):'';
 const index=Number.isInteger(item.index)?item.index:Number.isInteger(item.track_index)?item.track_index:null;
 return album&&index!==null?`${album}:${index}`:album||null;
}

export const playbackDiagnostics=new PlaybackDiagnostics();
globalThis.vinylPlaybackDiagnostics=playbackDiagnostics;

export function mountPlaybackDiagnostics(root,{authorized=false,confirmClear=()=>globalThis.confirm?.('재생 진단 로그를 모두 삭제할까요?')===true}={}){
 if(!root)return()=>{};
 if(!authorized){root.textContent='관리자 권한이 필요합니다.';return()=>{};}
 const panel=document.createElement('section');panel.className='playback-diagnostics';panel.setAttribute('aria-label','재생 진단 로그');
 const header=document.createElement('div');header.className='playback-diagnostics-controls';
 const label=document.createElement('label');label.className='playback-diagnostics-toggle';
 const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=playbackDiagnostics.enabled;
 const toggleText=document.createElement('span');toggleText.textContent='진단 로그 수집';label.append(toggle,toggleText);
 const status=document.createElement('p');status.className='playback-diagnostics-status';status.setAttribute('role','status');
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='새로고침';
 const download=document.createElement('button');download.type='button';download.textContent='JSON 다운로드';
 const clear=document.createElement('button');clear.type='button';clear.className='playback-diagnostics-clear';clear.textContent='로그 초기화';
 header.append(label,refresh,download,clear);
 const summary=document.createElement('p');summary.className='playback-diagnostics-summary';
 const groups=document.createElement('div');groups.className='playback-diagnostics-groups';
 panel.append(header,status,summary,groups);root.replaceChildren(panel);
 let disposed=false;
 function renderEvents(){
  if(disposed)return;
  const events=playbackDiagnostics.getEvents(),groupMap=new Map();
  status.textContent=`${playbackDiagnostics.enabled?'수집 중':'수집 꺼짐'} · ${events.length}/${MAX_EVENTS}개 · 최근 7일 · 이 기기에만 저장`;
  summary.textContent=`세션 ${playbackDiagnostics.sessionId} · 시간은 이 기기 기준 · 오디오 이벤트의 원본 곡을 판별할 수 없는 경우 “출처 미확정”으로 표시`;
  for(const event of events){const key=event.transitionId||'공통 이벤트';if(!groupMap.has(key))groupMap.set(key,[]);groupMap.get(key).push(event);}
  const ordered=[...groupMap.entries()].reverse();groups.replaceChildren();
  if(!events.length){const empty=document.createElement('p');empty.className='playback-diagnostics-empty';empty.textContent='기록된 이벤트가 없습니다. 자동 중단을 재현하기 전에 진단 수집을 켜 주세요.';groups.append(empty);return;}
  for(const [transitionId,rows] of ordered){
   const details=document.createElement('details');details.className='playback-diagnostics-transition';details.open=ordered.length<=3;
   const title=document.createElement('summary'),first=rows[0],last=rows.at(-1);
   title.textContent=`${transitionId} · ${first.trackId||'트랙 미확인'} · 큐 ${Number.isInteger(first.queueIndex)?first.queueIndex+1:'?'}번 · ${rows.length}개 이벤트 · ${new Date(last.timestamp).toLocaleString()}`;
   const list=document.createElement('ol');list.className='playback-diagnostics-events';
   for(const event of rows){
    const item=document.createElement('li');if(/error|fail|candidate|forced-stop|unsettled/i.test(event.eventName))item.classList.add('is-warning');
    const when=document.createElement('time');when.dateTime=new Date(event.timestamp).toISOString();when.textContent=new Date(event.timestamp).toLocaleTimeString();
    const name=document.createElement('code');name.textContent=event.eventName;
    const state=document.createElement('small');state.textContent=`g=${event.sourceGeneration} · ${event.trackId||'track —'} · q=${Number.isInteger(event.queueIndex)?event.queueIndex+1:'—'} · paused=${event.paused} · ended=${event.ended} · t=${event.currentTime??'—'}/${event.duration??'—'} · ready=${event.readyState??'—'} · network=${event.networkState??'—'} · media=${event.playbackState||'—'} · ${event.sourceAttribution==='native-event-origin-unknown'?'출처 미확정':'명시 계측'}${event.status!==undefined?' · HTTP '+event.status:''}${event.errorName?' · '+event.errorName:''}`;
    item.append(when,name,state);list.append(item);
   }
   details.append(title,list);groups.append(details);
  }
 }
 const onToggle=()=>{playbackDiagnostics.setEnabled(toggle.checked);renderEvents();};
 const onRefresh=()=>renderEvents();
 const onDownload=()=>{
  const blob=new Blob([JSON.stringify(playbackDiagnostics.exportData(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=`vinyl-room-playback-diagnostics-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const onClear=()=>{if(confirmClear()){playbackDiagnostics.clear();renderEvents();}};
 const onChange=()=>renderEvents();
 toggle.addEventListener('change',onToggle);refresh.addEventListener('click',onRefresh);download.addEventListener('click',onDownload);clear.addEventListener('click',onClear);globalThis.addEventListener?.('vinyl-playback-diagnostics-change',onChange);
 renderEvents();
 return()=>{disposed=true;toggle.removeEventListener('change',onToggle);refresh.removeEventListener('click',onRefresh);download.removeEventListener('click',onDownload);clear.removeEventListener('click',onClear);globalThis.removeEventListener?.('vinyl-playback-diagnostics-change',onChange);};
}
