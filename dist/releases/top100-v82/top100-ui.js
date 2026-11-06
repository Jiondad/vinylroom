import {NAS_URL} from './config.js';
import {currentMemberToken,invalidateMemberAccess} from './playlists.js';
import {getPlayer,playItem} from './player.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let coverUrls=[];
function releaseCovers(){for(const url of coverUrls)URL.revokeObjectURL(url);coverUrls=[];}
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
async function cover(img,folder,rank){
 try{
  const response=await request('/v2/top100-cover?folder='+encodeURIComponent(folder)+'&rank='+rank);
  const blob=await response.blob();
  if(!img.isConnected)return;
  const url=URL.createObjectURL(blob);coverUrls.push(url);img.src=url;
 }catch{img.hidden=true;}
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
  root.innerHTML='<section class="top100-panel"><div class="top100-head"><div><h2>TOP 100</h2><p>DAILY MUSIC CHART · '+esc(chartFolder)+'</p></div><label>날짜 선택<select id="top100-date">'+folders.map(f=>'<option value="'+esc(f.folder)+'" '+(f.folder===chartFolder?'selected':'')+'>'+esc(f.date)+' · '+esc(f.folder.replace(/^\d{8}\s*/,''))+'</option>').join('')+'</select></label></div><div class="top100-actions"><button data-top100-all="play">▶ 전체 재생</button><button data-top100-all="download">↓ 전체 다운로드</button><button data-top100-all="queue">＋ 대기열에 추가</button><button data-top100-all="list">♫ 플레이리스트에 저장</button></div><div class="top100-table-wrap"><table class="top100-table"><thead><tr><th>순위</th><th aria-label="앨범커버"></th><th>Title</th><th>길이</th><th>Artist</th><th>Album</th><th>재생</th><th>목록추가</th><th>플레이리스트추가</th><th>다운로드</th></tr></thead><tbody>'+tracks.map(t=>'<tr><td class="rank">'+t.rank+'</td><td><img class="top100-cover" data-top100-cover="'+t.rank+'" alt="" loading="lazy"></td><td class="top100-title" title="'+esc(t.title)+'">'+esc(t.title)+'</td><td class="top100-length">'+(t.duration?Math.floor(t.duration/60)+':'+String(Math.floor(t.duration%60)).padStart(2,'0'):'—')+'</td><td title="'+esc(t.artist)+'">'+esc(t.artist)+'</td><td title="'+esc(t.album)+'">'+esc(t.album||'—')+'</td><td><button data-top100-action="play" data-rank="'+t.rank+'" aria-label="'+t.rank+'위 재생">▶</button></td><td><button data-top100-action="queue" data-rank="'+t.rank+'" aria-label="'+t.rank+'위 대기열 추가">＋</button></td><td><button data-top100-action="list" data-rank="'+t.rank+'" aria-label="'+t.rank+'위 플레이리스트 추가">♫</button></td><td><button data-top100-action="download" data-rank="'+t.rank+'" aria-label="'+t.rank+'위 다운로드">↓</button></td></tr>').join('')+'</tbody></table></div></section>';
  root.querySelector('#top100-date').onchange=async e=>{folder=e.target.value;releaseCovers();try{await draw();}catch(error){if(isCurrent())alert(error.message);}};
  root.querySelectorAll('[data-top100-cover]').forEach(img=>cover(img,chartFolder,Number(img.dataset.top100Cover)));
  root.querySelectorAll('[data-top100-action]').forEach(button=>button.onclick=async()=>{
   const item=items.find(t=>t.top100_rank===Number(button.dataset.rank));
   if(!item)return;
   try{const action=button.dataset.top100Action;
    if(action==='play')await playItem(item);
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

