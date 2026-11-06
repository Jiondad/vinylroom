import {renderTop100} from './top100-ui.js';
import {loadMemberImage} from './member-images.js';
import {finishAccessInitialization} from './access-state.js';
import {connectAccount,login as openAccount,signupRequest,currentMemberToken,isApprovedMember,invalidateMemberAccess} from './playlists.js';
import {attachArtwork} from './artwork-ui.js';
import {searchField} from './search-presentation.js';
import {albumYear,formatLabel,statsMarkup,albumFacts} from './presentation.js';
import {getPlayer,describeTrack,playItem} from './player.js';
import {Repository} from './store.js';
import {NAS_URL} from './config.js';
import {GENRES} from './core.js';
import {mediaPanel,trackActions,bindMedia} from './media.js';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const repo=new Repository({guest:true});repo.load=async()=>{};
connectAccount(repo,()=>render());
let view='home',page=1,artist='',letter='',generation=0,revision='',searchTimer;
let randomSeed=crypto.randomUUID();const randomResults=new Map();
try{randomSeed=sessionStorage.getItem('vinyl-random-seed')||randomSeed;sessionStorage.setItem('vinyl-random-seed',randomSeed);}catch{}
$('#nav').insertAdjacentHTML('afterbegin',"<button data-view=\"home\"><svg class=\"nav-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"3\"/><path d=\"M7 3v4m10-4v4M3 10h18\"/><path d=\"m10 13 5 3-5 3z\"/></svg><span>Today's Albums</span></button>");
$('#nav').insertAdjacentHTML('beforeend',"<button data-view=\"random\"><svg class=\"nav-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-2 5-4m2-4c2-3 3-4 5-4h3m-4-4 4 4-4 4\"/></svg><span>Random100</span></button>");
$('#nav [data-view="random"]').insertAdjacentHTML('afterend','<button data-view="top100"><span class="nav-icon" aria-hidden="true">♬</span><span>Top100</span></button>');
if($('#my-playlists'))$('#nav').append($('#my-playlists'));
async function catalog(params){
 const key=params.toString();
 if(params.get('view')!=='random')return api('/v2/albums?'+key);
 if(randomResults.has(key))return randomResults.get(key);
 const result=await api('/v2/albums?'+key,{signal:AbortSignal.timeout(60000)});
 randomResults.set(key,result);return result;
}
const categories=['Studio','Live','Compilations','Singles & EPs','Bootlegs','ETC'];
let category='';
const letters=['0–9',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ','기타'];
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),6000);}
function action(fn){return async e=>{const b=e?.currentTarget;if(b)b.disabled=true;try{await fn(e);}catch(err){toast(err.message);}finally{if(b?.isConnected)b.disabled=false;}};}
async function api(path,{admin=false,body,signal}={}){
 const access=await currentMemberToken();
 if(admin){repo.requireAdmin();if(Date.now()>repo.expires-60000)await repo.refresh();}
 const r=await fetch(NAS_URL+path,{method:body?'POST':'GET',credentials:'omit',redirect:'error',headers:{Authorization:'Bearer '+access,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:signal||AbortSignal.timeout(20000)});
 if(r.status===401||r.status===403)invalidateMemberAccess();
 const data=await r.json();if(!r.ok)throw Error(data.message||'NAS 연결을 확인하세요.');return data;
}
let albumPage=null;
let albumRequestGeneration=0;
function closeAlbumPage(){
 albumRequestGeneration++;
 if(!albumPage)return;
 albumPage.dispatchEvent(new Event('album-page-close'));
 albumPage.remove();albumPage=null;
 document.body.classList.remove('album-page-open');
}
function albumPageLayout(html){
 closeAlbumPage();
 const section=document.createElement('section');
 section.className='album-full-page';
 section.setAttribute('aria-label','앨범 상세 페이지');
 section.innerHTML='<div class="album-full-bar"><strong>VINYL ROOM / ALBUM</strong><button type="button" id="album-page-back">← 앨범 목록</button></div><div class="modal-body album-page-body">'+html+'</div>';
 document.querySelector('main').after(section);albumPage=section;document.body.classList.add('album-page-open');
 section.querySelector('#album-page-back').onclick=closeAlbumPage;
 return section;
}
function modal(title,html){if($('#dialog').open)$('#dialog').close();$('#dialog-content').innerHTML=`<div class="modal-head"><h2>${esc(title)}</h2><button class="close" aria-label="닫기">×</button></div><div class="modal-body">${html}</div>`;$('.close').onclick=()=>$('#dialog').close();$('#dialog').showModal();}
function updateAuth(){document.body.classList.toggle('guest-mode',!repo.admin);$('#connection-label').textContent=repo.admin?'관리자 / 로그아웃':'관리자 로그인';$('#mode-label').textContent='NAS 자동 색인 서재';$('#import').textContent='폴더 색인';$('#export').textContent='색인 상태';}
function cover(a){return `<div class="cover"><img data-member-cover="${esc(a.id)}" loading="lazy" alt="${esc(a.title)} 커버"><span class="cover-fallback" hidden>${esc(a.artist)}</span></div>`;}
function bindCovers(root){root.querySelectorAll('.cover img').forEach(img=>{
 const box=img.parentElement;
 const failed=()=>{box.classList.remove('cover-loading');box.classList.add('cover-failed');img.hidden=true;img.nextElementSibling.hidden=false;};
 const ready=()=>{if(box.classList.contains('cover-failed'))return;box.classList.remove('cover-loading');box.classList.add('cover-ready');};
 img.onerror=failed;img.onload=()=>{if(img.decode)img.decode().then(ready,ready);else ready();};
 if(img.dataset.memberCover)loadMemberImage(img,NAS_URL+'/v2/cover?id='+encodeURIComponent(img.dataset.memberCover)+'&v='+encodeURIComponent(revision)).catch(failed);
 if(img.complete&&img.naturalWidth)img.onload();else box.classList.add('cover-loading');
});}
function savePage(){try{sessionStorage.setItem('vinyl-page-v1',JSON.stringify({view,page,artist,letter,category,search:$('#search').value,genre:$('#genre').value,format:$('#format').value,sort:$('#sort').value}));}catch{}}
function restorePage(){try{
 const saved=JSON.parse(sessionStorage.getItem('vinyl-page-v1')||'null');
 if(!saved||!['home','library','artists','random','top100','review','duplicates'].includes(saved.view))return;
 view=saved.view;page=Number.isSafeInteger(saved.page)&&saved.page>0?saved.page:1;
 artist=typeof saved.artist==='string'?saved.artist:'';letter=letters.includes(saved.letter)?saved.letter:'';category=categories.includes(saved.category)?saved.category:'';
 for(const id of ['search','genre','format','sort'])if(typeof saved[id]==='string')$('#'+id).value=saved[id];
 if(!$('#sort').value)$('#sort').value='artist';
}catch{}}
async function render(){
 if(!isApprovedMember())return;
 savePage();
 if(view==='top100'){
  const topToken=++generation;
  updateAuth();
  $('#crumb').textContent='Top100';
  $('#notice').textContent='날짜별 Top100 · 기존 앨범 색인과 분리된 음악 차트';
  $('#page-title').textContent='TOP 100';
  $('#result-count').textContent='한 페이지에 전체 순위 표시';
  $('#pagination').innerHTML='';
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  document.body.classList.remove('home-view','random-view');
  try{await renderTop100($('#content'),{isCurrent:()=>topToken===generation&&view==='top100'&&isApprovedMember()});}catch(error){if(topToken===generation){$('#notice').textContent=error.message;toast(error.message);}}return;
 }
 const token=++generation;updateAuth();$('#notice').textContent='목록 조회 중…';
 const searching=view==='library'&&$('#search').value.trim();
 let effectiveView=view==='random'?'tracks':searching?'tracks':view;
 const params=new URLSearchParams({view:view==='random'?'random':effectiveView,page,q:$('#search').value,genre:$('#genre').value,format:$('#format').value,sort:$('#sort').value,artist,letter,category:artist&&effectiveView==='library'?category:''});
 if(view==='random')params.set('seed',randomSeed);
 try{
  const [result,state]=await Promise.all([catalog(params),api('/v2/state')]);if(token!==generation)return;
  revision=state.revision;page=result.page;
  const needsSearchUpdate=effectiveView==='tracks'&&result.view!=='tracks';
  if(needsSearchUpdate)effectiveView='library';
  $('#notice').textContent=!state.ready?'기존 기록을 NAS 색인으로 이관 중입니다. 이 작업은 최초 한 번만 진행합니다.':state.indexing?'NAS에서 변경 사항을 확인 중입니다. 현재 목록은 바로 이용할 수 있습니다.':'NAS 색인 · 현재 페이지의 목록만 조회합니다.';
  if(needsSearchUpdate)$('#notice').textContent='곡 목록 검색은 NAS 업데이트 후 사용할 수 있습니다. 현재는 기존 앨범 결과를 표시합니다.';
  const modeLabel=$('#mode-label');
  $('#stats').innerHTML=statsMarkup(state.albums,state.artists,state.tracks);
  if(modeLabel&&window.matchMedia('(max-width:740px)').matches)$('#stats').append(modeLabel);
  $('#page-title').textContent=artist?artist+' · 앨범':({home:'',random:'',artists:'',review:'등록 확인함',duplicates:'소장본 비교'})[view]||'';
  $('#crumb').textContent=({home:"Today's Albums",random:'Random 100',artists:'Artist Index'})[view]||'앨범 서재';document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='home')$('#notice').textContent=`${result.day} · 오늘 만나볼 앨범 · 매일 새로운 선택`;
  if(view==='random')$('#notice').textContent='소장 음원에서 고른 100곡 · 다시 뽑기 전까지 목록이 유지됩니다.';
  $('#result-count').textContent=`${result.total.toLocaleString()}${effectiveView==='tracks'?'곡':view==='artists'?'명의 아티스트':'개 소장본'} · 페이지당 ${result.size}개`;
  let html=artist?'<button id="back-artists">← 아티스트 목록</button>':'';
  if(view==='random')html+=`<div class="actions random-actions"><button id="random-redraw">다시 뽑기</button><button id="random-play" ${result.items.length?'':'disabled'}>전체 재생</button><button id="random-queue" ${result.items.length?'':'disabled'}>대기열에 모두 추가</button><button id="random-save" ${result.items.length?'':'disabled'}>플레이리스트에 저장</button></div>`;
  if(artist&&effectiveView==='library')html+=`<nav class="category-filter" aria-label="앨범 분류"><button data-category="" aria-pressed="${!category}">전체</button>${categories.map(c=>`<button data-category="${esc(c)}" aria-pressed="${c===category}">${esc(c)}</button>`).join('')}</nav>`;
  if(artist&&state.categories_ready===false)html+='<p class="hint">NAS 폴더 기준으로 분류를 갱신 중입니다. 기존 목록은 계속 이용할 수 있습니다.</p>';
  if(view==='random'){
   html+=`<div class="random-grid">${result.items.map(t=>`<article class="random-track"><button class="random-song-card" data-search-play="${esc(t.album_id)}" data-song-index="${t.track_index}" aria-label="${esc(t.title)} 재생">${cover({id:t.album_id,title:t.album_title,artist:t.artist})}<strong title="${esc(t.title)}">${esc(t.title)}</strong><span title="${esc(t.artist)}">${esc(t.artist)}</span></button></article>`).join('')}</div>`;
  }else if(effectiveView==='tracks'){
   html+=`<div class="song-search-results"><div class="search-heading"><span></span><span>곡명</span><span>앨범</span><span>아티스트</span><span></span></div>${result.items.map(t=>`<article class="search-song"><button class="search-cover" data-open="${esc(t.album_id)}" aria-label="${esc(t.album_title)} 상세">${cover({id:t.album_id,title:t.album_title,artist:t.artist})}</button><span class="search-title">${searchField(t.title,$('#search').value)}</span><button class="search-text" data-open="${esc(t.album_id)}">${searchField(t.album_title,$('#search').value)}</button><button class="search-text" data-index-artist="${esc(t.artist)}">${searchField(t.artist,$('#search').value)}</button><div class="search-actions"><button data-search-play="${esc(t.album_id)}" data-song-index="${t.track_index}">▶ 재생</button><button data-search-queue="${esc(t.album_id)}" data-song-index="${t.track_index}">＋ 대기열</button><button data-search-list="${esc(t.album_id)}" data-song-index="${t.track_index}">＋ 목록</button><button data-search-download="${esc(t.album_id)}" data-song-index="${t.track_index}">↓ 받기</button></div></article>`).join('')}</div>`;
  }else if(view==='artists'){
   html+=`<div class="artist-index"><button data-letter="">전체</button>${letters.map(l=>`<button data-letter="${esc(l)}" aria-pressed="${l===letter}">${esc(l)}</button>`).join('')}</div>`;
   let previous='';for(const a of result.items){if(a.initial!==previous){if(previous)html+='</ul></section>';html+=`<section class="artist-section"><h2>${esc(a.initial)}</h2><ul>`;previous=a.initial;}
    html+=`<li><button class="artist-link" data-index-artist="${esc(a.name)}">${esc(a.name)}</button><span>${a.count}개 앨범</span><span class="artist-genre">${esc(a.genre)}</span>${repo.admin?`<button data-genre="${esc(a.name)}">장르 수정</button>`:''}</li>`;}
   if(previous)html+='</ul></section>';
  }else{
   if(view==='duplicates')html+='<p class="hint">아티스트와 제목이 같은 비교 후보입니다. 동일 음원으로 확정한 결과가 아닙니다.</p>';
   html+=`<div class="grid">${result.items.map(a=>`<article class="album"><button class="album-open" data-open="${esc(a.id)}" aria-label="${esc(a.title)} 상세">${cover(a)}<h3 title="${esc(a.title)}">${esc(a.title)}</h3></button><button class="artist-name album-artist-link" data-index-artist="${esc(a.artist)}" aria-label="${esc(a.artist)} 전체 앨범 보기">${esc(a.artist)}</button><div class="album-info-row"><span>${esc(String(albumYear(a)).match(/\d{4}/)?.[0]||'연도 미확인')}</span><span>${esc(a.category||'미확인')}</span></div><div class="album-info-row"><span class="album-card-genre" title="${esc(a.genre||'미분류')}">${esc(a.genre||'미분류')}</span><span class="album-card-quality">${esc(formatLabel(a))}</span></div></article>`).join('')}</div>`;
  }
  if(!result.items.length)html+='<p class="empty">해당 목록이 없습니다. 색인 상태 또는 검색 조건을 확인하세요.</p>';
  // Commit view styles with their content to keep the old grid stable while loading.
  document.body.classList.toggle('home-view',view==='home');
  document.body.classList.toggle('random-view',view==='random');
  $('#sort').hidden=view==='home'||view==='random';
  $('#content').innerHTML=html;bindCovers($('#content'));
  if(view==='random'){
   const items=result.items.map(t=>({...t,index:t.track_index,disc:String(t.disc||1)}));
   $('#random-redraw').onclick=()=>{randomSeed=crypto.randomUUID();randomResults.clear();try{sessionStorage.setItem('vinyl-random-seed',randomSeed);}catch{}render();};
   $('#random-play').onclick=action(async()=>{const p=getPlayer(),start=p.items.length;p.add(items);await p.play(start);});
   $('#random-queue').onclick=()=>{getPlayer().add(items);toast(`${items.length}곡을 대기열에 추가했습니다.`);};
   $('#random-save').onclick=()=>window.dispatchEvent(new CustomEvent('save-playlist-tracks',{detail:items}));
  }
  $('#pagination').innerHTML=result.pages>1?`<button id="previous-page" ${page===1?'disabled':''}>이전</button><span>${page} / ${result.pages} 페이지</span><button id="next-page" ${page===result.pages?'disabled':''}>다음</button>`:'';
  for(const [id,step] of [['previous-page',-1],['next-page',1]])if($('#'+id))$('#'+id).onclick=()=>{page+=step;render();window.scrollTo(0,0);};
  $('#content').querySelectorAll('[data-search-download]').forEach(b=>b.onclick=action(()=>detail(b.dataset.searchDownload,Number(b.dataset.songIndex),'download')));
  $('#content').querySelectorAll('[data-search-queue],[data-search-list]').forEach(b=>b.onclick=action(async()=>{const album=await api('/v2/album?id='+encodeURIComponent(b.dataset.searchQueue||b.dataset.searchList));const item=describeTrack(album,Number(b.dataset.songIndex));if(b.dataset.searchList)window.dispatchEvent(new CustomEvent('save-playlist-tracks',{detail:[item]}));else{getPlayer().add([item]);toast('대기열에 추가했습니다.');}}));
  $('#content').querySelectorAll('[data-search-play]').forEach(b=>b.onclick=action(async()=>{const album=await api('/v2/album?id='+encodeURIComponent(b.dataset.searchPlay));await playItem(describeTrack(album,Number(b.dataset.songIndex)));}));
  $('#content').querySelectorAll('[data-open]').forEach(b=>b.onclick=action(()=>detail(b.dataset.open)));
  $('#content').querySelectorAll('[data-index-artist]').forEach(b=>b.onclick=()=>{artist=b.dataset.indexArtist;category='';view='library';page=1;$('#search').value=$('#genre').value=$('#format').value='';render();window.scrollTo(0,0);});
  $('#content').querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;page=1;render();});
  $('#content').querySelectorAll('[data-letter]').forEach(b=>b.onclick=()=>{letter=b.dataset.letter;page=1;render();});
  $('#content').querySelectorAll('[data-genre]').forEach(b=>b.onclick=()=>artistGenre(b.dataset.genre));
  if($('#back-artists'))$('#back-artists').onclick=()=>{artist=category='';view='artists';page=1;render();};
 }catch(e){if(token===generation){$('#notice').textContent='목록을 조회하지 못했습니다. 목록 새로고침으로 다시 시도하세요.';toast(e.message);}}
}
async function detail(id,playIndex=null,trackAction='play'){
 const requestGeneration=++albumRequestGeneration;
 const a=await api((repo.admin?'/v2/admin-album':'/v2/album')+'?id='+encodeURIComponent(id),{admin:repo.admin});
 if(requestGeneration!==albumRequestGeneration)return;
 albumPageLayout(`<div class="detail-top">${cover(a)}<div><p class="album-eyebrow">ALBUM ARCHIVE</p><p>${esc(a.artist)}</p><h2>${esc(a.title)}</h2><div class="album-chips">${[albumYear(a),a.category,a.genre,formatLabel(a)].filter(Boolean).map(value=>`<span>${esc(value)}</span>`).join('')}</div>${albumFacts(a)}${a.edition?`<dl class="album-facts"><dt>소장 판본</dt><dd>${esc(a.edition)}</dd></dl>`:''}${a.missing?'<p class="error">색인된 파일을 찾을 수 없습니다. 폴더 색인을 실행해 주세요.</p>':''}${repo.admin?'<div class="actions"><button id="edit-index">정보 수정</button><button id="review-index">확인 상태 변경</button></div>':''}</div></div>${mediaPanel(repo.admin)}<h3>트랙 · ${(a.tracks||[]).length}개</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>곡명</th><th>길이</th><th>형식</th><th>가사</th><th>재생</th><th>대기열</th><th>목록</th><th>다운로드</th></tr></thead><tbody>${(a.tracks||[]).map((t,i)=>`<tr><td>${esc(t.disc||1)}-${esc(t.number||i+1)}</td><td title="${esc(t.title||t.filename)}">${esc(t.title||t.filename)}</td><td>${t.duration?Math.floor(t.duration/60)+':'+String(Math.floor(t.duration%60)).padStart(2,'0'):'—'}</td><td>${esc(formatLabel(t,a))}</td>${trackActions(i)}</tr>`).join('')}</tbody></table></div>${repo.admin?`<h3>출처와 부속 자료</h3><pre>${esc(JSON.stringify(a.sources||[],null,2))}</pre><details><summary>스캔 원본 정보</summary><pre>${esc(JSON.stringify(a.raw_tags||{},null,2))}</pre></details><div class="actions"><a target="_blank" rel="noopener" href="https://www.discogs.com/search/?q=${encodeURIComponent(a.artist+' '+a.title)}&type=release">발매 정보 찾기 ↗</a><button id="hide-index" class="danger">서재에서 숨기기</button></div><section class="album-admin-records"><h3>개인 기록</h3><p>${esc(a.notes||'메모 없음')}</p><h3>보관 위치</h3><p class="path">${esc(a.relative_path)}</p></section>`:''}`);
 bindCovers(albumPage);bindMedia(repo,a);attachArtwork(albumPage,a.id);
 const coverImg=albumPage.querySelector('.detail-top .cover img');
 if(coverImg){coverImg.classList.add('album-cover-zoom');coverImg.setAttribute('role','button');coverImg.tabIndex=0;coverImg.title='앨범 표지 확대';const zoom=()=>openAlbumCover(a.id,coverImg.src);coverImg.onclick=zoom;coverImg.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();zoom();}};}
 if(Number.isInteger(playIndex))albumPage.querySelector(`[data-track-action="${trackAction}"][data-track-index="${playIndex}"]`)?.click();
 if(repo.admin){$('#edit-index').onclick=()=>edit(a);$('#review-index').onclick=action(async()=>{await api('/v2/edit',{admin:true,body:{id:a.id,fields:{reviewed:!a.reviewed}}});detail(a.id);render();});$('#hide-index').onclick=()=>{modal('서재에서 숨기기','<p>음악 파일과 개인 기록은 보존됩니다. 목록에서만 숨깁니다.</p><button id="confirm-hide">숨기기</button>');$('#confirm-hide').onclick=action(async()=>{await api('/v2/hide',{admin:true,body:{id:a.id}});$('#dialog').close();closeAlbumPage();render();});};}
}
function openAlbumCover(albumId,fallback){
 const viewer=document.createElement('div');
 viewer.className='album-cover-viewer';
 viewer.setAttribute('role','dialog');viewer.setAttribute('aria-modal','true');
 viewer.setAttribute('aria-label','앨범 표지 확대 보기');
 viewer.innerHTML='<button class="album-cover-close" type="button" aria-label="닫기">×</button><img alt="확대된 앨범 표지">';
 const img=viewer.querySelector('img');img.src=fallback;
 let scale=1,offsetX=0,offsetY=0,drag=null;
 const apply=()=>{img.style.transform='translate('+offsetX+'px,'+offsetY+'px) scale('+scale+')';img.style.cursor=scale>1?'grab':'zoom-in';};
 img.draggable=false;
 img.addEventListener('wheel',event=>{
   event.preventDefault();scale=Math.max(1,Math.min(4,scale*(event.deltaY<0?1.2:1/1.2)));
   if(scale===1)offsetX=offsetY=0;apply();
 },{passive:false});
 img.addEventListener('dblclick',event=>{event.preventDefault();scale=1;offsetX=offsetY=0;apply();});
 img.addEventListener('pointerdown',event=>{if(scale<=1)return;drag={x:event.clientX,y:event.clientY,left:offsetX,top:offsetY};img.setPointerCapture(event.pointerId);img.style.cursor='grabbing';});
 img.addEventListener('pointermove',event=>{if(!drag)return;offsetX=drag.left+event.clientX-drag.x;offsetY=drag.top+event.clientY-drag.y;apply();});
 img.addEventListener('pointerup',()=>{drag=null;apply();});
 img.addEventListener('pointercancel',()=>{drag=null;apply();});
 const original=NAS_URL+'/v2/cover-original?id='+encodeURIComponent(albumId);
 loadMemberImage(img,original).catch(()=>{});
 const previous=document.activeElement;
 const owner=albumPage;
 const dismiss=()=>{document.removeEventListener('keydown',keyboard,true);owner?.removeEventListener('album-page-close',dismiss);viewer.remove();previous?.focus?.();};
 owner?.addEventListener('album-page-close',dismiss);
 const keyboard=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss();}else if(e.key==='Tab'){e.preventDefault();viewer.querySelector('button').focus();}};
 viewer.onclick=e=>{if(e.target===viewer)dismiss();};
 viewer.querySelector('button').onclick=dismiss;
 document.addEventListener('keydown',keyboard,true);
 document.body.append(viewer);viewer.querySelector('button').focus();
}
function edit(a){
 const fields=[['artist','아티스트'],['title','앨범명'],['original_year','원발매일'],['release_year','판본 발매일'],['edition','판본'],['label','레이블'],['catalog_number','카탈로그 번호'],['country','국가'],['performance_date','공연 날짜'],['venue','장소'],['recording_source','녹음 출처'],['genre','장르']];
 modal('앨범 정보 수정',`<form id="edit-form"><div class="fields">${fields.map(([k,l])=>`<label>${l}<input name="${k}" value="${esc(a[k])}" maxlength="500"></label>`).join('')}<label>앨범 분류<input value="${esc(a.category||'Studio')}" disabled><small>NAS 분류 폴더를 이동한 후 재색인하면 변경됩니다.</small></label><label>장르 적용<select name="genre_mode"><option value="inherit">아티스트 기본값</option><option value="override" ${a.genre_mode==='override'?'selected':''}>개별 지정</option></select></label><label>세부 장르<input name="styles" value="${esc((a.styles||[]).join(', '))}"></label><label class="full">메모<textarea name="notes">${esc(a.notes)}</textarea></label></div><p class="hint">변경한 항목은 자동 색인에서도 보존됩니다. 음악 파일은 수정하지 않습니다.</p><button type="submit">저장</button></form>`);
 $('#edit-form').onsubmit=action(async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));f.styles=f.styles.split(',').map(x=>x.trim()).filter(Boolean);const changed=Object.fromEntries(Object.entries(f).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(k==='category'&&a.category_source!=='manual'?'auto':a[k]??'')));await api('/v2/edit',{admin:true,body:{id:a.id,fields:changed}});$('#dialog').close();await detail(a.id);render();});
}
function artistGenre(name){modal('아티스트 장르',`<form id="artist-form"><p>${esc(name)}</p><select name="genre">${GENRES.map(g=>`<option>${esc(g)}</option>`).join('')}</select><button>저장</button></form>`);$('#artist-form').onsubmit=action(async e=>{e.preventDefault();await api('/v2/artist',{admin:true,body:{name,genre:new FormData(e.target).get('genre')}});$('#dialog').close();render();});}
function login(){
 if(repo.admin){modal('관리자 계정','<button id="logout-index">로그아웃</button>');$('#logout-index').onclick=action(async()=>{await repo.logout();$('#dialog').close();render();});return;}
 modal('관리자 로그인','<form id="login-form"><div class="fields"><label>이메일<input name="email" type="email" autocomplete="username" required></label><label>비밀번호<input name="password" type="password" autocomplete="current-password" required></label></div><p class="hint">색인 실행과 정보 수정에만 로그인이 필요합니다.</p><button type="submit">로그인</button></form>');
 $('#login-form').onsubmit=action(async e=>{e.preventDefault();const f=new FormData(e.target);await repo.login(repo.config.url,repo.config.key,f.get('email'),f.get('password'));$('#dialog').close();render();});
}
async function indexing(){
 repo.requireAdmin();modal('NAS 폴더 색인',`<p class="hint">선택한 폴더만 색인합니다. Music 원본은 읽기 전용이며 자동 색인과 순서대로 실행됩니다.</p><div id="folder-browser"></div><label class="check"><input id="recursive-index" type="checkbox" checked>하위 폴더 포함</label><button id="start-index" class="primary">선택 폴더 색인 시작</button><h3>색인 상태</h3><div id="index-jobs" aria-live="polite"></div>`);
 const node=$('#folder-browser'),jobs=$('#index-jobs');let selected='';
 const initial=name=>{const c=String(name).normalize('NFKC').trim().charAt(0),n=c.charCodeAt(0);if(/[0-9]/.test(c))return '0–9';if(/[a-z]/i.test(c))return c.toUpperCase();if(n>=0xac00&&n<=0xd7a3)return 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor((n-0xac00)/588)];return '기타';};
 let browseGeneration=0;
 const browse=async path=>{
  const token=++browseGeneration,r=await api('/v2/folders?path='+encodeURIComponent(path),{admin:true});
  if(!node.isConnected||token!==browseGeneration)return;
  selected=r.path==='.'?'':r.path;let folderLetter='';
  const paint=()=>{
   const folders=r.folders.filter(f=>!folderLetter||initial(f.name)===folderLetter);
   node.innerHTML=`<div class="artist-index folder-letter-index" aria-label="폴더 첫 글자">${['',...letters].map(l=>`<button type="button" data-folder-letter="${esc(l)}" aria-pressed="${l===folderLetter}">${esc(l||'전체')}</button>`).join('')}</div><p class="path">Music / ${esc(selected)}</p><button id="parent-folder" ${selected?'':'disabled'}>상위 폴더</button><ul class="folder-options">${folders.map(f=>`<li><button data-folder="${esc(f.path)}">📁 ${esc(f.name)}</button></li>`).join('')}</ul>${folders.length?'':'<p class="hint">해당 초성의 폴더가 없습니다.</p>'}`;
   $('#parent-folder').onclick=action(()=>browse(selected.split('/').slice(0,-1).join('/')));
   node.querySelectorAll('[data-folder]').forEach(b=>b.onclick=action(()=>browse(b.dataset.folder)));
   node.querySelectorAll('[data-folder-letter]').forEach(b=>b.onclick=()=>{folderLetter=b.dataset.folderLetter;paint();});
  };paint();
 };

 const poll=async()=>{try{const state=await api('/v2/jobs',{admin:true});if(!jobs.isConnected)return;jobs.innerHTML=`<p>자동 확인: ${state.schedule==='daily'?'매일 새벽 2시 (한국 시간)':Math.round(state.interval/60)+'분 간격'} · 기존 기록 이관 ${state.ready?'완료':'진행 중'}</p>${state.jobs.map(j=>`<article class="index-job"><strong>${esc(j.path||'Music 전체')} · ${esc(({queued:'대기',running:'진행 중',completed:'완료',completed_with_errors:'일부 오류',failed:'실패',interrupted:'중단'})[j.state]||j.state)}</strong><p>${j.processed}개 확인 · 추가 ${j.added} · 갱신 ${j.updated} · 변경 없음 ${j.unchanged} · 파일 없음 ${j.missing}</p><p>${esc(j.message)}</p>${j.errors.length?`<details><summary>오류 ${j.errors.length}건 (최근 최대 100건)</summary><pre>${esc(JSON.stringify(j.errors,null,2))}</pre></details>`:''}</article>`).join('')}`;}catch(e){if(jobs.isConnected)jobs.textContent=e.message;}if(jobs.isConnected&&$('#dialog').open)setTimeout(poll,5000);};
 $('#start-index').onclick=action(async()=>{await api('/v2/scan',{admin:true,body:{path:selected,recursive:$('#recursive-index').checked}});toast('색인 대기열에 등록했습니다. 창을 닫아도 계속 진행됩니다.');});
 await browse('');poll();
}
$('#genre').innerHTML='<option value="">모든 장르</option>'+GENRES.map(g=>`<option>${esc(g)}</option>`).join('');
$('#search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{view='library';artist=letter=category='';page=1;render();},250);};
for(const id of ['genre','format','sort'])$('#'+id).onchange=()=>{page=1;render();};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{closeAlbumPage();clearTimeout(searchTimer);view=b.dataset.view;artist=letter=category='';$('#search').value='';page=1;render();});
$('.brand').onclick=e=>{e.preventDefault();closeAlbumPage();clearTimeout(searchTimer);view='home';artist=letter=category='';page=1;for(const id of ['search','genre','format'])$('#'+id).value='';$('#sort').value='artist';$('#dialog').close();render();window.scrollTo({top:0,behavior:'instant'});};
$('#settings').onclick=openAccount;$('#import').onclick=action(indexing);$('#export').onclick=action(indexing);$('#refresh-catalog').onclick=()=>render();
const gate=document.getElementById('vinyl-auth-gate');
gate.id='vinyl-auth-gate';
gate.setAttribute('aria-label','회원 전용 음악 서재');
gate.innerHTML='<div class="vinyl-auth-gate-card"><svg class="brand-icon" viewBox="0 0 38 38" width="38" height="38" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="6" width="34" height="27" rx="3" stroke="currentColor" stroke-width="1.6"/><circle cx="15" cy="19.5" r="9" stroke="currentColor" stroke-width="1.5"/><circle cx="15" cy="19.5" r="6.5" stroke="currentColor" stroke-width=".8" opacity=".55"/><circle cx="15" cy="19.5" r="2.6" fill="currentColor"/><circle cx="30" cy="11" r="1.8" fill="currentColor"/><path d="M30 13v9l-5 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="m24 25-2 2" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M6 29h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><p class="vinyl-auth-brand">VINYL ROOM</p><h1>회원 전용 음악 서재</h1><p class="vinyl-auth-description">관리자 승인을 받은 회원만 앨범과 음악을 이용할 수 있습니다.</p><div class="vinyl-auth-actions"><button type="button" id="vinyl-auth-open">로그인</button><button type="button" id="vinyl-auth-signup">회원가입</button></div><small>가입 신청 후 이메일 인증과 관리자 승인이 필요합니다.</small></div>';

gate.querySelector('#vinyl-auth-open').onclick=openAccount;
gate.querySelector('#vinyl-auth-signup').onclick=signupRequest;
restorePage();

if(isApprovedMember())await render();
else document.body.classList.add('vinyl-auth-locked');
let lastApprovedState=isApprovedMember();
window.addEventListener('vinyl-approval-change',()=>{
 const enabled=isApprovedMember();
 if(enabled===lastApprovedState)return;
 lastApprovedState=enabled;
 
 if(enabled)render();
 else {generation++;$('#content').replaceChildren();const modeLabel=$('#mode-label');if(modeLabel)document.querySelector('.sidebar .side-bottom').append(modeLabel);$('#stats').replaceChildren();$('#pagination').replaceChildren();closeAlbumPage();getPlayer().clear();document.querySelectorAll('.artwork-viewer,.album-cover-viewer,.vinyl-members-dialog').forEach(node=>node.remove());}
});
finishAccessInitialization(isApprovedMember());

