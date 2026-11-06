import {decorateAlbumAction} from './album-action-icons.js';
// Own only Album/Random controls. Today keeps its existing summary and cover-fit policy.
export function createListToolbar({toolbar,results,count,content,media,mobileMedia}){
 let mode='',actions=null;
 const redraw=results.querySelector('#random-redraw'),original=new WeakMap();
 const icons=[['random-play','play','전체듣기'],['random-queue','queue','대기열추가'],['random-save','playlist','플레이리스트추가'],['random-download','download','모두받기']];
 function syncRandom(){
  if(redraw){const target=mode==='random'&&actions?actions:results;if(redraw.parentNode!==target)target.prepend(redraw);}
  if(mode!=='random'||!actions||!mobileMedia)return;
  const compact=mobileMedia.matches;actions.toggleAttribute('data-random-compact',compact);
  for(const [id,kind,label]of icons){const b=actions.querySelector('#'+id);if(!b)continue;
   if(compact&&!original.has(b)){original.set(b,{html:b.innerHTML,role:b.getAttribute('data-vr-role'),title:b.getAttribute('title'),label:b.getAttribute('aria-label'),quick:b.getAttribute('data-quick-label')});decorateAlbumAction(b,kind,label);b.removeAttribute('data-quick-label');}
   else if(!compact&&original.has(b)){const old=original.get(b);b.innerHTML=old.html;for(const [key,value]of [['data-vr-role',old.role],['title',old.title],['aria-label',old.label],['data-quick-label',old.quick]]){if(value===null)b.removeAttribute(key);else b.setAttribute(key,value);}b.removeAttribute('data-vr-album-icon');original.delete(b);}
  }
 }
 function restoreActions(){if(actions&&actions.parentNode!==content)content.prepend(actions);}
 function sync(){
  syncRandom();
  const aligned=media.matches&&(mode==='library'||mode==='random');
  toolbar.classList.toggle('list-toolbar',aligned);
  count.hidden=mode==='random';
  if(mode!=='home'){
   const target=aligned&&mode==='library'?toolbar:results;
   if(count.parentNode!==target)target.prepend(count);
  }
  if(actions){
   const target=aligned&&mode==='random'?toolbar:content;
   if(actions.parentNode!==target)target.prepend(actions);
  }
 }
 function beforeRender(){
  if(redraw&&redraw.parentNode!==results)results.append(redraw);
  restoreActions();actions=null;mode='';toolbar.classList.remove('list-toolbar');count.hidden=false;
 }
 function update(nextMode,nextActions=null){mode=nextMode;actions=nextActions;sync();}
 media.addEventListener('change',sync);
 mobileMedia?.addEventListener('change',sync);
 return {beforeRender,update};
}
