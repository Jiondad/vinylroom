import {applyBulkDraft,fields,values,selectionGate} from './tag-editor-draft.js?v=20261122-default-rename';
import {installTagCoverDraft} from './tag-editor-cover-draft.js?v=20261122-save-ready';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),clone=v=>structuredClone(v),base=f=>f.split('/').pop();
const S={album:null,original:[],draft:[],selected:new Set(),renames:{},warnings:{},drafts:new Map(),nodes:new Map(),active:'',search:[],metrics:[],anchor:null,visible:[]};
let saveCaps={tags:false,cover:false,rename:false,tag_fields:[]};let activeTool='tags';const toolInputs={};
let tagSaveBusy=false;const justSaved=new Set();
const REFRESH_VIEW_KEY='vinyl-tag-editor-refresh-view-v1';
function readRefreshView(){try{const v=JSON.parse(sessionStorage.getItem(REFRESH_VIEW_KEY)||'null');return v&&typeof v==='object'&&!Array.isArray(v)?v:null;}catch{return null;}}
const refreshView=readRefreshView();
function rememberEditorView(){
 try{
  const previous=readRefreshView()||{};
  const album=S.album?{id:S.album.id,title:S.album.title||'',artist:S.album.artist||'',date:S.album.date||'',relative_path:S.album.path||''}:previous.album||null;
  const scroll=$('#artistScroll');
  sessionStorage.setItem(REFRESH_VIEW_KEY,JSON.stringify({
   album,tool:activeTool,scrollTop:scroll?.scrollTop||0
  }));
 }catch{}
}

const pending=new Map(),inflight=new Map(),gate=selectionGate();let channel=null,rpcSeq=0,toastTimer,searchVersion=0,currentTrackRequest=null;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}
function read(url,body){const key=body===undefined?url:null;if(key&&inflight.has(key))return inflight.get(key);
 let id;const task=new Promise((resolve,reject)=>{id=++rpcSeq;const timer=setTimeout(()=>{pending.delete(id);parent.postMessage({type:'vr-tag-cancel',id,channel},location.origin);reject(Error('NAS 조회 시간 초과 · 다시 선택하세요.'));},30000);pending.set(id,{resolve,reject,timer});parent.postMessage({type:'vr-tag-read',id,channel,url,body},location.origin);});
 task.cancel=()=>{const p=pending.get(id);if(p){clearTimeout(p.timer);pending.delete(id);parent.postMessage({type:'vr-tag-cancel',id,channel},location.origin);p.reject(Error('selection_superseded'));}};
 if(key){inflight.set(key,task);task.finally(()=>{if(inflight.get(key)===task)inflight.delete(key);}).catch(()=>{});}return task;
}
async function api(url,body){if(!channel)throw Error('관리자 인증이 필요합니다.');return (await read(url,body)).result;}
window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin)return;const m=event.data;
 if(m?.type==='vr-tag-init'&&!channel&&typeof m.channel==='string'){channel=m.channel;document.body.hidden=false;document.body.classList.remove('locked');if(m.preview)$('#sourceBadge').textContent='DEMO · NAS 미연결';void expand('');void readSaveCaps();if(m.initialAlbum)openLinkedAlbum(m.initialAlbum);}
 if(m?.type==='vr-tag-viewport'&&m.channel===channel&&Number.isFinite(m.top)&&Number.isFinite(m.height)&&m.top>=0&&m.height>=240){document.documentElement.style.setProperty('--tag-visible-top',m.top+'px');document.documentElement.style.setProperty('--tag-visible-height',m.height+'px');}
 if(m?.type==='vr-tag-revoke'){channel=null;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('관리자 인증이 필요합니다.'));}pending.clear();inflight.clear();S.drafts.clear();S.original=[];S.draft=[];coverEditor.close();document.body.classList.add('locked');}
 if(m?.type==='vr-tag-result'&&m.channel===channel){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve({result:m.result,metrics:m.metrics});}}
});
if(parent===window){document.body.hidden=false;document.body.classList.add('locked');}
function node(path,name){if(!S.nodes.has(path))S.nodes.set(path,{path,name:name||path.split('/').pop()||'음악 폴더',children:new Set(),expanded:false,loaded:false,albumsLoaded:false,loading:false,error:'',album:null});return S.nodes.get(path);}
node('','음악 폴더').expanded=true;
function addPath(path){let parent='';for(const name of path.split('/').filter(Boolean)){const next=parent?parent+'/'+name:name;node(parent).children.add(next);node(next,name);parent=next;}return node(parent);}
function addAlbums(items,parentPath){for(const a of items){const path=a.tree_path||a.relative_path||a.path||parentPath+'/@'+a.id;const n=addPath(path);n.album=a;n.name=a.title;let par=path;while(par){node(par).albumsLoaded=true;par=par.split('/').slice(0,-1).join('/');}}
 node(parentPath).albumsLoaded=true;
}
// Use the real NAS folder name for sibling ordering, not the album's display title.
// This matches Windows Explorer's name-based/natural ascending folder order.
function treeFolderSortKey(path){
 const n=node(path);
 const source=n.album?.relative_path||n.album?.path||path;
 return String(source).split('/').filter(Boolean).pop()||n.name;
}
function compareTreeFolders(a,b){
 return treeFolderSortKey(a).localeCompare(treeFolderSortKey(b),'ko',{numeric:true,sensitivity:'base'})||
  a.localeCompare(b,'ko',{numeric:true,sensitivity:'base'});
}
function renderTree(){const render=(path,depth=0)=>{const n=node(path),isAlbum=!!n.album,open=n.expanded;return `<li><div class="tree-row ${isAlbum?'album ':''}${isAlbum&&S.active===n.album.id?'active':''}" style="padding-left:${depth*13+4}px"><button class="tree-toggle" data-expand="${esc(path)}" aria-label="${esc(n.name)} ${open?'접기':'펼치기'}" aria-expanded="${open}" ${isAlbum&&!n.children.size?'disabled':''}>${isAlbum&&!n.children.size?'·':open?'▾':'▸'}</button><button class="tree-label" ${isAlbum?'data-album="'+esc(n.album.id)+'"':'data-folder="'+esc(path)+'"'} title="${esc(path||'/music')}"><span class="tree-icon">${isAlbum?'♫':'▱'}</span>${esc(n.name)}${isAlbum?'<small>'+esc(n.album.date||'')+'</small>':''}</button></div>${open?`<ul class="tree-branch">${[...n.children].sort(compareTreeFolders).map(p=>render(p,depth+1)).join('')}</ul>`:''}${n.loading?'<p class="tree-feedback">불러오는 중…</p>':''}${n.error?`<p class="tree-feedback">${esc(n.error)} <button data-retry="${esc(path)}">다시 조회</button></p>`:''}</li>`;};$('#artistList').innerHTML='<ul class="tree-branch">'+render('')+'</ul>';}
async function expand(path,{retry=false}={}){const n=node(path);if(n.album&&!n.children.size)return;const opening=!n.expanded||!n.loaded||retry;n.expanded=opening;if(!opening){renderTree();return;}if(n.loading){renderTree();return;}n.loading=true;n.error='';renderTree();try{
 if(!n.loaded||retry){const r=await api('/api/folders?path='+encodeURIComponent(path));for(const a of r.items||[]) {n.children.add(a.id);node(a.id,a.name);}n.loaded=true;}
 if(path.split('/').length>=2&&!n.albumsLoaded){const r=await api('/api/albums?artist='+encodeURIComponent('folder:'+path));addAlbums(r.items||[],path);if(r.truncated)n.error='조회 범위 일부만 표시';}
 }catch(e){n.error=e.message;}finally{n.loading=false;renderTree();}}
