// A singleton passive capture listener covers the document and nested album/list scrolling.
const installed=new WeakMap();
export function installBackToTop({doc=document,win=window}={}){
 if(installed.has(doc))return installed.get(doc);
 const button=doc.createElement('button');button.id='vinyl-back-to-top';button.type='button';button.hidden=true;button.setAttribute('aria-label','맨 위로 이동');button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg>';doc.body.append(button);
 const css=doc.createElement('link');css.rel='stylesheet';css.href=new URL('./back-to-top.css',import.meta.url).href;doc.head.append(css);
 let frame=0,last=null,disposed=false;
 const page=()=>doc.scrollingElement||doc.documentElement;
 const blocked=()=>!!doc.querySelector('dialog[open],.album-cover-viewer,.artwork-viewer,[aria-modal="true"],#queue-panel:not([hidden])');
 const scrollable=node=>node&&node.isConnected!==false&&node.scrollHeight>node.clientHeight+1&&/(auto|scroll)/.test(win.getComputedStyle(node).overflowY);
 function target(){
  const detail=doc.querySelector('.album-full-page');
  if(last&&last!==page()&&scrollable(last)&&(!detail||detail.contains(last)||detail===last)&&!last.closest('dialog,#global-player,.mobile-player-sheet'))return last;
  let node=detail||doc.querySelector('#content');
  while(node&&node!==doc.body){if(scrollable(node))return node;node=node.parentElement;}
  return page();
 }
 function update(){
  frame=0;if(disposed)return;
  const root=target(),hide=blocked()||Number(root?.scrollTop||0)<300;
  if(button.hidden!==hide)button.hidden=hide;
  if(hide)return;
  let bottom=18;
  for(const bar of doc.querySelectorAll('#global-player,.mobile-mini-player')){
   const style=win.getComputedStyle(bar);if(style.display==='none'||style.visibility==='hidden')continue;
   const rect=bar.getBoundingClientRect();if(rect.height&&rect.top<win.innerHeight&&rect.bottom>0)bottom=Math.max(bottom,win.innerHeight-rect.top+12);
  }
  button.style.bottom=`calc(${bottom}px + env(safe-area-inset-bottom, 0px))`;
 }
 function schedule(){if(!frame&&!disposed)frame=win.requestAnimationFrame(update);}
 function scroll(event){if(event.target?.nodeType===1)last=event.target;schedule();}
 function pageChange(){last=null;schedule();}
 button.onclick=()=>{const root=target();if(blocked())return;root?.scrollTo?.({top:0,behavior:win.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});schedule();};
 doc.addEventListener('scroll',scroll,{capture:true,passive:true});win.addEventListener('resize',schedule,{passive:true});
 win.addEventListener('vinyl-album-page-change',pageChange);win.addEventListener('popstate',pageChange);
 const observer=new win.MutationObserver(schedule);observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','hidden','class']});
 const api={refresh:update,destroy(){disposed=true;if(frame)win.cancelAnimationFrame(frame);observer.disconnect();doc.removeEventListener('scroll',scroll,true);win.removeEventListener('resize',schedule);win.removeEventListener('vinyl-album-page-change',pageChange);win.removeEventListener('popstate',pageChange);button.remove();css.remove();installed.delete(doc);}};
 installed.set(doc,api);update();return api;
}
