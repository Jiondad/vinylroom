import {applyBulkDraft,fields,values,selectionGate} from './tag-editor-draft.js?v=20261122-default-rename';
import {installTagCoverDraft} from './tag-editor-cover-draft.js?v=20261122-fullsave-wiring';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),clone=v=>structuredClone(v),base=f=>f.split('/').pop();
const S={album:null,original:[],draft:[],selected:new Set(),renames:{},warnings:{},drafts:new Map(),nodes:new Map(),active:'',search:[],metrics:[],anchor:null,visible:[]};
let saveCaps={tags:false,cover:false,rename:false,tag_fields:[]};let activeTool='tags';const toolInputs={};
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
function renderTree(){const render=(path,depth=0)=>{const n=node(path),isAlbum=!!n.album,open=n.expanded;return `<li><div class="tree-row ${isAlbum?'album ':''}${isAlbum&&S.active===n.album.id?'active':''}" style="padding-left:${depth*13+4}px"><button class="tree-toggle" data-expand="${esc(path)}" aria-label="${esc(n.name)} ${open?'접기':'펼치기'}" aria-expanded="${open}" ${isAlbum&&!n.children.size?'disabled':''}>${isAlbum&&!n.children.size?'·':open?'▾':'▸'}</button><button class="tree-label" ${isAlbum?'data-album="'+esc(n.album.id)+'"':'data-folder="'+esc(path)+'"'} title="${esc(path||'/music')}"><span class="tree-icon">${isAlbum?'♫':'▱'}</span>${esc(n.name)}${isAlbum?'<small>'+esc(n.album.date||'')+'</small>':''}</button></div>${open?`<ul class="tree-branch">${[...n.children].sort((a,b)=>node(a).name.localeCompare(node(b).name,'ko',{numeric:true})).map(p=>render(p,depth+1)).join('')}</ul>`:''}${n.loading?'<p class="tree-feedback">불러오는 중…</p>':''}${n.error?`<p class="tree-feedback">${esc(n.error)} <button data-retry="${esc(path)}">다시 조회</button></p>`:''}</li>`;};$('#artistList').innerHTML='<ul class="tree-branch">'+render('')+'</ul>';}
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
 saveDraft();const ticket=gate.next(),started=performance.now();if(currentTrackRequest)currentTrackRequest.cancel();S.active=id;S.album=null;S.original=[];S.draft=[];S.renames={};S.warnings={};S.selected.clear();S.anchor=null;coverEditor.close();$('#albumHeader').innerHTML=summary(info);$('#loadStatus').textContent='트랙 태그를 불러오는 중…';$('#bulkApply').disabled=true;$('#resetBtn').disabled=true;renderTree();renderTracks('트랙 태그를 불러오는 중…');
 $('#albumHeader').setAttribute('aria-busy','true');parent.postMessage({type:'vr-tag-covers',channel},location.origin);
 const request=read('/api/tracks?album='+encodeURIComponent(id));currentTrackRequest=request;
 try{const {result,metrics}=await request;if(!gate.current(ticket))return;const album=result.album;S.album=album;$('#albumHeader .folder-path').textContent=album.path||'';$('#albumHeader .folder-path').title=album.path||'';S.original=clone(album.entries);const saved=S.drafts.get(id+'|shared'),valid=saved?.original===JSON.stringify(S.original);S.draft=clone(valid?saved.draft:album.entries);S.renames=valid?clone(saved.renames):{};S.warnings=valid?clone(saved.warnings):{};S.selected=new Set();S.anchor=null;$('#loadStatus').textContent='';$('#bulkApply').disabled=false;$('#resetBtn').disabled=false;renderTracks();const measurement={album_id:id,...metrics,display_ms:performance.now()-started};S.metrics.push(measurement);parent.postMessage({type:'vr-tag-measured',channel,measurement},location.origin);$('#albumHeader').dataset.readMetrics=JSON.stringify(measurement);window.vrTagEditorLastSelection=measurement;window.dispatchEvent(new CustomEvent('vr-tag-selection-measured',{detail:measurement}));
 if(matchMedia('(max-width:650px)').matches){$('.browser').classList.add('collapsed');$('#browseToggle').textContent='펼치기';$('#browseToggle').setAttribute('aria-expanded','false');}
 }catch(e){if(gate.current(ticket)&&e.message!=='selection_superseded'){$('#loadStatus').textContent=e.message;renderTracks('조회 실패 · 왼쪽 앨범을 다시 선택하세요.');}}
 finally{if(gate.current(ticket)){$('#albumHeader').removeAttribute('aria-busy');currentTrackRequest=null;}}
}
const reasons={existing_value_preserved:'기존값 보존',joint_artist_backslash_protected:'공동 아티스트 보호',filename_does_not_match_format:'변환 형식 불일치',ambiguous_filename_format:'구분자 모호',duplicate_track_number_on_disc:'디스크 내 번호 중복',destination_currently_exists:'파일명 충돌',missing_or_invalid_tracknumber:'번호 확인 필요'};
function changedFields(e){const old=S.original.find(x=>x.file===e.file);return Object.keys(fields).filter(f=>values(e,f)!==values(old,f));}
function cell(e,f){const old=S.original.find(x=>x.file===e.file),diff=values(e,f)!==values(old,f),number=f==='tracknumber',val=number?values(e,f).replace(/^([1-9])(?=\/|$)/,'0$1'):values(e,f);return `<td class="${diff?'changed':''}">${diff?'<del title="원본">'+esc(values(old,f)||'빈 값')+'</del>':''}<input data-field="${f}" data-file="${esc(e.file)}" aria-label="${fields[f]} ${esc(base(e.file))}" value="${esc(val)}" readonly placeholder="${f==='title'?'제목 없음':'—'}" title="${esc(val)}" ${number?'inputmode="numeric"':''}></td>`;}
function renderTracks(empty='선택한 앨범의 트랙이 여기에 표시됩니다.'){
 let lastDisc=null;const entries=S.draft.filter(e=>!$('#missingOnly').checked||changedFields(e).length||S.renames[e.file]||!e.tags.title?.length||!e.tags.tracknumber?.length),parts=[];
 S.visible=entries.map(e=>e.file);
 for(const e of entries){const disc=+(e.tags.discnumber?.[0]?.split('/')[0]||1);if(disc!==lastDisc){parts.push(`<tr class="disc-row"><td colspan="9">DISC ${String(disc).padStart(2,'0')}</td></tr>`);lastDisc=disc;}
 const changed=changedFields(e),common=changed.filter(f=>['album','album_artist','date','discnumber'].includes(f)),old=S.original.find(x=>x.file===e.file),missing=!e.tags.title?.length||!e.tags.tracknumber?.length;
 parts.push(`<tr data-track="${esc(e.file)}" tabindex="0" aria-selected="${S.selected.has(e.file)}" class="${S.selected.has(e.file)?'selected':''}"><td class="row-marker" aria-hidden="true">${S.selected.has(e.file)?'●':'·'}</td><td class="${S.renames[e.file]?'changed':''}"><div class="file-cell"><span class="filename" title="${esc(e.file)}">${esc(base(e.file))}</span><button class="path-open" data-path="${esc(e.file)}" aria-label="${esc(base(e.file))} 파일 경로" title="전체 파일 경로">↗</button></div>${S.renames[e.file]?'<del>'+esc(base(e.file))+'</del><div class="file-proposal">'+esc(S.renames[e.file])+'</div>':''}${common.map(f=>'<small class="file-proposal">'+fields[f]+': '+esc(values(old,f)||'빈 값')+' → '+esc(values(e,f)||'빈 값')+'</small>').join('')}${S.warnings[e.file]?'<small class="row-warning">'+esc(reasons[S.warnings[e.file]]||S.warnings[e.file])+'</small>':''}</td>${['tracknumber','title','artist','album_artist','featuring','genre'].map(f=>cell(e,f)).join('')}<td><span class="state ${changed.length||S.renames[e.file]?'draft':missing?'missing':''}">${changed.length||S.renames[e.file]?'변경 초안':missing?'누락':'정상'}</span></td></tr>`);
 }
 $('#tracks').innerHTML=parts.join('')||`<tr><td colspan="9" class="empty">${esc(S.album?'표시할 트랙이 없습니다.':empty)}</td></tr>`;$('#trackCount').textContent=S.draft.length+'곡';const hiddenSelected=[...S.selected].filter(f=>!S.visible.includes(f)).length;$('#selectedCount').textContent=S.selected.size+' / '+S.draft.length+'곡 선택'+(hiddenSelected?' · 숨김 '+hiddenSelected+'곡':'');$('#discSelectionCount').textContent=S.selected.size+'곡 선택';$('#discApply').disabled=!S.album||!S.selected.size;$('#selectAll').checked=!!S.visible.length&&S.visible.every(f=>S.selected.has(f));$('#selectAll').indeterminate=S.visible.some(f=>S.selected.has(f))&&!$('#selectAll').checked;
 $('#draftCount').textContent='변경 '+S.draft.filter(e=>changedFields(e).length||S.renames[e.file]).length+'곡';$('#commonSummary').textContent=S.album?['album','album_artist','date'].map(f=>{const v=[...new Set(S.draft.map(e=>values(e,f)))];return fields[f]+': '+(v.length>1?'파일별 값 다름':v[0]||'빈 값');}).join(' · '):'';
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
$('#bulkApply').onclick=()=>{if(!S.album)return;try{
 const mode=$('#bulkField').value,withDisc=mode==='number'&&$('#numberDisc').checked;
 if(withDisc&&$('#bulkScope').value!=='selected')throw Error('DISCNUMBER 동시 지정은 선택 트랙 범위를 사용하세요.');
 const disc=withDisc?discDraft(S.draft):null;
 const r=applyBulkDraft({entries:disc?.entries||S.draft,selected:[...S.selected],scope:$('#bulkScope').value,field:mode,value:$('#bulkValue').value,replace:$('#bulkPolicy').value==='replace',format:$('#format').value,start:Number($('#numberStart').value),order:mode==='number'?'display':'filename'});
 if(mode!=='to')S.draft=r.entries;if(mode==='to'){const targets=$('#bulkScope').value==='album'?S.draft.map(e=>e.file):[...S.selected];for(const file of targets)delete S.renames[file];Object.assign(S.renames,r.renames);}else Object.assign(S.renames,r.renames);
 S.warnings={...disc?.warnings,...r.warnings};saveDraft();renderTracks();$('#bulkStatus').textContent=`${r.changed}곡 초안 변경 · ${Object.keys(S.warnings).length}곡 참고`;
 }catch(e){$('#bulkStatus').textContent=e.message;}};
function toolbar(){const f=$('#bulkField').value,isFormat=['from','to'].includes(f),isNumber=['number','normalize'].includes(f);$('#formatControls').hidden=!isFormat;$('#numberControls').hidden=f!=='number';$('.bulk-value').hidden=isFormat||isNumber;$('#bulkPolicy').disabled=f==='normalize'||f==='to';for(const o of $('#variable').options)o.disabled=f==='to'&&o.value==='%dummy%';for(const o of $('#preset').options)o.disabled=f==='to'&&o.value.includes('%dummy%');if(f==='to'&&$('#format').value.includes('%dummy%'))$('#format').value='%discnumber% - $num(%track%,2). %title%';$('#bulkValue').placeholder=['genre','featuring'].includes(f)?'여러 값은 | 로 구분':'변경할 값';}
$('#bulkField').onchange=toolbar;$('#preset').onchange=e=>{if(e.target.value)$('#format').value=e.target.value;};$('#variable').innerHTML+=['artist','albumartist','album','date','year','discnumber','track','title','genre','featuring','dummy'].map(f=>`<option value="%${f}%">%${f}%</option>`).join('');$('#variable').onchange=e=>{const input=$('#format');input.setRangeText(e.target.value,input.selectionStart??input.value.length,input.selectionEnd??input.value.length,'end');input.focus();e.target.value='';};
$('#tracks').onchange=e=>{const file=e.target.dataset.select;if(file){e.target.checked?S.selected.add(file):S.selected.delete(file);renderTracks();return;}const f=e.target.dataset.field;if(!f)return;const entry=S.draft.find(row=>row.file===e.target.dataset.file);if(!entry)return;let val=e.target.value.trim();try{if(f==='tracknumber'){if(val&&!/^(?:0?[1-9]|[1-9]\d)(?:\/\d{1,3})?$/.test(val))throw Error('트랙번호는 01~99입니다.');entry.tags[f]=val?[val.replace(/^([1-9])(?=\/|$)/,'0$1')]:[];}else{const r=applyBulkDraft({entries:S.draft,selected:[entry.file],scope:'selected',field:f,value:val,replace:true});S.draft=r.entries;S.warnings=r.warnings;}saveDraft();}catch(e){toast(e.message);}renderTracks();};
function selectTrack(file,event){
 if(!S.visible.includes(file))return;
 if(event.shiftKey){const from=S.visible.indexOf(S.anchor),to=S.visible.indexOf(file),range=from<0?[file]:S.visible.slice(Math.min(from,to),Math.max(from,to)+1);S.selected=new Set(event.ctrlKey||event.metaKey?[...S.selected,...range]:range);if(from<0)S.anchor=file;}
 else if(event.ctrlKey||event.metaKey){S.selected.has(file)?S.selected.delete(file):S.selected.add(file);S.anchor=file;}
 else {S.selected=new Set([file]);S.anchor=file;}
 renderTracks();const row=[...$('#tracks').querySelectorAll('[data-track]')].find(r=>r.dataset.track===file);row?.focus({preventScroll:true});
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
  e.preventDefault();$('#missingOnly').checked=false;S.selected=new Set(S.draft.map(x=>x.file));S.anchor=S.draft[0]?.file||null;renderTracks();$('#tracks [data-track]')?.focus({preventScroll:true});return;
 }
 const row=e.target.closest('[data-track]');if(!row)return;
 if(e.key===' '){e.preventDefault();selectTrack(row.dataset.track,e);}
 if(e.key==='F2'||e.key==='Enter'){const input=row.querySelector('input[data-field]');if(input){e.preventDefault();input.readOnly=false;input.focus();input.select();}}
});
$('#selectAll').onchange=e=>{S.selected=new Set(e.target.checked?S.visible:[]);S.anchor=null;renderTracks();};
$('#missingOnly').onchange=()=>{S.selected.clear();S.anchor=null;renderTracks();$('#bulkStatus').textContent='필터 변경 · 트랙 선택 해제 · 변경 초안 유지';};
$('#resetBtn').onclick=()=>{if(!S.album)return;S.draft=clone(S.original);S.renames={};S.warnings={};saveDraft();renderTracks();$('#bulkStatus').textContent='초안을 초기화했습니다.';};
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
 $('.bulk-toolbar').setAttribute('data-mode',tool);const caption=$('#formatCaption');if(caption)caption.textContent=tool==='to'?'파일명 생성 패턴':'파일명 추출 패턴';toolbar();renderTracks();
}
document.querySelector('.editor-tools').onclick=e=>{const b=e.target.closest('[data-tool]');if(b)activateTool(b.dataset.tool);};activateTool('tags');

