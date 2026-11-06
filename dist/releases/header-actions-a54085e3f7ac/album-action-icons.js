// Presentation only. Existing button nodes and callbacks are retained.
const paths={play:'<path d="m8 5 11 7-11 7Z"/>',queue:'<path d="M4 6h16M4 11h10M4 16h7M18 14v7M14.5 17.5h7"/>',playlist:'<path d="M7 3h10v18l-5-4-5 4Z"/><path d="M9 9h6M12 6v6"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>'};
export function decorateAlbumAction(button,kind,label){
 if(!button||!paths[kind])return;
 button.dataset.vrAlbumIcon=kind;button.dataset.vrRole='icon';button.setAttribute('aria-label',label);button.title=label;
 button.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+paths[kind]+'</svg>';
}
