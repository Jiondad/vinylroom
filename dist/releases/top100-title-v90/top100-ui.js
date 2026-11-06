import {NAS_URL} from './config.js';
import {currentMemberToken,invalidateMemberAccess,isApprovedMember} from './playlists.js';
import {getPlayer,playItem,syncPlayButtons} from './player.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coverCache=new Map();
const MAX_CACHED_COVERS=250;
let coverObserver=null;
let coverGeneration=0;
function releaseCovers(){coverGeneration++;coverObserver?.disconnect();coverObserver=null;}
function cachedCover(key){const url=coverCache.get(key);if(url){coverCache.delete(key);coverCache.set(key,url);}return url;}
async function request(path,options={}){
 const token=await currentMemberToken();
 const response=await fetch(NAS_URL+path,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30000),...options,headers:{Authorization:'Bearer '+token,...options.headers}});
 if(response.status===401||response.status===403)invalidateMemberAccess();
 if(!response.ok){let message='Top100 요청을 완료하지 못했습니다.';try{message=(await response.json()).message||message;}catch{}throw Error(message);}
 return response;
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
async function cover(img,folder,rank,generation){
 const key=folder+':'+rank;
 const cached=cachedCover(key);
 if(cached){if(img.isConnected&&generation===coverGeneration)img.src=cached;return;}
 try{
  const response=await request('/v2/top100-cover?folder='+encodeURIComponent(folder)+'&rank='+rank);
  const blob=await response.blob();
  if(!blob.type.startsWith('image/'))throw Error('잘못된 커버 이미지');
  if(generation!==coverGeneration||!img.isConnected)return;
  const url=URL.createObjectURL(blob);coverCache.set(key,url);
  while(coverCache.size>MAX_CACHED_COVERS){const oldest=coverCache.keys().next().value;URL.revokeObjectURL(coverCache.get(oldest));coverCache.delete(oldest);}
  img.src=url;
 }catch{if(generation===coverGeneration&&img.isConnected)img.classList.add('cover-unavailable');}
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
  const cached=cachedCover(folder+':'+img.dataset.top100Cover);
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
export async function renderTop100(root,{isCurrent=()=>true}={}){
 if(!isCurrent())return;
 releaseCovers();
 root.innerHTML='<div class="top100-loading">Top100 목록을 불러오는 중입니다…</div>';
 const chart=await (await request('/v2/top100')).json();
 if(!isCurrent())return;
 const folders=chart.folders||[];
 if(!folders.length){root.innerHTML='<div class="empty">Music/000 Top100에 날짜별 차트 폴더가 없습니다.</div>';return;}
 let folder=chart.selected,dateGeneration=0;
 async function draw(){
  const version=++dateGeneration,chartFolder=folder;
  const data=chartFolder===chart.selected?chart:await (await request('/v2/top100?folder='+encodeURIComponent(chartFolder))).json();
  if(!isCurrent()||version!==dateGeneration)return;
  const tracks=(data.tracks||[]).slice().sort((a,b)=>a.rank-b.rank);
  const items=tracksFor(chartFolder,tracks);
  root.innerHTML='<section class="top100-panel"><div class="top100-head"><div><p>DAILY MUSIC CHART · '+esc(chartFolder)+'</p></div><label>날짜 선택<select id="top100-date">'+folders.map(f=>'<option value="'+esc(f.folder)+'" '+(f.folder===chartFolder?'selected':'')+'>'+esc(f.date)+' · '+esc(f.folder.replace(/^\d{8}\s*/,''))+'</option>').join('')+'</select></label></div><div class="top100-actions"><button data-top100-all="play">▶ 전체 재생</button><button data-top100-all="download">↓ 전체 다운로드</button><button data-top100-all="queue">＋ 대기열에 추가</button><button data-top100-all="list">♫ 플레이리스트에 저장</button></div><div class="top100-table-wrap"><table class="top100-table"><thead><tr><th>순위</th><th aria-label="앨범커버"></th><th>Title</th><th>길이</th><th>Artist</th><th>Album</th><th>가사</th><th>재생</th><th>목록추가</th><th>플레이리스트추가</th><th>다운로드</th></tr></thead><tbody>'+tracks.map(t=>'<tr><td class="rank">'+t.rank+'</td><td><img class="top100-cover" data-top100-cover="'+t.rank+'" alt="" loading="lazy"></td><td class="top100-title" title="'+esc(t.title)+'">'+esc(t.title)+'</td><td class="top100-length">'+(t.duration?Math.floor(t.duration/60)+':'+String(Math.floor(t.duration%60)).padStart(2,'0'):'—')+'</td><td title="'+esc(t.artist)+'">'+esc(t.artist)+'</td><td title="'+esc(t.album)+'">'+esc(t.album||'—')+'</td><td><button data-top100-action="lyrics" data-rank="'+t.rank+'" aria-label="'+t.rank+'위 가사 보기">가사</button></td><td><button data-top100-action="play" data-rank="'+t.rank+'" aria-label="'+t.rank+'위 재생">▶</button></td><td><button data-top100-action="queue" data-rank="'+t.rank+'" aria-label="'+t.rank+'위 대기열 추가">＋</button></td><td><button data-top100-action="list" data-rank="'+t.rank+'" aria-label="'+t.rank+'위 플레이리스트 추가">♫</button></td><td><button data-top100-action="download" data-rank="'+t.rank+'" aria-label="'+t.rank+'위 다운로드">↓</button></td></tr>').join('')+'</tbody></table></div></section>';
  root.querySelector('#top100-date').onchange=async e=>{folder=e.target.value;releaseCovers();try{await draw();}catch(error){if(isCurrent())alert(error.message);}};
  loadVisibleCovers(root,chartFolder);
  root.querySelectorAll('[data-top100-action="play"]').forEach(button=>button.dataset.folder=chartFolder);
  syncPlayButtons();
  root.querySelectorAll('[data-top100-action]').forEach(button=>button.onclick=async()=>{
   const item=items.find(t=>t.top100_rank===Number(button.dataset.rank));
   if(!item)return;
   try{const action=button.dataset.top100Action;
    if(action==='play')await playItem(item);
    if(action==='lyrics')await showLyrics(chartFolder,item.top100_rank,item.title,item.artist);
    if(action==='queue')getPlayer().add([item]);
    if(action==='list')window.dispatchEvent(new CustomEvent('save-playlist-tracks',{detail:[item]}));
    if(action==='download')await download(chartFolder,item.top100_rank);
   }catch(error){alert(error.message);}
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
