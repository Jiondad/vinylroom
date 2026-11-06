import {NAS_URL} from './config.js';
import {invalidateArtistProfiles} from './artist-image-core.js';
import {ARTIST_MANIFEST} from './artist-gallery-integration.js';

const base=NAS_URL+'/v2/artist-profiles/';
const node=(tag,label)=>{const el=document.createElement(tag);if(label)el.textContent=label;return el;};

export function createArtistProfileManager({allowed,token,onUpdated}){
 let available=false,lastCheck=0,introAvailable=false;
 async function request(path,{body=null}={}){
  if(!allowed())throw Error('관리자 권한이 필요합니다.');
  const access=await token();
  const response=await fetch(base+path,{method:body?'POST':'GET',credentials:'omit',redirect:'error',
   headers:{Authorization:'Bearer '+access,...(body?{'Content-Type':'application/json'}:{})},
   body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!response.ok){let error={};try{error=await response.json();}catch{}throw Error(error.message||`사진 관리 서버 HTTP ${response.status}`);}
  return response.json();
 }
 async function verify(){
  if(!allowed()){available=false;return false;}
  if(available&&Date.now()-lastCheck<30000)return true;
  try{const data=await request('capabilities');available=data.enabled===true&&data.schema===1;introAvailable=data.introduction===true;lastCheck=Date.now();}
  catch{available=false;}
  return available;
 }
 async function open({artistKey,artistName}){
  if(!await verify())return;
  const params='?name='+encodeURIComponent(artistName);
  let data;
  try{data=await request('candidates'+params);}catch{return;}
  const cover=node('div');cover.className='vr-ae-editor-backdrop';cover.setAttribute('role','dialog');
  cover.setAttribute('aria-modal','true');cover.setAttribute('aria-label',artistName+' 사진 편집');
  const form=node('form');form.className='vr-ae-editor';
  const heading=node('h2',artistName+' · 사진 관리');
  const header=node('div');header.className='vr-ae-editor-header';
  const topClose=node('button','×');topClose.type='button';topClose.className='vr-ae-editor-close';topClose.setAttribute('aria-label','사진 관리 닫기');header.append(heading,topClose);
  const message=node('p');message.className='vr-ae-editor-message';message.setAttribute('role','status');
  const fileLabel=node('label');
  const file=node('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';fileLabel.append(file);
  fileLabel.className='vr-ae-file-drop';
  const uploadIcon=node('span');uploadIcon.className='vr-ae-upload-icon';uploadIcon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-8M18 2v6M15 5h6M3 17l5-5 4 4 3-3 5 5"/><circle cx="8" cy="8" r="1.5"/></svg>';uploadIcon.setAttribute('aria-hidden','true');
  const dropHint=node('span','사진을 끌어다 놓으세요');dropHint.className='vr-ae-drop-hint';
  const clickHint=node('span','또는 클릭하여 사진 선택');clickHint.className='vr-ae-click-hint';
  const sizeHint=node('span','JPEG · PNG · WebP / 한쪽 800px 이상');sizeHint.className='vr-ae-size-hint';
  const preview=node('img');preview.className='vr-ae-upload-preview';preview.alt='선택한 사진 미리보기';preview.hidden=true;
  const fileInfo=node('span');fileInfo.className='vr-ae-file-info';fileInfo.setAttribute('role','status');
  fileLabel.append(uploadIcon,dropHint,clickHint,sizeHint,preview,fileInfo);
  const existing=node('div');existing.className='vr-ae-existing';
  let autoSelect=null;
  if(data.auto_available){
   const caption=node('div');caption.className='vr-ae-existing-caption';caption.append(node('span','기존 수집 사진'),node('small','자동 수집 사진이 있을 때만 표시'));
   const row=node('label');row.className='vr-ae-existing-card';
   const icon=node('span','▧');icon.className='vr-ae-existing-icon';icon.setAttribute('aria-hidden','true');
   const texts=node('span');texts.append(node('span','자동 수집된 사진'),node('small','기존 사진을 선택하여 교체'));
   autoSelect=node('select');autoSelect.setAttribute('aria-label','기존 수집 사진 선택');
   for(const [value,label] of [['','선택 안 함'],['auto','자동 수집 사진 사용']]){const option=node('option',label);option.value=value;autoSelect.append(option);}
   row.append(icon,texts,autoSelect);existing.append(caption,row);
  }
  let chosenFile=null,previewUrl=null,selection=0;
  function resetPhoto(){
   chosenFile=null;preview.hidden=true;preview.removeAttribute('src');fileInfo.textContent='';
   if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
  }
  async function choosePhoto(files){
   const version=++selection;resetPhoto();if(autoSelect)autoSelect.value='';
   const picked=files?.[0];
   if(!picked)return;
   if(files.length!==1){fileInfo.textContent='사진은 한 장씩 선택하세요.';file.value='';return;}
   if(!['image/jpeg','image/png','image/webp'].includes(picked.type)){
    fileInfo.textContent='JPEG·PNG·WebP 이미지만 선택할 수 있습니다.';file.value='';return;
   }
   if(picked.size>25_000_000){fileInfo.textContent='사진은 25MB 이하여야 합니다.';file.value='';return;}
   const url=URL.createObjectURL(picked);previewUrl=url;
   const probe=new Image();
   try{
    await new Promise((resolve,reject)=>{probe.onload=resolve;probe.onerror=reject;probe.src=url;});
    if(version!==selection)return;
    if(Math.max(probe.naturalWidth,probe.naturalHeight)<800)throw Error('사진의 가로·세로 중 한쪽은 800px 이상이어야 합니다.');
    chosenFile=picked;preview.src=url;preview.hidden=false;
    fileInfo.textContent=picked.name+' · '+probe.naturalWidth+'×'+probe.naturalHeight+' · 저장 전';
   }catch(error){
    if(version!==selection)return;
    resetPhoto();file.value='';fileInfo.textContent=error?.message||'이미지를 읽을 수 없습니다.';
   }
  }
  if(autoSelect)autoSelect.onchange=()=>{if(autoSelect.value==='auto'){++selection;resetPhoto();file.value='';}};
  file.addEventListener('change',()=>void choosePhoto(file.files));
  fileLabel.addEventListener('dragover',event=>{event.preventDefault();fileLabel.classList.add('vr-ae-drop-active');});
  fileLabel.addEventListener('dragleave',()=>fileLabel.classList.remove('vr-ae-drop-active'));
  fileLabel.addEventListener('drop',event=>{event.preventDefault();fileLabel.classList.remove('vr-ae-drop-active');void choosePhoto(event.dataTransfer?.files);});
  const introLabel=node('label','아티스트 소개');introLabel.className='vr-ae-introduction';
  const intro=node('textarea');intro.rows=4;intro.maxLength=2000;intro.value=data.introduction||'';intro.disabled=!introAvailable;
  intro.setAttribute('aria-label','아티스트 소개');if(!introAvailable)intro.title='NAS 소개 저장 연결이 필요합니다.';
  introLabel.append(intro);const originalIntro=intro.value;
  const controls=node('div');controls.className='vr-ae-editor-actions';
  const save=node('button','저장');save.type='submit';
  const hide=node('button','삭제');hide.type='button';hide.title='공개 목록에서 제외하며 원본과 백업은 보존합니다.';
  const cancel=node('button','닫기');cancel.type='button';
  controls.append(hide,save,cancel);
  form.append(header,fileLabel,existing,introLabel,controls,message);cover.append(form);
  const focus=document.activeElement;document.body.append(cover);
  const onKey=e=>{if(e.key==='Escape')close();};
  function close(){++selection;resetPhoto();document.removeEventListener('keydown',onKey);cover.remove();focus?.focus?.();}
  topClose.onclick=close;cancel.onclick=close;cover.onclick=e=>{if(e.target===cover)close();};document.addEventListener('keydown',onKey);cancel.focus();
  async function change(action,extra={},introUpdate=null){
   if(!await verify())throw Error('관리자 권한을 다시 확인하세요.');
   for(const button of controls.querySelectorAll('button'))button.disabled=true;
   try{for(const step of (action==='delete'?['hide','clear']:action==='auto'?['clear','unhide']:[action]))await request('manage'+params,{body:{action:step,...extra}});if(introUpdate!==null&&action!=='introduction')await request('manage'+params,{body:{action:'introduction',introduction:introUpdate}});invalidateArtistProfiles(ARTIST_MANIFEST);close();await onUpdated();}
   catch(err){message.textContent=err.message;for(const button of controls.querySelectorAll('button'))button.disabled=false;}
  }
  hide.onclick=()=>void change('delete');
  form.onsubmit=async event=>{
   event.preventDefault();
   const picked=chosenFile;
   const changedIntro=introAvailable&&intro.value!==originalIntro?intro.value:null;
   if(autoSelect?.value==='auto'){await change('auto',{},changedIntro);return;}
   if(!picked){if(changedIntro!==null)await change('introduction',{introduction:changedIntro});else message.textContent='변경할 사진이나 소개를 입력하세요.';return;}
   const bytes=new Uint8Array(await picked.arrayBuffer());let binary='';
   for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   await change('approve',{image:btoa(binary),admin_upload:true},changedIntro);
  };
 }
 return {enabled:()=>available&&allowed(),verify,open};
}
