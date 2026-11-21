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
  const relative_file=file.startsWith('/music/')?file.slice(7):file.startsWith('/')?null:file;
  return {file,relative_file,size:f.size||0,mtime_ns:f.mtime_ns||0,tags};
 });
 if(new Set(entries.map(e=>e.file)).size!==entries.length)throw Error('중복 파일 식별값을 확인하세요.');
 if(entries.length>120)throw Error('현재 미리보기는 앨범당 120개 실제 파일까지 지원합니다.');
 return {id,artist:a.artist,title:a.title,date:a.original_year||a.release_year||'',path:a.relative_path||'',count:entries.length,entries,source:'NAS_INDEX_READ_ONLY'};
}
export function createTagReader({api,canManage,signal}){
 const coverFiles=new Map(),detailCache=new Map(),inflight=new Map();
 const ttl=30000;
 const remember=(key,value)=>{detailCache.delete(key);detailCache.set(key,{at:Date.now(),value});if(detailCache.size>64)detailCache.delete(detailCache.keys().next().value);return value;};
 const albums=new Set(),folders=new Set(['']),artists=new Set();
 const check=()=>{if(signal?.aborted||!canManage())throw Error('관리자 인증이 필요합니다.');};
 return async (url,body,request={})=>{
  const alive=()=>{check();if(request.signal?.aborted)throw Error('selection_superseded');};
  async function get(path){alive();const started=performance.now();let task=inflight.get(path);if(!task){request.metrics&&(request.metrics.nas_requests++);task=api(path,{admin:true,signal});inflight.set(path,task);task.finally(()=>{if(inflight.get(path)===task)inflight.delete(path);}).catch(()=>{});}
   try{const result=await task;alive();return result;}finally{if(request.metrics)request.metrics.nas_wait_ms+=performance.now()-started;}
  }
  async function detail(id){const found=detailCache.get(id);if(found&&Date.now()-found.at<ttl)return found.value;return remember(id,await get('/v2/admin-album?'+new URLSearchParams({id})));}
  alive();const u=new URL(url,'https://tag.invalid');
  if(u.origin!=='https://tag.invalid')throw Error('허용되지 않은 조회');
  if(u.pathname.startsWith('/api/cover/')){
   if(!['/api/cover/inspect','/api/cover/plan'].includes(u.pathname))throw Error('실제 커버 저장은 비활성화되어 있습니다.');
   const id=body?.album_id,file=body?.file,relative=coverFiles.get(id)?.get(file);
   if(!relative||!albums.has(id)||relative.startsWith('/')||relative.includes('\\')||relative.split('/').some(p=>p==='..'||p==='.')||!relative.includes('/'))throw Error('현재 앨범에서 확인한 파일만 선택하세요.');
   if(u.pathname==='/api/cover/inspect')return get('/v2/admin/tag-cover/inspect?'+new URLSearchParams({album_id:id,file:relative}));
   if(!['add','replace','remove'].includes(body.action)||!/^([a-f0-9]{64})$/.test(body.expected_file_sha256||'')||!/^([a-f0-9]{64})$/.test(body.expected_catalog_digest||''))throw Error('실제 파일 상태를 먼저 조회하세요.');
   if(body.action!=='remove'&&(typeof body.image_base64!=='string'||body.image_base64.length>14*1024*1024))throw Error('이미지 크기 제한을 확인하세요.');
   check();const result=await api('/v2/admin/tag-cover/plan',{admin:true,signal,body:{album_id:id,file:relative,action:body.action,expected_file_sha256:body.expected_file_sha256,expected_catalog_digest:body.expected_catalog_digest,...(body.action==='remove'?{}:{image_base64:body.image_base64})}});check();return result;
  }
  if(body!==undefined)throw Error('읽기 조회에 본문을 전달할 수 없습니다.');
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
   const artist=u.searchParams.get('artist')||'';
   if(artist.startsWith('folder:')){
    const folder=artist.slice(7);
    if(!folders.has(folder))throw Error('선택하지 않은 폴더');
    const validPath=path=>typeof path==='string'&&!!path&&!path.startsWith('/')&&!/[\\:\x00-\x1f]/.test(path)&&!path.split('/').some(p=>!p||p==='.'||p==='..'||p.startsWith('.'));
    if(!validPath(folder))throw Error('올바른 상대 폴더를 선택하세요.');
    const items=[],seenIds=new Set(),seenCursors=new Set();let cursor=null,hasMore=false,revision=null;
    for(let page=0;page<4;page++){
     alive();const params=new URLSearchParams({path:folder,limit:'50'});if(cursor)params.set('cursor',cursor);
     let r;try{r=await get('/v2/admin/tag-cover/folder-albums?'+params);}catch(error){alive();throw Error('폴더 앨범 조회 API 확인 필요 · 상세 조회로 재시도하지 않습니다.');}
     if(r?.state!=='READ_ONLY_FOLDER_ALBUMS'||r.version!=='tag-folder-index-v1'||r.folder!==folder||typeof r.revision!=='string'||!r.revision||(revision!==null&&revision!==r.revision)||!Array.isArray(r.items)||r.items.length>50||typeof r.has_more!=='boolean'||(r.has_more&&(!r.items.length||typeof r.next_cursor!=='string'||!r.next_cursor||seenCursors.has(r.next_cursor)))||(!r.has_more&&r.next_cursor!==null))throw Error('폴더 앨범 응답 불일치');
     for(const a of r.items){
      const path=a.relative_path;
      if(!UUID.test(a.id||'')||seenIds.has(a.id)||typeof a.title!=='string'||typeof a.artist!=='string'||typeof a.date!=='string'||!validPath(path)||(path!==folder&&!path.startsWith(folder+'/')))throw Error('폴더 소속 또는 앨범 식별 불일치');
      seenIds.add(a.id);items.push({...a,count:null});
     }
     revision=r.revision;hasMore=r.has_more;if(!hasMore)break;cursor=r.next_cursor;seenCursors.add(cursor);
    }
    alive();for(const a of items){albums.add(a.id);const parts=a.relative_path.split('/');for(let k=1;k<=parts.length;k++)folders.add(parts.slice(0,k).join('/'));}
    return {items,truncated:hasMore};
   }
   if(!artists.has(artist))throw Error('먼저 아티스트를 선택하세요.');
   const items=[];let page=1,pages=1;
   do{
    const r=await get('/v2/albums?'+new URLSearchParams({artist,view:'library',page:String(page)}));pages=Number(r.pages)||1;
    for(const a of r.items||[]){if(!UUID.test(a.id||''))continue;albums.add(a.id);items.push({...a,date:a.original_year||a.release_year||'',count:null});}
    page++;
   }while(page<=pages&&page<=4);
   return {items,truncated:pages>4};
  }
  if(u.pathname==='/api/tracks'){
   const id=u.searchParams.get('album');if(!UUID.test(id||'')||!albums.has(id))throw Error('먼저 조회한 앨범을 선택하세요.');
   const album=indexedTagAlbum(await detail(id),id);
   coverFiles.set(id,new Map(album.entries.filter(e=>e.relative_file).map(e=>[e.file,e.relative_file])));return {album};
  }
  throw Error('Tag Editor는 지정된 읽기 조회만 허용합니다.');
 };
}
export function mountTagEditor({container,api,canManage,loadCover=coverMemberImage,preview=false}){
 if(!canManage?.())throw Error('승인된 관리자만 이용할 수 있습니다.');
 const controller=new AbortController(),channel=crypto.randomUUID(),frame=document.createElement('iframe');
 frame.title='Tag Editor · NAS 색인 태그 읽기 전용';frame.style.cssText='width:100%;height:78vh;min-height:650px;border:0;border-radius:8px;background:#f5f7f8';frame.referrerPolicy='no-referrer';
 frame.src=new URL('tag-editor-ui.html?v=20261121-init-hotfix',document.baseURI).href;
 const read=createTagReader({api,canManage:()=>!controller.signal.aborted&&canManage(),signal:controller.signal});
 // Bounded concurrent reads: a stale browse cannot monopolize the selected album.
 const queue=[],jobs=new Map();let active=0;
 function pump(){while(active<2&&queue.length){const job=queue.shift();if(job.controller.signal.aborted){jobs.delete(job.id);continue;}active++;
  const metrics={nas_requests:0,nas_wait_ms:0},started=performance.now();
  Promise.resolve().then(()=>read(job.url,job.body,{signal:job.controller.signal,metrics})).then(result=>{
   if(!controller.signal.aborted&&!job.controller.signal.aborted&&canManage())frame.contentWindow?.postMessage({type:'vr-tag-result',channel,id:job.id,result,metrics:{...metrics,bridge_ms:performance.now()-started}},origin);
  },e=>{if(!controller.signal.aborted&&!job.controller.signal.aborted&&canManage())frame.contentWindow?.postMessage({type:'vr-tag-result',channel,id:job.id,error:e.message},origin);
  }).finally(()=>{jobs.delete(job.id);active--;pump();});
 }}
 const origin=location.origin;
 async function message(event){
  if(event.origin!==origin||event.source!==frame.contentWindow)return;
  const m=event.data;if(m?.type==='vr-tag-ready'){if(canManage())frame.contentWindow.postMessage({type:'vr-tag-init',channel,preview},origin);return;}
  if(m?.type==='vr-tag-covers'&&m.channel===channel){if(canManage())for(const img of frame.contentDocument.querySelectorAll('img[data-tag-cover]')){if(UUID.test(img.dataset.tagCover)&&!img.dataset.loading){img.dataset.loading='true';void loadCover(img,img.dataset.tagCover).catch(()=>{img.hidden=true;});}}return;}
  if(m?.type==='vr-tag-measured'&&m.channel===channel){const v=m.measurement;if(v&&UUID.test(v.album_id||'')&&Number.isFinite(v.display_ms))frame.dataset.lastReadMetrics=JSON.stringify(v);return;}
  if(m?.type==='vr-tag-cancel'&&m.channel===channel){jobs.get(m.id)?.controller.abort();return;}
  if(m?.type!=='vr-tag-read'||m.channel!==channel||!Number.isSafeInteger(m.id)||typeof m.url!=='string')return;
  if(!canManage()){dispose();return;}
  if(jobs.has(m.id))return;
  if(jobs.size>=32){frame.contentWindow?.postMessage({type:'vr-tag-result',channel,id:m.id,error:'조회가 많습니다. 잠시 후 다시 선택하세요.'},origin);return;}
  const job={id:m.id,url:m.url,body:m.body,controller:new AbortController()};jobs.set(m.id,job);
  if(m.url.startsWith('/api/tracks?'))queue.unshift(job);else queue.push(job);pump();
 }
 function dispose(){if(controller.signal.aborted)return;controller.abort();for(const job of jobs.values())job.controller.abort();queue.length=0;for(const img of frame.contentDocument?.querySelectorAll('img[data-tag-cover]')||[])clearMemberImage(img);window.removeEventListener('message',message);frame.contentWindow?.postMessage({type:'vr-tag-revoke'},origin);frame.remove();}
 frame.addEventListener('load',()=>{
  if(!controller.signal.aborted&&canManage()){
   const doc=frame.contentDocument;
   if(!doc?.getElementById('accessLock')){container.textContent='Tag Editor 화면 파일을 불러오지 못했습니다. 다시 접속해 주세요.';return;}
   frame.contentWindow?.postMessage({type:'vr-tag-init',channel,preview},origin);
  }
 });
 window.addEventListener('message',message);container.replaceChildren(frame);return {dispose};
}


