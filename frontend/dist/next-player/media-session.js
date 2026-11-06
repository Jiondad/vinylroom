const sessions=new WeakMap();
export function bindNextMediaSession(engine,session=globalThis.navigator?.mediaSession,Metadata=globalThis.MediaMetadata){
 if(!session)return {sync(){},dispose(){}};
 const existing=sessions.get(session);if(existing?.engine===engine)return existing.api;
 if(existing)throw Error('MediaSession already has an engine owner');
 const handlers={play:()=>engine.resume().catch(()=>{}),pause:()=>engine.pause(),nexttrack:()=>engine.next(),previoustrack:()=>engine.previous(),seekto:e=>seek(e.seekTime),seekbackward:e=>seek(engine.audio.currentTime-engine.start-(e.seekOffset||10)),seekforward:e=>seek(engine.audio.currentTime-engine.start+(e.seekOffset||10))};
 function seek(value){engine.seek(value);sync();}
 let item;
 function sync(){
  if(engine.disposed){api.dispose();return;}
  const current=engine.items[engine.index];
  try{if(current!==item){item=current;session.metadata=current&&Metadata?new Metadata({title:current.title||'',artist:current.artist||'',album:current.album_title||''}):null;}
   // W3C declared state keeps pause available during preparation; it is NOT
   // a claim of decoded output or continuing Android audio focus.
   session.playbackState=current&&engine.intent==='playing'&&['resolving','loading','playing','buffering'].includes(engine.state)?'playing':current?'paused':'none';
   const duration=(engine.end??engine.audio.duration)-engine.start,position=engine.audio.currentTime-engine.start;
   if(current===engine.loadedItem&&!['resolving','loading'].includes(engine.state)&&Number.isFinite(duration)&&duration>0)session.setPositionState?.({duration,position:Math.max(0,Math.min(duration,position)),playbackRate:engine.audio.playbackRate||1});else session.setPositionState?.();
  }catch{}
 }
 const bound=[];for(const [name,fn] of Object.entries(handlers))try{session.setActionHandler(name,fn);bound.push(name);}catch{}
 const unsubscribe=engine.subscribe(sync);engine.audio.addEventListener('timeupdate',sync);
 const api={sync,dispose(){unsubscribe();engine.audio.removeEventListener('timeupdate',sync);if(sessions.get(session)?.engine===engine){for(const name of bound)try{session.setActionHandler(name,null);}catch{}sessions.delete(session);}}};
 sessions.set(session,{engine,api});sync();return api;
}
