import {installButtonSystem} from './button-system.js';
import {mountAlbumReference} from './reference-ui.js';
import {installBackToTop} from './back-to-top.js';
import {catalogLink,bindCatalogLinks,activeCatalogMenu} from './catalog-links.js';
import {bindAlbumTrackTaps} from './album-track-taps.js';
import {createArtistIndex} from './artist-index-policy.js';
import {mountArtistHome} from './artist-home.js';
import {mountArtistGallery,disposeArtistGallery} from './artist-gallery-integration.js';
import {createArtistProfileManager} from './artist-profile-editor.js';
import {configureHeaderActions,refreshHeaderActions} from './header-actions.js';
import {installCompactUI,polishAlbumHeader} from './ui-polish.js';
import {albumShareRoute,albumHistoryPath,canReadAlbumMetadata,bindAlbumShare} from './album-share.js';
import {discTrackLayout} from './disc-tracks.js';
import {createListToolbar} from './list-toolbar.js';
import {arrangeHomeSummary,fitTodayCovers} from './home-layout.js';
import {createNavigationHistory,navigationSnapshot} from './navigation-history.js';
import {indexingPanel,mountIndexing} from './indexing-ui.js';
import {mountAdminCenter,closeAdminCenter} from './admin-center.js';
import {openMemberManagement} from './member-management.js';
import {createCatalogRequests} from './catalog-requests.js';
import {initializeBrowse,publicBrowseEnabled,readRequest,installMemberPrompts} from './browse-access.js';
import {renderTop100} from './top100-ui.js';
import {bindRandomTrackActions} from './random-mobile-actions.js';
import {loadMemberImage,clearMemberImage} from './member-images.js';
import {finishAccessInitialization} from './access-state.js';
import {connectAccount,login as openAccount,signupRequest,currentMemberToken,isApprovedMember,invalidateMemberAccess,albumAccessSnapshot} from './playlists.js';
import {attachArtwork} from './artwork-ui.js';
import {searchField} from './search-presentation.js';
import {albumReleaseDate,albumYear,formatLabel,statsMarkup,albumFacts} from './presentation.js';
import {getPlayer,describeTrack,playItem} from './player.js';
import {mountPlaybackDiagnostics} from './playback-diagnostics.js';
import {Repository} from './store.js';
import {NAS_URL} from './config.js';
import {GENRES} from './core.js';
import {mediaPanel,trackActions,bindMedia} from './media.js';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const listToolbar=createListToolbar({toolbar:document.querySelector('main .toolbar'),results:document.querySelector('main .results-line'),count:$('#result-count'),content:$('#content'),media:window.matchMedia('(min-width:1101px)'),mobileMedia:window.matchMedia('(max-width:740px)')});
const repo=new Repository({guest:true});repo.load=async()=>{};
configureHeaderActions({canIndex:()=>repo.admin&&isApprovedMember()});
installBackToTop();
connectAccount(repo,()=>render(),{openAdminCenter:()=>openAdminCenter()});
let view='home',page=1,artist='',letter='',generation=0,revision='',searchTimer;
let navigation=null,activeAlbumId='',activePanel='',top100Folder='',navigationGeneration=0,pendingSharedAlbumId='';
const originalPlaylistClick=$('#my-playlists')?.onclick;
let randomSeed=crypto.randomUUID();const randomResults=new Map();
try{randomSeed=sessionStorage.getItem('vinyl-random-seed')||randomSeed;sessionStorage.setItem('vinyl-random-seed',randomSeed);}catch{}
$('#nav').insertAdjacentHTML('afterbegin',"<button data-view=\"home\"><svg class=\"nav-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"3\"/><path d=\"M7 3v4m10-4v4M3 10h18\"/><path d=\"m10 13 5 3-5 3z\"/></svg><span>Today's Albums</span></button>");
$('#nav').insertAdjacentHTML('beforeend',"<button data-view=\"random\"><svg class=\"nav-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-2 5-4m2-4c2-3 3-4 5-4h3m-4-4 4 4-4 4\"/></svg><span>Random100</span></button>");
$('#nav [data-view="random"]').insertAdjacentHTML('afterend','<button data-view="top100"><span class="nav-icon" aria-hidden="true">♬</span><span>Top100</span></button>');
if($('#my-playlists'))$('#nav').append($('#my-playlists'));
const adminNav=document.createElement('button');adminNav.id='vinyl-admin-center-nav';adminNav.hidden=true;
adminNav.innerHTML='<span class="nav-icon" aria-hidden="true">◈</span><span class="mobile-nav-label" data-mobile-label="Admin">Admin</span>';
adminNav.setAttribute('aria-label','Admin');adminNav.style.order='6';$('#nav').append(adminNav);
installCompactUI();
installButtonSystem();
const shareStyle=document.createElement('link');shareStyle.rel='stylesheet';shareStyle.href=new URL('./album-share.css',import.meta.url).href;document.head.append(shareStyle);
const adminStyle=document.createElement('link');adminStyle.rel='stylesheet';adminStyle.href=new URL('./admin-center.css',import.meta.url).href;document.head.append(adminStyle);