function saveDraft(){if(!S.album)return;const key=S.album.id+'|shared';S.drafts.delete(key);S.drafts.set(key,{original:JSON.stringify(S.original),draft:clone(S.draft),renames:clone(S.renames),warnings:clone(S.warnings)});if(S.drafts.size>20)S.drafts.delete(S.drafts.keys().next().value);}
function openLinkedAlbum(a){
 const id=String(a?.id||''),path=String(a?.relative_path||'');
 if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)||!path||path.startsWith('/')||path.includes('\\')||path.split('/').some(p=>!p||p==='.'||p==='..'))return;
 const selectedNode=addPath(path);
 selectedNode.album={id,title:String(a.title||''),artist:String(a.artist||''),date:String(a.date||''),path,relative_path:path};
 let parent=path;
 while(parent){node(parent).expanded=true;parent=parent.split('/').slice(0,-1).join('/');}
 node('').expanded=true;
 renderTree();
 void selectAlbum(id);
}
function summary(a){return `<button class="cover-button" id="coverOpen" aria-label="내장 커버 편집 열기"><span>◎</span><img data-tag-cover="${esc(a.id)}" alt="앨범 색인 커버"><span>커버 편집</span></button><div><h2>${esc(a.title)}</h2><p>${esc(a.artist)} · ${esc(a.date||'연도 없음')}</p><div class="folder-path" title="${esc(a.path||a.relative_path||'')}">${esc(a.path||a.relative_path||'')}</div></div>`;}
async function selectAlbum(id){if(S.active===id&&S.album)return;const info=[...S.nodes.values()].find(n=>n.album?.id===id)?.album;if(!info)return;
 saveDraft();const ticket=gate.next(),started=performance.now();if(currentTrackRequest)currentTrackRequest.cancel();S.active=id;S.album=null;S.original=[];S.draft=[];S.renames={};S.warnings={};S.selected.clear();S.anchor=null;justSaved.clear();syncMultiTags();coverEditor.close();$('#albumHeader').innerHTML=summary(info);$('#loadStatus').textContent='트랙 태그를 불러오는 중…';$('#bulkApply').disabled=true;$('#resetBtn').disabled=true;renderTree();renderTracks('트랙 태그를 불러오는 중…');
 $('#albumHeader').setAttribute('aria-busy','true');parent.postMessage({type:'vr-tag-covers',channel},location.origin);
 const request=read('/api/tracks?album='+encodeURIComponent(id));currentTrackRequest=request;
 try{const {result,metrics}=await request;if(!gate.current(ticket))return;const album=result.album;S.album=album;$('#albumHeader .folder-path').textContent=album.path||'';$('#albumHeader .folder-path').title=album.path||'';S.original=clone(album.entries);const saved=S.drafts.get(id+'|shared'),valid=saved?.original===JSON.stringify(S.original);S.draft=clone(valid?saved.draft:album.entries);S.renames=valid?clone(saved.renames):{};S.warnings=valid?clone(saved.warnings):{};S.selected=new Set();S.anchor=null;syncMultiTags();$('#loadStatus').textContent='';$('#bulkApply').disabled=false;$('#resetBtn').disabled=false;renderTracks();rememberEditorView();
 if(refreshView?.album?.id===id&&Number.isFinite(refreshView.scrollTop))requestAnimationFrame(()=>{$('#artistScroll').scrollTop=refreshView.scrollTop;});const measurement={album_id:id,...metrics,display_ms:performance.now()-started};S.metrics.push(measurement);parent.postMessage({type:'vr-tag-measured',channel,measurement},location.origin);$('#albumHeader').dataset.readMetrics=JSON.stringify(measurement);window.vrTagEditorLastSelection=measurement;window.dispatchEvent(new CustomEvent('vr-tag-selection-measured',{detail:measurement}));
 if(matchMedia('(max-width:650px)').matches){$('.browser').classList.add('collapsed');$('#browseToggle').textContent='펼치기';$('#browseToggle').setAttribute('aria-expanded','false');}
 }catch(e){if(gate.current(ticket)&&e.message!=='selection_superseded'){$('#loadStatus').textContent=e.message;renderTracks('조회 실패 · 왼쪽 앨범을 다시 선택하세요.');}}
 finally{if(gate.current(ticket)){$('#albumHeader').removeAttribute('aria-busy');currentTrackRequest=null;}}
}
const reasons={existing_value_preserved:'기존값 보존',joint_artist_backslash_protected:'공동 아티스트 보호',filename_does_not_match_format:'변환 형식 불일치',ambiguous_filename_format:'구분자 모호',duplicate_track_number_on_disc:'디스크 내 번호 중복',destination_currently_exists:'파일명 충돌',missing_or_invalid_tracknumber:'번호 확인 필요'};
const MULTI_FIELDS=['title','artist','album','album_artist','date','tracknumber','discnumber','genre','featuring'];
const editedMulti=new Set();
function syncMultiTags(){
 const entries=S.draft.filter(e=>S.selected.has(e.file));
 const panel=$('#multiTagPanel');
 if(!panel)return;
 $('#multiTagSelection').textContent=entries.length?entries.length+'곡 선택 · 변경할 필드를 입력하세요':'먼저 트랙을 선택하세요';
 editedMulti.clear();
 for(const field of MULTI_FIELDS){
  const el=panel.querySelector('[data-multi-field="'+field+'"]');
  if(!el)continue;
  const vals=[...new Set(entries.map(e=>values(e,field)))];
  el.value=entries.length&&vals.length===1?vals[0]:'';
  el.placeholder=entries.length&&vals.length>1?'여러 값 · 입력하면 선택 곡에 적용':field==='date'?'YYYY-MM-DD':'값 입력 (빈칸은 유지)';
  el.disabled=!entries.length||tagSaveBusy||!saveCaps.tags||!saveCaps.tag_fields?.includes(field);
  delete el.dataset.edited;
 }
 $('#multiTagStatus').textContent=entries.length?'변경할 값을 입력한 필드만 저장합니다. 빈칸은 기존값 유지.':'수정할 트랙을 먼저 선택하세요.';
 $('#multiTagSave').disabled=!entries.length||tagSaveBusy||!saveCaps.tags;
}
function multiTagValues(field,raw){
 const value=raw.trim();
 if(!value)return null; // Empty never clears an existing tag.
 if(value.length>1000||value.includes('\0'))throw Error(fields[field]+' 값을 확인하세요.');
 if(field==='date'&&!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value))throw Error('DATE는 YYYY 또는 YYYY-MM-DD 형식입니다.');
 if(field==='discnumber'&&!/^(?:0?[1-9]|[1-9]\d)$/.test(value))throw Error('DISCNUMBER는 1~99입니다.');
 if(field==='tracknumber'&&!/^(?:0?[1-9]|[1-9]\d)(?:\/\d{1,3})?$/.test(value))throw Error('TRACKNUMBER는 01~99 또는 01/14 형식입니다.');
 if(field==='discnumber')return [String(+value)];
 if(field==='tracknumber')return [value.replace(/^([1-9])(?=\/|$)/,'0$1')];
 if(field==='genre'||field==='featuring')return [...new Set(value.split(/\s*\|\s*/).filter(Boolean))];
 return [value];
}
$('#multiTagPanel').addEventListener('input',event=>{
 const field=event.target.dataset.multiField;
 if(!MULTI_FIELDS.includes(field))return;
 editedMulti.add(field);event.target.dataset.edited='true';
 $('#multiTagStatus').textContent=editedMulti.size+'개 필드 입력됨 · NAS 저장을 누르기 전에는 적용되지 않습니다.';
});
$('#multiTagReset').onclick=()=>syncMultiTags();
$('#multiTagSave').onclick=async()=>{
 if(tagSaveBusy||!S.album||!S.selected.size||!saveCaps.tags)return;
 const selected=S.draft.filter(e=>S.selected.has(e.file));
 const modifications={};
 try{
  for(const field of editedMulti){
   if(!saveCaps.tag_fields.includes(field))throw Error(fields[field]+' 저장 미지원');
   const input=$('#multiTagPanel').querySelector('[data-multi-field="'+field+'"]');
   const values=multiTagValues(field,input.value);
   if(values!==null)modifications[field]=values;
  }
  const activeFields=Object.keys(modifications);
  if(!activeFields.length){$('#multiTagStatus').textContent='실제로 입력한 변경값이 없습니다. 빈칸은 기존 태그를 유지합니다.';return;}
  for(const row of selected){
   for(const field of activeFields){
    if(['artist','album_artist'].includes(field)&&row.tags[field]?.some(v=>v.includes('\\'))&&
     JSON.stringify(row.tags[field])!==JSON.stringify(modifications[field]))
      throw Error('공동 아티스트 태그는 보호됩니다: '+base(row.file));
   }
  }
  const changed=selected.filter(row=>activeFields.some(f=>JSON.stringify(row.tags[f]||[])!==JSON.stringify(modifications[f])));
  if(!changed.length){$('#multiTagStatus').textContent='선택한 곡에 이미 동일한 값이 있습니다.';return;}
  for(const row of selected)for(const field of activeFields)row.tags[field]=clone(modifications[field]);
  saveDraft();renderTracks();
  $('#multiTagStatus').textContent='선택 항목 NAS 저장 중 · '+changed.length+'곡 · '+activeFields.length+'개 필드';
  const outcome=await persistTagRows(changed,{automatic:true,onlyFields:activeFields});
  if(outcome?.error){$('#multiTagStatus').textContent='부분 저장 또는 실패 · '+outcome.completed+'/'+outcome.total+'곡 · NAS 실제 태그 확인 필요';}
  else{$('#multiTagStatus').textContent='NAS 저장 완료 · '+(outcome?.completed||0)+'곡 · '+activeFields.length+'개 필드';}
  editedMulti.clear();for(const input of $('#multiTagPanel').querySelectorAll('[data-multi-field]'))delete input.dataset.edited;
 }catch(error){$('#multiTagStatus').textContent='저장 중단 · '+error.message;toast(error.message);}
};
function changedFields(e){const old=S.original.find(x=>x.file===e.file);return Object.keys(fields).filter(f=>values(e,f)!==values(old,f));}
function cell(e,f){const old=S.original.find(x=>x.file===e.file),diff=values(e,f)!==values(old,f),number=f==='tracknumber',val=number?values(e,f).replace(/^([1-9])(?=\/|$)/,'0$1'):values(e,f);return `<td class="${diff?'changed':''}"><input data-field="${f}" data-file="${esc(e.file)}" aria-label="${fields[f]} ${esc(base(e.file))}" value="${esc(val)}" readonly placeholder="${f==='title'?'제목 없음':'—'}" title="${esc(val)}" ${number?'inputmode="numeric"':''}></td>`;}
function renderTracks(empty='선택한 앨범의 트랙이 여기에 표시됩니다.'){
 let lastDisc=null;const entries=S.draft.filter(e=>!$('#missingOnly').checked||changedFields(e).length||S.renames[e.file]||!e.tags.title?.length||!e.tags.tracknumber?.length),parts=[];
 S.visible=entries.map(e=>e.file);
 for(const e of entries){const disc=+(e.tags.discnumber?.[0]?.split('/')[0]||1);if(disc!==lastDisc){parts.push(`<tr class="disc-row"><td colspan="8">DISC ${String(disc).padStart(2,'0')}</td></tr>`);lastDisc=disc;}
 const changed=changedFields(e),common=changed.filter(f=>['album','album_artist','date','discnumber'].includes(f)),old=S.original.find(x=>x.file===e.file),missing=!e.tags.title?.length||!e.tags.tracknumber?.length;
 parts.push(`<tr data-track="${esc(e.file)}" tabindex="0" aria-selected="${S.selected.has(e.file)}" class="${S.selected.has(e.file)?'selected':''}"><td class="row-marker" aria-hidden="true">${S.selected.has(e.file)?'●':'·'}</td><td class="${S.renames[e.file]?'changed':''}"><div class="file-cell"><span class="filename" title="${esc(S.renames[e.file]||e.file)}">${esc(S.renames[e.file]||base(e.file))}</span><button class="path-open" data-path="${esc(e.file)}" aria-label="${esc(base(e.file))} 파일 경로" title="전체 파일 경로">↗</button></div>${common.map(f=>'<small class="file-proposal">'+fields[f]+': '+esc(values(old,f)||'빈 값')+' → '+esc(values(e,f)||'빈 값')+'</small>').join('')}${S.warnings[e.file]?'<small class="row-warning">'+esc(reasons[S.warnings[e.file]]||S.warnings[e.file])+'</small>':''}</td>${['tracknumber','title','artist','album_artist','featuring','genre'].map(f=>cell(e,f)).join('')}</tr>`);
 }
 $('#tracks').innerHTML=parts.join('')||`<tr><td colspan="8" class="empty">${esc(S.album?'표시할 트랙이 없습니다.':empty)}</td></tr>`;$('#trackCount').textContent=S.draft.length+'곡';const hiddenSelected=[...S.selected].filter(f=>!S.visible.includes(f)).length;$('#selectedCount').textContent=S.selected.size+' / '+S.draft.length+'곡 선택'+(hiddenSelected?' · 숨김 '+hiddenSelected+'곡':'');$('#discSelectionCount').textContent=S.selected.size+'곡 선택';$('#discApply').disabled=!S.album||!S.selected.size;$('#selectAll').checked=!!S.visible.length&&S.visible.every(f=>S.selected.has(f));$('#selectAll').indeterminate=S.visible.some(f=>S.selected.has(f))&&!$('#selectAll').checked;
 const unsaved=S.draft.filter(e=>changedFields(e).length||S.renames[e.file]).length;
 const saved=S.draft.filter(e=>justSaved.has(e.file)&&!changedFields(e).length&&!S.renames[e.file]).length;
 const missingCount=S.draft.filter(e=>!e.tags.title?.length||!e.tags.tracknumber?.length).length;
 $('#tagStatusSummary').textContent=S.album?
  [unsaved?'미저장 '+unsaved+'곡':'미저장 없음',saved?'저장 확인 '+saved+'곡':'',missingCount?'필수 태그 누락 '+missingCount+'곡':''].filter(Boolean).join(' · '):'';
 $('#draftCount').textContent='변경 '+unsaved+'곡';$('#commonSummary').textContent=S.album?['album','album_artist','date'].map(f=>{const v=[...new Set(S.draft.map(e=>values(e,f)))];return fields[f]+': '+(v.length>1?'파일별 값 다름':v[0]||'빈 값');}).join(' · '):'';
 saveButtonState();
}
$('#artistList').onclick=e=>{const a=e.target.closest('[data-album]'),folder=e.target.closest('[data-folder]'),toggle=e.target.closest('[data-expand]'),retry=e.target.closest('[data-retry]');if(a)void selectAlbum(a.dataset.album);else if(retry)void expand(retry.dataset.retry,{retry:true});else if(toggle||folder)void expand((toggle||folder).dataset[toggle?'expand':'folder']);};
$('#artistForm').onsubmit=async e=>{e.preventDefault();const query=$('#artistSearch').value.trim(),ticket=++searchVersion;if(!query){$('#searchResults').replaceChildren();return;}$('#searchResults').textContent='검색 중…';try{const r=await api('/api/artists?q='+encodeURIComponent(query));if(ticket!==searchVersion)return;S.search=r.items||[];$('#searchResults').innerHTML='<p class="search-title">검색 결과</p>'+S.search.map((a,i)=>`<button class="search-result" data-search-artist="${i}">${esc(a.name)}</button>`).join('')+(r.truncated?'<p class="tree-feedback">검색어를 좁혀 주세요.</p>':'');if(!S.search.length)$('#searchResults').textContent='검색 결과 없음';}catch(e){if(ticket===searchVersion)$('#searchResults').textContent=e.message;}};
$('#searchResults').onclick=async e=>{const button=e.target.closest('[data-search-artist]');if(!button||button.disabled)return;const a=S.search[+button.dataset.searchArtist];button.disabled=true;try{const r=await api('/api/albums?artist='+encodeURIComponent(a.id));const path='검색 결과/'+a.name;node('').children.add('검색 결과');addPath(path);node('검색 결과').expanded=true;node('검색 결과').loaded=true;node('검색 결과').albumsLoaded=true;node(path).expanded=true;node(path).loaded=true;addAlbums((r.items||[]).map(a=>({...a,tree_path:path+'/@'+a.id})),path);renderTree();}catch(e){toast(e.message);}finally{button.disabled=false;}};
function discDraft(entries){
 const value=$('#discValue').value;
 if(!/^[0-9]{1,2}$/.test(value)||+value<1||+value>99)throw Error('DISCNUMBER는 1~99입니다.');
 return applyBulkDraft({entries,selected:[...S.selected],scope:'selected',field:'discnumber',value,replace:$('#bulkPolicy').value==='replace'});
}
$('#discApply').onclick=()=>{if(!S.album)return;try{const r=discDraft(S.draft);S.draft=r.entries;S.warnings={...S.warnings,...r.warnings};saveDraft();renderTracks();$('#bulkStatus').textContent=`DISCNUMBER ${$('#discValue').value} · ${r.changed}곡 초안 변경 · ${Object.keys(r.warnings).length}곡 참고`;}catch(e){toast(e.message);}};
$('#bulkApply').onclick=async()=>{if(!S.album||tagSaveBusy)return;try{
 const mode=$('#bulkField').value,withDisc=mode==='number'&&$('#numberDisc').checked;
 const priorNumbers=new Map(S.draft.map(e=>[e.file,{tracknumber:values(e,'tracknumber'),discnumber:values(e,'discnumber')}]));
 if(withDisc&&$('#bulkScope').value!=='selected')throw Error('DISCNUMBER 동시 지정은 선택 트랙 범위를 사용하세요.');
 const disc=withDisc?discDraft(S.draft):null;
 const r=applyBulkDraft({entries:disc?.entries||S.draft,selected:[...S.selected],scope:$('#bulkScope').value,field:mode,value:$('#bulkValue').value,replace:$('#bulkPolicy').value==='replace',format:$('#format').value,start:Number($('#numberStart').value),order:mode==='number'?'display':'filename'});
 if(mode!=='to')S.draft=r.entries;if(mode==='to'){const targets=$('#bulkScope').value==='album'?S.draft.map(e=>e.file):[...S.selected];for(const file of targets)delete S.renames[file];Object.assign(S.renames,r.renames);}else Object.assign(S.renames,r.renames);
 S.warnings={...disc?.warnings,...r.warnings};saveDraft();renderTracks();
 if(mode==='to'){
  const files=$('#bulkScope').value==='album'?S.draft.map(e=>e.file):[...S.selected];
  const proposed=files.filter(file=>S.renames[file]&&S.renames[file]!==base(file));
  if(!proposed.length){$('#bulkStatus').textContent='변경할 파일명이 없습니다.';return;}
  if(!saveCaps.rename){$('#bulkStatus').textContent='파일명 자동저장 불가 · NAS 저장 기능 OFF · 미저장 상태입니다.';return;}
  await saveRenames({files:proposed,automatic:true});
 }else if(mode==='number'||mode==='normalize'){
  const intended=S.draft.filter(e=>{const previous=priorNumbers.get(e.file);return previous&&(previous.tracknumber!==values(e,'tracknumber')||previous.discnumber!==values(e,'discnumber'))&&changedFields(e).some(f=>f==='tracknumber'||f==='discnumber');});
  if(!intended.length){$('#bulkStatus').textContent='저장할 트랙번호 변경이 없습니다.';return;}
  if(intended.length>1){$('#bulkStatus').textContent=`NAS HTTP 400 미해결 · ${intended.length}곡 자동 일괄 저장을 안전상 중지했습니다. 화면은 미저장 초안이며 실제 저장이 아닙니다.`;$('#saveStatus').textContent='NAS 오류 해결 전 전체 앨범 자동저장 일시 중지';return;}
  if(!saveCaps.tags){$('#bulkStatus').textContent='저장 실패 · NAS 저장 연결이 꺼져 있어 변경 내용은 미저장입니다.';return;}
  await persistTagRows(intended,{automatic:true,onlyFields:['tracknumber','discnumber']});
 }else $('#bulkStatus').textContent=`${r.changed}곡 초안 변경 · ${Object.keys(S.warnings).length}곡 참고`;
 }catch(e){$('#bulkStatus').textContent='변환 실패 · '+e.message;}};
