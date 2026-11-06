const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validCatalogTarget(kind,value){return typeof value==='string'&&(kind==='album'?/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value):kind==='artist'&&value.trim().length>0&&value.length<=256);}
export function catalogLink(kind,value,label,{trusted=false}={}){return validCatalogTarget(kind,value)?`<button type="button" class="catalog-link" data-catalog-kind="${kind}" data-catalog-value="${escape(value)}" data-catalog-trusted="${trusted?'true':'false'}">${escape(label)}</button>`:escape(label);}
export function queueCatalogLinks(t){return `<div class="queue-catalog-links">${catalogLink('artist',t.artist,t.artist||'',{trusted:!t.top100_folder})}${t.album_title?' · '+catalogLink('album',t.album_id,t.album_title):''}</div>`;}
export function bindCatalogLinks(root,{openAlbum,openArtist,verifyArtist,onError=()=>{}}){let generation=0;
 const handler=async event=>{const button=event.target?.closest?.('button.catalog-link');if(!button||button.disabled)return;event.preventDefault();event.stopPropagation();const kind=button.dataset.catalogKind,value=button.dataset.catalogValue;if(!validCatalogTarget(kind,value))return;const current=++generation;button.disabled=true;
 try{if(kind==='artist'&&button.dataset.catalogTrusted!=='true'&&!await verifyArtist(value))throw Error('정확히 일치하는 소장 아티스트를 확인하지 못했습니다.');if(current!==generation)return;button.closest('dialog[open]')?.close();if(kind==='album')await openAlbum(value);else await openArtist(value);}catch(e){onError(e.message);}finally{button.disabled=false;}};
 root.addEventListener('click',handler,true);return ()=>root.removeEventListener('click',handler,true);
}
export const activeCatalogMenu=(view,artist,album=false)=>album?'library':view==='library'&&artist?'artists':view;
