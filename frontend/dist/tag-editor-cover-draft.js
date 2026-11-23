/* Tag Editor embedded cover: authenticated inspect/plan/apply per original album.
 * A catalog display cover is NOT proof of an embedded audio front cover. */
export function coverTargets(album,scope,selected=[]){
 const files=[...new Set((album?.entries||[]).map(e=>e.file).filter(f=>typeof f==='string'&&/\.(flac|mp3)$/i.test(f)))];
 return scope==='__all__'?files:scope==='__selected__'?files.filter(f=>selected.includes(f)):files.filter(f=>f===scope);
}
export function coverImageError(file){return !file||!['image/jpeg','image/png'].includes(file.type)||!file.size||file.size>10*1024*1024?'JPG·PNG 10MB 이하 이미지 한 개를 선택하세요.':null;}
export function installTagCoverDraft({getAlbum,getSelectedFiles,api,getSaveCapabilities=()=>({cover:false})}){
 if(typeof getAlbum!=='function'||typeof getSelectedFiles!=='function'||typeof api!=='function')throw Error('tag_cover_requires_editor_context');
 if(document.getElementById('tagCoverDialog'))throw Error('tag_cover_already_mounted');
 const region=document.createElement('dialog');region.id='tagCoverDialog';region.className='tag-cover-draft';region.setAttribute('aria-labelledby','tagCoverTitle');
 region.innerHTML=`<div class="tag-cover-heading"><div><h2 id="tagCoverTitle">내장 커버</h2><small>음원 파일 앞표지 · 폴더 0.jpg와 별개</small></div><button type="button" data-cover-close aria-label="커버 편집 닫기">닫기</button></div>
 <div class="tag-cover-body"><div class="cover-scope"><button type="button" data-cover-scope="__all__">앨범 전체</button><button type="button" data-cover-scope="__selected__">선택 트랙</button></div><div id="tagCoverFiles" class="tag-cover-files"></div>
 <div class="tag-cover-actions"><button type="button" data-cover-inspect>현재 상태 조회</button><button type="button" data-cover-action="add">추가</button><button type="button" data-cover-action="replace">교체</button><button type="button" data-cover-action="remove">제거</button><button type="button" data-cover-reset>초안 취소</button></div>
 <div class="tag-cover-drop" data-cover-drop role="group" aria-label="커버 이미지 드롭 영역" tabindex="0"><strong>JPG·PNG 이미지를 여기에 놓으세요</strong><span>이미지 하나로 전체 대상의 초안을 만듭니다.</span><button type="button" data-cover-pick>이미지 선택</button><small>최대 10MB · 4096px · 선택만으로 파일이 변경되지 않습니다.</small></div>
 <input type="file" id="tagCoverFile" accept="image/png,image/jpeg" hidden><div id="tagCoverStatus" role="status" aria-live="polite"></div>
 <div class="tag-cover-grid"><section><h3>현재 내장 앞표지</h3><p id="coverCurrentSummary"></p><div class="tag-cover-current"></div></section><section><h3>변경 예정</h3><div class="tag-cover-art" id="tagCoverArt"><span>이미지를 선택하세요</span></div></section></div>
 <div class="tag-cover-footer"><button type="button" data-cover-plan>변경 계획 확인</button><button type="button" class="tag-cover-apply" data-cover-save disabled title="음원 쓰기 경로는 비활성화되어 있습니다.">파일 저장 OFF</button></div></div>`;
 document.body.append(region);
 const q=s=>region.querySelector(s),fileInput=q('#tagCoverFile'),art=q('#tagCoverArt'),status=q('#tagCoverStatus'),files=q('#tagCoverFiles'),current=q('.tag-cover-current');
 const controls=[...region.querySelectorAll('[data-cover-action]')];
 let scope='__all__';let albumId='',draft=null,objectUrl=null,intent=null,version=0,selectionKey='',busy=false,states=new Map(),plans=new Map(),lastResult='';
 const selected=()=>coverTargets(getAlbum(),scope,getSelectedFiles());const name=f=>f.split('/').pop();
 // Multi-CD view IDs are synthetic. Every Writer request requires the
 // authenticated original disc UUID and exact file path.
 function ownerFor(file){
  const album=getAlbum(),entry=album?.entries?.find(e=>e.file===file);
  if(!album||!entry)throw Error('현재 앨범 파일이 아닙니다.');
  if(!album.disc_group)return album.id;
  const disc=album.discs?.find(d=>d.id===entry.source_album_id);
  if(!disc||!disc.path||!file.startsWith(disc.path+'/')||
     !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(disc.id))
   throw Error('커버 대상 CD의 원본 UUID/경로 불일치');
  return disc.id;
 }
 const revoke=()=>{if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}};
 function reset(){++version;revoke();draft=null;intent=null;plans.clear();lastResult='';fileInput.value='';render();}
 function sync(){const id=getAlbum()?.id||'',key=JSON.stringify([id,...selected()]);if(key!==selectionKey){selectionKey=key;++version;states.clear();plans.clear();}if(id!==albumId){albumId=id;revoke();draft=null;lastResult='';}if(!id&&region.open)region.close();}
 function text(tag,value,cls){const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el;}
 const explainHold=reason=>({
  front_cover_already_present_use_replace:'내장 커버가 이미 있습니다. 추가 대신 교체를 선택하세요.',
  no_front_cover_to_change:'내장 커버가 없습니다. 교체 대신 추가를 선택하세요.',
  same_cover_no_change:'기존 내장 커버와 동일한 이미지입니다. 변경할 필요가 없습니다.',
  no_change:'변경할 커버 내용이 없습니다.',
  catalog_lease_busy_retry_later:'NAS 색인 작업과 충돌했습니다. 현재 저장 상태를 확인하세요.'
 })[reason]||reason||'변경 계획을 확인하세요.';
 function render(){sync();const chosen=selected();controls.forEach(b=>{b.disabled=busy||!chosen.length;b.setAttribute('aria-pressed',String(draft?.action===b.dataset.coverAction));});region.querySelectorAll('[data-cover-scope]').forEach(b=>{b.disabled=busy;b.setAttribute('aria-pressed',String(b.dataset.coverScope===scope));});q('[data-cover-pick]').disabled=busy||!chosen.length;
  const inspected=chosen.filter(f=>states.get(f)?.state==='EMBEDDED_COVER_INSPECTED').length,planned=chosen.filter(f=>plans.get(f)?.state==='READ_ONLY_COVER_PLAN').length;
  // Only for uniform, fully inspected selections. Mixed cover states must
  // remain explicit; never silently apply an unsuitable action to a track.
  if(!busy&&draft&&['add','replace'].includes(draft.action)&&inspected===chosen.length&&chosen.length){
   const fronts=chosen.map(f=>(states.get(f)?.front_covers||[]).length>0);
   const next=fronts.every(Boolean)?'replace':fronts.every(x=>!x)?'add':null;
   if(next&&next!==draft.action){draft={...draft,action:next};plans.clear();
    lastResult=next==='replace'?'선택한 모든 곡에 커버가 있어 교체로 변경했습니다.':'선택한 모든 곡에 커버가 없어 추가로 변경했습니다.';}
  }
  q('[data-cover-inspect]').disabled=busy||!chosen.length;
  q('[data-cover-inspect]').textContent=inspected&&inspected<chosen.length?'다음 현재 상태 조회':'현재 상태 조회';
  q('[data-cover-plan]').disabled=busy||!draft||!chosen.length;
  q('[data-cover-plan]').textContent=planned&&planned<chosen.length?'다음 변경 계획 확인':'변경 계획 확인';const save=q('[data-cover-save]');save.disabled=busy||!getSaveCapabilities().cover||!draft||!chosen.length;save.title=planned===chosen.length?'저장 전에 변경 계획을 다시 검증합니다.':'저장 시 현재 상태와 변경 계획을 자동 확인하고 최종 승인을 요청합니다.';save.textContent=getSaveCapabilities().cover?'내장 커버 저장':'파일 저장 OFF';
  art.replaceChildren();if(draft?.url){const img=document.createElement('img');img.src=draft.url;img.alt='변경 예정 내장 앞표지';art.append(img);}else art.append(text('span',draft?.action==='remove'?'앞표지 제거 예정':'표지 초안 없음'));
  files.replaceChildren(text('p',`${scope==='__all__'?'전체':'선택'} ${chosen.length}곡 · 변경 초안 ${draft?chosen.length:0}곡 · 상태 확인 ${inspected}/${chosen.length} · 계획 확인 ${planned}/${chosen.length}`));
  if(chosen.length>10)files.append(text('p','현재 상태와 계획은 10곡씩 확인합니다.','tag-cover-warning'));
  status.textContent=busy?'NAS에서 현재 파일을 확인하는 중…':lastResult?lastResult:draft?`${{add:'추가',replace:'교체',remove:'제거'}[draft.action]} 초안 · ${draft.filename||'새 이미지 없음'}${draft.width?' · '+draft.width+'×'+draft.height+' · '+draft.mime+' · '+Math.ceil(draft.bytes/1024)+'KB':''} · 실제 쓰기 없음`:chosen.length&&chosen.every(f=>states.get(f)?.state==='EMBEDDED_COVER_INSPECTED')?'내장 커버 조회 완료 · 원본 보존':chosen.some(file=>states.get(file)?.state==='EMBEDDED_COVER_INSPECTED')?'현재 내장 커버 조회 완료 · 저장 OFF':'파일을 선택하고 현재 상태를 조회하세요.';
  current.replaceChildren();const known=chosen.map(f=>states.get(f)).filter(r=>r?.state==='EMBEDDED_COVER_INSPECTED'),withFront=known.filter(r=>r.front_covers?.length),variants=new Set(known.map(r=>JSON.stringify(r.front_covers?.map(p=>p.sha256)||[])));
  q('#coverCurrentSummary').textContent=known.length?`조회 ${known.length}곡 · 앞표지 있음 ${withFront.length}곡 · 없음 ${known.length-withFront.length}곡`:'내장 커버 미조회';
  if(variants.size>1)q('#coverCurrentSummary').textContent+=' · 커버 혼재, 대표 이미지';
  const representative=withFront.find(r=>r.preview_data_url?.startsWith('data:image/jpeg;base64,'));if(representative){const img=document.createElement('img');img.src=representative.preview_data_url;img.alt='현재 내장 앞표지 대표 이미지';current.append(img);}
  const holds=chosen.filter(f=>plans.get(f)&&plans.get(f).state!=='READ_ONLY_COVER_PLAN');if(holds.length)files.append(text('p',`계획 보류 ${holds.length}곡 · `+[...new Set(holds.map(f=>explainHold(plans.get(f).reason)))].join(', ')));
 }
 async function saveChosen(){const chosen=[...selected()],id=albumId,ticket=version;if(busy||!getSaveCapabilities().cover)return;
  if(!chosen.length){status.textContent='저장할 곡을 선택하세요.';return;}
  if(!draft){lastResult='추가·교체·제거할 커버 변경 초안을 먼저 만드세요.';status.textContent=lastResult;return;}
  // Save is a guided action: read and plan every selected file before asking for write approval.
  // Existing inspect/plan API remains read-only and uses file/Catalog CAS.
  for(let offset=0;offset<chosen.length;offset+=10){if(ticket!==version||id!==albumId)return;await inspectChosen();if(chosen.slice(offset,offset+10).some(f=>states.get(f)?.state!=='EMBEDDED_COVER_INSPECTED')){status.textContent='현재 상태 조회에 실패한 트랙이 있습니다. 저장하지 않았습니다.';return;}}
  for(let offset=0;offset<chosen.length;offset+=10){if(ticket!==version||id!==albumId)return;await makePlans();if(chosen.slice(offset,offset+10).some(f=>plans.get(f)?.state!=='READ_ONLY_COVER_PLAN')){status.textContent='변경 계획 확인이 보류됐습니다. 추가·교체 선택 및 트랙 상태를 확인하세요.';return;}}
  if(ticket!==version||id!==albumId||!chosen.every(f=>plans.get(f)?.state==='READ_ONLY_COVER_PLAN'))return;
  if(!window.confirm(`선택 범위 ${chosen.length}곡의 내장 커버를 저장합니다. 기존 백업과 충돌 검사를 적용합니다. 계속할까요?`))return;busy=true;render();let completed=0,error=null,uncertainFile=null,rechecked='';try{for(const file of chosen){if(ticket!==version)break;uncertainFile=file;const state=states.get(file),p=plans.get(file);const owner=ownerFor(file);
 // The preceding file save can change inventory state. Refresh the CAS plan
 // for this exact file and do not auto-retry any uncertain apply.
 const latest=await api('/api/cover/inspect',{album_id:owner,file});
 if(latest?.state!=='EMBEDDED_COVER_INSPECTED')throw Error(latest?.reason||'저장 직전 커버 재조회 실패');
 const refreshed=await api('/api/cover/plan',{album_id:owner,file,action:draft.action,
  expected_file_sha256:latest.file_sha256,expected_catalog_digest:latest.catalog_digest,
  ...(draft.action==='remove'?{}:{image_base64:draft.base64})});
 if(refreshed?.state!=='READ_ONLY_COVER_PLAN'||!refreshed.plan_id)
  throw Error(refreshed?.reason||'저장 직전 커버 계획 실패');
 const r=await api('/api/cover/apply',{album_id:owner,file,action:draft.action,
  expected_file_sha256:latest.file_sha256,expected_catalog_digest:latest.catalog_digest,
  expected_plan_id:refreshed.plan_id,...(draft.action==='remove'?{}:{image_base64:draft.base64}),confirm_write:true});if(r.state!=='COVER_WRITE_COMPLETED')throw Error([r.reason||r.state,r.operation_id?'operation '+r.operation_id:''].filter(Boolean).join(' · '));if(r.verification?.state!=='EMBEDDED_COVER_INSPECTED')throw Error('저장 후 같은 파일의 내장 커버 재조회 실패');completed++;uncertainFile=null;plans.delete(file);states.set(file,r.verification);}}catch(e){
   error=e.message;
   // A timed-out HTTP reply may follow a committed write. Read only; no retry.
   if(uncertainFile){try{const actual=await api('/api/cover/inspect',{album_id:ownerFor(uncertainFile),file:uncertainFile});
    if(actual?.state==='EMBEDDED_COVER_INSPECTED'){states.set(uncertainFile,actual);rechecked=' · 대상 파일 실제 상태 재조회 완료';}
    else rechecked=' · 대상 파일 상태 불확실, 자동 재시도 금지';
   }catch{rechecked=' · 대상 파일 재조회 실패, 자동 재시도 금지';}}
  }finally{busy=false;render();}
  lastResult=error?'저장 '+completed+'곡 응답 확인 · 중단: '+explainHold(error)+rechecked:'내장 커버 저장·동일 파일 재조회 완료 '+completed+'곡';status.textContent=lastResult;}
 async function inspectChosen(){sync();const chosen=selected().filter(f=>states.get(f)?.state!=='EMBEDDED_COVER_INSPECTED').slice(0,10),ticket=version,id=albumId;if(!chosen.length)return;busy=true;render();try{for(const file of chosen){let r;try{r=await api('/api/cover/inspect',{album_id:ownerFor(file),file});}catch(e){r={state:'HOLD',reason:e.message};}if(ticket!==version)return;states.set(file,r);lastResult='';} }finally{busy=false;render();}}
 async function makePlans(){sync();const chosen=selected().filter(f=>plans.get(f)?.state!=='READ_ONLY_COVER_PLAN').slice(0,10),ticket=version,id=albumId;if(!draft||!chosen.length)return;busy=true;render();try{for(const file of chosen){const state=states.get(file);if(state?.state!=='EMBEDDED_COVER_INSPECTED'){plans.set(file,{state:'HOLD',reason:'현재 내장 커버를 먼저 조회하세요.'});continue;}let r;try{r=await api('/api/cover/plan',{album_id:ownerFor(file),file,action:draft.action,expected_file_sha256:state.file_sha256,expected_catalog_digest:state.catalog_digest,...(draft.action==='remove'?{}:{image_base64:draft.base64})});}catch(e){r={state:'HOLD',reason:e.message};}if(ticket!==version)return;plans.set(file,r);lastResult='';} }finally{busy=false;render();}}
 async function choose(file,action){if(!file)return;const ticket=++version;plans.clear();const error=coverImageError(file);if(error){reset();status.textContent=error;return;}const url=URL.createObjectURL(file);try{const photo=new Image();photo.src=url;await photo.decode();const {naturalWidth:width,naturalHeight:height}=photo;if(!width||!height||width>4096||height>4096||width*height>16_000_000)throw Error('커버는 최대 4096px, 1600만 화소까지 허용합니다.');const buffer=await file.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',buffer);const base64=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result).split(',')[1]);fr.onerror=reject;fr.readAsDataURL(file);});if(ticket!==version||!albumId){URL.revokeObjectURL(url);return;}lastResult='';revoke();objectUrl=url;draft={action,mime:file.type,filename:file.name,width,height,bytes:file.size,url,base64,sha256:[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')};render();}catch(e){URL.revokeObjectURL(url);reset();status.textContent=e.message||'이미지 디코딩 실패';}}
 region.addEventListener('click',e=>{if(e.target===region||e.target.closest('[data-cover-close]')){region.close();return;}const target=e.target.closest('[data-cover-scope]');if(target&&!busy){scope=target.dataset.coverScope;version++;states.clear();plans.clear();lastResult='';render();return;}if(e.target.closest('[data-cover-save]')){void saveChosen();return;}const action=e.target.closest('[data-cover-action]')?.dataset.coverAction;if(action==='add'||action==='replace'){if(!selected().length||busy)return;if(draft?.base64){draft={...draft,action};plans.clear();lastResult='';render();}else{intent=action;fileInput.click();}}else if(action==='remove'){if(!selected().length)return;reset();draft={action:'remove'};render();}else if(e.target.closest('[data-cover-pick]')){if(!busy&&selected().length){intent=draft?.action==='add'?'add':'replace';fileInput.click();}}else if(e.target.closest('[data-cover-reset]'))reset();else if(e.target.closest('[data-cover-inspect]'))void inspectChosen();else if(e.target.closest('[data-cover-plan]'))void makePlans();});
 fileInput.addEventListener('change',()=>{const action=intent,file=fileInput.files?.[0];intent=null;fileInput.value='';if(action)void choose(file,action);});
 const drop=q('[data-cover-drop]');
 drop.addEventListener('keydown',e=>{if(e.target===drop&&(e.key==='Enter'||e.key===' ')){e.preventDefault();q('[data-cover-pick]').click();}});
 for(const kind of ['dragenter','dragover'])drop.addEventListener(kind,e=>{e.preventDefault();drop.classList.add('drag-over');});
 drop.addEventListener('dragleave',e=>{if(!drop.contains(e.relatedTarget))drop.classList.remove('drag-over');});
 drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag-over');if(busy||!selected().length)return;const images=[...(e.dataTransfer?.files||[])];if(images.length!==1){status.textContent='JPG·PNG 이미지 한 개만 놓으세요.';return;}void choose(images[0],draft?.action==='add'?'add':'replace');});
 region.addEventListener('dragover',e=>e.preventDefault());region.addEventListener('drop',e=>e.preventDefault());
 function open(){const album=getAlbum();if(!album)return;lastResult='';scope='__all__';albumId=album.id;selectionKey='';states.clear();plans.clear();revoke();draft=null;render();region.showModal();}
 function close(){++version;lastResult='';busy=false;states.clear();plans.clear();revoke();draft=null;intent=null;fileInput.value='';if(region.open)region.close();}
 region.addEventListener('close',()=>{++version;revoke();draft=null;intent=null;});
 render();return {open,close,refresh:render,clear:reset};
}