function toolbar(){const f=$('#bulkField').value,isFormat=['from','to'].includes(f),isNumber=['number','normalize'].includes(f);$('#formatControls').hidden=!isFormat;$('#numberControls').hidden=f!=='number';$('.bulk-value').hidden=isFormat||isNumber;$('#bulkPolicy').disabled=f==='normalize'||f==='to';for(const o of $('#variable').options)o.disabled=f==='to'&&o.value==='%dummy%';for(const o of $('#preset').options)o.disabled=f==='to'&&o.value.includes('%dummy%');if(f==='to'&&$('#format').value.includes('%dummy%'))$('#format').value='%discnumber% - $num(%track%,2). %title%';$('#bulkValue').placeholder=['genre','featuring'].includes(f)?'여러 값은 | 로 구분':'변경할 값';}
$('#bulkField').onchange=toolbar;$('#preset').onchange=e=>{if(e.target.value)$('#format').value=e.target.value;};$('#variable').innerHTML+=['artist','albumartist','album','date','year','discnumber','track','title','genre','featuring','dummy'].map(f=>`<option value="%${f}%">%${f}%</option>`).join('');$('#variable').onchange=e=>{const input=$('#format');input.setRangeText(e.target.value,input.selectionStart??input.value.length,input.selectionEnd??input.value.length,'end');input.focus();e.target.value='';};
$('#tracks').onchange=e=>{const file=e.target.dataset.select;if(file){e.target.checked?S.selected.add(file):S.selected.delete(file);renderTracks();syncMultiTags();return;}const f=e.target.dataset.field;if(!f)return;const entry=S.draft.find(row=>row.file===e.target.dataset.file);if(!entry)return;let val=e.target.value.trim();try{if(f==='tracknumber'){if(val&&!/^(?:0?[1-9]|[1-9]\d)(?:\/\d{1,3})?$/.test(val))throw Error('트랙번호는 01~99입니다.');entry.tags[f]=val?[val.replace(/^([1-9])(?=\/|$)/,'0$1')]:[];}else{const r=applyBulkDraft({entries:S.draft,selected:[entry.file],scope:'selected',field:f,value:val,replace:true});S.draft=r.entries;S.warnings=r.warnings;}saveDraft();}catch(e){toast(e.message);}renderTracks();};
function selectTrack(file,event){
 if(!S.visible.includes(file))return;
 if(event.shiftKey){const from=S.visible.indexOf(S.anchor),to=S.visible.indexOf(file),range=from<0?[file]:S.visible.slice(Math.min(from,to),Math.max(from,to)+1);S.selected=new Set(event.ctrlKey||event.metaKey?[...S.selected,...range]:range);if(from<0)S.anchor=file;}
 else if(event.ctrlKey||event.metaKey){S.selected.has(file)?S.selected.delete(file):S.selected.add(file);S.anchor=file;}
 else {S.selected=new Set([file]);S.anchor=file;}
 renderTracks();syncMultiTags();const row=[...$('#tracks').querySelectorAll('[data-track]')].find(r=>r.dataset.track===file);row?.focus({preventScroll:true});
}
$('#tracks').onclick=e=>{
 const path=e.target.closest('[data-path]');if(path){$('#fullPath').textContent=path.dataset.path;$('#pathDialog').showModal();return;}
 const row=e.target.closest('[data-track]');if(!row)return;
 const input=e.target.closest('input[data-field]');
 if(input&&!input.readOnly)return;
 if(e.target.closest('button,select,textarea,a'))return;
 if(input&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&S.selected.size===1&&S.selected.has(row.dataset.track)){
  input.readOnly=false;input.focus();input.select();return;
 }
 e.preventDefault();selectTrack(row.dataset.track,e);
};
$('#tracks').ondblclick=e=>{const input=e.target.closest('input[data-field]');if(input){input.readOnly=false;input.focus();input.select();}};
$('#tracks').addEventListener('focusout',e=>{if(e.target.matches('input[data-field]'))e.target.readOnly=true;});
$('.track-panel').addEventListener('keydown',e=>{
 if(e.target.matches('input:not([readonly]),textarea,select,button')||document.querySelector('dialog[open]'))return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){
  e.preventDefault();$('#missingOnly').checked=false;S.selected=new Set(S.draft.map(x=>x.file));S.anchor=S.draft[0]?.file||null;renderTracks();syncMultiTags();$('#tracks [data-track]')?.focus({preventScroll:true});return;
 }
 const row=e.target.closest('[data-track]');if(!row)return;
 if(e.key===' '){e.preventDefault();selectTrack(row.dataset.track,e);}
 if(e.key==='F2'||e.key==='Enter'){const input=row.querySelector('input[data-field]');if(input){e.preventDefault();input.readOnly=false;input.focus();input.select();}}
});
$('#selectAll').onchange=e=>{S.selected=new Set(e.target.checked?S.visible:[]);S.anchor=null;renderTracks();syncMultiTags();};
$('#missingOnly').onchange=()=>{S.selected.clear();S.anchor=null;renderTracks();syncMultiTags();$('#bulkStatus').textContent='필터 변경 · 트랙 선택 해제 · 변경 초안 유지';};
$('#resetBtn').onclick=()=>{if(!S.album)return;S.draft=clone(S.original);S.renames={};S.warnings={};saveDraft();renderTracks();syncMultiTags();$('#bulkStatus').textContent='초안을 초기화했습니다.';};
$('#browseToggle').onclick=()=>{const collapsed=$('.browser').classList.toggle('collapsed');$('#browseToggle').textContent=collapsed?'펼치기':'접기';$('#browseToggle').setAttribute('aria-expanded',String(!collapsed));};
const pathDialog=$('#pathDialog');$('#closePath').onclick=()=>pathDialog.close();pathDialog.addEventListener('click',e=>{if(e.target===pathDialog)pathDialog.close();});
const coverEditor=installTagCoverDraft({getAlbum:()=>S.album,getSelectedFiles:()=>[...S.selected],api,getSaveCapabilities:()=>saveCaps});$('#albumHeader').onclick=e=>{if(e.target.closest('#coverOpen')){if(S.album)coverEditor.open();else toast('트랙 조회 후 커버를 선택하세요.');}};
renderTree();parent.postMessage({type:'vr-tag-ready'},location.origin);

