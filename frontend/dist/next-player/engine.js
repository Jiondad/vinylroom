import {QueueModel} from './queue.js';
import {playbackDiagnostics} from '../playback-diagnostics.js';
const owners=new WeakMap();
// Access policy stays in access-state; this only cancels the owned media work.
export function revokeOwnedAudio(audio){const engine=owners.get(audio);if(!engine)return false;engine.revoke();return true;}
export function classifyFailure(error){
 if(error?.status===401)return 'authentication';
 if(error?.status===403)return 'permission';
 if(error?.name==='NotAllowedError')return 'policy';
 if(error?.name==='AbortError'||error?.code===1)return 'aborted';
 if(error?.status>=500)return 'upstream';
 if(error?.code===4||error?.name==='NotSupportedError')return 'source-or-codec';
 if(error?.code===3)return 'decode';
 if(error?.code===2||error?.name==='TypeError')return 'network';
 return 'unknown';
}
// A single externally owned HTMLAudioElement; no view, timers or recovery loop.
export class NextQueuePlayer extends QueueModel {
 constructor(audio,resolve,onChange=()=>{},options={}){
  super(options.random);
  if(owners.has(audio))throw Error('Audio already has an engine owner');
  owners.set(audio,this);
  audio.volume=.5;
  Object.assign(this,{audio,resolve,onChange,clock:options.clock||Date.now,state:'idle',intent:'paused',loading:false,message:'',failure:null,start:0,end:null,sequence:0,sourceGeneration:0,request:null,prepared:null,loadedItem:null,transitioning:false,endConsumed:true,disposed:false,listeners:new Set(),bindings:[]});
  this.onQueueChange=()=>this.invalidatePrepared();
  this.listen('playing',()=>{if(this.disposed||this.transitioning||!this.loadedItem||this.loadedItem!==this.items[this.index]||this.audio.paused||this.audio.readyState<3)return;if(this.intent!=='playing'){this.audio.pause();return;}this.endConsumed=false;this.setState('playing');});
  this.listen('pause',()=>{if(this.disposed||this.transitioning||this.endConsumed||this.audio.ended||!this.audio.paused||['idle','ended','error','blocked'].includes(this.state))return;if(this.intent==='playing'){this.intent='paused';this.setState('interrupted');}else this.setState('paused');});
  this.listen('ended',()=>{if(this.audio.ended)this.finishCurrent();});
  this.listen('error',()=>{if(!this.transitioning&&this.loadedItem&&this.audio.error)this.fail(this.audio.error);});
  for(const event of ['waiting','stalled'])this.listen(event,()=>{if(this.intent==='playing'&&this.state==='playing')this.setState('buffering');});
  this.listen('timeupdate',()=>{
   if(this.loadedItem!==this.items[this.index]||this.transitioning)return;
   if(this.end!==null&&this.audio.currentTime>=this.end){this.finishCurrent();return;}
   if(this.intent==='playing'&&Number.isFinite(this.audio.duration)&&this.audio.duration-this.audio.currentTime<=30)this.prepareNext();
  });
 }
 listen(name,fn){this.audio.addEventListener(name,fn);this.bindings.push([name,fn]);}
 subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 notify(){for(const fn of [this.onChange,...this.listeners])try{fn(this);}catch{this.observerErrors=(this.observerErrors||0)+1;}}
 setState(state){if(state!=='ended'&&this.message==='재생이 끝났습니다.')this.message='';this.state=state;this.loading=['resolving','loading'].includes(state);this.notify();}
 fail(error){this.failure=classifyFailure(error);this.intent='paused';this.message=this.failure==='authentication'||this.failure==='permission'?'이용 권한을 확인해 주세요.':this.failure==='policy'?'재생 버튼을 눌러 주세요.':'재생을 시작하지 못했습니다. 다른 곡을 선택하거나 직접 다시 재생해 주세요.';this.setState(this.failure==='policy'?'blocked':'error');if(!this.audio.paused)this.audio.pause();}
 cancelRequest(){this.sequence++;this.request?.abort();this.request=null;}
 invalidatePrepared(){this.prepared?.controller.abort();this.prepared=null;this.nextChoice=undefined;}
 prepareNext(){
  const index=this.peekNextIndex(),item=this.items[index];if(this.disposed||!Number.isInteger(index)||!item)return;
  if(this.prepared?.item===item&&this.clock()-this.prepared.created<30000)return this.prepared.promise;
  this.invalidatePrepared();this.nextChoice=index;
  const slot={item,index,created:this.clock(),controller:new AbortController(),result:null};this.prepared=slot;
  slot.promise=Promise.resolve().then(()=>this.resolve(item,{signal:slot.controller.signal,queueIndex:index,reason:'prefetch'})).then(result=>{if(!slot.controller.signal.aborted)slot.result=result;return result;}).catch(error=>{if(this.prepared===slot)this.prepared=null;throw error;});
  slot.promise.catch(()=>{});return slot.promise;
 }
 async play(index,resume=0,remember=true,automatic=false){
  if(this.disposed||!Number.isInteger(index)||!this.items[index])return;
  const item=this.items[index],slot=this.prepared?.item===item&&this.clock()-this.prepared.created<30000?this.prepared:null;
  this.cancelRequest();const seq=this.sequence;
  if(this.prepared!==slot)this.invalidatePrepared();else this.prepared=null;
  if(remember&&this.index>=0&&this.index!==index)this.history.push(this.index);
  this.index=index;this.shuffleBag=this.shuffleBag.filter(i=>i!==index);this.nextChoice=undefined;
  this.intent='playing';this.failure=null;this.message='곡을 불러오는 중…';this.transitioning=true;this.endConsumed=true;
  const controller=new AbortController();this.request=controller;
  if(slot)controller.signal.addEventListener('abort',()=>slot.controller.abort(),{once:true});
  this.setState('resolving');
  try{
   // A ready ticket reaches src+play in the current event task, without a pause.
   const result=slot?.result||(await (slot?.promise||this.resolve(item,{signal:controller.signal,queueIndex:index,reason:automatic?'automatic':'play'})));
   if(seq!==this.sequence||controller.signal.aborted||this.disposed)return;
   if(!result||typeof result.url!=='string'||!result.url)throw Error('Invalid media source');
   this.loadedItem=item;this.start=Math.max(0,Number(result.start)||0);this.end=result.cue&&Number(result.duration)>0?this.start+Number(result.duration):null;
   const offset=this.start+Math.max(0,Number(resume)||0),generation=++this.sourceGeneration;
   this.audio.onloadedmetadata=()=>{if(generation!==this.sourceGeneration||this.loadedItem!==item||this.disposed)return;if(offset>0){const limit=this.end??this.audio.duration;this.audio.currentTime=Number.isFinite(limit)?Math.min(offset,Math.max(this.start,limit-.1)):offset;}};
   this.audio.src=result.url;this.transitioning=false;this.message='';this.setState('loading');
   if(seq!==this.sequence||this.intent!=='playing'||this.disposed)return;
   // Record the actual background transition result; never retry a browser-denied play.
   const playAttemptId=playbackDiagnostics.playPromiseRequested();
   if(automatic)playbackDiagnostics.record('automatic-next-play-attempt',{reason:'queue-advance'},{immediate:true});
   try{
    await this.audio.play();
    playbackDiagnostics.playPromiseResolved(playAttemptId);
   }catch(error){
    playbackDiagnostics.playPromiseRejected(playAttemptId,error);
    if(automatic)playbackDiagnostics.record('automatic-next-play-failed',{errorName:error?.name||'Error',reason:'queue-advance'},{immediate:true});
    throw error;
   }
   // A resolved play promise is not evidence of continuing audible output.
   if(!this.disposed&&generation===this.sourceGeneration&&this.intent!=='playing'&&!this.audio.paused)this.audio.pause();
  }catch(error){if(seq!==this.sequence||controller.signal.aborted||this.disposed)return;this.transitioning=false;this.fail(error);}
  finally{if(seq===this.sequence){this.transitioning=false;this.request=null;}}
 }
 pause(){if(this.disposed)return;this.intent='paused';this.cancelRequest();this.transitioning=false;this.audio.pause();this.setState('paused');}
 async resume(){
  if(this.disposed||!this.items.length)return;
  if(this.loadedItem!==this.items[this.index]||!this.audio.getAttribute('src')||this.failure){await this.play(Math.max(0,this.index),0,false);if(this.failure)throw Object.assign(Error('Playback could not start'),{name:'PlaybackStartError'});return;}
  this.intent='playing';const seq=this.sequence,generation=this.sourceGeneration;this.failure=null;this.setState('loading');
  try{await this.audio.play();if(!this.disposed&&generation===this.sourceGeneration&&this.intent!=='playing'&&!this.audio.paused)this.audio.pause();}catch(error){if(seq===this.sequence&&!this.disposed){this.fail(error);throw error;}}
 }
 seek(position){const end=this.end??this.audio.duration;if(this.disposed||this.loadedItem!==this.items[this.index]||!this.audio.getAttribute('src')||['resolving','loading'].includes(this.state)||!Number.isFinite(end)||!Number.isFinite(Number(position)))return;this.audio.currentTime=Math.max(this.start,Math.min(end,this.start+Number(position)));}
 next(automatic=false){if(this.disposed)return;const next=this.peekNextIndex();if(Number.isInteger(next)&&this.items[next])return this.play(next,0,true,automatic);this.intent='paused';this.endConsumed=true;if(!this.audio.paused)this.audio.pause();this.message='재생이 끝났습니다.';this.setState('ended');}
 previous(){const previous=this.shuffle?this.history.pop():this.index>0?this.index-1:this.repeat==='all'?this.items.length-1:-1;if(Number.isInteger(previous)&&this.items[previous])return this.play(previous,0,false);}
 advance(){return this.repeat==='one'&&this.items[this.index]?this.play(this.index,0,false,true):this.next(true);}
 finishCurrent(){if(this.disposed||this.intent!=='playing'||this.transitioning||this.endConsumed||this.index<0)return;this.endConsumed=true;return this.advance();}
 remove(index){
  if(this.disposed||!Number.isInteger(index)||index<0||index>=this.items.length)return;
  if(index===this.index){this.stopSource();this.index=-1;}else if(index<this.index)this.index--;
  this.items.splice(index,1);this.history=[];this.shuffleBag=this.shuffleBag.filter(i=>i!==index).map(i=>i>index?i-1:i);this.changed();
 }
 stopSource(){if(this.disposed)return;this.cancelRequest();this.invalidatePrepared();this.intent='paused';this.transitioning=false;this.endConsumed=true;this.audio.pause();this.audio.onloadedmetadata=null;this.audio.removeAttribute('src');this.audio.load();this.loadedItem=null;this.start=0;this.end=null;this.failure=null;this.message='';this.state='idle';this.loading=false;}
 clear(){if(this.disposed)return;this.stopSource();this.items=[];this.index=-1;this.shuffleBag=[];this.history=[];this.notify();}
 revoke(){this.clear();}
 dispose(){if(this.disposed)return;this.clear();for(const [name,fn] of this.bindings)this.audio.removeEventListener(name,fn);this.bindings=[];this.disposed=true;this.state='disposed';this.notify();this.listeners.clear();owners.delete(this.audio);}
}