for(const [selector,label] of [['[data-view="home"]','Today'],['[data-view="library"]','Album'],['[data-view="artists"]','Artist'],['[data-view="random"]','Random'],['[data-view="top100"]','Top100'],['#my-playlists','Playlist']]){const button=$('#nav '+selector),text=button?.querySelector('span:last-child');if(text){text.classList.add('mobile-nav-label');text.dataset.mobileLabel=label;button.setAttribute('aria-label',text.textContent);}}
const catalogRequests=createCatalogRequests();
let pendingCatalogState=null,lastCatalogState=null;
function catalogState(){if(!pendingCatalogState)pendingCatalogState=api('/v2/state').then(state=>{lastCatalogState=state;return state;}).finally(()=>{pendingCatalogState=null;});return pendingCatalogState;}
const artistIndex=createArtistIndex((params,signal)=>api('/v2/albums?'+params,{signal}));
async function catalog(params,onFirst){
 const key=params.toString();
 return catalogRequests.run(key,async signal=>{
  if(params.get('view')==='artists'){
   // An index restored from browser storage is safe only after the current
   // Catalog revision is checked; do not fetch 24 pages unnecessarily.
   let currentRevision=lastCatalogState?.revision??revision;
   if(currentRevision==null||currentRevision===''){
    try{const state=await Promise.race([catalogState(),new Promise(resolve=>setTimeout(()=>resolve(null),900))]);currentRevision=state?.revision??currentRevision;}catch{}
   }
   return artistIndex(params,signal,currentRevision,onFirst);
  }
  if(params.get('view')==='random'&&randomResults.has(key))return randomResults.get(key);
  const result=await api('/v2/albums?'+key,{signal});
  if(params.get('view')==='random')randomResults.set(key,result);
  return result;
 },params.get('view')==='random'?60000:20000);
}
const categories=['Studio','Live','Compilations','Singles & EPs','Bootlegs','ETC'];
let category='';
const letters=['0–9',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ','기타'];
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),6000);}
function action(fn){return async e=>{const b=e?.currentTarget;if(b)b.disabled=true;try{await fn(e);}catch(err){toast(err.message);}finally{if(b?.isConnected)b.disabled=false;}};}
async function api(path,{admin=false,body,signal}={}){
 if(!admin&&!body){const r=await readRequest(NAS_URL+path,{signal:signal||AbortSignal.timeout(20000)});const data=await r.json();if(!r.ok)throw Error(data.message||'NAS 연결을 확인하세요.');return data;}
 const access=await currentMemberToken();
 if(admin){repo.requireAdmin();if(Date.now()>repo.expires-60000)await repo.refresh();}
 const r=await fetch(NAS_URL+path,{method:body?'POST':'GET',credentials:'omit',redirect:'error',headers:{Authorization:'Bearer '+access,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:signal||AbortSignal.timeout(20000)});
 if(r.status===401||r.status===403)invalidateMemberAccess();
 const data=await r.json().catch(()=>({}));if(!r.ok){const error=Error((data.message||'NAS 요청에 실패했습니다.')+' (HTTP '+r.status+' · '+path.split('?')[0]+')');error.status=r.status;throw error;}return data;
}
const artistProfileManager=createArtistProfileManager({
 allowed:()=>repo.admin&&isApprovedMember(),token:currentMemberToken,
 onUpdated:()=>render(true)
});
bindCatalogLinks(document,{openAlbum:async id=>{closeAdminCenter();await detail(id);},openArtist:async name=>{closeAdminCenter();await browseArtist(name);},verifyArtist:async name=>{const r=await api('/v2/albums?'+new URLSearchParams({view:'artists',artist:name,page:'1'}));return r.total===1&&r.items?.length===1&&r.items[0].name===name&&r.items[0].count>0;},onError:toast});
let albumPage=null;
// One delegated listener survives album redraws without accumulating handlers.
function dismissTrackMenus(event){
 if(!albumPage)return;
 for(const menu of albumPage.querySelectorAll('.mobile-track-more[open]')){
  if(event.type==='keydown'&&event.key!=='Escape')return;
  if(event.type==='keydown'||!menu.contains(event.target))menu.open=false;
 }
}
document.addEventListener('pointerdown',dismissTrackMenus,true);
document.addEventListener('keydown',dismissTrackMenus);

function resetPageScroll(){
 window.scrollTo({top:0,left:0,behavior:'instant'});
 const main=document.querySelector('main');
 if(main){main.scrollTop=0;main.scrollLeft=0;}
 if(albumPage){albumPage.scrollTop=0;albumPage.scrollLeft=0;}
}
let albumRequestGeneration=0;
let pendingArtistTransition=null;
function refreshCatalogNavigation(){const active=activeCatalogMenu(view,artist,!!activeAlbumId);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===active));if(activeAlbumId)$('#crumb').textContent='앨범 서재';else if(artist&&view==='library')$('#crumb').textContent='Artist / '+artist;}
function closeAlbumPage(){
 pendingArtistTransition=null;
 albumRequestGeneration++;activeAlbumId='';refreshCatalogNavigation();
 if(!albumPage)return;
 albumPage.dispatchEvent(new Event('album-page-close'));
 albumPage.remove();albumPage=null;
 document.body.classList.remove('album-page-open');
 window.dispatchEvent(new Event('vinyl-album-page-change'));
 resetPageScroll();
}
function albumPageLayout(html){
 closeAlbumPage();
 const section=document.createElement('section');
 section.className='album-full-page';
 section.setAttribute('aria-label','앨범 상세 페이지');
 section.innerHTML='<div class="album-full-bar"><strong>VINYL ROOM / ALBUM</strong></div><nav class="album-page-navigation" aria-label="앨범 탐색"><button type="button" id="album-page-back">← 앨범 목록</button></nav><div class="modal-body album-page-body">'+html+'</div>';
 document.querySelector('main').after(section);albumPage=section;document.body.classList.add('album-page-open');
 window.dispatchEvent(new Event('vinyl-album-page-change'));
 resetPageScroll();
 section.querySelector('#album-page-back').onclick=()=>{if(navigation?.current()?.album&&navigation.canGoBack())navigation.back();else{closeAlbumPage();navigation?.replace(navigationState());}};
 return section;
}
function modal(title,html){if($('#dialog').open)$('#dialog').close();$('#dialog-content').innerHTML=`<div class="modal-head"><h2>${esc(title)}</h2><button class="close" aria-label="닫기">×</button></div><div class="modal-body">${html}</div>`;$('.close').onclick=()=>$('#dialog').close();$('#dialog').showModal();$('#dialog').scrollTop=0;$('#dialog').querySelector('.modal-body').scrollTop=0;}
let diagnosticsDispose=null;
$('#dialog').addEventListener('close',()=>{diagnosticsDispose?.();diagnosticsDispose=null;});
function openPlaybackDiagnostics(){if(!repo.admin||!isApprovedMember())return;modal('재생 진단 로그','<div id="playback-diagnostics-host"></div>');const host=$('#playback-diagnostics-host');diagnosticsDispose=mountPlaybackDiagnostics(host,{authorized:repo.admin&&isApprovedMember()});}
function updateAuth(){document.body.classList.toggle('guest-mode',!repo.admin);$('#connection-label').textContent=repo.admin?'관리자 / 로그아웃':'관리자 로그인';const modeLabel=$('#mode-label');if(modeLabel)modeLabel.textContent='NAS 음악 서재';$('#import').textContent='Indexing';refreshHeaderActions();$('#export').textContent='색인 상태';$('#playback-diagnostics-nav')?.remove();adminNav.hidden=!(repo.admin&&isApprovedMember());if(adminNav.hidden&&document.body.classList.contains('vinyl-admin-page-open'))window.dispatchEvent(new Event('vinyl-approval-change'));if((!repo.admin||!isApprovedMember())&&$('#playback-diagnostics-host')&&$('#dialog').open)$('#dialog').close();}
function cover(a){return `<div class="cover"><img data-member-cover="${esc(a.id)}" loading="eager" decoding="async" hidden alt="${esc(a.title)} 커버"><span class="cover-fallback" hidden>${esc(a.artist)}</span></div>`;}
function bindCovers(root){root.querySelectorAll('.cover img').forEach(img=>{
 const box=img.parentElement;
 const failed=()=>{box.classList.remove('cover-loading');box.classList.add('cover-failed');img.hidden=true;img.nextElementSibling.hidden=false;};
 const ready=()=>{if(box.classList.contains('cover-failed'))return;img.hidden=false;box.classList.remove('cover-loading');box.classList.add('cover-ready');};
 img.onerror=failed;img.onload=()=>{if(img.decode)img.decode().then(ready,failed);else ready();};
 if(img.dataset.memberCover)loadMemberImage(img,NAS_URL+'/v2/cover?id='+encodeURIComponent(img.dataset.memberCover)+'&v='+encodeURIComponent(revision)).catch(failed);
 if(img.complete&&img.naturalWidth)img.onload();else box.classList.add('cover-loading');
});}
function navigationState(){return navigationSnapshot({view,page,artist,letter,category,search:$('#search').value,genre:$('#genre').value,format:$('#format').value,sort:$('#sort').value,seed:randomSeed,chart:top100Folder,album:activeAlbumId,panel:activePanel});}
async function applyNavigation(value){
 const state=navigationSnapshot(value),request=++navigationGeneration;
 clearTimeout(searchTimer);activePanel='';closeAlbumPage();
 const personal=$('#personal-dialog');if(personal?.open)personal.close();
 const dialog=$('#dialog');if(dialog?.open)dialog.close();
 view=state.view;page=state.page;artist=state.artist;letter=state.letter;category=state.category;top100Folder=state.chart;
 if(state.seed){randomSeed=state.seed;try{sessionStorage.setItem('vinyl-random-seed',randomSeed);}catch{}}
 for(const key of ['search','genre','format','sort'])$('#'+key).value=state[key];
 if(!$('#sort').value)$('#sort').value='artist';
 await render(true,true);if(request!==navigationGeneration)return;
 if(state.album)await detail(state.album,null,'play',true);
 if(state.panel==='playlist'&&isApprovedMember()&&request===navigationGeneration){activePanel='playlist';await originalPlaylistClick?.();}
}
function savePage(){try{sessionStorage.setItem('vinyl-page-v1',JSON.stringify({view,page,artist,letter,category,search:$('#search').value,genre:$('#genre').value,format:$('#format').value,sort:$('#sort').value}));}catch{}}
function browseArtist(catalogArtist){
 // The catalog's exact artist value is the existing /v2/albums artist filter key.
 if(typeof catalogArtist!=='string'||!catalogArtist.trim()){toast('아티스트 연결 정보를 확인할 수 없습니다.');return;}
 // Keep the detail over the previous (possibly Today's Albums) list until the destination is ready.
 const transition=pendingArtistTransition||{origin:navigationState()};
 pendingArtistTransition=transition;
 clearTimeout(searchTimer);catalogRequests.cancel();
 artist=catalogArtist;letter=category='';view='library';page=1;
 for(const id of ['search','genre','format'])$('#'+id).value='';
 $('#sort').value='artist';
 return render(true,false,transition);
}
function restorePage(){try{
 const saved=JSON.parse(sessionStorage.getItem('vinyl-page-v1')||'null');
 if(!saved||!['home','library','artists','random','top100','review','duplicates'].includes(saved.view))return;
 view=saved.view;page=Number.isSafeInteger(saved.page)&&saved.page>0?saved.page:1;
 artist=typeof saved.artist==='string'?saved.artist:'';letter=letters.includes(saved.letter)?saved.letter:'';category=categories.includes(saved.category)?saved.category:'';
 for(const id of ['search','genre','format','sort'])if(typeof saved[id]==='string')$('#'+id).value=saved[id];
 if(!$('#sort').value)$('#sort').value='artist';
}catch{}}
async function render(resetScroll=false,fromHistory=false,artistTransition=null){
 if(!isApprovedMember()&&!publicBrowseEnabled())return;
 if(resetScroll&&!fromHistory){navigationGeneration++;activePanel='';if(!artistTransition)navigation?.record(navigationState());}
 savePage();
 $('#result-count').classList.toggle('artist-home-title',Boolean(artist&&view==='library'));
 document.querySelector('main .toolbar').toggleAttribute('data-artist-home',Boolean(artist&&view==='library'));
 document.querySelector('main').toggleAttribute('data-artist-index',view==='artists');
 if(view==='top100'){
  catalogRequests.cancel();
  const topToken=++generation;
  updateAuth();
  $('#random-redraw').hidden=true;
  $('#crumb').textContent='Top100';
  $('#notice').textContent='날짜별 Top100 · 기존 앨범 색인과 분리된 음악 차트';
  $('#page-title').textContent='TOP 100';
  $('#result-count').textContent='한 페이지에 전체 순위 표시';
  $('#pagination').innerHTML='';
  refreshCatalogNavigation();
  listToolbar.beforeRender();
  arrangeHomeSummary(false,$('#result-count'),document.querySelector('main .toolbar'),document.querySelector('main .results-line'));
  document.body.classList.remove('home-view','random-view');
  disposeArtistGallery();
  try{await renderTop100($('#content'),{isCurrent:()=>topToken===generation&&view==='top100'&&(isApprovedMember()||publicBrowseEnabled()),initialFolder:top100Folder,onFolderChange:folder=>{top100Folder=folder;navigationGeneration++;navigation?.record(navigationState());}});if(topToken===generation){top100Folder=$('#top100-date')?.value||top100Folder;if(!fromHistory)navigation?.replace(navigationState());if(resetScroll)resetPageScroll();}}catch(error){if(topToken===generation){$('#notice').textContent=error.message;toast(error.message);}}return;
 }
 const token=++generation;updateAuth();
 const searching=view==='library'&&$('#search').value.trim();
 let effectiveView=view==='random'?'tracks':searching?'tracks':view;
 const params=new URLSearchParams({view:view==='random'?'random':effectiveView,page,q:$('#search').value,genre:$('#genre').value,format:$('#format').value,sort:$('#sort').value,artist,letter,category:artist&&effectiveView==='library'?category:''});
 if(view==='random')params.set('seed',randomSeed);
 // Hidden Artist controls must not inherit another menu's filter selections.
 if(view==='artists'){params.set('genre','');params.set('format','');params.set('sort','artist');}
 if(view==='artists'){
  disposeArtistGallery();listToolbar.beforeRender();
  document.body.classList.remove('home-view','random-view');
  arrangeHomeSummary(false,$('#result-count'),document.querySelector('main .toolbar'),document.querySelector('main .results-line'));
  $('#crumb').textContent='Artist Index';$('#page-title').textContent='';refreshCatalogNavigation();
  $('#random-redraw').hidden=true;$('#sort').hidden=false;
  $('#notice').textContent='익숙한 이름 너머, 아티스트의 이야기를 발견해 보세요.';
  $('#result-count').textContent='아티스트 불러오는 중…';$('#pagination').replaceChildren();
  $('#content').innerHTML='<div class="artist-index-heading"><div><h1>Artist</h1><p role="status">아티스트 불러오는 중…</p></div></div>';
  if(resetScroll)resetPageScroll();
 }
 try{
  // Summary latency/failure must not discard a successful album/artist response.
  void catalogState().then(state=>{
   if(token!==generation)return;
   revision=state.revision;
   $('#stats').innerHTML=statsMarkup(state.albums,state.artists,state.tracks);
   const label=$('#mode-label');
   if(label&&window.matchMedia('(max-width:740px)').matches)$('#stats').append(label);
  }).catch(()=>{});
  let artistPermissionCheck=null;
  const applyResult=async result=>{if(token!==generation)return;
  const state=lastCatalogState||{};
  revision=state.revision??revision;page=result.page;
  const needsSearchUpdate=effectiveView==='tracks'&&result.view!=='tracks';
  const randomQueueItems=view==='random'?result.items.map(t=>({...t,index:t.track_index,disc:String(t.disc||1)})):[];
  if(needsSearchUpdate)effectiveView='library';
  $('#notice').textContent=!lastCatalogState?'목록을 표시했습니다. 색인 상태를 확인 중입니다.':state.ready===false?'기존 기록을 NAS 색인으로 이관 중입니다. 이 작업은 최초 한 번만 진행합니다.':state.indexing?'NAS에서 변경 사항을 확인 중입니다. 현재 목록은 바로 이용할 수 있습니다.':'NAS 색인 · 현재 페이지의 목록만 조회합니다.';
  if(needsSearchUpdate)$('#notice').textContent='곡 목록 검색은 NAS 업데이트 후 사용할 수 있습니다. 현재는 기존 앨범 결과를 표시합니다.';
  const modeLabel=$('#mode-label');
  $('#stats').innerHTML=statsMarkup(state.albums,state.artists,state.tracks);
  if(modeLabel&&window.matchMedia('(max-width:740px)').matches)$('#stats').append(modeLabel);
  $('#page-title').textContent=artist?'':({home:'',random:'',artists:'',review:'등록 확인함',duplicates:'소장본 비교'})[view]||'';
  $('#crumb').textContent=({home:"Today's Albums",random:'Random 100',artists:'Artist Index'})[view]||'앨범 서재';refreshCatalogNavigation();
  if(view==='library')$('#notice').textContent='시간을 넘어, 음악의 새로운 매력을 발견해 보세요.';
  if(view==='artists')$('#notice').textContent='익숙한 이름 너머, 아티스트의 이야기를 발견해 보세요.';
  if(view==='home')$('#notice').textContent=`${result.day ? result.day+' · ' : ''}오늘 만나볼 앨범 · 매일 새로운 선택`;
  if(view==='random')$('#notice').textContent='소장 음원에서 고른 100곡 · 다시 뽑기 전까지 목록이 유지됩니다.';
  $('#result-count').textContent=artist&&view==='library'?'Artist Home':`${result.total.toLocaleString()}${effectiveView==='tracks'?'곡':view==='artists'?'명의 아티스트':'개 소장본'} · 페이지당 ${result.size}개`;
  let html='';
  if(artist&&view==='library')html+='<div id="artist-home-host"></div>';
  if(view==='random')html+=`<div class="actions random-actions"><div class="vinyl-quick-actions"><button id="random-play" data-quick-label="▶ 전체재생" ${result.items.length?'':'disabled'} aria-label="전체 재생">전체 재생</button><button id="random-download" class="mobile-batch-download" data-quick-label="↓ 다운로드" ${result.items.length?'':'disabled'} aria-label="현재 목록 전체 다운로드">다운로드</button><button id="random-queue" data-quick-label="＋ 대기열" ${result.items.length?'':'disabled'} aria-label="대기열에 모두 추가">대기열에 모두 추가</button><button id="random-save" data-quick-label="♫ 플리저장" ${result.items.length?'':'disabled'} aria-label="플레이리스트에 저장">플레이리스트에 저장</button></div></div>`;
  if(artist&&effectiveView==='library')html+=`<nav class="category-filter" aria-label="앨범 분류"><button data-category="" aria-pressed="${!category}">전체</button>${categories.map(c=>`<button data-category="${esc(c)}" aria-pressed="${c===category}">${esc(c)}</button>`).join('')}</nav>`;
  if(artist&&state.categories_ready===false)html+='<p class="hint">NAS 폴더 기준으로 분류를 갱신 중입니다. 기존 목록은 계속 이용할 수 있습니다.</p>';
  if(view==='random'){
   html+=`<div class="random-grid">${result.items.map(t=>`<article class="random-track"><button class="random-song-card" ${isApprovedMember()?`data-random-track="${esc(t.album_id)}:${t.track_index}" data-search-play="${esc(t.album_id)}" data-song-index="${t.track_index}" aria-label="${esc(t.title)} 재생. 빠르게 두 번 터치하면 대기열에 추가"`:`data-open="${esc(t.album_id)}" aria-label="${esc(t.title)} · 앨범 상세"`}>${cover({id:t.album_id,title:t.album_title,artist:t.artist})}<strong title="${esc(t.title)}">${esc(t.title)}</strong></button><div class="random-track-info">${t.artist?`<span title="${esc(t.artist)}">${esc(t.artist)}</span>`:''}${t.album_title?`<span title="${esc(t.album_title)}">${esc(t.album_title)}</span>`:''}</div></article>`).join('')}</div>`;
  }else if(effectiveView==='tracks'){
   html+=`<div class="song-search-results"><div class="search-heading"><span></span><span>곡명</span><span>앨범</span><span>아티스트</span><span></span></div>${result.items.map(t=>`<article class="search-song"><button class="search-cover" data-open="${esc(t.album_id)}" aria-label="${esc(t.album_title)} 상세">${cover({id:t.album_id,title:t.album_title,artist:t.artist})}</button><span class="search-title">${searchField(t.title,$('#search').value)}</span><button class="search-text" data-open="${esc(t.album_id)}">${searchField(t.album_title,$('#search').value)}</button><button class="search-text" data-index-artist="${esc(t.artist)}">${searchField(t.artist,$('#search').value)}</button><div class="search-actions"><button data-search-play="${esc(t.album_id)}" data-song-index="${t.track_index}">▶ 재생</button><button data-search-queue="${esc(t.album_id)}" data-song-index="${t.track_index}">＋ 대기열</button><button data-search-list="${esc(t.album_id)}" data-song-index="${t.track_index}">＋ 목록</button><button data-search-download="${esc(t.album_id)}" data-song-index="${t.track_index}">↓ 받기</button></div></article>`).join('')}</div>`;
  }else if(view==='artists'){
   html+=`<div class="artist-index-heading"><div class="artist-index-summary"><h1>Artist</h1><p>${result.total.toLocaleString()}명의 아티스트 · ${page} / ${Math.max(1,Math.ceil(result.total/result.size))} 페이지</p></div><div data-artist-gallery-tools></div></div>`;
   html+=`<div class="artist-index"><button data-letter="">전체</button>${letters.map(l=>`<button data-letter="${esc(l)}" aria-pressed="${l===letter}">${esc(l)}</button>`).join('')}</div>`;
   html+='<div data-artist-gallery-list>';
   let previous='';for(const a of result.items){if(a.initial!==previous){if(previous)html+='</ul></section>';html+=`<section class="artist-section"><h2>${esc(a.initial)}</h2><ul>`;previous=a.initial;}
    html+=`<li><button class="artist-link" data-index-artist="${esc(a.name)}">${esc(a.name)}</button><span>${a.count}개 앨범</span><span class="artist-genre">${esc(a.genre)}</span>${repo.admin?`<button data-genre="${esc(a.name)}">장르 수정</button>`:''}</li>`;}
   if(previous)html+='</ul></section>';
   html+='</div>';
  }else{
   if(view==='duplicates')html+='<p class="hint">아티스트와 제목이 같은 비교 후보입니다. 동일 음원으로 확정한 결과가 아닙니다.</p>';
   html+=`<div class="grid">${result.items.map(a=>`<article class="album"><button class="album-open" data-open="${esc(a.id)}" aria-label="${esc(a.title)} 상세">${cover(a)}<h3 title="${esc(a.title)}">${esc(a.title)}</h3></button><button class="artist-name album-artist-link" data-index-artist="${esc(a.artist)}" aria-label="${esc(a.artist)} 전체 앨범 보기">${esc(a.artist)}</button><div class="album-info-row"><span>${esc(albumReleaseDate(a)||'연도 미확인')}</span><span>${esc(a.category||'미확인')}</span></div><div class="album-info-row"><span class="album-card-genre" title="${esc(a.genre||'미분류')}">${esc(a.genre||'미분류')}</span><span class="album-card-quality">${esc(formatLabel(a))}</span></div></article>`).join('')}</div>`;
  }
  if(!result.items.length)html+='<p class="empty">해당 목록이 없습니다. 색인 상태 또는 검색 조건을 확인하세요.</p>';
  // Commit view styles with their content to keep the old grid stable while loading.
  listToolbar.beforeRender();
  document.body.classList.toggle('home-view',view==='home');
  arrangeHomeSummary(view==='home',$('#result-count'),document.querySelector('main .toolbar'),document.querySelector('main .results-line'));
  document.body.classList.toggle('random-view',view==='random');
  $('#sort').hidden=view==='home'||view==='random';
  $('#random-redraw').hidden=view!=='random';
  disposeArtistGallery();
  const resultStamp=String(Date.now())+':'+String(Boolean(result.partial));
  $('#content').dataset.artistResult=resultStamp;$('#content').innerHTML=html;bindCovers($('#content'));
  const galleryManagement=repo.admin&&isApprovedMember()&&(view==='artists'?artistProfileManager.enabled():(artist&&view==='library')&&await artistProfileManager.verify())?artistProfileManager:null;
  if(view==='artists'){
   mountArtistGallery($('#content'),result.items,browseArtist,galleryManagement);
   if(repo.admin&&isApprovedMember()&&!galleryManagement)void (artistPermissionCheck ||= artistProfileManager.verify()).then(ok=>{
    if(ok&&token===generation&&$('#content').dataset.artistResult===resultStamp&&view==='artists'&&$('#content').querySelector('[data-artist-gallery-tools]')){
     // Photo management must not delay list bindings; reuse the mounted view.
     disposeArtistGallery();mountArtistGallery($('#content'),result.items,browseArtist,artistProfileManager);
    }
   });
  }
  if(artist&&view==='library'){const profileArtist=artist;void mountArtistHome($('#artist-home-host'),{name:artist,albums:result.items,total:result.total,canManage:()=>repo.admin&&isApprovedMember(),onArtist:browseArtist,photoManagement:galleryManagement,loadArtistInfo:async()=>{const r=await api('/v2/albums?'+new URLSearchParams({view:'artists',artist:profileArtist,page:'1'}));return r.items?.find(row=>row.name===profileArtist);}});}
  listToolbar.update(view==='home'?'home':view==='random'?'random':view==='library'&&!artist&&effectiveView==='library'?'library':'',view==='random'?$('#content .random-actions'):null);
  if(view==='home')fitTodayCovers();
  if(view==='random'){
   const items=randomQueueItems;
   $('#random-play').onclick=action(async()=>{const p=getPlayer(),start=p.items.length;p.add(items);await p.play(start);});
   $('#random-queue').onclick=()=>{getPlayer().add(items);toast(`${items.length}곡을 대기열에 추가했습니다.`);};
   $('#random-save').onclick=()=>window.dispatchEvent(new CustomEvent('save-playlist-tracks',{detail:items}));
   $('#random-download').onclick=action(async()=>{await currentMemberToken();const {downloadRandomTracks}=await import('./random-download.js');downloadRandomTracks(items,{base:NAS_URL,token:currentMemberToken,invalidate:invalidateMemberAccess});});
  }
  $('#pagination').innerHTML=result.pages>1?`<button id="previous-page" ${page===1?'disabled':''}>이전</button><span>${page} / ${result.pages} 페이지</span><button id="next-page" ${page===result.pages?'disabled':''}>다음</button>`:'';
  for(const [id,step] of [['previous-page',-1],['next-page',1]])if($('#'+id))$('#'+id).onclick=()=>{page+=step;render(true);};
  $('#content').querySelectorAll('[data-search-download]').forEach(b=>b.onclick=action(()=>detail(b.dataset.searchDownload,Number(b.dataset.songIndex),'download')));
  $('#content').querySelectorAll('[data-search-queue],[data-search-list]').forEach(b=>b.onclick=action(async()=>{const album=await api('/v2/album?id='+encodeURIComponent(b.dataset.searchQueue||b.dataset.searchList));const item=describeTrack(album,Number(b.dataset.songIndex));if(b.dataset.searchList)window.dispatchEvent(new CustomEvent('save-playlist-tracks',{detail:[item]}));else{getPlayer().add([item]);toast('대기열에 추가했습니다.');}}));
  bindRandomTrackActions($('#content'),{isMobile:()=>window.matchMedia('(max-width:740px)').matches,play:b=>{void (async()=>{try{const album=await api('/v2/album?id='+encodeURIComponent(b.dataset.searchPlay));await playItem(describeTrack(album,Number(b.dataset.songIndex)));const p=getPlayer();if(p.failure)toast(p.message||'음원 재생을 시작하지 못했습니다.');}catch(error){toast(error.message);}})();},queue:b=>{const item=randomQueueItems.find(t=>t.album_id===b.dataset.searchPlay&&t.index===Number(b.dataset.songIndex));if(!item){toast('곡 정보를 불러오지 못했습니다. 목록을 새로고침해 주세요.');return;}const player=getPlayer();player.add([item]);toast(`대기열에 추가했습니다. (${player.items.length}곡)`);}});
  $('#content').querySelectorAll('[data-search-play]:not([data-random-track])').forEach(b=>b.onclick=action(async()=>{const album=await api('/v2/album?id='+encodeURIComponent(b.dataset.searchPlay));await playItem(describeTrack(album,Number(b.dataset.songIndex)));}));
  $('#content').querySelectorAll('[data-open]').forEach(b=>b.onclick=action(()=>detail(b.dataset.open)));
  $('#content').querySelectorAll('[data-index-artist]').forEach(b=>b.onclick=()=>browseArtist(b.dataset.indexArtist));
  $('#content').querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;page=1;render(true);});
  $('#content').querySelectorAll('[data-letter]').forEach(b=>b.onclick=async()=>{const left=b.parentElement.scrollLeft;letter=b.dataset.letter;page=1;await render(true);const strip=$('#content .artist-index');if(strip){strip.scrollLeft=left;const selected=[...strip.querySelectorAll('[data-letter]')].find(item=>item.dataset.letter===letter);if(selected){const r=selected.getBoundingClientRect(),s=strip.getBoundingClientRect();if(r.left<s.left)strip.scrollLeft-=s.left-r.left;else if(r.right>s.right)strip.scrollLeft+=r.right-s.right;}}});
  $('#content').querySelectorAll('[data-genre]').forEach(b=>b.onclick=()=>artistGenre(b.dataset.genre));
  if(artistTransition&&pendingArtistTransition===artistTransition){
   closeAlbumPage();
   navigation?.record(navigationState());
  }
  if(result.partial)$('#result-count').textContent=`${result.total.toLocaleString()}명의 아티스트 · 전체 목록 불러오는 중…`;
  if(resetScroll)resetPageScroll();
  };
  const result=await catalog(params,first=>{void applyResult(first).catch(()=>{});});
  await applyResult(result);
 }catch(e){if(token===generation){
  if(artistTransition&&pendingArtistTransition===artistTransition){
   const origin=artistTransition.origin;
   pendingArtistTransition=null;
   view=origin.view;page=origin.page;artist=origin.artist;letter=origin.letter;category=origin.category;activePanel=origin.panel;
   for(const id of ['search','genre','format','sort'])$('#'+id).value=origin[id];
   savePage();
  }else $('#notice').textContent='목록을 조회하지 못했습니다. 메뉴를 다시 선택해 주세요.';
  toast(e.message);
 }}
}
async function detail(id,playIndex=null,trackAction='play',fromHistory=false){
 if(!canReadAlbumMetadata(albumAccessSnapshot(),publicBrowseEnabled()))throw Error('로그인한 계정의 승인 상태를 확인해 주세요.');
 if(!fromHistory)navigationGeneration++;
 const requestGeneration=++albumRequestGeneration;
 const a=await api((repo.admin?'/v2/admin-album':'/v2/album')+'?id='+encodeURIComponent(id),{admin:repo.admin});
 if(requestGeneration!==albumRequestGeneration)return;
 if(a.id!==id)throw Error('요청한 앨범 정보를 확인하지 못했습니다.');
 const trackLayout=discTrackLayout(a.tracks||[]);
 albumPageLayout(`<div class="detail-top">${cover(a)}<div><p class="album-eyebrow">ALBUM ARCHIVE</p><p>${typeof a.artist==='string'&&a.artist.trim()?`<button type="button" class="album-artist-detail-link" data-detail-artist aria-label="${esc(a.artist)} 전체 앨범 보기">${esc(a.artist)}</button>`:esc(a.artist)}</p><h2>${esc(a.title)}</h2>${albumFacts(a)}${a.missing?'<p class="error">색인된 파일을 찾을 수 없습니다. 폴더 색인을 실행해 주세요.</p>':''}<div class="album-share-actions"><button type="button" data-album-share>공유</button></div>${repo.admin?'<div class="actions"><button id="edit-index">정보 수정</button><button id="review-index">확인 상태 변경</button></div>':''}</div></div>${mediaPanel(repo.admin)}<h3>트랙 · ${(a.tracks||[]).length}개</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>곡명</th><th>길이</th><th>형식</th><th>가사</th>${isApprovedMember()?'<th>재생</th><th>대기열</th><th>목록</th><th>다운로드</th>':''}</tr></thead><tbody>${trackLayout.rows.map(({track:t,index:i,disc,number,header})=>`${header?`<tr class="album-disc-heading"><td colspan="${isApprovedMember()?9:5}" style="border-top:1px solid #e6e0d6;font-weight:400;font-size:12px;padding:10px 8px 5px">CD${disc}</td></tr>`:''}<tr><td>${esc(number)}</td><td class="album-track-title" title="${esc(t.title||t.filename)}"><span class="desktop-track-title">${esc(t.title||t.filename)}</span><div class="mobile-track-line"><span class="guest-track-title">${esc(t.title||t.filename)}</span><button type="button" class="mobile-track-title-play" data-mobile-track-play="${i}" aria-label="${esc(t.title||t.filename)} 재생">${esc(t.title||t.filename)}</button><details class="mobile-track-more"><summary aria-label="${esc(t.title||t.filename)} 추가 기능">⋯</summary><div class="mobile-track-menu"><button type="button" data-mobile-track-action="lyrics" aria-label="가사 보기" data-mobile-track-index="${i}">가사 보기</button><button type="button" data-mobile-track-action="play" aria-label="재생" data-mobile-track-index="${i}">재생</button><button type="button" data-mobile-track-action="queue" aria-label="대기열에 추가" data-mobile-track-index="${i}">대기열에 추가</button><button type="button" data-mobile-track-action="playlist" aria-label="플레이리스트에 저장" data-mobile-track-index="${i}">플레이리스트에 저장</button><button type="button" data-mobile-track-action="download" aria-label="받기" data-mobile-track-index="${i}">받기</button></div></details></div><span class="mobile-track-meta">${t.duration?Math.floor(t.duration/60)+':'+String(Math.floor(t.duration%60)).padStart(2,'0'):'—'} · ${esc(formatLabel(t,a))}</span></td><td>${t.duration?Math.floor(t.duration/60)+':'+String(Math.floor(t.duration%60)).padStart(2,'0'):'—'}</td><td>${esc(formatLabel(t,a))}</td>${trackActions(i,isApprovedMember())}</tr>`).join('')}</tbody></table></div>${repo.admin?`<h3>출처와 부속 자료</h3><pre>${esc(JSON.stringify(a.sources||[],null,2))}</pre><details><summary>스캔 원본 정보</summary><pre>${esc(JSON.stringify(a.raw_tags||{},null,2))}</pre></details><div class="actions"><a target="_blank" rel="noopener" href="https://www.discogs.com/search/?q=${encodeURIComponent(a.artist+' '+a.title)}&type=release">발매 정보 찾기 ↗</a><button id="hide-index" class="danger">서재에서 숨기기</button></div><section class="album-admin-records"><h3>개인 기록</h3><p>${esc(a.notes||'메모 없음')}</p><h3>보관 위치</h3><p class="path">${esc(a.relative_path)}</p></section>`:''}`);
 bindCovers(albumPage);bindMedia(repo,a,trackLayout.rows.map(row=>row.index),isApprovedMember());attachArtwork(albumPage,a.id);bindAlbumShare(albumPage,a);
 const artistLink=albumPage.querySelector('[data-detail-artist]');if(artistLink)artistLink.onclick=()=>browseArtist(a.artist);
 pendingSharedAlbumId='';
 activeAlbumId=a.id;refreshCatalogNavigation();activePanel='';if(!fromHistory)navigation?.record(navigationState());
 // Mobile controls delegate to existing desktop actions; playback logic remains shared.
 const trackHost=albumPage;
 bindAlbumTrackTaps(trackHost,{play:button=>trackHost.querySelector('[data-track-action="play"][data-track-index="'+button.dataset.mobileTrackPlay+'"]')?.click(),queue:button=>trackHost.querySelector('[data-track-action="queue"][data-track-index="'+button.dataset.mobileTrackPlay+'"]')?.click()});
 albumPage.querySelectorAll('[data-mobile-track-action]').forEach(button=>{
  button.onclick=e=>{
   e?.preventDefault();e?.stopPropagation();
   const action=button.dataset.mobileTrackAction,index=button.dataset.mobileTrackIndex;
   const details=button.closest('details');if(details)details.open=false;
   albumPage.querySelector('[data-track-action="'+action+'"][data-track-index="'+index+'"]')?.click();
  };
 });
 albumPage.querySelectorAll('.mobile-track-more').forEach(details=>{
  // Keep native summary toggling, keyboard activation and scrolling intact.
  for(const type of ['pointerdown','click'])details.addEventListener(type,e=>e.stopPropagation());
  details.addEventListener('toggle',()=>{
   if(!details.open)return;
   albumPage.querySelectorAll('.mobile-track-more[open]').forEach(other=>{if(other!==details)other.open=false;});
  });
 });
 const coverImg=albumPage.querySelector('.detail-top .cover img');
 if(coverImg){coverImg.classList.add('album-cover-zoom');coverImg.setAttribute('role','button');coverImg.tabIndex=0;coverImg.title='앨범 표지 확대';const zoom=()=>openAlbumCover(a.id,coverImg.src);coverImg.onclick=zoom;coverImg.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();zoom();}};}
 if(Number.isInteger(playIndex))albumPage.querySelector(`[data-track-action="${trackAction}"][data-track-index="${playIndex}"]`)?.click();
 if(repo.admin){$('#edit-index').onclick=()=>edit(a);$('#review-index').onclick=action(async()=>{await api('/v2/edit',{admin:true,body:{id:a.id,fields:{reviewed:!a.reviewed}}});detail(a.id);render();});$('#hide-index').onclick=()=>{modal('서재에서 숨기기','<p>음악 파일과 개인 기록은 보존됩니다. 목록에서만 숨깁니다.</p><button id="confirm-hide">숨기기</button>');$('#confirm-hide').onclick=action(async()=>{await api('/v2/hide',{admin:true,body:{id:a.id}});$('#dialog').close();closeAlbumPage();render();});};}
 polishAlbumHeader(albumPage,a);
 mountAlbumReference(albumPage,a,trackLayout.rows,{player:getPlayer(),onQueue:isApprovedMember()?()=>getPlayer().add(trackLayout.rows.map(row=>describeTrack(a,row.index))):null,onPlaylist:isApprovedMember()?()=>window.dispatchEvent(new CustomEvent('save-playlist-tracks',{detail:trackLayout.rows.map(row=>describeTrack(a,row.index))})):null});
}
function openAlbumCover(albumId,fallback){
 const viewer=document.createElement('div');
 viewer.className='album-cover-viewer';
 viewer.setAttribute('role','dialog');viewer.setAttribute('aria-modal','true');
 viewer.setAttribute('aria-label','앨범 표지 확대 보기');
 viewer.innerHTML='<button class="album-cover-close" type="button" aria-label="닫기">×</button><img alt="확대된 앨범 표지"><p class="album-cover-status" role="status">원본 이미지 불러오는 중…</p>';
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
 loadMemberImage(img,original,{preserveSource:true}).then(()=>{if(viewer.isConnected)viewer.querySelector('.album-cover-status').textContent='원본 이미지';}).catch(()=>{if(viewer.isConnected)viewer.querySelector('.album-cover-status').textContent='원본을 불러오지 못했습니다. 현재 이미지는 미리보기입니다.';});
 const previous=document.activeElement;
 const owner=albumPage;
 const dismiss=()=>{document.removeEventListener('keydown',keyboard,true);owner?.removeEventListener('album-page-close',dismiss);clearMemberImage(img);viewer.remove();previous?.focus?.();};
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
 repo.requireAdmin();modal('NAS 폴더 색인',indexingPanel());
 mountIndexing({dialog:$('#dialog'),api,canManage:()=>repo.admin&&isApprovedMember(),letters,toast});
}