function saveButtonState(){
 const renameMode=activeTool==='to',enabled=renameMode?saveCaps.rename:saveCaps.tags;
 const count=S.draft.filter(e=>S.selected.has(e.file)&&(renameMode?S.renames[e.file]:changedFields(e).length)).length;
 $('#saveTags').disabled=!enabled||!S.album;
 $('#saveTags').textContent=renameMode?'파일명 변경 저장':'태그 변경 저장';
 $('#saveTags').title=enabled?(count?`선택 변경 ${count}곡 실제 파일 저장`:'저장할 변경 초안을 만든 후 누르세요'):(renameMode?'NAS 정식 색인 연결 및 자격 검증 필요':'NAS 태그 저장 기능 확인 필요');
}
async function readSaveCaps(){
 try{const r=await api('/api/save-capabilities');if(r.state==='TAG_EDITOR_SAVE_CAPABILITIES'&&r.version==='tag-editor-save-v1')saveCaps={...r,tags:r.tags===true&&Array.isArray(r.tag_fields),cover:r.cover===true,rename:r.rename===true};}
 catch{saveCaps={tags:false,cover:false,rename:false,tag_fields:[]};}
 $('#saveStatus').textContent=saveCaps.tags?`실제 저장 ON · 태그 ${(saveCaps.tag_formats||['flac']).join('·').toUpperCase()} · ${(saveCaps.tag_fields||[]).length}개 필드 / 파일명 ${saveCaps.rename?'ON':'OFF'}`:'NAS 저장 경로·검증 확인 필요';$('#sourceBadge').textContent=saveCaps.tags?'NAS 실제 음원 · 저장 가능':'NAS 저장 연결 확인 필요';saveButtonState();
}
$('#saveTags').onclick=async()=>{
 if(!S.album)return;if(activeTool==='to'){await saveRenames();return;}if(!saveCaps.tags)return;
 const rows=S.draft.filter(e=>S.selected.has(e.file)&&changedFields(e).length);if(!rows.length){toast('선택 트랙의 변경 초안이 없습니다.');return;}
 if(rows.some(e=>!(saveCaps.tag_formats||['flac']).includes(e.file.split('.').pop().toLowerCase())||changedFields(e).some(f=>!saveCaps.tag_fields.includes(f)))){toast('NAS에서 아직 승인되지 않은 파일 형식 또는 태그 필드입니다.');return;}
 if(!window.confirm(`선택한 ${rows.length}곡의 태그 변경 초안을 저장할까요? 백업과 파일 충돌 검사를 적용합니다.`))return;
 $('#saveTags').disabled=true;$('#editor').inert=true;let completed=0;try{
  const id=S.album.id,plans=[];for(const e of rows){const old=S.original.find(x=>x.file===e.file),fs=changedFields(e),body={album_id:id,file:e.file,edits:Object.fromEntries(fs.map(f=>[f,e.tags[f]])),before_tags:Object.fromEntries(fs.map(f=>[f,old.tags[f]||[]]))};const p=await api('/api/tag/plan',body);if(p.state!=='READ_ONLY_TRACK_WRITE_PLAN')throw Error(p.reason||p.state);plans.push({e,body,p});}
  if(!window.confirm(`선택 ${plans.length}곡의 표시된 태그 변경을 저장합니다. 백업·충돌 검사를 적용합니다. 계속할까요?`))return;
  for(const {e,body} of plans){if(S.album?.id!==id)throw Error('앨범 선택이 변경됐습니다.');const p=await api('/api/tag/plan',body);if(p.state!=='READ_ONLY_TRACK_WRITE_PLAN')throw Error(p.reason||p.state);const r=await api('/api/tag/apply',{...body,expected_plan_id:p.plan_id,confirm_write:true});if(r.state!=='TAG_TRACK_WRITE_COMPLETED')throw Error(r.reason||r.state);S.original.find(x=>x.file===e.file).tags=clone(r.saved_tags||e.tags);e.tags=clone(r.saved_tags||e.tags);completed++;$('#saveStatus').textContent=`저장 ${completed}곡 · operation ${r.operation_id}`;}
  S.drafts.delete(id+'|shared');saveDraft();renderTracks();
 }catch(e){$('#saveStatus').textContent=`저장 ${completed}곡 · 중단: ${e.message}`;}finally{$('#editor').inert=false;saveButtonState();}
};