const toolGroups={tags:['artist','album_artist','album','date','genre','featuring','discnumber','title'],from:['from'],to:['to'],number:['number','normalize']};
function activateTool(tool){
 if(tool==='cover'){if(S.album)coverEditor.open();else toast('먼저 앨범을 선택하세요.');return;}
 const group=toolGroups[tool];if(!group)return;
 if(tool!==activeTool){
  toolInputs[activeTool]={field:$('#bulkField').value,format:$('#format').value,value:$('#bulkValue').value,scope:$('#bulkScope').value,policy:$('#bulkPolicy').value,start:$('#numberStart').value};saveDraft();activeTool=tool;
  // Shared per-album draft remains in memory when switching tools; only tool inputs change.
  const input=toolInputs[tool]||{};$('#format').value=input.format||(tool==='to'?'%discnumber% - $num(%track%,2). %title%':'%track% %title%');$('#bulkValue').value=input.value||'';$('#bulkScope').value=input.scope||'selected';$('#bulkPolicy').value=input.policy||'empty';$('#numberStart').value=input.start||'1';$('#bulkStatus').textContent='';
 }
 for(const button of document.querySelectorAll('[data-tool]'))button.setAttribute('aria-pressed',String(button.dataset.tool===tool));
 for(const option of $('#bulkField').options){option.hidden=!group.includes(option.value);option.disabled=option.hidden;}
 const savedField=toolInputs[tool]?.field;$('#bulkField').value=group.includes(savedField)?savedField:group[0];
 $('#multiTagPanel').hidden=tool!=='tags';$('.bulk-toolbar').hidden=tool==='tags';rememberEditorView();const caption=$('#formatCaption');if(caption)caption.textContent=tool==='to'?'파일명 생성 패턴':'파일명 추출 패턴';toolbar();renderTracks();
}
document.querySelector('.editor-tools').onclick=e=>{const b=e.target.closest('[data-tool]');if(b)activateTool(b.dataset.tool);};activateTool(toolGroups[refreshView?.tool]&&refreshView.tool!=='cover'?refreshView.tool:'tags');
$('#artistScroll').addEventListener('scroll',rememberEditorView,{passive:true});