$('#genre').innerHTML='<option value="">모든 장르</option>'+GENRES.map(g=>`<option>${esc(g)}</option>`).join('');
$('#search').oninput=()=>{catalogRequests.cancel();generation++;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(view!=='artists'){view='library';artist=letter=category='';}else{letter='';}page=1;render(true);},250);};
for(const id of ['genre','format','sort'])$('#'+id).onchange=()=>{page=1;render(true);};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{closeAlbumPage();clearTimeout(searchTimer);view=b.dataset.view;artist=letter=category='';$('#search').value='';page=1;render(true);});
$('.brand').onclick=e=>{e.preventDefault();closeAlbumPage();clearTimeout(searchTimer);view='home';artist=letter=category='';page=1;for(const id of ['search','genre','format'])$('#'+id).value='';$('#sort').value='artist';$('#dialog').close();render(true);};
async function openAdminCenter(){
 repo.requireAdmin();if(!isApprovedMember())throw Error('승인된 관리자만 사용할 수 있습니다.');
 mountAdminCenter({canManage:()=>repo.admin&&isApprovedMember(),getAccessToken:currentMemberToken,
  openMembers:async()=>openMemberManagement(await currentMemberToken()),
  openIndexing:async()=>{closeAdminCenter();await indexing();},openPlaybackDiagnostics:()=>{closeAdminCenter();openPlaybackDiagnostics();},api:(path,options)=>api(path,options)});
}
adminNav.onclick=action(openAdminCenter);
$('#settings').onclick=openAccount;$('#import').onclick=action(indexing);$('#export').onclick=action(indexing);$('#random-redraw').onclick=()=>{randomSeed=crypto.randomUUID();randomResults.clear();try{sessionStorage.setItem('vinyl-random-seed',randomSeed);}catch{}navigationGeneration++;navigation?.record(navigationState());render();};
const gate=document.getElementById('vinyl-auth-gate');
gate.id='vinyl-auth-gate';
gate.setAttribute('aria-label','회원 전용 음악 서재');
gate.innerHTML='<div class="vinyl-auth-gate-card"><svg class="brand-icon" viewBox="0 0 38 38" width="38" height="38" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="6" width="34" height="27" rx="3" stroke="currentColor" stroke-width="1.6"/><circle cx="15" cy="19.5" r="9" stroke="currentColor" stroke-width="1.5"/><circle cx="15" cy="19.5" r="6.5" stroke="currentColor" stroke-width=".8" opacity=".55"/><circle cx="15" cy="19.5" r="2.6" fill="currentColor"/><circle cx="30" cy="11" r="1.8" fill="currentColor"/><path d="M30 13v9l-5 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="m24 25-2 2" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M6 29h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><p class="vinyl-auth-brand">VINYL ROOM</p><h1>회원 전용 음악 서재</h1><p class="vinyl-auth-description">관리자 승인을 받은 회원만 앨범과 음악을 이용할 수 있습니다.</p><div class="vinyl-auth-actions"><button type="button" id="vinyl-auth-open">로그인</button><button type="button" id="vinyl-auth-signup">회원가입</button></div><small>가입 신청 후 이메일 인증과 관리자 승인이 필요합니다.</small></div>';

