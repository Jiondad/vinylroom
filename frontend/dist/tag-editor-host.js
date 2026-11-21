import {coverMemberImage,clearMemberImage} from './member-images.js';
// Administrator-only read adapter. Uses existing authenticated API; no tokens cross the frame.
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const norm=s=>String(s||'').normalize('NFKC').trim().toLocaleLowerCase();
const list=v=>Array.isArray(v)?v.map(String):v==null?[]:[String(v)];
export function indexedTagAlbum(a,id){
 if(a?.id!==id||a.missing||a.hidden)throw Error('활성 앨범 식별을 확인할 수 없습니다.');
 const files=a.physical_files;
 if(!Array.isArray(files)||!files.length)throw Error('RAW_TAGS_UNAVAILABLE: 파일별 원본 태그 색인이 없습니다. Catalog 표시값을 태그로 대체하지 않습니다.');
 const entries=files.map(f=>{
  if(!f.raw_tags||typeof f.raw_tags!=='object'||f.error||f.read_error)throw Error('RAW_TAGS_UNAVAILABLE: 읽기 오류 또는 태그 색인 누락');
  const raw=Object.fromEntries(Object.entries(f.raw_tags).map(([k,v])=>[k.toLowerCase(),v]));
  const aliases={title:['title'],artist:['artist'],featuring:['featuring'],genre:['genre'],album:['album'],album_artist:['albumartist','album artist'],date:['date'],tracknumber:['tracknumber'],discnumber:['discnumber']};
  const tags=Object.fromEntries(Object.entries(aliases).map(([k,names])=>[k,list(raw[names.find(n=>raw[n]!=null)])]));
  const file=f.path||[a.relative_path,f.subfolder,f.filename].filter(Boolean).join('/');
  if(typeof file!=='string'||!file)throw Error('파일 식별 경로가 없습니다.');
  return {file,size:f.size||0,mtime_ns:f.mtime_ns||0,tags};
 });
 if(new Set(entries.map(e=>e.file)).size!==entries.length)throw Error('중복 파일 식별값을 확인하세요.');
 if(entries.length>120)throw Error('현재 미리보기는 앨범당 120개 실제 파일까지 지원합니다.');
 return {id,artist:a.artist,title:a.title,date:a.original_year||a.release_year||'',path:a.relative_path||'',count:entries.length,entries,source:'NAS_INDEX_READ_ONLY'};
}
export function createTagReader({api,canManage,signal}){
 const albums=new Set(),folders=new Set(['']),artists=new Set();
 const check=()=>{if(signal?.aborted||!canManage())throw Error('관리자 인증이 필요합니다.');};
 async function get(path){check();const r=await api(path,{admin:true,signal});check();return r;}
 return async url=>{
  check();const u=new URL(url,'https://tag.invalid');
  if(u.origin!=='https://tag.invalid')throw Error('허용되지 않은 조회');
  if(u.pathname==='/api/folders'){
   const path=u.searchParams.get('path')||'';if(!folders.has(path))throw Error('먼저 상위 폴더를 선택하세요.');
   const r=await get('/v2/folders?'+new URLSearchParams({path}));
   const items=(r.folders||[]).filter(x=>typeof x.path==='string'&&typeof x.name==='string').map(x=>{folders.add(x.path);return {id:x.path,name:x.name,folder:x.path}});
   return {items};
  }
  if(u.pathname==='/api/artists'){
   const q=(u.searchParams.get('q')||'').trim();if(q.length<1||q.length>100)throw Error('아티스트 검색어를 입력하세요.');
   const r=await get('/v2/albums?'+new URLSearchParams({view:'artists',q,page:'1'}));
   return {items:(r.items||[]).map(x=>{artists.add(x.name);return {id:x.name,name:x.name,folder:'Catalog 아티스트 · 공동 표기 보존',albums:x.count}}),truncated:r.pages>1};
  }
  if(u.pathname==='/api/albums'){
   const artist=u.searchParams.get('artist')||'';let params,folder;
   if(artist.startsWith('folder:')){folder=artist.slice(7);if(!folders.has(folder))throw Error('선택하지 않은 폴더');params={q:folder.split('/')[1]||folder.split('/').pop(),view:'library',page:'1'};}
   else {if(!artists.has(artist))throw Error('먼저 아티스트를 선택하세요.');params={artist,view:'library',page:'1'};}
   const items=[];let page=1,pages=1;
   // Bounded selected-artist lookup; never sweep the library. Existing pagination reused.
   do{
    const r=await get('/v2/albums?'+new URLSearchParams({...params,page:String(page)}));pages=Number(r.pages)||1;
    for(const a of r.items||[]){if(!UUID.test(a.id||''))continue;
     if(folder){const full=await get('/v2/admin-album?'+new URLSearchParams({id:a.id}));if(!(full.relative_path===folder||full.relative_path?.startsWith(folder+'/')))continue;}
     albums.add(a.id);items.push({...a,date:a.original_year||a.release_year||'',count:null});
    }
    page++;
   }while(page<=pages&&page<=4);
   return {items,truncated:pages>4};
  }
  if(u.pathname==='/api/tracks'){
   const id=u.searchParams.get('album');if(!UUID.test(id||'')||!albums.has(id))throw Error('먼저 조회한 앨범을 선택하세요.');
   return {album:indexedTagAlbum(await get('/v2/admin-album?'+new URLSearchParams({id})),id)};
  }
  throw Error('Tag Editor는 지정된 읽기 조회만 허용합니다.');
 };
}
export function mountTagEditor({container,api,canManage}){
 if(!canManage?.())throw Error('승인된 관리자만 이용할 수 있습니다.');
 const controller=new AbortController(),channel=crypto.randomUUID(),frame=document.createElement('iframe');
 frame.title='Tag Editor · NAS 색인 태그 읽기 전용';frame.style.cssText='width:100%;height:78vh;min-height:650px;border:0;border-radius:8px;background:#f5f7f8';frame.referrerPolicy='no-referrer';
 frame.src=new URL('tag-editor-ui.html?v=20261121-1',document.baseURI).href;
 const read=createTagReader({api,canManage:()=>!controller.signal.aborted&&canManage(),signal:controller.signal});let busy=false;
 const origin=location.origin;
 async function message(event){
  if(event.origin!==origin||event.source!==frame.contentWindow)return;
  const m=event.data;if(m?.type==='vr-tag-ready'){if(canManage())frame.contentWindow.postMessage({type:'vr-tag-init',channel},origin);return;}
  if(m?.type==='vr-tag-covers'&&m.channel===channel){if(canManage())for(const img of frame.contentDocument.querySelectorAll('img[data-tag-cover]')){if(UUID.test(img.dataset.tagCover)&&!img.dataset.loading){img.dataset.loading='true';void coverMemberImage(img,img.dataset.tagCover).catch(()=>{img.hidden=true;});}}return;}
  if(m?.type!=='vr-tag-read'||m.channel!==channel||!Number.isSafeInteger(m.id)||typeof m.url!=='string')return;
  if(!canManage()){dispose();return;}
  if(busy){frame.contentWindow.postMessage({type:'vr-tag-result',channel,id:m.id,error:'이전 조회가 완료된 뒤 다시 시도하세요.'},origin);return;}
  busy=true;
  try{const result=await read(m.url);if(!controller.signal.aborted&&canManage())frame.contentWindow.postMessage({type:'vr-tag-result',channel,id:m.id,result},origin);}
  catch(e){if(!controller.signal.aborted)frame.contentWindow.postMessage({type:'vr-tag-result',channel,id:m.id,error:e.message},origin);}
  finally{busy=false;}
 }
 function dispose(){if(controller.signal.aborted)return;controller.abort();for(const img of frame.contentDocument?.querySelectorAll('img[data-tag-cover]')||[])clearMemberImage(img);window.removeEventListener('message',message);frame.contentWindow?.postMessage({type:'vr-tag-revoke'},origin);frame.remove();}
 window.addEventListener('message',message);container.replaceChildren(frame);return {dispose};
}
