// Queue presentation only. Persistence remains in playlists.js / playlist-inline.js.
const paths={
 'list-music':'<path d="M3 6h11M3 10h11M3 14h7M3 18h7M17 17V3l4-1v13"/><circle cx="15" cy="17" r="2"/><circle cx="19" cy="15" r="2"/>',
 'bookmark-plus':'<path d="M19 10V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v17l7-4 2 1M16 15h6M19 12v6"/>',
 'trash-2':'<path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/>',
 x:'<path d="m6 6 12 12M18 6 6 18"/>'
};
export function decorateQueueControl(button,icon,label){
 if(!button)return;
 button.dataset.vrRole='icon';button.dataset.queueControl=icon;
 button.setAttribute('aria-label',label);button.title=label;
 button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+paths[icon]+'</svg>';
}
export function bindDesktopQueueInline(panel,save,clear,getTracks){
 const doc=panel.ownerDocument,win=doc.defaultView,clearOriginal=clear?.onclick;
 function area(){panel.querySelector('.queue-inline-form')?.remove();const box=doc.createElement('div');box.className='queue-inline-form';panel.querySelector('ol').before(box);return box;}
 if(save)save.onclick=()=>{const inlineHost=area();win.dispatchEvent(new win.CustomEvent('save-playlist-tracks',{detail:{tracks:getTracks().map(t=>({...t})),inlineHost}}));};
 if(clear&&clearOriginal)clear.onclick=()=>{
  const box=area(),text=doc.createElement('p'),actions=doc.createElement('div');text.textContent='재생 대기열을 비울까요?';actions.className='actions';
  const cancel=doc.createElement('button');cancel.type='button';cancel.textContent='취소';cancel.onclick=()=>box.remove();
  const confirm=doc.createElement('button');confirm.type='button';confirm.textContent='비우기';confirm.dataset.vrRole='danger';confirm.onclick=event=>{box.remove();clearOriginal.call(clear,event);};
  actions.append(cancel,confirm);box.append(text,actions);
 };
}