gate.querySelector('#vinyl-auth-open').onclick=openAccount;
gate.querySelector('#vinyl-auth-signup').onclick=signupRequest;
await initializeBrowse();
// Do not start an expensive 24-page Artist crawl on every page load.
// The first Artist navigation fills a revision-checked persisted cache.
installMemberPrompts(isApprovedMember,openAccount);
restorePage();
navigation=createNavigationHistory({window,onNavigate:applyNavigation,onError:toast,urlForSnapshot:state=>albumHistoryPath(window.location.href,state.album)});
const initialAlbumRoute=albumShareRoute(window.location.href);
let restoredNavigation=navigation.current();
if(initialAlbumRoute.kind==='album'){pendingSharedAlbumId=initialAlbumRoute.id;restoredNavigation=navigationSnapshot({...restoredNavigation||navigationState(),view:'library',page:1,album:initialAlbumRoute.id,panel:''});navigation.replace(restoredNavigation);}
else if(initialAlbumRoute.kind==='invalid'){restoredNavigation=null;navigation.replace({...navigationState(),album:''});}
if(!restoredNavigation)navigation.replace(navigationState());
const playlistButton=$('#my-playlists');
if(playlistButton)playlistButton.onclick=e=>{if(isApprovedMember()){activePanel='playlist';navigationGeneration++;navigation.record(navigationState());}return originalPlaylistClick?.(e);};
$('#personal-dialog')?.addEventListener('close',()=>{if(activePanel==='playlist'){activePanel='';if(navigation.current()?.panel==='playlist')navigation.back();}});
if('scrollRestoration' in window.history)window.history.scrollRestoration='manual';
resetPageScroll();

