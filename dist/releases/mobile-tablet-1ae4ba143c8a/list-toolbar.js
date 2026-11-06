// Own only Album/Random controls. Today keeps its existing summary and cover-fit policy.
export function createListToolbar({toolbar,results,count,content,media}){
 let mode='',actions=null;
 function restoreActions(){if(actions&&actions.parentNode!==content)content.prepend(actions);}
 function sync(){
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
  restoreActions();actions=null;mode='';toolbar.classList.remove('list-toolbar');count.hidden=false;
 }
 function update(nextMode,nextActions=null){mode=nextMode;actions=nextActions;sync();}
 media.addEventListener('change',sync);
 return {beforeRender,update};
}
