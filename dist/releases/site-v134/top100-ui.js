import {readRequest} from './browse-access.js';
import {NAS_URL} from './config.js';
import {currentMemberToken,invalidateMemberAccess,isApprovedMember} from './playlists.js';
import {getPlayer,playItem,syncPlayButtons} from './player.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coverCache=new Map();
const MAX_CACHED_COVERS=250;
let coverObserver=null;
let coverGeneration=0;
let mobileMenuCleanup=()=>{},closeTop100Menu=()=>{};
function releaseCovers(){mobileMenuCleanup();coverGeneration++;coverObserver?.disconnect();coverObserver=null;}
function cachedCover(key){const url=coverCache.get(key);if(url){coverCache.delete(key);coverCache.set(key,url);}return url;}
async function request(path,options={}){
 if(!options.method&&(path==='/v2/top100'||path.startsWith('/v2/top100?')||path.startsWith('/v2/top100-cover?')))return readRequest(NAS_URL+path,{signal:options.signal||AbortSignal.timeout(30000)});
 const token=await currentMemberToken();
 const response=await fetch(NAS_URL+path,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30000),...options,headers:{Authorization:'Bearer '+token,...options.headers}});
 if(response.status===401||response.status===403)invalidateMemberAccess();
 if(!response.ok){let message='Top100 요청을 완료하지 못했습니다.';try{message=(await response.json()).message||message;}catch{}throw Error(message);}
 return response;
}
async function jsonWithDeadline(path,ms=30000){
 const controller=new AbortController();
 let timer;
 try{
  return await Promise.race([
   (async()=>{const response=await request(path,{signal:controller.signal});return response.json();})(),
   new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(new Error('Top100 응답 수신 또는 JSON 읽기가 지연되었습니다.'),{name:'TimeoutError'}));},ms);})
  ]);
 }finally{clearTimeout(timer);controller.abort();}
}
const chartCache=new Map(),chartInflight=new Map();
async function cachedChart(path){
 const hit=chartCache.get(path);if(hit&&Date.now()-hit.time<60000)return hit.data;
 if(chartInflight.has(path))return chartInflight.get(path);
 const task=jsonWithDeadline(path).then(data=>{
  if(!Array.isArray(data.folders)||!Array.isArray(data.tracks))throw Error('잘못된 Top100 응답입니다.');
  chartCache.delete(path);chartCache.set(path,{time:Date.now(),data});
  if(data.selected){chartVersions.set(data.selected,data.revision||'legacy');chartCache.set('/v2/top100?folder='+encodeURIComponent(data.selected),{time:Date.now(),data});}
  while(chartCache.size>12)chartCache.delete(chartCache.keys().next().value);
  while(chartVersions.size>12)chartVersions.delete(chartVersions.keys().next().value);
  return data;
 });chartInflight.set(path,task);
 try{return await task;}finally{chartInflight.delete(path);}
}
const tracksFor=(folder,tracks)=>tracks.map(t=>({album_id:'top100:'+folder+':'+t.rank,album_title:t.album||'Top100',artist:t.artist,title:t.title,top100_folder:folder,top100_rank:t.rank,index:t.rank-1}));
async function ticket(folder,rank,action){
 const body={folder,rank,action};
 const response=await request('/v2/top100-ticket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const result=await response.json();
 if(!/^\/v1\/file\/[A-Za-z0-9_-]+$/.test(result.path))throw Error('잘못된 다운로드 주소입니다.');
 return NAS_URL+result.path;
}
async function download(folder,rank,action='download'){
 const url=await ticket(folder,rank,action);
 const a=document.createElement('a');a.href=url;a.download='';a.rel='noopener';document.body.append(a);a.click();a.remove();
}
const coverInflight=new Map(),chartVersions=new Map();
let activeCoverRequests=0;
const coverWaiters=[];
const coverKey=(folder,rank)=>folder+':'+(chartVersions.get(folder)||'legacy')+':'+rank;
async function coverResource(folder,rank){
 const key=coverKey(folder,rank),cached=cachedCover(key);if(cached)return cached;
 if(coverInflight.has(key))return coverInflight.get(key);
 const task=(async()=>{
  if(activeCoverRequests>=5)await new Promise(resolve=>coverWaiters.push(resolve));
  else activeCoverRequests++;
  try{
   const response=await request('/v2/top100-cover?folder='+encodeURIComponent(folder)+'&rank='+rank+'&thumbnail=1&v='+encodeURIComponent(chartVersions.get(folder)||'legacy'));
   if(!response.ok)throw Error('커버를 불러올 수 없습니다.');
   const blob=await response.blob();if(!blob.type.startsWith('image/'))throw Error('잘못된 커버 이미지');
   const url=URL.createObjectURL(blob);coverCache.set(key,url);
   while(coverCache.size>MAX_CACHED_COVERS){const oldest=coverCache.keys().next().value;URL.revokeObjectURL(coverCache.get(oldest));coverCache.delete(oldest);}
   return url;
  }finally{if(coverWaiters.length)coverWaiters.shift()();else activeCoverRequests--;}
 })();coverInflight.set(key,task);
 try{return await task;}finally{coverInflight.delete(key);}
}
async function cover(img,folder,rank,generation){
 try{const url=await coverResource(folder,rank);if(img.isConnected&&generation===coverGeneration)img.src=url;}
 catch{if(generation===coverGeneration&&img.isConnected)img.classList.add('cover-unavailable');}
}
function loadVisibleCovers(root,folder){
 const generation=coverGeneration;
 const imgs=[...root.querySelectorAll('[data-top100-cover]')];
 if(!('IntersectionObserver' in window)){for(const img of imgs)cover(img,folder,Number(img.dataset.top100Cover),generation);return;}
 coverObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){
   const img=entry.target;coverObserver.unobserve(img);
   cover(img,folder,Number(img.dataset.top100Cover),generation);
  }
 },{rootMargin:'360px 0px'});
 for(const img of imgs){
  const cached=cachedCover(coverKey(folder,img.dataset.top100Cover));
  if(cached)img.src=cached;else coverObserver.observe(img);
 }
}
let lyricsGeneration=0;
async function showLyrics(folder,rank,title,artist){
 const version=++lyricsGeneration;
 let dialog=document.querySelector('#top100-lyrics-dialog');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='top100-lyrics-dialog';dialog.className='top100-lyrics-dialog';
  document.body.append(dialog);
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 }
 dialog.innerHTML='<div class="top100-lyrics-header"><div><strong>'+esc(title)+'</strong><small>'+esc(artist)+'</small></div><button type="button" aria-label="가사 닫기" data-close-lyrics>×</button></div><div class="top100-lyrics-content">가사를 불러오는 중…</div>';
 dialog.querySelector('[data-close-lyrics]').onclick=()=>dialog.close();
 dialog.showModal();
 try{
  const response=await request('/v2/top100-lyrics?folder='+encodeURIComponent(folder)+'&rank='+rank);
  const data=await response.json();
  if(dialog.open&&version===lyricsGeneration)dialog.querySelector('.top100-lyrics-content').textContent=data.lyrics?.trim()||'등록된 가사가 없습니다.';
 }catch(error){if(dialog.open&&version===lyricsGeneration)dialog.querySelector('.top100-lyrics-content').textContent=error.message;}
}
function showLoadError(root,error,retry){
 root.innerHTML='<div class="top100-load-error" role="alert"><p>Top100 목록을 불러오지 못했습니다.</p><p data-error></p><button type="button" id="top100-retry">다시 시도</button></div>';
 root.querySelector('[data-error]').textContent=error.name==='TimeoutError'?'응답 제한 시간 30초를 초과했습니다.':error.message;
 root.querySelector('#top100-retry').onclick=retry;
}
function trackDuration(track){
 const seconds=Number(track.duration);return Number.isFinite(seconds)&&seconds>0?Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0'):'—';
}
function trackQuality(track){
 const format=String(track.format||'').trim();const bits=Number(track.bit_depth??track.bits_per_sample);
 return format+(format.toUpperCase()==='FLAC'&&Number.isInteger(bits)&&bits>0&&bits<=64?' '+bits+'bit':'')||'—';
}
function setupMobileTop100Menu(root,tracks){
 const menu=root.querySelector('[data-top100-menu]');
 if(!menu?.querySelectorAll||!root.addEventListener)return;
 let trigger=null;
 function close(restore=false){
  const previous=trigger;menu.hidden=true;trigger=null;previous?.setAttribute('aria-expanded','false');
  document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);
  window.removeEventListener('resize',viewport);window.removeEventListener('scroll',viewport,true);
  if(restore&&previous?.isConnected)previous.focus();
 }
 function outside(event){if(!menu.contains(event.target)&&!trigger?.contains(event.target))close();}
 function escape(event){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}}
 function viewport(){close();}
 function open(event){
  const button=event.target.closest('[data-top100-more]');if(!button)return;
  if(trigger===button&&!menu.hidden){close();return;}
  close();const track=tracks.find(t=>Number(t.rank)===Number(button.dataset.top100More));if(!track)return;
  trigger=button;button.setAttribute('aria-expanded','true');
  menu.querySelector('[data-top100-menu-album]').textContent=track.album||'앨범 정보 없음';
  menu.querySelectorAll('[data-top100-action]').forEach(b=>{b.dataset.rank=String(track.rank);});
  menu.hidden=false;
  const anchor=button.getBoundingClientRect(),bounds=menu.getBoundingClientRect();
  const width=window.innerWidth,height=window.innerHeight;
  menu.style.left=Math.max(12,Math.min(anchor.right-bounds.width,width-bounds.width-12))+'px';
  menu.style.top=Math.max(12,Math.min(anchor.bottom+4,height-bounds.height-12))+'px';
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);
  window.addEventListener('resize',viewport);window.addEventListener('scroll',viewport,true);
 }
 root.addEventListener('click',open);
 closeTop100Menu=close;
 mobileMenuCleanup=()=>{close();root.removeEventListener('click',open);mobileMenuCleanup=()=>{};closeTop100Menu=()=>{};};
}
export async function renderTop100(root,{isCurrent=()=>true,initialFolder='',onFolderChange=()=>{}}={}){
 if(!isCurrent())return;
 releaseCovers();
 root.innerHTML='<div class="top100-loading">Top100 목록을 불러오는 중입니다…</div>';
 let chart;
 try{chart=await cachedChart('/v2/top100');}catch(error){if(isCurrent())showLoadError(root,error,()=>renderTop100(root,{isCurrent,initialFolder,onFolderChange}));return;}
 if(!isCurrent())return;
 const folders=chart.folders||[];
 if(!folders.length){root.innerHTML='<div class="empty">Music/000 Top100에 날짜별 차트 폴더가 없습니다.</div>';return;}
 let folder=folders.some(f=>f.folder===initialFolder)?initialFolder:chart.selected,dateGeneration=0;
 async function draw(){
  const version=++dateGeneration,chartFolder=folder;
  let data;
  try{data=await cachedChart('/v2/top100?folder='+encodeURIComponent(chartFolder));}catch(error){if(version===dateGeneration&&isCurrent())showLoadError(root,error,()=>draw());return;}
  if(!isCurrent()||version!==dateGeneration)return;
  const tracks=(data.tracks||[]).slice().sort((a,b)=>a.rank-b.rank);
  const items=tracksFor(chartFolder,tracks);
  root.innerHTML='<section class="top100-panel"><div class="top100-head"><label>날짜 선택<select id="top100-date">'+folders.map(f=>'<option value="'+esc(f.folder)+'" '+(f.folder===chartFolder?'selected':'')+'>'+esc(f.date)+' · '+esc(f.folder.replace(/^\d{8}\s*/,''))+'</option>').join('')+'</select></label><div class="top100-actions vinyl-quick-actions"><button data-top100-all="play" data-quick-label="▶ 전체재생" aria-label="▶ 전체재생">▶ 전체 재생</button><button data-top100-all="download" data-quick-label="↓ 다운로드" aria-label="↓ 다운로드">↓ 전체 다운로드</button><button data-top100-all="queue" data-quick-label="＋ 대기열" aria-label="＋ 대기열">＋ 대기열에 추가</button><button data-top100-all="list" data-quick-label="♫ 플리저장" aria-label="♫ 플리저장">♫ 플레이리스트에 저장</button></div></div><div class="top100-table-wrap"><table class="top100-table"><thead><tr><th>순위</th><th aria-label="앨범커버"></th><th>Title</th><th>길이</th><th>Artist</th><th>Album</th><th>가사</th><th>재생</th><th>목록추가</th><th>플레이리스트추가</th><th>다운로드</th></tr></thead><tbody>'+tracks.map(t=>'<tr><td class="rank">'+t.rank+'</td><td><img class="top100-cover" data-top100-cover="'+t.rank+'" data-top100-tap-play="'+t.rank+'" role="button" tabindex="0" aria-label="'+esc(t.title)+' 재생" alt="" loading="lazy"></td><td class="top100-title" title="'+esc(t.title)+'" data-top100-tap-play="'+t.rank+'" role="button" tabindex="0" aria-label="'+esc(t.title)+' 재생"><span class="top100-song-name">'+esc(t.title)+'</span><span class="top100-mobile-artist">'+esc(t.artist)+'</span><span class="top100-mobile-meta">'+trackDuration(t)+' · '+esc(trackQuality(t))+'</span></td><td class="top100-length">'+(t.duration?Math.floor(t.duration/60)+':'+String(Math.floor(t.duration%60)).padStart(2,'0'):'—')+'</td><td title="'+esc(t.artist)+'">'+esc(t.artist)+'</td><td title="'+esc(t.album)+'">'+esc(t.album||'—')+'</td><td><button data-top100-action="lyrics" data-rank="'+t.rank+'" aria-label="'+t.rank+'위 가사 보기">가사</button></td><td><button data-top100-action="play" data-rank="'+t.rank+'" aria-label="'+t.rank+'위 재생">▶</button></td><td><button data-top100-action="queue" data-rank="'+t.rank+'" aria-label="'+t.rank+'위 대기열 추가">＋</button></td><td><button data-top100-action="list" data-rank="'+t.rank+'" aria-label="'+t.rank+'위 플레이리스트 추가">♫</button></td><td><button data-top100-action="download" data-rank="'+t.rank+'" aria-label="'+t.rank+'위 다운로드">↓</button></td><td class="top100-mobile-more-cell"><button type="button" data-top100-more="'+t.rank+'" aria-expanded="false" aria-controls="top100-mobile-menu" aria-label="'+esc(t.title)+' 추가 기능">⋯</button></td></tr>').join('')+'</tbody></table></div><div id="top100-mobile-menu" class="top100-mobile-menu" data-top100-menu role="group" aria-label="곡 추가 기능" hidden><p data-top100-menu-album></p><button data-top100-action="lyrics" data-rank="">가사 보기</button><button data-top100-action="queue" data-rank="">대기열에 추가</button><button data-top100-action="list" data-rank="">플레이리스트에 저장</button><button data-top100-action="download" data-rank="">다운로드</button></div></section>';
  root.querySelector('#top100-date').onchange=async e=>{folder=e.target.value;onFolderChange(folder);releaseCovers();try{await draw();}catch(error){if(isCurrent())alert(error.message);}};
  setupMobileTop100Menu(root,tracks);
  loadVisibleCovers(root,chartFolder);
  root.querySelectorAll('[data-top100-action="play"]').forEach(button=>button.dataset.folder=chartFolder);
  syncPlayButtons();
  root.querySelectorAll('[data-top100-tap-play]').forEach(el=>{
   const play=()=>root.querySelector('[data-top100-action="play"][data-rank="'+el.dataset.top100TapPlay+'"]')?.click();
   el.addEventListener('click',play);
   el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();play();}});
  });

  root.querySelectorAll('[data-top100-action]').forEach(button=>button.onclick=async()=>{
   const item=items.find(t=>t.top100_rank===Number(button.dataset.rank));
   if(!item)return;
   try{const action=button.dataset.top100Action;
    if(action==='play')await playItem(item);
    if(action==='lyrics')await showLyrics(chartFolder,item.top100_rank,item.title,item.artist);
    if(action==='queue')getPlayer().add([item]);
    if(action==='list')window.dispatchEvent(new CustomEvent('save-playlist-tracks',{detail:[item]}));
    if(action==='download')await download(chartFolder,item.top100_rank);
   }catch(error){alert(error.message);}finally{closeTop100Menu();}
  });
  root.querySelectorAll('[data-top100-all]').forEach(button=>button.onclick=async()=>{
   try{const action=button.dataset.top100All;
    if(!items.length)return;
    if(action==='play'){const player=getPlayer();const start=player.items.length;player.add(items);await player.play(start);}
    if(action==='queue')getPlayer().add(items);
    if(action==='list')window.dispatchEvent(new CustomEvent('save-playlist-tracks',{detail:items}));
    if(action==='download')await download(chartFolder,null,'album-download');
   }catch(error){alert(error.message);}
  });
 }
 await draw();
}


window.addEventListener('vinyl-approval-change',()=>{if(!isApprovedMember()){releaseCovers();for(const url of coverCache.values())URL.revokeObjectURL(url);coverCache.clear();lyricsGeneration++;document.querySelector('#top100-lyrics-dialog')?.remove();}});


