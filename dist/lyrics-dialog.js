// Selectively adapted from the preview lyric dialog. Read-only playback observer.
import {getPlayer} from './player.js';
import {parseTimedLyrics,activeCueIndex,matchesLyricTrack,lyricPosition} from './lyrics-parser.js';
let closeCurrent=null,currentDialog=null;
const events=['timeupdate','seeked','loadedmetadata','playing','pause','ended','emptied'];
export function closeLyricDialog(){closeCurrent?.();}
export function showLyricDialog({title='',artist='',target,load,owner,player=getPlayer()}={}){
 if(typeof load!=='function')throw Error('가사 조회 함수를 확인해 주세요.');
 if(currentDialog?.player===player&&currentDialog.owner===owner)return currentDialog.open({title,artist,target,load});
 closeCurrent?.();
 if(!document.querySelector('link[data-vinyl-lyrics-style]')){
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./lyrics-dialog.css',import.meta.url).href;css.dataset.vinylLyricsStyle='';document.head.append(css);
 }
 const dlg=document.createElement('dialog');dlg.id='vinyl-lyrics-dialog';dlg.className='vinyl-lyrics-dialog';dlg.setAttribute('aria-label','가사 보기');
 const head=document.createElement('div');head.className='vinyl-lyrics-header';
 const titleBox=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small');
 titleBox.append(strong,small);
 const btn=document.createElement('button');btn.type='button';btn.textContent='×';btn.setAttribute('aria-label','가사 닫기');head.append(titleBox,btn);
 const info=document.createElement('p');info.className='vinyl-lyrics-status';info.setAttribute('role','status');
 const body=document.createElement('div');body.className='vinyl-lyrics-content';dlg.append(head,info,body);
 let done=false,lines=[],rows=[],chosen=-2,unsubscribe=null,aborter=null,request=0;
 const highlight=document.createElement('div');highlight.className='vinyl-lyrics-highlight';highlight.setAttribute('aria-hidden','true');highlight.hidden=true;
 const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(()=>positionHighlight(false)):null;resizeObserver?.observe(body);
 let loadCurrent=load;
 let manualUntil=0,needsCenter=false;
 const reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
 function suspendFollow(){manualUntil=Date.now()+6000;needsCenter=true;}
 function onScrollKey(e){if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key))suspendFollow();}
 body.tabIndex=0;body.setAttribute('aria-label','가사 본문');
 body.addEventListener('wheel',suspendFollow,{passive:true});body.addEventListener('touchmove',suspendFollow,{passive:true});body.addEventListener('pointerdown',suspendFollow);body.addEventListener('keydown',onScrollKey);
 let selected={...target},follow=matchesLyricTrack(player?.items?.[player.index],target);
 function current(){return player?.items?.[player.index];}
 function close(){
  if(done)return;done=true;request++;aborter?.abort();resizeObserver?.disconnect();
  for(const e of events)player?.audio?.removeEventListener(e,sync);
  body.removeEventListener('wheel',suspendFollow);body.removeEventListener('touchmove',suspendFollow);body.removeEventListener('pointerdown',suspendFollow);body.removeEventListener('keydown',onScrollKey);
  unsubscribe?.();window.removeEventListener('vinyl-approval-change',close);window.removeEventListener('vinyl-account-change',close);
  owner?.removeEventListener('album-page-close',close);
  if(dlg.open)dlg.close();dlg.remove();if(closeCurrent===close){closeCurrent=null;currentDialog=null;}
 }
 function positionHighlight(animate=false){
  const row=rows[chosen];if(done||!row||!row.isConnected){highlight.hidden=true;return;}
  const rect=row.getBoundingClientRect(),viewport=body.getBoundingClientRect();
  highlight.classList.toggle('is-moving',animate&&!reducedMotion());
  highlight.hidden=false;
  highlight.style.width=rect.width+'px';highlight.style.height=rect.height+'px';
  highlight.style.transform=`translate3d(${rect.left-viewport.left+body.scrollLeft-body.clientLeft}px,${rect.top-viewport.top+body.scrollTop-body.clientTop}px,0)`;
 }
 function sync(event){
  if(done)return;
  const item=current(),same=matchesLyricTrack(item,selected);
  if(same)follow=true;
  if(follow&&item&&!same){
   selected={album_id:item.album_id,index:item.index,top100_folder:item.top100_folder,top100_rank:item.top100_rank};
   void reload(item.title,item.artist,item);return;
  }
  if(!lines.length)return;
  const ready=same&&player?.loadedItem===item&&!!player?.audio?.getAttribute('src');
  info.textContent=ready?'':'해당 곡을 재생하면 가사가 동기화됩니다.';
  const n=ready?activeCueIndex(lines,lyricPosition(player)):-1;
  if(n===chosen){if(needsCenter&&Date.now()>=manualUntil)centerCue(n);return;}const previous=chosen;chosen=n;
  const time=n>=0?lines[n].time:null;
  for(let i=0;i<rows.length;i++){
   const row=rows[i],active=time!==null&&lines[i].time===time;
   row.classList.toggle('is-current',active);
   if(active)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');
  }
  positionHighlight(previous>=0&&n>=0&&Math.abs(n-previous)===1&&!['seeked','loadedmetadata','emptied'].includes(event?.type));
  // Scroll only the lyric viewport, never the page or playback controls.
  centerCue(n);
 }
 function centerCue(n){
  if(n<0)return;
  if(Date.now()<manualUntil){needsCenter=true;return;}
  const row=rows[n];
  const offset=typeof row.getBoundingClientRect==='function'?row.getBoundingClientRect().top-body.getBoundingClientRect().top+body.scrollTop:row.offsetTop-body.offsetTop;
  const top=Math.max(0,offset-(body.clientHeight-row.offsetHeight)/2);
  if(typeof body.scrollTo==='function')body.scrollTo({top,behavior:reducedMotion()?'auto':'smooth'});else body.scrollTop=top;
  needsCenter=false;
 }
 async function reload(name,performer,item=null){
  const version=++request;aborter?.abort();aborter=new AbortController();lines=[];rows=[];highlight.hidden=true;chosen=-2;manualUntil=0;needsCenter=false;
  strong.textContent=String(name||'가사');small.textContent=String(performer||'');info.textContent='';body.textContent='가사를 불러오는 중…';
  try{
   const raw=await loadCurrent({signal:aborter.signal,target:{...selected},item});
   if(done||version!==request)return;
   const result=parseTimedLyrics(raw);body.replaceChildren();
   if(!result.timed){info.textContent=result.text?'일반 가사 · 시간 정보 없음':'가사 없음';const pre=document.createElement('pre');pre.textContent=result.text||'등록된 가사가 없습니다.';body.append(pre);sync();return;}
   lines=result.cues;body.append(highlight);
   for(const cue of lines){const row=document.createElement('p');row.className='vinyl-lyrics-line';row.dataset.lyric=cue.text||' ';const text=document.createElement('span');text.textContent=cue.text||' ';row.append(text);body.append(row);rows.push(row);}
   sync();
  }catch{if(!done&&version===request){info.textContent='가사를 불러오지 못했습니다.';body.textContent='계정 권한과 연결 상태를 확인해 주세요.';}}
 }
 btn.onclick=close;dlg.addEventListener('close',close);
 dlg.addEventListener('cancel',e=>{e.preventDefault();close();});
 dlg.addEventListener('click',e=>{if(e.target===dlg)close();});
 window.addEventListener('vinyl-approval-change',close);window.addEventListener('vinyl-account-change',close);owner?.addEventListener('album-page-close',close);
 document.body.append(dlg);try{dlg.showModal();}catch(error){close();throw error;}
 closeCurrent=close;
 currentDialog={player,owner,open:options=>{selected={...options.target};follow=matchesLyricTrack(current(),selected);loadCurrent=options.load;void reload(options.title,options.artist);return dlg;}};
 for(const e of events)player?.audio?.addEventListener(e,sync);
 unsubscribe=player?.subscribe?.(sync)||null;
 document.fonts?.ready?.then(()=>{if(!done){needsCenter=true;sync();positionHighlight(false);}});
 void reload(title,artist);return dlg;
}
