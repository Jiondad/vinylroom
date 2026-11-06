// Reuse authenticated original-file tickets; never buffer or transcode music.
export async function requestOriginalTicket(item,{base,token,invalidate,signal}){
 const access=await token();
 const response=await fetch(base+'/v1/track',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},body:JSON.stringify({album_id:item.album_id,track:item.track_index??item.index,action:'download'}),credentials:'omit',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)});
 if(response.status===401||response.status===403)invalidate();
 const result=await response.json();
 if(!response.ok)throw Error(result.message||'다운로드 요청에 실패했습니다.');
 if(!/^\/v1\/file\/[A-Za-z0-9_-]+$/.test(result.path))throw Error('NAS 다운로드 주소가 잘못되었습니다.');
 return base+result.path;
}
let active=null;
export function downloadRandomTracks(items,options){
 if(active){active.focus();return;}
 const dialog=document.createElement('dialog');active=dialog;
 dialog.className='random-download-dialog';
 dialog.innerHTML='<div class="modal-body"><h3>목록 전체 다운로드</h3><p>원본 파일을 한 곡씩 요청합니다. 브라우저의 여러 파일 다운로드 허용이 필요할 수 있습니다.</p><p role="status" aria-live="polite"></p><div class="actions"><button data-start>순차 다운로드 시작</button><button data-close>닫기</button></div></div>';
 document.body.append(dialog);
 const start=dialog.querySelector('[data-start]'),close=dialog.querySelector('[data-close]'),status=dialog.querySelector('[role="status"]');
 const tracks=items.map(t=>({...t}));let stopped=false;const controller=new AbortController();
 const cleanup=()=>{stopped=true;controller.abort();dialog.remove();if(active===dialog)active=null;};
 dialog.addEventListener('close',cleanup,{once:true});dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});close.onclick=()=>dialog.close();
 start.onclick=async()=>{
  start.disabled=true;close.textContent='중단 / 닫기';
  try{
   for(let i=0;i<tracks.length&&!stopped;i++){
    status.textContent=`${i+1} / ${tracks.length} · 원본 다운로드 요청 중`;
    const url=await requestOriginalTicket(tracks[i],{...options,signal:controller.signal});if(stopped)return;
    const a=document.createElement('a');a.href=url;a.download='';a.referrerPolicy='no-referrer';a.rel='noopener';document.body.append(a);a.click();a.remove();
    // Pace ticket requests; browser manages the original file transfers.
    if(i+1<tracks.length)await new Promise(resolve=>setTimeout(resolve,1000));
   }
   if(!stopped)status.textContent=`${tracks.length}곡의 다운로드를 요청했습니다. 완료 여부는 브라우저 다운로드 목록에서 확인하세요.`;
  }catch(error){if(!stopped)status.textContent=error.message;}
  finally{if(!stopped)close.textContent='닫기';}
 };
 dialog.showModal();
}