function saveButtonState(){
 const renameMode=activeTool==='to',enabled=renameMode?saveCaps.rename:saveCaps.tags;
 const count=S.draft.filter(e=>S.selected.has(e.file)&&(renameMode?S.renames[e.file]:changedFields(e).length)).length;
 $('#saveTags').disabled=tagSaveBusy||!enabled||!S.album;
 $('#saveTags').textContent=renameMode?'파일명 변경 저장':activeTool==='number'?'기타 태그 저장':'태그 변경 저장';
 $('#saveTags').title=enabled?(count?`선택 변경 ${count}곡 실제 파일 저장`:'저장할 변경 초안을 만든 후 누르세요'):(renameMode?'NAS 정식 색인 연결 및 자격 검증 필요':'NAS 태그 저장 기능 확인 필요');
}
async function readSaveCaps(){
 try{const r=await api('/api/save-capabilities');if(r.state==='TAG_EDITOR_SAVE_CAPABILITIES'&&r.version==='tag-editor-save-v1')saveCaps={...r,tags:r.tags===true&&Array.isArray(r.tag_fields),cover:r.cover===true,rename:r.rename===true};}
 catch{saveCaps={tags:false,cover:false,rename:false,tag_fields:[]};}
 $('#saveStatus').textContent=saveCaps.tags?`실제 저장 ON · 태그 ${(saveCaps.tag_formats||['flac']).join('·').toUpperCase()} · ${(saveCaps.tag_fields||[]).length}개 필드 / 파일명 ${saveCaps.rename?'ON':'OFF'}`:'NAS 저장 경로·검증 확인 필요';$('#sourceBadge').textContent=saveCaps.tags?'NAS 실제 음원 · 저장 가능':'NAS 저장 연결 확인 필요';saveButtonState();syncMultiTags();
}
async function persistTagRows(rows,{automatic=false,onlyFields=null}={}){
 if(tagSaveBusy||!S.album||!saveCaps.tags)return;
 const id=S.album.id;
 const jobs=rows.map(e=>{
  const old=S.original.find(x=>x.file===e.file);
  if(!old)return null;
  const fs=changedFields(e).filter(f=>!onlyFields||onlyFields.includes(f));
  return fs.length?{file:e.file,fields:fs}:null;
 }).filter(Boolean);
 if(!jobs.length)return;
 if(jobs.some(j=>!(saveCaps.tag_formats||['flac']).includes(j.file.split('.').pop().toLowerCase())||j.fields.some(f=>!saveCaps.tag_fields.includes(f)))){
  $('#saveStatus').textContent='저장 실패 · NAS에서 승인되지 않은 파일 형식 또는 태그 필드입니다.';
  return;
 }
 if(!automatic&&!window.confirm(`선택한 ${jobs.length}곡의 태그를 실제 NAS 파일에 저장할까요?`))return;
 tagSaveBusy=true;$('#saveTags').disabled=true;$('#bulkApply').disabled=true;
 // Keep the screen scrollable and responsive while the NAS responds.
 let completed=0,failed=null;
 try{
  for(const job of jobs){
   if(S.album?.id!==id)throw Error('앨범 선택이 변경됐습니다.');
   const draft=S.draft.find(e=>e.file===job.file),old=S.original.find(e=>e.file===job.file);
   if(!draft||!old)throw Error('트랙 데이터가 변경됐습니다.');
   const fs=job.fields.filter(f=>values(draft,f)!==values(old,f));
   if(!fs.length)continue;
   const body={album_id:id,file:job.file,
    edits:Object.fromEntries(fs.map(f=>[f,draft.tags[f]])),
    before_tags:Object.fromEntries(fs.map(f=>[f,old.tags[f]||[]]))};
   $('#saveStatus').textContent=`NAS 저장 중 · ${completed}/${jobs.length}곡`;
   const p=await api('/api/tag/plan',body);
   if(p.state!=='READ_ONLY_TRACK_WRITE_PLAN')throw Error(p.reason||p.state);
   const result=await api('/api/tag/apply',{...body,expected_plan_id:p.plan_id,confirm_write:true});
   if(result.state!=='TAG_TRACK_WRITE_COMPLETED')throw Error(result.reason||result.state);
   if(!result.saved_tags||fs.some(f=>JSON.stringify(result.saved_tags[f]||[])!==JSON.stringify(body.edits[f]||[]))){
    // Writer may already have committed. Do not retry an uncertain result.
    throw Error('NAS 쓰기 응답 확인 불가 · 자동 재시도 금지');
   }
   for(const f of fs){
    old.tags[f]=clone(result.saved_tags[f]);
    draft.tags[f]=clone(result.saved_tags[f]);
   }
   justSaved.add(job.file);completed++;saveDraft();renderTracks();
   $('#saveStatus').textContent=`NAS 저장 완료 · ${completed}/${jobs.length}곡`;
  }
  $('#bulkStatus').textContent=`NAS 실제 저장 완료 · ${completed}곡`;
 }catch(e){
  failed=e;
  $('#saveStatus').textContent=`저장 중단 · ${completed}/${jobs.length}곡 완료 · ${e.message}`;
  $('#bulkStatus').textContent=`저장 실패 · ${completed}곡만 완료, 나머지는 미저장 · ${e.message}`;
  if(automatic){
   try{
    const live=await api('/api/tracks?album='+encodeURIComponent(id));
    if(S.album?.id===id&&Array.isArray(live?.album?.entries)){
     const actual=new Map(live.album.entries.map(e=>[e.file,e]));
     for(const job of jobs){
      const now=actual.get(job.file),old=S.original.find(e=>e.file===job.file),draft=S.draft.find(e=>e.file===job.file);
      if(!now||!old||!draft)continue;
      for(const f of job.fields){old.tags[f]=clone(now.tags[f]||[]);draft.tags[f]=clone(now.tags[f]||[]);}
     }
     $('#bulkStatus').textContent=`저장 중단 · ${completed}곡 응답 확인 · NAS 실제 번호 재조회 완료 · ${e.message}`;
    }
   }catch{ $('#bulkStatus').textContent+=' · 실제 번호 재조회 실패'; }
  }
 }finally{
  saveDraft();tagSaveBusy=false;$('#bulkApply').disabled=!S.album;
  renderTracks();
 }
 return {completed,total:jobs.length,error:failed};
}
$('#saveTags').onclick=async()=>{
 if(!S.album||tagSaveBusy)return;
 if(activeTool==='to'){await saveRenames();return;}
 const rows=S.draft.filter(e=>S.selected.has(e.file)&&changedFields(e).length);
 if(!rows.length){toast('선택 트랙의 미저장 변경이 없습니다.');return;}
 await persistTagRows(rows);
};

