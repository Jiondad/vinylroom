import {playbackDiagnostics} from './playback-diagnostics.js';
import {bindQueueReordering} from './queue-reorder.js';
// A view of QueuePlayer: never creates another Audio instance or stream request.
export function playbackWindow(player){
 const start=Number(player.start)||0,end=player.end??player.audio.duration;
 const duration=Number.isFinite(end)?Math.max(0,end-start):0;
 return {duration,position:Math.max(0,Math.min(duration,(Number(player.audio.currentTime)||0)-start))};
}
export function seekPlayback(player,position){
 const {duration}=playbackWindow(player);
 if(duration&&player.audio.getAttribute('src'))player.audio.currentTime=(Number(player.start)||0)+Math.max(0,Math.min(duration,Number(position)||0));
}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
const icons={previous:'‹',play:'▷',pause:'Ⅱ',next:'›',queue:'☷',close:'×'};
const modeIcon=path=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';
const shuffleIcon=modeIcon('<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-2 5-4m2-4c2-3 3-4 5-4h3m-4-4 4 4-4 4"/>');
const repeatIcon=modeIcon('<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/>');
const mountedPlayers=new WeakMap();
export function mountMobilePlayer(player,host){
 if(mountedPlayers.has(host))return mountedPlayers.get(host);
 const audio=player.audio,media=window.matchMedia('(max-width:740px)');
 const mini=document.createElement('div');mini.className='mobile-mini-player';
 mini.innerHTML='<button class="mini-art" data-expand aria-label="확장 플레이어 열기"><img alt="" hidden><span aria-hidden="true">♫</span></button><div class="mini-equalizer-slot" aria-hidden="true"></div><button class="mini-info" data-expand aria-label="곡 정보 및 확장 플레이어"><strong></strong><small></small></button><div class="mini-controls"><button data-previous aria-label="이전 곡">‹</button><button data-toggle aria-label="재생">▷</button><button data-next aria-label="다음 곡">›</button><button data-queue aria-label="재생 대기열">☷<small data-count></small></button></div><input class="mini-seek" data-seek type="range" min="0" max="1" step="0.1" value="0" aria-label="재생 위치">';
 host.append(mini);
 // Reparent the existing four bars, never clone them or create another audio view.
 const equalizer=host.querySelector('.player-equalizer');
 const indicatorSlot=mini.querySelector('.mini-equalizer-slot');
 function placeIndicator(){
  if(!equalizer)return;
  if(media.matches)indicatorSlot.append(equalizer);
  else host.insertBefore(equalizer,host.querySelector('.player-info'));
 }
 placeIndicator();
 function sheet(kind,label,body){
  const dialog=document.createElement('dialog');dialog.className='mobile-player-sheet '+kind;
  dialog.setAttribute('aria-label',label);
  dialog.innerHTML='<div class="sheet-handle" aria-hidden="true"></div><header><h2>'+label+'</h2><button data-close aria-label="닫기">×</button></header>'+body;
  document.body.append(dialog);
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  let startY=null;const handle=dialog.querySelector('.sheet-handle');
  handle.addEventListener('pointerdown',e=>{startY=e.clientY;handle.setPointerCapture?.(e.pointerId);});
  handle.addEventListener('pointerup',e=>{if(startY!==null&&e.clientY-startY>60)dialog.close();startY=null;});
  handle.addEventListener('pointercancel',()=>{startY=null;});
  return dialog;
 }
 const expanded=sheet('expanded-player','지금 재생 중','<div class="expanded-body"><div class="expanded-art"><img alt="" hidden><span aria-hidden="true">♫</span></div><h3 data-title></h3><p data-artist></p><p data-message role="status"></p><input data-seek type="range" min="0" max="1" step="0.1" value="0" aria-label="정밀 재생 위치"><div class="expanded-time"><span data-position>0:00</span><span data-duration>0:00</span></div><div class="expanded-controls"><button data-shuffle aria-label="셔플 켜기" aria-pressed="false">'+shuffleIcon+'</button><button data-previous aria-label="이전 곡">‹</button><button data-toggle aria-label="재생">▷</button><button data-next aria-label="다음 곡">›</button><button data-repeat aria-label="반복 꺼짐" aria-pressed="false">'+repeatIcon+'<small hidden>1</small></button></div><label class="expanded-volume">볼륨<input data-volume type="range" min="0" max="1" step="0.01" aria-label="볼륨"></label><div class="expanded-actions"><button data-stop>정지</button><button data-queue>재생 대기열</button><button data-save>플레이리스트 저장</button></div></div>');
 const queue=sheet('mobile-queue','재생 대기열','<div class="queue-sheet-tools"><span data-queue-count></span><button data-save aria-label="대기열 플레이리스트 저장">저장</button><button data-clear aria-label="대기열 비우기">비우기</button></div><ol class="mobile-queue-list"></ol>');
 let queueSignature='',returnFocus=null;
 function closeSheets(){expanded.close();queue.close();}
 function open(dialog){if(!media.matches||!player.items.length)return;closeSheets();returnFocus=document.activeElement;update();if(dialog===queue)drawQueue();dialog.showModal();}
 for(const dialog of [expanded,queue])dialog.addEventListener('close',()=>{if(!expanded.open&&!queue.open&&returnFocus?.isConnected)returnFocus.focus();});
 async function toggle(){
  if(!player.items.length)return;
  if(!audio.getAttribute('src')){const resume=host.querySelector('#resume-playback');if(resume)resume.click();else await player.play(Math.max(0,player.index));}
  else if(audio.paused){const id=playbackDiagnostics.playPromiseRequested();try{await audio.play();playbackDiagnostics.playPromiseResolved(id);}catch(error){playbackDiagnostics.playPromiseRejected(id,error);player.message='재생 버튼을 다시 눌러 주세요.';player.onChange();}}
  else{playbackDiagnostics.requestPause('mobile-player-toggle');audio.pause();}
 }
 for(const root of [mini,expanded]){
  root.querySelector('[data-toggle]').onclick=toggle;
  root.querySelector('[data-previous]').onclick=()=>player.previous();
  root.querySelector('[data-next]').onclick=()=>player.next();
  root.querySelector('[data-queue]').onclick=()=>open(queue);
  root.querySelector('[data-seek]').addEventListener('input',e=>{seekPlayback(player,e.target.value);progress();});
 }
 mini.querySelectorAll('[data-expand]').forEach(b=>b.onclick=()=>open(expanded));
 expanded.querySelector('[data-shuffle]').onclick=()=>player.setShuffle(!player.shuffle);
 expanded.querySelector('[data-repeat]').onclick=()=>player.setRepeat({off:'all',all:'one',one:'off'}[player.repeat||'off']);
 expanded.querySelector('[data-volume]').addEventListener('input',e=>{audio.volume=Number(e.target.value);});
 expanded.querySelector('[data-stop]').onclick=()=>{playbackDiagnostics.requestPause('mobile-player-stop');audio.pause();seekPlayback(player,0);progress();};
 function save(){const detail=player.items.map(t=>({...t}));closeSheets();window.dispatchEvent(new CustomEvent('save-playlist-tracks',{detail}));}
 expanded.querySelector('[data-save]').onclick=save;
 function inlineArea(){queue.querySelector('.queue-inline-form')?.remove();const host=document.createElement('div');host.className='queue-inline-form';queue.querySelector('ol').before(host);return host;}
 queue.querySelector('[data-save]').onclick=()=>{const inlineHost=inlineArea();window.dispatchEvent(new CustomEvent('save-playlist-tracks',{detail:{tracks:player.items.map(t=>({...t})),inlineHost}}));};
 queue.querySelector('[data-clear]').onclick=()=>{const host=inlineArea();const text=document.createElement('p');text.textContent='재생 대기열을 비울까요?';const actions=document.createElement('div');actions.className='actions';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='취소';cancel.onclick=()=>host.remove();const confirm=document.createElement('button');confirm.type='button';confirm.textContent='비우기';confirm.dataset.vrRole='danger';confirm.onclick=()=>{host.remove();player.clear();};actions.append(cancel,confirm);host.append(text,actions);};
 const list=queue.querySelector('ol');
 bindQueueReordering(list,player);
 list.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.play!==undefined)player.play(Number(b.dataset.play));if(b.dataset.remove!==undefined)player.remove(Number(b.dataset.remove));});
 function drawQueue(){
  queue.querySelector('[data-queue-count]').textContent=player.items.length+'곡 · 곡을 길게 눌러 이동';
  const signature=JSON.stringify(player.items.map(t=>[t.album_id,t.disc,t.index,t.title,t.artist]));
  if(signature!==queueSignature){queueSignature=signature;list.innerHTML=player.items.map((t,i)=>'<li data-queue-index="'+i+'"><span class="mobile-queue-grip" aria-hidden="true">⠿</span><button data-play="'+i+'" aria-label="'+escape(t.title)+' 재생, 길게 눌러 순서 변경"><span class="mobile-queue-number">'+(i+1)+'</span><span><strong>'+escape(t.title)+'</strong><small>'+escape(t.artist)+'</small></span></button><button data-remove="'+i+'" aria-label="'+escape(t.title)+' 삭제">×</button></li>').join('');}
  [...list.children].forEach((row,i)=>{if(i===player.index)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');});
 }
 function progress(){
  if(!media.matches)return;const {duration,position}=playbackWindow(player);
  for(const input of [mini.querySelector('[data-seek]'),expanded.querySelector('[data-seek]')]){input.max=String(duration||1);input.value=String(position);input.disabled=!duration;input.style.setProperty('--progress',(duration?position/duration*100:0)+'%');input.setAttribute('aria-valuetext',clock(position)+' / '+clock(duration));}
  if(expanded.open){expanded.querySelector('[data-position]').textContent=clock(position);expanded.querySelector('[data-duration]').textContent=clock(duration);}
 }
 function artwork(){
  const original=host.querySelector('#player-cover'),src=!original.hidden?original.getAttribute('src'):null;
  for(const root of [mini,expanded]){const img=root.querySelector('img');if(src){if(img.getAttribute('src')!==src)img.src=src;img.hidden=false;}else{img.hidden=true;img.removeAttribute('src');}img.nextElementSibling.hidden=!!src;}
 }
 function update(){
  if(!player.items.length){closeSheets();return;}
  if(!media.matches)return;
  const item=player.items[player.index];
  mini.querySelector('strong').textContent=item?.title||'재생 대기열';mini.querySelector('.mini-info small').textContent=item?.artist||'곡을 선택하세요';
  mini.querySelector('.mini-info').setAttribute('aria-label',[item?.title,item?.artist,'확장 플레이어 열기'].filter(Boolean).join(' · '));
  mini.querySelector('[data-count]').textContent=String(player.items.length);
  expanded.querySelector('[data-title]').textContent=item?.title||'재생 대기열';expanded.querySelector('[data-artist]').textContent=item?[item.artist,item.album_title].filter(Boolean).join(' · '):'';
  expanded.querySelector('[data-message]').textContent=player.message;
  expanded.querySelector('[data-volume]').value=String(audio.volume);
  for(const root of [mini,expanded]){const b=root.querySelector('[data-toggle]');b.textContent=audio.paused?icons.play:icons.pause;b.setAttribute('aria-label',audio.paused?'재생':'일시정지');root.querySelector('[data-previous]').disabled=player.shuffle?!player.history.length:player.index<=0&&player.repeat!=='all';root.querySelector('[data-next]').disabled=!player.shuffle&&player.index+1>=player.items.length&&player.repeat!=='all';}
  const shuffle=expanded.querySelector('[data-shuffle]'),repeat=expanded.querySelector('[data-repeat]');
  shuffle.setAttribute('aria-pressed',String(!!player.shuffle));shuffle.setAttribute('aria-label',player.shuffle?'셔플 끄기':'셔플 켜기');
  repeat.setAttribute('aria-pressed',String(!!player.repeat&&player.repeat!=='off'));repeat.setAttribute('aria-label',({off:'반복 꺼짐',all:'전체 반복',one:'한 곡 반복'})[player.repeat||'off']);repeat.querySelector('small').hidden=player.repeat!=='one';
  if(queue.open)drawQueue();artwork();progress();
 }
 // Time events touch only two sliders and the expanded time labels, never any list.
 for(const event of ['timeupdate','durationchange','loadedmetadata'])audio.addEventListener(event,progress);
 for(const event of ['play','pause','ended','emptied','volumechange'])audio.addEventListener(event,update);
 const coverObserver=new MutationObserver(artwork);coverObserver.observe(host.querySelector('#player-cover'),{attributes:true,attributeFilter:['src','hidden']});
 media.addEventListener('change',()=>{placeIndicator();if(!media.matches)closeSheets();else update();});
 window.addEventListener('vinyl-approval-change',()=>{if(document.documentElement.getAttribute('data-vinyl-access')!=='approved')closeSheets();});
 update();const api={update};mountedPlayers.set(host,api);return api;
}