async function saveRenames(){
 if(!S.album||!saveCaps.rename){toast('파일명 저장 OFF · NAS 정식 색인 연결 확인 필요');return;}
 const id=S.album.id,rows=S.original.filter(e=>S.selected.has(e.file)&&S.renames[e.file]);
 if(!rows.length){toast('변경할 파일명을 먼저 만들고 트랙을 선택하세요.');return;}
 if(!window.confirm(`선택 ${rows.length}곡의 파일명을 화면의 초안대로 저장할까요? 원본 태그는 바꾸지 않으며 백업·Catalog 색인을 함께 확인합니다.`))return;
 $('#editor').inert=true;$('#saveTags').disabled=true;let completed=0,operations=[];
 try{
  // Check the entire selected range before moving the first file. Replan each next
  // file against the Catalog revision produced by the previous native index job.
  for(const e of rows){const p=await api('/api/rename/plan',{album_id:id,file:e.file,new_name:S.renames[e.file]});if(p.state!=='READ_ONLY_RENAME_PLAN')throw Error(p.reason||p.state);}
  for(const e of rows){
   if(S.album?.id!==id)throw Error('앨범 선택이 변경됐습니다.');
   const old=e.file,body={album_id:id,file:old,new_name:S.renames[old]},p=await api('/api/rename/plan',body);
   if(p.state!=='READ_ONLY_RENAME_PLAN')throw Error(p.reason||p.state);
   const r=await api('/api/rename/apply',{...body,expected_plan_id:p.plan_id,confirm_write:true});
   if(r.state!=='RENAME_WRITE_COMPLETED')throw Error([r.reason||r.state,r.operation_id?'operation '+r.operation_id:''].filter(Boolean).join(' · '));
   if(!r.new_file||!r.saved_tags)throw Error('파일명 저장 후 재조회 실패 · 원본 상태를 확인하세요.');
   for(const list of [S.original,S.draft]){const entry=list.find(x=>x.file===old);if(entry){entry.file=r.new_file;entry.relative_file=r.new_file;if(list===S.original)entry.tags=clone(r.saved_tags);}}
   S.selected.delete(old);S.selected.add(r.new_file);if(S.anchor===old)S.anchor=r.new_file;
   delete S.renames[old];delete S.warnings[old];completed++;operations.push(r.operation_id);
   saveDraft();renderTracks();$('#saveStatus').textContent=`파일명 저장 ${completed}/${rows.length}곡 · operation ${r.operation_id}`;
  }
  const fresh=await api('/api/tracks?album='+encodeURIComponent(id));
  const canonical=f=>f.replace(/^\/music\//,'');const names=new Set(fresh.album.entries.map(e=>canonical(e.file)));if(rows.some(e=>!names.has(canonical(e.file))))throw Error('Catalog 파일명 재조회 불일치');
 }catch(e){$('#saveStatus').textContent=`파일명 저장 ${completed}곡 · 중단: ${e.message}`;}
 finally{$('#editor').inert=false;saveButtonState();}
}