async function saveRenames({files=null,automatic=false}={}){
 if(tagSaveBusy||!S.album||!saveCaps.rename){toast('NAS 파일명 저장 기능을 사용할 수 없습니다.');return;}
 const id=S.album.id,scope=files||[...S.selected],wanted=new Set(scope);
 const jobs=S.original.filter(e=>wanted.has(e.file)&&S.renames[e.file]&&S.renames[e.file]!==base(e.file))
  .map(e=>({file:e.file,new_name:S.renames[e.file]}));
 if(!jobs.length){toast('변경할 파일명이 없습니다.');return;}
 if(!automatic&&!window.confirm(`선택한 ${jobs.length}곡의 파일명을 NAS에 저장할까요?`))return;
 tagSaveBusy=true;$('#saveTags').disabled=true;$('#bulkApply').disabled=true;
 let completed=0,failed=null;
 try{
  // Validate every proposed rename before writing any file; do not re-run old fixture checks.
  for(const job of jobs){
   if(S.album?.id!==id)throw Error('앨범이 변경됐습니다.');
   const p=await api('/api/rename/plan',{album_id:id,...job});
   if(p.state!=='READ_ONLY_RENAME_PLAN')throw Error(p.reason||p.state);
  }
  for(const job of jobs){
   if(S.album?.id!==id)throw Error('앨범이 변경됐습니다.');
   $('#saveStatus').textContent=`파일명 NAS 저장 중 · ${completed}/${jobs.length}곡`;
   const body={album_id:id,...job},p=await api('/api/rename/plan',body);
   if(p.state!=='READ_ONLY_RENAME_PLAN')throw Error(p.reason||p.state);
   const result=await api('/api/rename/apply',{...body,expected_plan_id:p.plan_id,confirm_write:true});
   if(result.state!=='RENAME_WRITE_COMPLETED'||!result.new_file||!result.saved_tags)
    throw Error([result.reason||result.state,'파일명 저장 응답 확인 필요'].filter(Boolean).join(' · '));
   const old=job.file,newFile=result.new_file;
   for(const list of [S.original,S.draft]){
    const entry=list.find(x=>x.file===old);
    if(entry){entry.file=newFile;entry.relative_file=newFile;if(list===S.original)entry.tags=clone(result.saved_tags);}
   }
   if(S.selected.delete(old))S.selected.add(newFile);
   if(S.anchor===old)S.anchor=newFile;
   delete S.renames[old];delete S.warnings[old];justSaved.delete(old);justSaved.add(newFile);
   completed++;saveDraft();renderTracks();
   $('#saveStatus').textContent=`파일명 NAS 저장 완료 · ${completed}/${jobs.length}곡`;
  }
  $('#bulkStatus').textContent=`파일명 NAS 저장 완료 · ${completed}곡`;
 }catch(e){
  failed=e;
  $('#saveStatus').textContent=`파일명 저장 중단 · ${completed}/${jobs.length}곡 완료 · ${e.message}`;
  $('#bulkStatus').textContent=`파일명 저장 실패 · ${completed}곡 응답 확인 · 남은 파일 미저장 · ${e.message}`;
  // Actual Catalog is authoritative after a partial rename, including a lost HTTP response.
  try{
   const fresh=await api('/api/tracks?album='+encodeURIComponent(id));
   if(S.album?.id===id&&Array.isArray(fresh?.album?.entries)){
    const live=new Map(fresh.album.entries.map(e=>[e.file,e]));
    for(const job of jobs){
     const expected=S.original.find(e=>e.file===job.file);
     if(!expected)continue;
     const newFile=job.file.split('/').slice(0,-1).concat(job.new_name).join('/');
     const actual=live.get(newFile);
     if(actual&&!live.has(job.file)){
      const draft=S.draft.find(e=>e.file===job.file);
      expected.file=newFile;expected.relative_file=newFile;expected.tags=clone(actual.tags);
      if(draft){draft.file=newFile;draft.relative_file=newFile;}
      if(S.selected.delete(job.file))S.selected.add(newFile);
      if(S.anchor===job.file)S.anchor=newFile;
      delete S.renames[job.file];delete S.warnings[job.file];justSaved.add(newFile);
     }
    }
    $('#bulkStatus').textContent+=' · NAS 파일명 재조회 완료';
   }
  }catch{$('#bulkStatus').textContent+=' · NAS 재조회 실패 (다시 저장하지 마세요)';}
 }finally{
  saveDraft();tagSaveBusy=false;$('#bulkApply').disabled=!S.album;renderTracks();
 }
 return {completed,total:jobs.length,error:failed};
}
