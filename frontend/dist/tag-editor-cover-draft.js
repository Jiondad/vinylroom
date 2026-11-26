/* Tag Editor embedded cover: authenticated inspect/plan/apply per original album.
 * A catalog display cover is NOT proof of an embedded audio front cover. */
export function coverTargets(album,scope,selected=[],formats=['flac','mp3']){
 const allowed=new Set(Array.isArray(formats)?formats.filter(f=>typeof f==='string').map(f=>f.toLowerCase()):[]);
 const files=[...new Set((album?.entries||[]).map(e=>e.file).filter(f=>typeof f==='string'&&/\.[a-z0-9]+$/i.test(f)&&allowed.has(f.split('.').pop().toLowerCase())))];
 return scope==='__all__'?files:scope==='__selected__'?files.filter(f=>selected.includes(f)):files.filter(f=>f===scope);
}
export function coverImageError(file){return !file||!['image/jpeg','image/png'].includes(file.type)||!file.size||file.size>10*1024*1024?'JPG·PNG 10MB 이하 이미지 한 개를 선택하세요.':null;}
export function installTagCoverDraft({getAlbum,api,getSaveCapabilities=()=>({cover:false})}){
 if(typeof getAlbum!=='function'||typeof api!=='function')throw Error('tag_cover_requires_editor_context');
 if(document.getElementById('tagCoverDialog'))throw Error('tag_cover_already_mounted');
 const region=document.createElement('dialog');region.id='tagCoverDialog';region.className='tag-cover-draft';region.setAttribute('aria-labelledby','tagCoverTitle');
 region.innerHTML=`<div class="tag-cover-heading"><div><h2 id="tagCoverTitle">앨범 대표 커버</h2><small>앨범의 모든 음원 파일에 동일한 앞표지를 등록합니다. 폴더 0.jpg와 사이트 대표 이미지는 별도입니다.</small></div><button type="button" data-cover-close aria-label="커버 편집 닫기">닫기</button></div>
 <div class="tag-cover-body"><div id="tagCoverFiles" class="tag-cover-files"></div>
 <div class="tag-cover-drop" data-cover-drop role="group" aria-label="대표 커버 이미지 선택 영역" tabindex="0"><strong>앨범 대표 커버 이미지를 선택하세요</strong><span>한 장의 이미지가 앨범 전체 CD의 모든 트랙에 동일하게 적용됩니다.</span><button type="button" data-cover-pick>이미지 선택</button><small>JPG·PNG · 최대 10MB · 4096px · 선택만으로 음원 파일은 변경되지 않습니다.</small></div>
 <input type="file" id="tagCoverFile" accept="image/png,image/jpeg" hidden><div id="tagCoverStatus" role="status" aria-live="polite"></div>
 <div class="tag-cover-grid"><section><h3>현재 대표 내장 커버</h3><p id="coverCurrentSummary">앨범 파일 상태를 확인하는 중입니다.</p><div class="tag-cover-current"></div></section><section><h3>새 대표 커버</h3><div class="tag-cover-art" id="tagCoverArt"><span>이미지를 선택하세요</span></div></section></div>
 <div class="tag-cover-footer"><button type="button" data-cover-reset>선택 취소</button><button type="button" class="tag-cover-apply" data-cover-save disabled>대표 커버 저장</button></div></div>`;
 document.body.append(region);
 const q=s=>region.querySelector(s),fileInput=q('#tagCoverFile'),art=q('#tagCoverArt'),status=q('#tagCoverStatus'),files=q('#tagCoverFiles'),current=q('.tag-cover-current');
 let albumId='',draft=null,objectUrl=null,version=0,busy=false,states=new Map(),lastResult='';
 const selected=()=>{const caps=getSaveCapabilities();return coverTargets(getAlbum(),'__all__',[],caps.cover===true&&Array.isArray(caps.tag_formats)?caps.tag_formats:[]);};
 function ownerFor(file){const album=getAlbum(),entry=album?.entries?.find(e=>e.file===file);if(!album||!entry)throw Error('현재 앨범 파일이 아닙니다.');if(!album.disc_group)return album.id;const disc=album.discs?.find(d=>d.id===entry.source_album_id);if(!disc||!disc.path||!file.startsWith(disc.path+'/')||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(disc.id))throw Error('커버 대상 CD의 원본 UUID/경로 불일치');return disc.id;}
 const revoke=()=>{if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}};
 function text(tag,value,cls){const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el;}
 function render(){const chosen=selected(),known=chosen.map(f=>states.get(f)).filter(r=>r?.state==='EMBEDDED_COVER_INSPECTED'),withFront=known.filter(r=>r.front_covers?.length),unique=new Set(known.map(r=>JSON.stringify(r.front_covers?.map(p=>p.sha256)||[])));
  files.replaceChildren(text('p',`앨범 전체 · ${chosen.length}곡 · 상태 확인 ${known.length}/${chosen.length}`));
  const excluded=(getAlbum()?.entries||[]).length-chosen.length;if(excluded>0)files.append(text('p',`저장 지원 대상 외 ${excluded}곡 제외 · NAS 승인 형식만 적용합니다.`,'tag-cover-warning'));
  if(chosen.length>10)files.append(text('p','NAS 상태 확인과 저장은 안전을 위해 10곡씩 나누어 자동 처리합니다.','tag-cover-warning'));
  q('#coverCurrentSummary').textContent=known.length?`확인 ${known.length}곡 · 내장 커버 있음 ${withFront.length}곡 · 없음 ${known.length-withFront.length}곡${unique.size>1?' · 기존 커버가 서로 다름':''}`:'내장 커버 상태 확인 전';
  current.replaceChildren();const representative=withFront.find(r=>r.preview_data_url?.startsWith('data:image/jpeg;base64,'));if(representative){const img=document.createElement('img');img.src=representative.preview_data_url;img.alt='현재 앨범 내장 커버';current.append(img);}
  art.replaceChildren();if(draft?.url){const img=document.createElement('img');img.src=draft.url;img.alt='새 앨범 대표 커버';art.append(img);}else art.append(text('span','이미지를 선택하세요'));
  const save=q('[data-cover-save]');save.disabled=busy||!getSaveCapabilities().cover||!draft||!chosen.length;save.textContent=busy?'저장 중…':'대표 커버 저장';
  q('[data-cover-pick]').disabled=busy||!chosen.length;q('[data-cover-reset]').disabled=busy||!draft;
  status.textContent=busy?'앨범 전체의 파일 상태를 확인하고 저장하는 중…':lastResult|| (draft?`새 대표 커버: ${draft.filename} · ${draft.width}×${draft.height} · 아직 저장하지 않았습니다.`:known.length===chosen.length&&chosen.length?'현재 앨범 커버 확인 완료 · 새 이미지를 선택해 변경할 수 있습니다.':'앨범 전체의 내장 커버 상태를 확인하고 있습니다.');
 }
 async function inspectAll(ticket){const chosen=selected();for(let offset=0;offset<chosen.length;offset+=10){if(ticket!==version)return false;for(const file of chosen.slice(offset,offset+10)){let r;try{r=await api('/api/cover/inspect',{album_id:ownerFor(file),file});}catch(e){r={state:'HOLD',reason:e.message};}if(ticket!==version)return false;states.set(file,r);}render();if(chosen.slice(offset,offset+10).some(f=>states.get(f)?.state!=='EMBEDDED_COVER_INSPECTED'))return false;}return true;}
 async function choose(file){if(!file)return;const ticket=++version;const error=coverImageError(file);if(error){lastResult=error;render();return;}const url=URL.createObjectURL(file);try{const photo=new Image();photo.src=url;await photo.decode();const {naturalWidth:width,naturalHeight:height}=photo;if(!width||!height||width>4096||height>4096||width*height>16_000_000)throw Error('커버는 최대 4096px, 1600만 화소까지 허용합니다.');const buffer=await file.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',buffer),base64=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result).split(',')[1]);fr.onerror=reject;fr.readAsDataURL(file);});if(ticket!==version||!albumId){URL.revokeObjectURL(url);return;}revoke();objectUrl=url;draft={mime:file.type,filename:file.name,width,height,bytes:file.size,url,base64,sha256:[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')};lastResult='';render();}catch(e){URL.revokeObjectURL(url);lastResult=e.message||'이미지 처리 실패';render();}}
 async function saveAlbumCover(){const chosen=[...selected()],id=albumId,ticket=version;if(busy||!draft||!getSaveCapabilities().cover||!chosen.length)return;busy=true;lastResult='';render();let completed=0,already=0,error=null,uncertain=null;try{
  if(!await inspectAll(ticket))throw Error('일부 음원의 현재 커버 상태를 확인하지 못했습니다. 저장하지 않았습니다.');
  const pending=chosen.filter(file=>!(states.get(file)?.front_covers||[]).some(pic=>pic.sha256===draft.sha256));
  already=chosen.length-pending.length;
  if(ticket!==version||id!==albumId)return;
  if(!pending.length){lastResult='선택한 대표 커버가 이미 앨범 전체에 적용되어 있습니다. 추가 저장은 필요하지 않습니다.';return;}
  for(const file of pending){if(ticket!==version)break;uncertain=file;const state=states.get(file);if(state?.state!=='EMBEDDED_COVER_INSPECTED')throw Error('현재 파일 상태를 확인하지 못했습니다.');const owner=ownerFor(file),action=(state.front_covers||[]).length?'replace':'add';const p=await api('/api/cover/plan',{album_id:owner,file,action,expected_file_sha256:state.file_sha256,expected_catalog_digest:state.catalog_digest,image_base64:draft.base64});if(p?.state!=='READ_ONLY_COVER_PLAN'||!p.plan_id)throw Error(p?.reason||'변경 계획 확인 실패');
   let r,lastError;for(let attempt=0;attempt<5;attempt++){try{r=await api('/api/cover/apply',{album_id:owner,file,action,expected_file_sha256:state.file_sha256,expected_catalog_digest:state.catalog_digest,expected_plan_id:p.plan_id,image_base64:draft.base64,confirm_write:true});lastError=null;break;}catch(e){lastError=e;if(!/HTTP 409\b/.test(String(e?.message||e))||attempt===4)throw e;await new Promise(resolve=>setTimeout(resolve,[1000,2000,4000,8000][attempt]));if(ticket!==version||id!==albumId)throw Error('화면 선택이 변경되어 저장을 중단했습니다.');}}
   if(lastError)throw lastError;if(r?.state!=='COVER_WRITE_COMPLETED'||r.verification?.state!=='EMBEDDED_COVER_INSPECTED')throw Error(r?.reason||'저장 후 동일 파일 검증 실패');states.set(file,r.verification);completed++;uncertain=null;lastResult=`저장 및 검증 ${completed}/${pending.length}곡 · 기존 동일 커버 ${already}곡 건너뜀`;render();
  }
 }catch(e){error=e.message;if(uncertain){try{const actual=await api('/api/cover/inspect',{album_id:ownerFor(uncertain),file:uncertain});if(actual?.state==='EMBEDDED_COVER_INSPECTED')states.set(uncertain,actual);}catch{}}}
 finally{busy=false;render();}
 if(error){const total=completed+already;lastResult=`기존 동일 커버 ${already}곡 건너뜀 · 이번 저장 ${completed}곡 · 중단: ${error} · 완료 여부를 재조회하세요.`;}else{lastResult=`대표 커버 적용 및 동일 파일 재조회 완료: ${completed+already}/${chosen.length}곡 (기존 적용 ${already}곡 포함)`;revoke();draft=null;}render();
 }
 function reset(){++version;revoke();draft=null;lastResult='이미지 선택을 취소했습니다.';fileInput.value='';render();}
 region.addEventListener('click',e=>{if(e.target===region||e.target.closest('[data-cover-close]')){region.close();return;}if(e.target.closest('[data-cover-save]')){void saveAlbumCover();return;}if(e.target.closest('[data-cover-pick]')){if(!busy&&selected().length)fileInput.click();return;}if(e.target.closest('[data-cover-reset]'))reset();});
 fileInput.addEventListener('change',()=>{const file=fileInput.files?.[0];fileInput.value='';void choose(file);});
 const drop=q('[data-cover-drop]');drop.addEventListener('keydown',e=>{if(e.target===drop&&(e.key==='Enter'||e.key===' ')){e.preventDefault();q('[data-cover-pick]').click();}});for(const kind of ['dragenter','dragover'])drop.addEventListener(kind,e=>{e.preventDefault();drop.classList.add('drag-over');});drop.addEventListener('dragleave',e=>{if(!drop.contains(e.relatedTarget))drop.classList.remove('drag-over');});drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag-over');const images=[...(e.dataTransfer?.files||[])];if(images.length!==1){lastResult='이미지 한 개만 선택하세요.';render();return;}void choose(images[0]);});region.addEventListener('dragover',e=>e.preventDefault());region.addEventListener('drop',e=>e.preventDefault());
 async function open(){const album=getAlbum();if(!album)return;version++;albumId=album.id;states.clear();revoke();draft=null;lastResult='';region.showModal();busy=true;render();try{await inspectAll(version);}finally{busy=false;render();}}
 function close(){version++;busy=false;states.clear();revoke();draft=null;fileInput.value='';if(region.open)region.close();}
 region.addEventListener('close',()=>{version++;revoke();draft=null;});
 render();return {open,close,refresh:render,clear:reset};
}