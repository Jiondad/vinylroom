import {getPlayer,describeTrack,playItem,playAlbum,syncPlayButtons} from './player.js';
import {NAS_URL} from './config.js';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mediaPanel(admin=false){return `<section id="media-panel" class="media-panel">${admin?`<details><summary>NAS 연결 정보</summary><p class="hint">음악 연결 주소: ${escape(NAS_URL)} · 손님은 별도 설정 없이 이용합니다.</p></details>`:''}<p id="media-status" role="status" class="hint"></p><pre id="track-lyrics" hidden></pre></section>`;}
export function trackActions(index){return ['lyrics','play','queue','playlist','download'].map((action,i)=>`<td><button type="button" data-track-action="${action}" data-track-index="${index}" aria-label="${index+1}번 트랙 ${['가사','재생','대기열 추가','플레이리스트 추가','다운로드'][i]}">${['가사','▶ 재생','＋ 대기열','＋ 목록','↓ 받기'][i]}</button></td>`).join('');}
export function bindMedia(repo,album){
 const panel=document.querySelector('.album-full-page #media-panel, dialog[open] #media-panel');
 if(!panel)throw Error('앨범 미디어 영역을 찾을 수 없습니다.');
 const status=panel.querySelector('#media-status'),lyric=panel.querySelector('pre');
 let generation=0;
 const dialog=panel.closest('dialog')||panel.closest('.album-full-page');
 const actions=document.createElement('div');actions.className='album-actions';
 actions.innerHTML='<button type="button" data-album-action="play">▶ 앨범 전체 재생</button><button type="button" data-album-action="download" title="앨범 원본 음원을 ZIP 파일로 다운로드">↓ 앨범 전체 다운로드</button>';
 const hero=dialog.querySelector('.detail-top>div:last-child');
 if(dialog.matches('.album-full-page')&&hero)hero.append(actions);else panel.before(actions);
 for(const button of actions.querySelectorAll('button')){
  button.disabled=!album.tracks?.length;
  button.onclick=async()=>{
   button.disabled=true;
   try{
    if(button.dataset.albumAction==='play'){await playAlbum(album);return;}
    const access=await (await import('./playlists.js')).currentMemberToken();
    const response=await fetch(NAS_URL+'/v1/track',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},body:JSON.stringify({album_id:album.id,action:'album-download'}),signal:AbortSignal.timeout(30000),credentials:'omit',redirect:'error'});
    const result=await response.json();if(!response.ok)throw Error(result.message||'앨범 다운로드를 준비하지 못했습니다.');
    if(!/^\/v1\/file\/[A-Za-z0-9_-]+$/.test(result.path))throw Error('NAS 응답 주소가 잘못되었습니다.');
    const a=document.createElement('a');a.href=NAS_URL+result.path;a.referrerPolicy='no-referrer';a.target='_blank';a.rel='noopener';a.click();
   }catch(error){status.textContent=error.message;}
   finally{button.disabled=false;}
  };
 }
 for(const b of dialog.querySelectorAll('[data-track-action="play"]'))b.dataset.playingAlbum=album.id;syncPlayButtons();
 for(const button of dialog.querySelectorAll('[data-track-action]'))button.onclick=async()=>{
  const current=++generation,session=repo.session;
  try{

   const base=NAS_URL;
   const access=await (await import('./playlists.js')).currentMemberToken();
   const activeSession=repo.session;
   const index=Number(button.dataset.trackIndex),action=button.dataset.trackAction;
   if(['play','queue','playlist'].includes(action)){const item=describeTrack(album,index);if(action==='playlist')window.dispatchEvent(new CustomEvent('save-playlist-tracks',{detail:[item]}));else if(action==='play')await playItem(item);else{getPlayer().add([item]);status.textContent='재생 대기열에 추가했습니다.';}return;}
   status.textContent='NAS에서 불러오는 중…';button.disabled=true;
   const response=await fetch(base+'/v1/track',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+access},body:JSON.stringify({album_id:album.id,track:index,action}),signal:AbortSignal.timeout(20000),credentials:'omit',redirect:'error'});
   const result=await response.json();if(!response.ok)throw Error(result.message||'NAS 요청에 실패했습니다.');
   if(current!==generation||!panel.isConnected||dialog.open===false||repo.session!==activeSession)return;
   const title=album.tracks[index].title||album.tracks[index].filename;
   if(action==='lyrics'){lyric.hidden=false;lyric.textContent=result.lyrics||'등록된 가사가 없습니다. 같은 파일명의 .lrc 또는 .txt 파일을 NAS에 넣으면 표시됩니다.';status.textContent=title+' · 가사';return;}
   if(!/^\/v1\/file\/[A-Za-z0-9_-]+$/.test(result.path))throw Error('NAS 응답 주소가 잘못되었습니다.');
   if(action==='download'){const a=document.createElement('a');a.href=base+result.path;a.referrerPolicy='no-referrer';a.target='_blank';a.rel='noopener';a.click();status.textContent=result.cue?'CUE 트랙은 분할하지 않고 앨범 원본 음원을 다운로드합니다.':'원본 다운로드를 요청했습니다.';return;}
  }catch(err){if(current===generation)status.textContent=err.name==='TypeError'?'NAS에 연결하지 못했습니다. HTTPS 주소와 NAS 실행 상태를 확인하세요.':err.message;}finally{button.disabled=false;}
 };
}
