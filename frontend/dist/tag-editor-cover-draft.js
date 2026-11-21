/* Phase H: reuse cover draft UI, authenticated parent bridge, NAS read/plan only.
 * No apply request is implemented. Indexed album artwork is NOT embedded cover proof. */
export function coverTargets(album,scope,selected=[]){
 const files=[...new Set((album?.entries||[]).map(e=>e.file).filter(f=>typeof f==='string'&&/\.(flac|mp3)$/i.test(f)))];
 return scope==='__all__'?files:scope==='__selected__'?files.filter(f=>selected.includes(f)):files.filter(f=>f===scope);
}
export function coverImageError(file){return !file||!['image/jpeg','image/png'].includes(file.type)||!file.size||file.size>10*1024*1024?'JPG·PNG 10MB 이하 이미지 한 개를 선택하세요.':null;}
export function installTagCoverDraft({getAlbum,getSelectedFiles,api}){
 if(typeof getAlbum!=='function'||typeof getSelectedFiles!=='function'||typeof api!=='function')throw Error('tag_cover_requires_editor_context');
 if(document.getElementById('tagCoverDialog'))throw Error('tag_cover_already_mounted');
 const region=document.createElement('dialog');region.id='tagCoverDialog';region.className='tag-cover-draft';region.setAttribute('aria-labelledby','tagCoverTitle');
 region.innerHTML=`<div class="tag-cover-heading"><div><h2 id="tagCoverTitle">내장 커버</h2><small>음원 파일 앞표지 · 폴더 0.jpg와 별개</small></div><button type="button" data-cover-close aria-label="커버 편집 닫기">닫기</button></div>
 <div class="tag-cover-body"><label class="cover-target">적용 범위<select data-cover-target><option value="__all__">앨범 전체 음원</option></select></label><div id="tagCoverFiles" class="tag-cover-files"></div>
 <div class="tag-cover-actions"><button type="button" data-cover-inspect>현재 상태 조회</button><button type="button" data-cover-action="add">추가</button><button type="button" data-cover-action="replace">교체</button><button type="button" data-cover-action="remove">제거</button><button type="button" data-cover-reset>초안 취소</button></div>
 <div class="tag-cover-drop" data-cover-drop role="group" aria-label="커버 이미지 드롭 영역" tabindex="0"><strong>JPG·PNG 이미지를 여기에 놓으세요</strong><span>이미지 하나로 전체 대상의 초안을 만듭니다.</span><button type="button" data-cover-pick>이미지 선택</button><small>최대 10MB · 4096px · 선택만으로 파일이 변경되지 않습니다.</small></div>
 <input type="file" id="tagCoverFile" accept="image/png,image/jpeg" hidden><div id="tagCoverStatus" role="status" aria-live="polite"></div>
 <div class="tag-cover-grid"><section><h3>현재 파일 내장 앞표지</h3><div class="tag-cover-current"></div></section><section><h3>변경 예정</h3><div class="tag-cover-art" id="tagCoverArt"><span>이미지를 선택하세요</span></div></section></div>
 <div class="tag-cover-footer"><button type="button" data-cover-plan>변경 계획 확인</button><button type="button" class="tag-cover-apply" disabled title="음원 쓰기 경로는 비활성화되어 있습니다.">파일 저장 OFF</button></div></div>`;
 document.body.append(region);
 const q=s=>region.querySelector(s),fileInput=q('#tagCoverFile'),art=q('#tagCoverArt'),status=q('#tagCoverStatus'),files=q('#tagCoverFiles'),current=q('.tag-cover-current');
 const controls=[...region.querySelectorAll('[data-cover-action]')];
 let albumId='',draft=null,objectUrl=null,intent=null,version=0,selectionKey='',busy=false,states=new Map(),plans=new Map();
 const selected=()=>coverTargets(getAlbum(),q('[data-cover-target]').value,getSelectedFiles());const name=f=>f.split('/').pop();
 const revoke=()=>{if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}};
 function reset(){++version;revoke();draft=null;intent=null;plans.clear();fileInput.value='';render();}
 function sync(){const id=getAlbum()?.id||'',key=JSON.stringify([id,...selected()]);if(key!==selectionKey){selectionKey=key;++version;states.clear();plans.clear();}if(id!==albumId){albumId=id;revoke();draft=null;}if(!id&&region.open)region.close();}
 function text(tag,value,cls){const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el;}
 function render(){sync();const chosen=selected();controls.forEach(b=>{b.disabled=busy||!chosen.length;b.setAttribute('aria-pressed',String(draft?.action===b.dataset.coverAction));});q('[data-cover-target]').disabled=busy;q('[data-cover-pick]').disabled=busy||!chosen.length;
  const inspected=chosen.filter(f=>states.get(f)?.state==='EMBEDDED_COVER_INSPECTED').length,planned=chosen.filter(f=>plans.get(f)?.state==='READ_ONLY_COVER_PLAN').length;
  q('[data-cover-inspect]').disabled=busy||!chosen.length;
  q('[data-cover-inspect]').textContent=inspected&&inspected<chosen.length?'다음 현재 상태 조회':'현재 상태 조회';
  q('[data-cover-plan]').disabled=busy||!draft||!chosen.length;
  q('[data-cover-plan]').textContent=planned&&planned<chosen.length?'다음 변경 계획 확인':'변경 계획 확인';
  art.replaceChildren();if(draft?.url){const img=document.createElement('img');img.src=draft.url;img.alt='변경 예정 내장 앞표지';art.append(img);}else art.append(text('span',draft?.action==='remove'?'앞표지 제거 예정':'표지 초안 없음'));
  files.replaceChildren(text('p',`대상 ${chosen.length}곡 · 초안 ${draft?chosen.length:0}곡 · 상태 확인 ${inspected}/${chosen.length} · 계획 확인 ${planned}/${chosen.length}곡: ${chosen.slice(0,5).map(name).join(', ')}${chosen.length>5?' 외 '+(chosen.length-5)+'곡':''}`));
  if(chosen.length>1)files.append(text('p','같은 이미지로 전체 대상 초안 구성 · 실제 일괄 저장 OFF','tag-cover-warning'));
  if(chosen.length>10)files.append(text('p','NAS 상태·계획은 버튼을 누를 때 최대 10곡씩 확인합니다. 전체 초안은 유지됩니다.','tag-cover-warning'));
  status.textContent=busy?'NAS에서 현재 파일을 확인하는 중…':draft?`${{add:'추가',replace:'교체',remove:'제거'}[draft.action]} 초안 · ${draft.filename||'새 이미지 없음'}${draft.width?' · '+draft.width+'×'+draft.height+' · '+draft.mime+' · '+Math.ceil(draft.bytes/1024)+'KB':''} · 실제 쓰기 없음`:chosen.length&&chosen.every(f=>states.get(f)?.state==='EMBEDDED_COVER_INSPECTED')?'내장 커버 조회 완료 · 원본 보존':chosen.some(file=>states.get(file)?.state==='EMBEDDED_COVER_INSPECTED')?'현재 내장 커버 조회 완료 · 저장 OFF':'파일을 선택하고 현재 상태를 조회하세요.';
  current.replaceChildren();for(const file of chosen.slice(0,120)){const row=document.createElement('article');row.append(text('strong',name(file)));const state=states.get(file),plan=plans.get(file);if(!state){row.append(text('p','내장 커버 미조회 · 앨범 색인 커버로 대체하지 않음'));}else if(state.state!=='EMBEDDED_COVER_INSPECTED'){row.append(text('p','HOLD: '+(state.reason||'현재 상태 확인 실패')));}else{
   const front=state.front_covers||[];row.append(text('p',`실제 내장 앞표지 ${front.length}개 · 기타 이미지 ${state.other_cover_count}개`));if(state.preview_data_url?.startsWith('data:image/jpeg;base64,')){const img=document.createElement('img');img.src=state.preview_data_url;img.alt=name(file)+' 원본 내장 앞표지';row.append(img);}row.append(text('p','파일 SHA256: '+state.file_sha256,'tag-cover-hash'));for(const pic of front)row.append(text('p',`${pic.mime} · ${pic.bytes} bytes · SHA256 ${pic.sha256}`,'tag-cover-hash'));
   if(draft)row.append(text('p',`변경 예정: ${{add:'앞표지 추가',replace:'앞표지 교체',remove:'앞표지 제거'}[draft.action]}${draft.sha256?' · SHA256 '+draft.sha256:''}`));
  }if(plan)row.append(text('p',plan.state==='READ_ONLY_COVER_PLAN'?'계획 확인 완료 · plan_id '+plan.plan_id:'HOLD: '+(plan.reason||'계획 확인 실패'),'tag-cover-hash'));current.append(row);}
 }
 async function inspectChosen(){sync();const chosen=selected().filter(f=>states.get(f)?.state!=='EMBEDDED_COVER_INSPECTED').slice(0,10),ticket=version,id=albumId;if(!chosen.length)return;busy=true;render();try{for(const file of chosen){let r;try{r=await api('/api/cover/inspect',{album_id:id,file});}catch(e){r={state:'HOLD',reason:e.message};}if(ticket!==version)return;states.set(file,r);} }finally{busy=false;render();}}
 async function makePlans(){sync();const chosen=selected().filter(f=>plans.get(f)?.state!=='READ_ONLY_COVER_PLAN').slice(0,10),ticket=version,id=albumId;if(!draft||!chosen.length)return;busy=true;render();try{for(const file of chosen){const state=states.get(file);if(state?.state!=='EMBEDDED_COVER_INSPECTED'){plans.set(file,{state:'HOLD',reason:'현재 내장 커버를 먼저 조회하세요.'});continue;}let r;try{r=await api('/api/cover/plan',{album_id:id,file,action:draft.action,expected_file_sha256:state.file_sha256,expected_catalog_digest:state.catalog_digest,...(draft.action==='remove'?{}:{image_base64:draft.base64})});}catch(e){r={state:'HOLD',reason:e.message};}if(ticket!==version)return;plans.set(file,r);} }finally{busy=false;render();}}
 async function choose(file,action){if(!file)return;const ticket=++version;plans.clear();const error=coverImageError(file);if(error){reset();status.textContent=error;return;}const url=URL.createObjectURL(file);try{const photo=new Image();photo.src=url;await photo.decode();const {naturalWidth:width,naturalHeight:height}=photo;if(!width||!height||width>4096||height>4096||width*height>16_000_000)throw Error('커버는 최대 4096px, 1600만 화소까지 허용합니다.');const buffer=await file.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',buffer);const base64=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result).split(',')[1]);fr.onerror=reject;fr.readAsDataURL(file);});if(ticket!==version||!albumId){URL.revokeObjectURL(url);return;}revoke();objectUrl=url;draft={action,mime:file.type,filename:file.name,width,height,bytes:file.size,url,base64,sha256:[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')};render();}catch(e){URL.revokeObjectURL(url);reset();status.textContent=e.message||'이미지 디코딩 실패';}}
 region.addEventListener('click',e=>{if(e.target===region||e.target.closest('[data-cover-close]')){region.close();return;}const action=e.target.closest('[data-cover-action]')?.dataset.coverAction;if(action==='add'||action==='replace'){if(!selected().length||busy)return;if(draft?.base64){draft={...draft,action};plans.clear();render();}else{intent=action;fileInput.click();}}else if(action==='remove'){if(!selected().length)return;reset();draft={action:'remove'};render();}else if(e.target.closest('[data-cover-pick]')){if(!busy&&selected().length){intent=draft?.action==='add'?'add':'replace';fileInput.click();}}else if(e.target.closest('[data-cover-reset]'))reset();else if(e.target.closest('[data-cover-inspect]'))void inspectChosen();else if(e.target.closest('[data-cover-plan]'))void makePlans();});
 fileInput.addEventListener('change',()=>{const action=intent,file=fileInput.files?.[0];intent=null;fileInput.value='';if(action)void choose(file,action);});
 q('[data-cover-target]').addEventListener('change',()=>{++version;states.clear();plans.clear();render();});
 const drop=q('[data-cover-drop]');
 drop.addEventListener('keydown',e=>{if(e.target===drop&&(e.key==='Enter'||e.key===' ')){e.preventDefault();q('[data-cover-pick]').click();}});
 for(const kind of ['dragenter','dragover'])drop.addEventListener(kind,e=>{e.preventDefault();drop.classList.add('drag-over');});
 drop.addEventListener('dragleave',e=>{if(!drop.contains(e.relatedTarget))drop.classList.remove('drag-over');});
 drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag-over');if(busy||!selected().length)return;const images=[...(e.dataTransfer?.files||[])];if(images.length!==1){status.textContent='JPG·PNG 이미지 한 개만 놓으세요.';return;}void choose(images[0],draft?.action==='add'?'add':'replace');});
 region.addEventListener('dragover',e=>e.preventDefault());region.addEventListener('drop',e=>e.preventDefault());
 function open(){const album=getAlbum();if(!album)return;albumId=album.id;selectionKey='';states.clear();plans.clear();revoke();draft=null;const select=q('[data-cover-target]');select.replaceChildren(text('option','앨범 전체 음원'));select.firstElementChild.value='__all__';
  for(const entry of album.entries||[]){if(!/\.(flac|mp3)$/i.test(entry.file))continue;const option=text('option',name(entry.file));option.value=entry.file;select.append(option);}
  const chosen=coverTargets(album,'__selected__',getSelectedFiles());if(chosen.length>0){const option=text('option',`선택한 ${chosen.length}개 음원만`);option.value='__selected__';select.append(option);}
  render();region.showModal();
 }
 function close(){++version;busy=false;states.clear();plans.clear();revoke();draft=null;intent=null;fileInput.value='';if(region.open)region.close();}
 region.addEventListener('close',()=>{++version;revoke();draft=null;intent=null;});
 render();return {open,close,refresh:render,clear:reset};
}
