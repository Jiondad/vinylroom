/* Vinyl Room Tag Editor Phase H — browser-only cover draft; no NAS requests/writes.
 * Existing Tag Editor owns the verified selection and album state.
 * The production bridge has no cover-writer route; apply stays disabled. */
export function installTagCoverDraft({getAlbum,getSelectedFiles}) {
  if (typeof getAlbum !== 'function' || typeof getSelectedFiles !== 'function') {
    throw Error('tag_cover_requires_editor_context');
  }
  const host = document.querySelector('.tags-panel');
  const albumHeader = document.querySelector('#albumHeader');
  if (!host || !albumHeader) throw Error('tag_cover_mount_missing');
  const region = document.createElement('section');
  region.className = 'tag-cover-draft';
  region.setAttribute('aria-label', '내장 앨범 커버 편집 초안');
  region.innerHTML = `
    <div class="tag-cover-heading"><h3>내장 커버 관리</h3><span>미리보기 전용 · 실제 저장 비활성</span></div>
    <div class="tag-cover-grid">
      <div class="tag-cover-art" id="tagCoverArt" aria-label="새 내장 표지 미리보기"><span>표지 초안 없음</span></div>
      <div class="tag-cover-details">
        <p>선택한 트랙의 <strong>내장 앞표지</strong>만 변경 대상으로 계획합니다. 앨범 목록에서 보이는 커버는 폴더 이미지일 수 있으며, 실제 내장 커버 상태는 아직 조회되지 않았습니다.</p>
        <div class="tag-cover-actions">
          <button type="button" data-cover-action="add">이미지 추가 계획</button>
          <button type="button" data-cover-action="replace">이미지 교체 계획</button>
          <button type="button" data-cover-action="remove">앞표지 제거 계획</button>
          <button type="button" data-cover-reset>취소</button>
        </div>
        <input type="file" id="tagCoverFile" accept="image/png,image/jpeg" hidden>
        <div id="tagCoverStatus" role="status" aria-live="polite">변경 계획이 없습니다.</div>
        <div id="tagCoverFiles" class="tag-cover-files"></div>
        <button type="button" class="tag-cover-apply" disabled title="NAS 관리자 커버 저장 API가 설치되지 않았습니다">실제 파일에 저장 · 미연결</button>
      </div>
    </div>`;
  albumHeader.insertAdjacentElement('afterend',region);
  region.hidden=true;
  const fileInput=region.querySelector('#tagCoverFile');
  const art=region.querySelector('#tagCoverArt');
  const status=region.querySelector('#tagCoverStatus');
  const files=region.querySelector('#tagCoverFiles');
  const controls=[...region.querySelectorAll('[data-cover-action]')];
  let albumId='',draft=null,objectUrl=null,intent=null,version=0;
  const revoke=()=>{if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}};
  function reset(){++version;revoke();draft=null;intent=null;fileInput.value='';render();}
  function checkAlbum(){
    const id=getAlbum()?.id||'';
    if(id!==albumId){albumId=id;reset();region.hidden=!id;}
  }
  function render(){
    const selected=getSelectedFiles();
    controls.forEach(b=>b.setAttribute('aria-pressed',String(draft?.action===b.dataset.coverAction)));
    art.replaceChildren();
    if(draft?.url){
      const img=document.createElement('img');img.src=draft.url;
      img.alt='내장 앨범 커버 추가 또는 교체 미리보기';art.append(img);
    } else {
      const p=document.createElement('span');p.textContent=draft?.action==='remove'?'앞표지 제거 예정':'표지 초안 없음';art.append(p);
    }
    const actionName={add:'추가',replace:'교체',remove:'제거'};
    status.textContent=draft?`${actionName[draft.action]} 초안 · ${selected.length}곡 선택 · ${draft.filename||'새 이미지 없음'}${draft.width?' · '+draft.width+'×'+draft.height:''} · NAS 저장 미연결`:
      `변경 계획이 없습니다. ${selected.length}곡이 선택되어 있습니다.`;
    files.replaceChildren();
    if(!selected.length){files.textContent='변경할 트랙을 먼저 선택하세요.';return;}
    const names=selected.map(s=>s.split('/').pop());
    const summary=document.createElement('p');
    summary.textContent=`대상 ${selected.length}곡: ${names.slice(0,5).join(', ')}${selected.length>5?' 외 '+(selected.length-5)+'곡':''}`;
    files.append(summary);
    if(draft){
      const note=document.createElement('p');note.className='tag-cover-warning';
      note.textContent='내장 커버 존재 여부·원본 SHA·파일별 충돌은 NAS에서 다시 확인해야 합니다. 폴더 0.jpg 및 다른 그림 종류는 변경하지 않습니다. 현재는 원본이 바뀌지 않습니다.';
      files.append(note);
    }
  }
  async function choose(file,action){
    if(!file)return;
    const ticket=++version;
    if(!['image/jpeg','image/png'].includes(file.type) || !file.size || file.size>10*1024*1024){
      reset();status.textContent='JPG 또는 PNG, 10MB 이하 이미지만 허용합니다.';return;
    }
    const url=URL.createObjectURL(file);
    try {
      const photo=new Image();
      photo.src=url;
      await photo.decode();
      if(ticket!==version || !albumId){URL.revokeObjectURL(url);return;}
      const {naturalWidth:width,naturalHeight:height}=photo;
      if(!width||!height||width>4096||height>4096||width*height>16_000_000){
        URL.revokeObjectURL(url);reset();status.textContent='커버 크기는 최대 4096px, 1600만 화소까지 허용합니다.';return;
      }
      revoke();objectUrl=url;
      draft={action,filename:file.name,width,height,bytes:file.size,url};render();
    }catch{
      URL.revokeObjectURL(url);reset();status.textContent='이미지 디코딩에 실패했습니다.';
    }
  }
  region.addEventListener('click',e=>{
    const action=e.target.closest('[data-cover-action]')?.dataset.coverAction;
    if(action==='add'||action==='replace'){
      if(!getSelectedFiles().length){status.textContent='변경할 트랙을 선택하세요.';return;}
      intent=action;fileInput.click();return;
    }
    if(action==='remove'){
      if(!getSelectedFiles().length){status.textContent='변경할 트랙을 선택하세요.';return;}
      reset();draft={action:'remove',filename:''};render();return;
    }
    if(e.target.closest('[data-cover-reset]'))reset();
  });
  fileInput.addEventListener('change',()=>{const action=intent;const file=fileInput.files?.[0];intent=null;fileInput.value='';if(action)void choose(file,action);});
  document.querySelector('.track-panel')?.addEventListener('change',()=>queueMicrotask(render));
  new MutationObserver(checkAlbum).observe(albumHeader,{childList:true});
  checkAlbum();
  return {refresh:checkAlbum,clear:reset};
}