import {loadArtistProfiles,normalizeArtist,profileFor,sameOriginAssetBase,openArtistImageViewer,previousArtistProfile} from './artist-image-core.js';

// Explicit UI integration contract: caller supplies the currently filtered artist list.
// Original list DOM is never rewritten; toolbar and grid are the only inserted elements.
export function mountArtistIndexGallery({toolbarTarget,listTarget,artists=[],manifestUrl,assetBaseUrl,
  openArtist, initialView='list',isAdmin=()=>false,onManage=null,openViewer=null,pageSize=60}) {
  if(!(toolbarTarget instanceof Element)||!(listTarget instanceof Element))throw Error('artist_gallery_invalid_targets');
  if(typeof openArtist!=='function')throw Error('artist_gallery_requires_openArtist');
  if(!['grid','list'].includes(initialView))throw Error('artist_gallery_invalid_view');
  const host=document.createElement('div');host.className='vr-ae-toolbar';
  host.setAttribute('aria-label','아티스트 보기 방식');
  const listButton=document.createElement('button'),gridButton=document.createElement('button');
  listButton.type=gridButton.type='button';listButton.textContent='☷  목록';gridButton.textContent='▦  사진';
  listButton.className=gridButton.className='vr-ae-switch';
  for(const b of [listButton,gridButton]){const face=document.createElement('span');face.className='vr-ae-switch-face';face.textContent=b.textContent;b.replaceChildren(face);}
  listButton.setAttribute('aria-label','목록 보기');gridButton.setAttribute('aria-label','사진 보기');
  host.append(listButton,gridButton);toolbarTarget.append(host);
  const gallery=document.createElement('section');gallery.className='vr-ae-gallery';gallery.setAttribute('aria-label','아티스트 사진 보기');
  const grid=document.createElement('div');grid.className='vr-ae-grid';
  const status=document.createElement('p');status.className='vr-ae-gallery-status';status.setAttribute('role','status');
  const loadMore=document.createElement('button');loadMore.type='button';loadMore.textContent='더 보기';loadMore.className='vr-ae-more';
  gallery.append(status,grid,loadMore);listTarget.insertAdjacentElement('afterend',gallery);
  let currentArtists=[],shown=0,mode='list',profiles=null,fetchAttempted=false,disposed=false;
  let loading=null,manifestFailed=false;
  const countLabel=(n)=>`${n.toLocaleString('ko-KR')}명`;
  function setArtists(next){
    currentArtists=(Array.isArray(next)?next:[]).map(normalizeArtist).filter(Boolean);
    if(mode==='grid')render(true);
  }
  function createCard(artist){
    let entry=profileFor(profiles,artist.key);
    const card=document.createElement('article');card.className='vr-ae-card';
    const portrait=document.createElement('button');portrait.type='button';portrait.className='vr-ae-card-image';
    portrait.setAttribute('aria-label',entry?`${artist.name} 사진 확대`:`${artist.name} 아티스트 홈`);
    if(entry){
      const img=document.createElement('img');const root=sameOriginAssetBase(entry.assetBaseUrl||assetBaseUrl);
      img.src=new URL(entry.thumb,root).href;img.alt='';img.loading='lazy';img.decoding='async';
      img.addEventListener('error',async()=>{
        const older=await previousArtistProfile(artist.key);
        if(older&&(older.thumb!==entry.thumb||older.assetBaseUrl!==entry.assetBaseUrl)){
          entry=older;img.src=new URL(older.thumb,sameOriginAssetBase(older.assetBaseUrl)).href;return;
        }
        portrait.classList.add('vr-ae-card-placeholder');portrait.replaceChildren(makePlaceholder());
      });
      portrait.append(img);
      portrait.addEventListener('click',()=>{if(typeof openViewer==='function')openViewer({entry,artistKey:artist.key,artistName:artist.name});else openArtistImageViewer({entry,assetBaseUrl,title:artist.name});});
    }else{
      portrait.classList.add('vr-ae-card-placeholder');portrait.append(makePlaceholder());
      portrait.addEventListener('click',()=>openArtist(artist));
    }
    const name=document.createElement('button');name.type='button';name.className='vr-ae-card-name';name.textContent=artist.name;name.title=artist.name;
    name.addEventListener('click',()=>openArtist(artist));
    const meta=document.createElement('span');meta.className='vr-ae-card-meta';
    meta.textContent=[artist.genre,artist.albumCount===null?'':`${artist.albumCount.toLocaleString('ko-KR')}개 앨범`].filter(Boolean).join(' · ');
    card.append(portrait,name,meta);
    return card;
  }
  function makePlaceholder(){const i=document.createElement('span');i.className='vr-ae-placeholder-icon';i.textContent='♫';i.setAttribute('aria-hidden','true');return i;}
  function appendPage(){
    const until=Math.min(currentArtists.length,shown+pageSize);
    const frag=document.createDocumentFragment();for(let i=shown;i<until;i++)frag.append(createCard(currentArtists[i]));
    grid.append(frag);shown=until;
    loadMore.hidden=shown>=currentArtists.length;
    status.textContent=manifestFailed?`${countLabel(currentArtists.length)} · 사진 라이브러리가 아직 연결되지 않았습니다. 기본 카드로 표시합니다.`:`${countLabel(currentArtists.length)} · 사진이 없는 아티스트도 표시됩니다`;
  }
  function render(reset){if(reset){grid.replaceChildren();shown=0;}appendPage();}
  async function ensureManifest(){
    if(fetchAttempted)return;
    if(loading)return loading;
    loading=loadArtistProfiles(manifestUrl).then(value=>{profiles=value;fetchAttempted=true;})
      .catch(()=>{profiles={};manifestFailed=true;fetchAttempted=true;}).finally(()=>{loading=null;});
    return loading;
  }
  function updateControls(){
    listTarget.hidden=mode==='grid';gallery.hidden=mode!=='grid';
    listButton.setAttribute('aria-pressed',String(mode==='list'));gridButton.setAttribute('aria-pressed',String(mode==='grid'));
    listButton.classList.toggle('vr-ae-selected',mode==='list');gridButton.classList.toggle('vr-ae-selected',mode==='grid');
  }
  async function setView(next){
    if(disposed || !['list','grid'].includes(next))return;
    mode=next;updateControls();
    if(mode==='grid'){
      if(!fetchAttempted){render(true);status.textContent='사진 라이브러리 불러오는 중…';}
      await ensureManifest();if(disposed||mode!=='grid')return;
      render(true);
    }
  }
  listButton.addEventListener('click',()=>{void setView('list');});
  gridButton.addEventListener('click',()=>{void setView('grid');});
  loadMore.addEventListener('click',()=>appendPage());
  setArtists(artists);void setView(initialView);
  return {updateArtists:setArtists,setView,refreshPermissions:()=>{if(mode==='grid')render(true);},getView:()=>mode,
    dispose:()=>{disposed=true;listTarget.hidden=false;host.remove();gallery.remove();}};
}
