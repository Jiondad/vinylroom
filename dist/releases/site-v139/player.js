import {mountDesktopPlayer} from './desktop-player.js';
import {mountMobilePlayer} from './mobile-player.js';
import {coverMemberImage,loadMemberImage} from './member-images.js';
import {NAS_URL} from './config.js';
import {bindQueueReordering} from './queue-reorder.js';
export function bindPlaybackIndicator(audio,host){
 const stopped=new Set(['pause','ended','waiting','stalled','emptied','error','abort','loadstart','seeking']);
 function update(event){host.classList.toggle('is-audible',!stopped.has(event?.type)&&!!audio.getAttribute('src')&&!audio.paused&&!audio.ended&&audio.readyState>=3);}
 for(const event of [...stopped,'playing','seeked'])audio.addEventListener(event,update);
 update();
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const describeTrack=(album,index)=>({album_id:album.id,album_title:album.title,artist:album.artist,title:album.tracks[index].title||album.tracks[index].filename||'제목 없음',filename:album.tracks[index].filename||'',disc:String(album.tracks[index].disc||1),index});
export function matchTrack(album,item){
 const rows=album.tracks||[];
 const disc=v=>String(v||1).split('/')[0].replace(/^0+(?=\d)/,'');
 const title=v=>String(v||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
 const indexed=rows.map((t,i)=>({t,i}));
 const files=item.filename?indexed.filter(({t})=>t.filename===item.filename&&disc(t.disc)===disc(item.disc)):[];
 if(files.length===1)return files[0].i;
 // Public album responses omit filenames. Reconnect only an unambiguous title,
 // never the old array position, which can point to another song after a scan.
 const matches=title(item.title)?indexed.filter(({t})=>title(t.title)===title(item.title)):[];
 const sameDisc=matches.filter(({t})=>disc(t.disc)===disc(item.disc));
 if(sameDisc.length===1)return sameDisc[0].i;
 if(matches.length===1)return matches[0].i;
 throw Error('이 곡의 파일이나 색인이 변경됐습니다. 앨범에서 다시 추가해 주세요.');
}
export class QueuePlayer {
 constructor(audio,resolve,onChange=()=>{}){this.audio=audio;this.resolve=resolve;this.onChange=onChange;this.items=[];this.index=-1;this.shuffle=false;this.repeat='off';this.shuffleBag=[];this.history=[];this.token=0;this.ending=false;this.start=0;this.end=null;this.loading=false;this.message='';this.queueRevision=0;this.nextChoice=undefined;this.prefetched=null;audio.volume=.5;audio.addEventListener('playing',()=>{this.ending=false;if(this.loading){this.loading=false;this.onChange();}});audio.addEventListener('ended',()=>{if(audio.ended)this.finishCurrent();});audio.addEventListener('timeupdate',()=>{const duration=this.end??Number(audio.duration),remaining=Number(duration)-Number(audio.currentTime);if(Number.isFinite(remaining)&&remaining>=0&&remaining<=30&&!this.ending)this.prepareNext();if(this.end&&audio.currentTime>=this.end){audio.pause();this.finishCurrent();return;}if(audio.ended||(audio.paused&&Number.isFinite(Number(audio.duration))&&Number(audio.duration)>0&&audio.currentTime>=audio.duration))this.finishCurrent();});audio.addEventListener('error',()=>{if(audio.getAttribute('src')){this.loading=false;this.message='재생할 수 없는 곡입니다. 다시 재생하거나 다음 곡을 선택해 주세요.';this.onChange();}});}
 invalidatePrepared(){this.queueRevision++;this.nextChoice=undefined;this.prefetched=null;}
 peekNextIndex(){if(this.nextChoice!==undefined)return this.nextChoice;let index=null;if(this.shuffle){this.shuffleBag=this.shuffleBag.filter(i=>i>=0&&i<this.items.length&&i!==this.index);if(!this.shuffleBag.length&&this.repeat==='all')this.shuffleBag=this.items.map((_,i)=>i).filter(i=>i!==this.index);if(this.shuffleBag.length)index=this.shuffleBag[Math.floor(Math.random()*this.shuffleBag.length)];else if(this.repeat==='all'&&this.items.length===1)index=0;}else{index=this.index+1;if(index>=this.items.length)index=this.repeat==='all'&&this.items.length?0:null;}this.nextChoice=index;return index;}
 prepareNext(){let index=this.peekNextIndex(),item=this.items[index];if(!Number.isInteger(index)||!item)return;if(this.prefetched&&this.prefetched.index===index&&this.prefetched.item===item&&this.prefetched.revision===this.queueRevision){if(Date.now()-this.prefetched.createdAt<30000)return this.prefetched.promise;this.prefetched=null;this.nextChoice=undefined;index=this.peekNextIndex();item=this.items[index];}const slot={index,item,revision:this.queueRevision,createdAt:Date.now(),result:null,promise:null};this.prefetched=slot;slot.promise=Promise.resolve().then(()=>this.resolve(item)).then(result=>{if(this.prefetched===slot&&slot.revision===this.queueRevision)slot.result=result;return result;}).catch(error=>{if(this.prefetched===slot)this.prefetched=null;throw error;});slot.promise.catch(()=>{});return slot.promise;}
 add(items){this.invalidatePrepared();const first=this.items.length;this.items.push(...items);if(this.shuffle)this.shuffleBag.push(...items.map((_,i)=>first+i));this.onChange();}
 move(from,to){
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=this.items.length||to>=this.items.length||from===to)return false;
  const remap=index=>index===from?to:from<to&&index>from&&index<=to?index-1:from>to&&index>=to&&index<from?index+1:index;
  this.invalidatePrepared();const [item]=this.items.splice(from,1);this.items.splice(to,0,item);
  this.index=remap(this.index);this.shuffleBag=this.shuffleBag.map(remap);this.history=this.history.map(remap);this.onChange();return true;
 }
 setShuffle(enabled){this.invalidatePrepared();this.shuffle=!!enabled;this.shuffleBag=this.items.map((_,i)=>i).filter(i=>i!==this.index);this.history=[];this.onChange();}
 setRepeat(mode){if(!['off','all','one'].includes(mode))return;this.invalidatePrepared();this.repeat=mode;this.onChange();}
 next(){const index=this.peekNextIndex();this.nextChoice=undefined;if(Number.isInteger(index)&&this.items[index])return this.play(index);this.message='재생이 끝났습니다.';this.onChange();}
 previous(){const index=this.shuffle?this.history.pop():(this.index>0?this.index-1:this.repeat==='all'?this.items.length-1:-1);if(Number.isInteger(index)&&this.items[index])return this.play(index,0,false);}
 async play(index,resume=0,remember=true){if(!this.items[index])return;const item=this.items[index],slot=this.prefetched,prepared=slot&&slot.index===index&&slot.item===item&&slot.revision===this.queueRevision&&Date.now()-slot.createdAt<40000?slot:null;if(!prepared)this.invalidatePrepared();this.nextChoice=undefined;if(remember&&this.index>=0&&this.index!==index)this.history.push(this.index);this.shuffleBag=this.shuffleBag.filter(i=>i!==index);const token=++this.token;this.audio.pause();this.index=index;this.loading=true;this.message='곡을 불러오는 중…';this.onChange();try{let result;if(prepared?.result)result=prepared.result;else if(prepared?.promise){try{result=await prepared.promise;}catch{result=await this.resolve(item);}}else result=await this.resolve(item);if(token!==this.token)return;if(this.prefetched===prepared)this.prefetched=null;this.start=Number(result.start)||0;this.end=result.cue&&Number(result.duration)>0?this.start+Number(result.duration):null;this.audio.onloadedmetadata=()=>{if(token!==this.token)return;this.audio.currentTime=this.start+Math.max(0,Math.min(resume,this.end?this.end-this.start-.1:Math.max(0,this.audio.duration-this.start-.1)));};this.audio.src=result.url;this.message='';
  // Ask the existing media element to continue immediately on track changes. Waiting for
  // loadedmetadata before calling play() can let Android drop the lock-screen media session
  // while the next file is opening in the background.
  this.audio.play().catch(()=>{if(token!==this.token)return;this.loading=false;this.message='재생 버튼을 눌러 주세요.';this.onChange();});
 }catch(e){if(token===this.token){this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.loading=false;this.message=e.message;}}finally{if(token===this.token)this.onChange();}}
 advance(){if(this.repeat==='one'&&this.items[this.index])return this.play(this.index);return this.next();}
 remove(index){this.invalidatePrepared();if(index===this.index){this.token++;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.index=-1;this.loading=false;}else if(index<this.index)this.index--;this.items.splice(index,1);this.history=[];this.shuffleBag=this.shuffleBag.filter(i=>i!==index).map(i=>i>index?i-1:i);this.onChange();}
 clear(){this.invalidatePrepared();this.token++;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.items=[];this.index=-1;this.shuffleBag=[];this.history=[];this.loading=false;this.message='';this.onChange();}
 finishCurrent(){if(this.index<0||this.ending)return;this.ending=true;this.end=null;return this.advance();}
}
let instance;
export function syncPlayButtons(){
 if(!instance)return;
 const p=instance,item=p.items[p.index];
 document.querySelectorAll('[data-top100-action="play"]').forEach(b=>{
  const active=item?.top100_folder===b.dataset.folder&&item?.top100_rank===Number(b.dataset.rank);
  const playing=!!active&&!p.audio.paused&&!!p.audio.getAttribute('src');
  const loading=!!active&&p.loading;
  const text=loading?'⌛ 준비 중':playing?'Ⅱ 일시정지':'▶ 재생';
  if(b.textContent!==text)b.textContent=text;
  b.setAttribute('aria-label',Number(b.dataset.rank)+'위 '+(playing?'일시정지':loading?'재생 준비 중':'재생'));
  b.setAttribute('aria-pressed',String(playing));
  b.classList.toggle('is-playing',playing);
 });
 document.querySelectorAll('[data-playing-album],[data-search-play]').forEach(b=>{
  const album=b.dataset.playingAlbum||b.dataset.searchPlay,index=Number(b.dataset.trackIndex??b.dataset.songIndex);
  const current=item&&item.album_id===album&&item.index===index;
  const playing=current&&!p.audio.paused&&!!p.audio.getAttribute('src');
  const loading=current&&p.loading;
  const text=loading?'⌛ 준비 중':playing?'❚❚ 일시정지':'▶ 재생';
  if(!b.classList.contains('random-song-card')&&b.textContent!==text)b.textContent=text;
  b.classList.toggle('is-playing',!!playing);
  b.setAttribute('aria-label',playing?'일시정지':loading?'재생 준비 중':'재생');
  b.setAttribute('aria-pressed',String(!!playing));
 });
}
export async function playAlbum(album,player=getPlayer()){
 const items=(album.tracks||[]).map((_,i)=>describeTrack(album,i));
 if(!items.length)return;
 const first=player.items.length;player.add(items);await player.play(first);
}
export async function playItem(item){
 const p=getPlayer(),current=p.items[p.index];
 if(current&&current.album_id===item.album_id&&current.index===item.index&&p.audio.getAttribute('src')){
  if(p.audio.paused)await p.audio.play();else p.audio.pause();
  syncPlayButtons();return;
 }
 p.add([item]);await p.play(p.items.length-1);
}

export function getPlayer(){
 if(instance)return instance;
 const host=document.createElement('section');host.id='global-player';host.setAttribute('aria-label','음악 플레이어');host.innerHTML='<div class="player-art"><img id="player-cover" alt="" hidden><span id="player-cover-fallback" aria-hidden="true">♫</span></div><div class="player-equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="player-info"><strong id="now-title">재생할 곡을 선택하세요</strong><span id="now-artist"></span><small id="player-message" role="status"></small></div><div class="player-controls"><button id="previous-track" aria-label="이전 곡">이전</button><audio id="track-player" preload="auto"></audio><button id="next-track" aria-label="다음 곡">다음</button><button id="show-queue">재생 대기열</button></div><div id="queue-panel" hidden></div>';document.body.append(host);
 const audio=host.querySelector('audio');
 let restoring=false,mobilePlayer=null,desktopPlayer=null,mediaSessionHandlersBound=false;
 const player=new QueuePlayer(audio,async item=>{
  if(item.top100_folder&&Number.isInteger(item.top100_rank)){
   const r=await fetch(NAS_URL+'/v2/top100-ticket',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await (await import('./playlists.js')).currentMemberToken()},body:JSON.stringify({folder:item.top100_folder,rank:item.top100_rank,action:'play'}),signal:AbortSignal.timeout(20000)});
   const data=await r.json();if(!r.ok)throw Error(data.message||'Top100 재생 연결 실패');
   if(!/^\/v1\/file\/[A-Za-z0-9_-]+$/.test(data.path))throw Error('잘못된 음원 주소입니다.');
   return {...data,url:NAS_URL+data.path};
  }
  const a=await fetch(NAS_URL+'/v2/album?id='+encodeURIComponent(item.album_id),{headers:{Authorization:'Bearer '+await (await import('./playlists.js')).currentMemberToken()},signal:AbortSignal.timeout(20000)});if(!a.ok)throw Error('앨범을 찾을 수 없습니다. 목록을 새로고침해 주세요.');const album=await a.json();const track=matchTrack(album,item);
  const r=await fetch(NAS_URL+'/v1/track',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await (await import('./playlists.js')).currentMemberToken()},body:JSON.stringify({album_id:item.album_id,track,action:'play'}),credentials:'omit',signal:AbortSignal.timeout(20000)});const data=await r.json();if(!r.ok)throw Error(data.message||'재생 연결 실패');if(!/^\/v1\/file\/[A-Za-z0-9_-]+$/.test(data.path))throw Error('잘못된 음원 주소입니다.');return {...data,url:NAS_URL+data.path};
 },()=>{const item=player.items[player.index];host.hidden=!player.items.length;document.body.classList.toggle('has-player',!!player.items.length);host.querySelector('#now-title').textContent=item?.title||'재생 대기열';host.querySelector('#now-artist').textContent=item?[item.artist,item.album_title].filter(Boolean).join(' · '):'';host.querySelector('#player-message').textContent=player.message;host.querySelector('#previous-track').disabled=player.index<=0;host.querySelector('#next-track').disabled=player.index+1>=player.items.length;updateArtwork(item);renderQueue();mobilePlayer?.update();desktopPlayer?.update();syncPlayButtons();syncMediaSession();if(!restoring)save();});
 function syncMediaSession(){
  if(typeof navigator==='undefined'||!navigator.mediaSession)return;
  const session=navigator.mediaSession,item=player.items[player.index];
  try{session.metadata=item&&typeof MediaMetadata==='function'?new MediaMetadata({title:item.title||'재생 대기열',artist:item.artist||'',album:item.album_title||'Vinyl Room'}):null;}catch{}
  try{session.playbackState=item?(audio.paused&&!player.loading?'paused':'playing'):'none';}catch{}
  if(!mediaSessionHandlersBound){
   try{session.setActionHandler('play',async()=>{if(audio.getAttribute('src')){try{await audio.play();}catch{}}else if(player.items.length)await player.play(Math.max(0,player.index));});}catch{}
   try{session.setActionHandler('pause',()=>audio.pause());}catch{}
   try{session.setActionHandler('nexttrack',()=>player.next());}catch{}
   try{session.setActionHandler('previoustrack',()=>player.previous());}catch{}
   try{session.setActionHandler('seekto',event=>{const duration=player.end??audio.duration;if(Number.isFinite(duration)&&Number.isFinite(event.seekTime))audio.currentTime=Math.max(player.start,Math.min(duration,player.start+event.seekTime));});}catch{}
   mediaSessionHandlersBound=true;
  }
 }
 let coverId=null;
 function updateArtwork(item){
  const id=item?.album_id||'';if(id===coverId)return;coverId=id;
  const img=host.querySelector('#player-cover'),fallback=host.querySelector('#player-cover-fallback');
  img.hidden=true;fallback.hidden=false;img.alt=item?`${item.album_title||item.title} 앨범 커버`:'';
  img.onload=()=>{img.hidden=false;fallback.hidden=true;};img.onerror=()=>{img.hidden=true;fallback.hidden=false;};
  if(item?.top100_folder&&Number.isInteger(item.top100_rank))loadMemberImage(img,NAS_URL+'/v2/top100-cover?folder='+encodeURIComponent(item.top100_folder)+'&rank='+item.top100_rank).catch(()=>{img.hidden=true;fallback.hidden=false;});
  else if(id)coverMemberImage(img,id).catch(()=>{img.hidden=true;fallback.hidden=false;});else img.removeAttribute('src');
 }
 audio.addEventListener('playing',()=>host.querySelector('#resume-playback')?.remove());
 bindPlaybackIndicator(audio,host);
 function save(){if(restoring)return;try{localStorage.setItem('music-player-v1',JSON.stringify({items:player.items,index:player.index,position:Math.max(0,audio.currentTime-player.start)||0,volume:audio.volume}));}catch{}}
 function renderQueue(){host.querySelector('#show-queue').textContent=`재생 대기열 ${player.items.length}`;host.querySelector('#queue-panel').innerHTML=`<div class="actions"><strong>재생 대기열 <small>${player.items.length}곡</small></strong><button id="save-queue">플레이리스트에 저장</button><button id="clear-queue">비우기</button></div><ol>${player.items.map((t,i)=>`<li data-queue-index="${i}" draggable="true" ${i===player.index?'aria-current="true"':''}><button data-queue-play="${i}" title="${esc(t.title)} · ${esc(t.artist)}"><span class="queue-number" aria-hidden="true">${i+1}</span><span class="queue-title">${esc(t.title)}</span><small>${esc(t.artist)}</small></button><button data-queue-remove="${i}" aria-label="${esc(t.title)} 대기열에서 제거">삭제</button></li>`).join('')}</ol>`;const list=host.querySelector('#queue-panel ol');bindQueueReordering(list,player);host.querySelectorAll('[data-queue-play]').forEach(b=>b.onclick=()=>player.play(+b.dataset.queuePlay));host.querySelectorAll('[data-queue-remove]').forEach(b=>b.onclick=()=>player.remove(+b.dataset.queueRemove));host.querySelector('#clear-queue').onclick=()=>player.clear();host.querySelector('#save-queue').onclick=()=>window.dispatchEvent(new CustomEvent('save-playlist-tracks',{detail:player.items.map(t=>({...t}))}));}
 host.querySelector('#previous-track').onclick=()=>player.play(player.index-1);host.querySelector('#next-track').onclick=()=>player.play(player.index+1);host.querySelector('#show-queue').onclick=()=>{const panel=host.querySelector('#queue-panel');panel.hidden=!panel.hidden;};audio.addEventListener('volumechange',save);let last=0;audio.addEventListener('timeupdate',()=>{if(Date.now()-last>5000){last=Date.now();save();}});
 host.hidden=true;
 try{const saved=JSON.parse(localStorage.getItem('music-player-v1'));if(saved?.items?.length){player.items=saved.items.filter(t=>typeof t.album_id==='string'&&typeof t.title==='string').slice(0,2000);player.index=Math.min(saved.index,player.items.length-1);restoring=true;audio.volume=Number.isFinite(saved.volume)?Math.max(0,Math.min(1,saved.volume)):.5;player.message='이전 재생 목록입니다. 이어듣기를 눌러 주세요.';player.onChange();const resume=document.createElement('button');resume.id='resume-playback';resume.textContent='이어듣기';resume.onclick=()=>{player.play(Math.max(0,player.index),saved.position||0);resume.remove();};host.querySelector('.player-info').append(resume);restoring=false;}}catch{}
 instance=player;desktopPlayer=mountDesktopPlayer(player,host);mobilePlayer=mountMobilePlayer(player,host);for(const event of ['play','playing','pause','ended','emptied'])audio.addEventListener(event,()=>{syncPlayButtons();syncMediaSession();});const observer=new MutationObserver(syncPlayButtons);for(const id of ['content','dialog-content']){const node=document.getElementById(id);if(node)observer.observe(node,{childList:true,subtree:true});}syncPlayButtons();syncMediaSession();return player;
}