try{
if(restoredNavigation&&(isApprovedMember()||publicBrowseEnabled()))await applyNavigation(restoredNavigation);
else if(isApprovedMember())await render(true);
else if(publicBrowseEnabled())await render(true);
else document.body.classList.add('vinyl-auth-locked');
}catch{const message='공유한 앨범을 불러올 수 없습니다. 삭제·숨김 여부, 계정 승인 및 연결 상태를 확인해 주세요.';$('#notice').textContent=message;toast(message);}
if(initialAlbumRoute.kind==='invalid'){const message='잘못된 앨범 공유 링크입니다. 앨범 목록에서 다시 선택해 주세요.';$('#notice').textContent=message;toast(message);}
// A shared guest detail must not remain open after signing into an unapproved account.
let lastMetadataAllowed=canReadAlbumMetadata(albumAccessSnapshot(),publicBrowseEnabled());
window.addEventListener('vinyl-account-change',()=>{
 const allowed=canReadAlbumMetadata(albumAccessSnapshot(),publicBrowseEnabled()),wasAllowed=lastMetadataAllowed;lastMetadataAllowed=allowed;
 if(!allowed){
  catalogRequests.cancel();generation++;navigationGeneration++;clearTimeout(searchTimer);
  if(albumPage){pendingSharedAlbumId=activeAlbumId;closeAlbumPage();}
  listToolbar.beforeRender();$('#content').replaceChildren();$('#stats').replaceChildren();$('#pagination').replaceChildren();
  randomResults.clear();closeAdminCenter();
  document.querySelectorAll('.artwork-viewer,.album-cover-viewer').forEach(node=>node.remove());
 }else if(!wasAllowed&&!isApprovedMember()){
  void render(true);
  if(pendingSharedAlbumId&&albumShareRoute(window.location.href).id===pendingSharedAlbumId)void detail(pendingSharedAlbumId,null,'play',true).catch(()=>toast('공유한 앨범을 불러오지 못했습니다.'));
 }
});
let lastApprovedState=isApprovedMember();
window.addEventListener('vinyl-approval-change',()=>{
 const enabled=isApprovedMember();
 if(enabled===lastApprovedState)return;
 lastApprovedState=enabled;
 
 if(enabled){render();if(albumPage&&activeAlbumId)void detail(activeAlbumId,null,'play',true).catch(error=>toast(error.message));else if(pendingSharedAlbumId&&albumShareRoute(window.location.href).id===pendingSharedAlbumId)void detail(pendingSharedAlbumId,null,'play',true).catch(()=>toast('공유한 앨범을 불러오지 못했습니다.'));}
 else {catalogRequests.cancel();generation++;listToolbar.beforeRender();$('#content').replaceChildren();const modeLabel=$('#mode-label');if(modeLabel)document.querySelector('.sidebar .side-bottom').append(modeLabel);$('#stats').replaceChildren();$('#pagination').replaceChildren();closeAlbumPage();getPlayer().clear();document.querySelectorAll('.artwork-viewer,.album-cover-viewer,.vinyl-members-dialog').forEach(node=>node.remove());if(document.documentElement?.dataset?.vinylBrowse==='true')render();}
});
if(!isApprovedMember()&&publicBrowseEnabled())getPlayer().clear();
finishAccessInitialization(isApprovedMember());







// Geometry-only updates; never render the album list on player or viewport changes.
let todayFitFrame=0;
function scheduleTodayFit(){cancelAnimationFrame(todayFitFrame);todayFitFrame=requestAnimationFrame(()=>fitTodayCovers());}
window.addEventListener('resize',scheduleTodayFit);
document.fonts?.ready.then(scheduleTodayFit);
document.fonts?.addEventListener('loadingdone',scheduleTodayFit);
