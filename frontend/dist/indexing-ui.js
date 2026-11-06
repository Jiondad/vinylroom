const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function indexingPanel(){return '<p class="hint">변경분 색인은 파일 정보로 변경을 탐지한 뒤 필요한 앨범만 분석합니다. 전체 색인은 Music 전체 범위를 점검합니다. 원본 파일은 수정하지 않습니다.</p>'+'<label>작업 유형<select id="scan-mode"><option value="changes">변경분 색인</option><option value="full">전체 색인</option></select></label><div id="folder-browser" aria-live="polite"><p>폴더 목록을 불러오는 중…</p></div><label class="check"><input id="recursive-index" type="checkbox" checked>하위 폴더 포함</label><label id="index-root-warning" class="check" hidden><input id="confirm-root-index" type="checkbox">Music 전체 색인임을 확인했습니다.</label><button id="start-index" class="primary" disabled>폴더를 먼저 선택하세요</button><p id="index-start-status" role="status"></p><h3>색인 상태 및 작업 이력</h3><div id="index-jobs" aria-live="polite"><p>작업 상태를 불러오는 중…</p></div>';}
export function folderInitial(name){const c=String(name).normalize('NFKC').trim().charAt(0),n=c.charCodeAt(0);if(/[0-9]/.test(c))return '0–9';if(/[a-z]/i.test(c))return c.toUpperCase();if(n>=0xac00&&n<=0xd7a3)return 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor((n-0xac00)/588)];return '기타';}
function relativePath(path){return typeof path==='string'&&!path.startsWith('/')&&!path.includes('\\')&&!path.split('/').includes('..');}
export function indexingError(error,path){const reason=error?.name==='TimeoutError'?'NAS 응답 시간이 초과되었습니다.':error?.name==='TypeError'?'NAS 연결에 실패했습니다. 네트워크·HTTPS·CORS 설정을 확인하세요.':error?.message||'요청을 완료하지 못했습니다.';return path+' · '+reason;}
export function mountIndexing({dialog,api,canManage,letters,toast,setTimer=setTimeout,clearTimer=clearTimeout}){
 const $=selector=>dialog.querySelector(selector),node=$('#folder-browser'),jobs=$('#index-jobs'),start=$('#start-index'),rootWarning=$('#index-root-warning'),rootConfirm=$('#confirm-root-index'),status=$('#index-start-status');
 let selected=null,requested='',browseGeneration=0,disposed=false,timer=null,browseController=null,polling=null,submitting=false,busy=false;
 const controller=new AbortController();
 const alive=()=>!disposed&&node.isConnected&&jobs.isConnected&&dialog.open;
 const signal=()=>AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]);
 function dispose(){disposed=true;browseGeneration++;clearTimer(timer);controller.abort();browseController?.abort();dialog.removeEventListener('close',dispose);}
 dialog.addEventListener('close',dispose,{once:true});
 function updateStart(){start.disabled=!canManage()||submitting||busy||selected===null||(selected===''&&!rootConfirm.checked);start.textContent=busy?'색인 실행 중':selected===null?'폴더를 먼저 선택하세요':selected===''?'Music 전체 범위 색인 시작':'선택 폴더 변경분 색인 시작';}
 rootConfirm.onchange=updateStart;
 const mode=$('#scan-mode');
 mode.value='changes';
 mode.onchange=()=>{if(mode.value==='full')void browse('');else updateStart();};
 async function browse(path){
  if(!alive())return;const version=++browseGeneration;requested=path;selected=null;rootConfirm.checked=false;rootWarning.hidden=true;updateStart();
  browseController?.abort();browseController=new AbortController();
  node.innerHTML='<p class="hint">폴더 목록을 불러오는 중…</p>';
  try{
   const result=await api('/v2/folders?path='+encodeURIComponent(path),{admin:true,signal:AbortSignal.any([signal(),browseController.signal])});
   if(!alive()||version!==browseGeneration)return;
   if(typeof result.path!=='string'||!relativePath(result.path)||!Array.isArray(result.folders)||result.folders.some(f=>!f||typeof f.name!=='string'||!relativePath(f.path)))throw Error('폴더 목록 응답 형식이 올바르지 않습니다.');
   selected=result.path==='.'?'':result.path;rootWarning.hidden=selected!=='';let letter='';
   const paint=()=>{
    const visible=result.folders.filter(f=>!letter||folderInitial(f.name)===letter);
    node.innerHTML='<div class="artist-index folder-letter-index" aria-label="폴더 첫 글자">'+['',...letters].map(l=>'<button type="button" data-folder-letter="'+esc(l)+'" aria-pressed="'+(l===letter)+'">'+esc(l||'전체')+'</button>').join('')+'</div><p class="path">선택: Music / '+esc(selected)+'</p><button type="button" data-parent '+(selected?'':'disabled')+'>상위 폴더</button><ul class="folder-options">'+visible.map(f=>'<li><button type="button" data-folder="'+esc(f.path)+'">📁 '+esc(f.name)+'</button></li>').join('')+'</ul>'+(visible.length?'':'<p class="hint">'+(letter?'해당 초성의 폴더가 없습니다.':'하위 폴더가 없습니다. 현재 폴더를 색인할 수 있습니다.')+'</p>');
    node.querySelector('[data-parent]').onclick=()=>browse(selected.split('/').slice(0,-1).join('/'));
    node.querySelectorAll('[data-folder]').forEach(b=>b.onclick=()=>browse(b.dataset.folder));
    node.querySelectorAll('[data-folder-letter]').forEach(b=>b.onclick=()=>{letter=b.dataset.folderLetter;paint();});
   };paint();updateStart();
  }catch(error){if(!alive()||version!==browseGeneration)return;selected=null;updateStart();node.innerHTML='<p class="error" role="alert">'+esc(indexingError(error,'GET /v2/folders'))+'</p><button type="button" data-retry-folders>폴더 목록 다시 시도</button>';node.querySelector('[data-retry-folders]').onclick=()=>browse(requested);}
 }
 function poll(){
  clearTimer(timer);if(!alive())return Promise.resolve();if(polling)return polling;
  polling=(async()=>{
   try{
    const state=await api('/v2/jobs',{admin:true,signal:signal()});if(!alive())return;
    if(!Array.isArray(state.jobs))throw Error('작업 상태 응답 형식이 올바르지 않습니다.');
    busy=state.jobs.some(j=>j.state==='queued'||j.state==='running');
    const schedule=state.schedule==='manual'?'수동 실행 전용':state.schedule==='daily'?'매일 '+(state.schedule_time||'02:00')+' ('+(state.timezone||'Asia/Seoul')+')':Number.isFinite(state.interval)?Math.round(state.interval/60)+'분 간격':'서버 일정 정보 없음';
    jobs.innerHTML='<p>자동 확인: '+esc(schedule)+' · 기존 기록 이관 '+(state.ready===true?'완료':state.ready===false?'진행 중':'상태 미확인')+'</p>'+(state.next_scan?'<p class="hint">다음 자동 확인: '+esc(state.next_scan)+'</p>':'')+(state.jobs.length?state.jobs.map(j=>{const errors=Array.isArray(j.errors)?j.errors:[];return '<article class="index-job"><strong>'+esc(j.path||'Music 전체')+' · '+esc(({queued:'대기',running:'진행 중',completed:'완료',completed_with_errors:'일부 오류',failed:'실패',interrupted:'중단'})[j.state]||j.state)+'</strong><p>'+esc(j.processed??0)+'개 확인 · 추가 '+esc(j.added??0)+' · 갱신 '+esc(j.updated??0)+' · 변경 없음 '+esc(j.unchanged??0)+' · 파일 없음 '+esc(j.missing??0)+'</p><p>'+esc(j.message)+'</p>'+(errors.length?'<details><summary>오류 '+errors.length+'건 (최근 최대 100건)</summary><pre>'+esc(JSON.stringify(errors,null,2))+'</pre></details>':'')+'</article>';}).join(''):'<p class="hint">최근 색인 작업 이력이 없습니다.</p>');
   }catch(error){if(alive()){jobs.innerHTML='<p class="error" role="alert">'+esc(indexingError(error,'GET /v2/jobs'))+'</p><button type="button" data-retry-jobs>작업 상태 다시 시도</button>';jobs.querySelector('[data-retry-jobs]').onclick=poll;}}
   finally{polling=null;if(alive()){updateStart();if(canManage())timer=setTimer(poll,5000);}}
  })();return polling;
 }
 start.onclick=async()=>{
  updateStart();if(start.disabled||!alive())return;
  const scan_mode=mode.value==='full'?'full':'changes';
  if(scan_mode==='full'&&selected!==''){status.textContent='전체 색인은 Music 최상위 폴더에서 확인 후 실행하세요.';return;}
  const path=selected,recursive=scan_mode==='full'?true:$('#recursive-index').checked;submitting=true;updateStart();status.textContent='Music / '+path+' 색인을 요청하는 중…';
  try{await api('/v2/scan',{admin:true,body:{path,recursive,scan_mode},signal:signal()});if(!alive())return;busy=true;status.textContent='색인 대기열에 등록했습니다. 창을 닫아도 NAS에서 계속 진행됩니다.';toast(status.textContent);void poll();}
  catch(error){if(alive())status.textContent=indexingError(error,'POST /v2/scan');}
  finally{submitting=false;if(alive())updateStart();}
 };
 updateStart();void browse('');void poll();return {browse,poll,dispose};
}
