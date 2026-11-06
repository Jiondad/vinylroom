import {mountArtistIndexGallery} from './artist-gallery.js';
import {mountArtistHomeImage,closeArtistImageViewer} from './artist-image-core.js';
import {NAS_URL} from './config.js';

// Same-origin read-only public assets exported from the approved v1.4 library.
// No demo images, collector, credentials or archive files are shipped here.
export const ARTIST_MANIFEST=NAS_URL+'/v2/public/artist-profiles/profiles.json';
export const ARTIST_ASSETS=NAS_URL+'/v2/public/artist-profiles/';
let indexController=null,indexView='list';
export function ensureArtistGalleryStyle(doc=document){
 if(doc.getElementById('artist-experience-style'))return;
 const link=doc.createElement('link');link.id='artist-experience-style';link.rel='stylesheet';
 link.href=new URL('./artist-experience.css',import.meta.url).href;doc.head.append(link);
}
export function disposeArtistGallery(){
 if(indexController){indexView=indexController.getView();indexController.dispose();indexController=null;}
 closeArtistImageViewer();
}
export function mountArtistGallery(content,rows,openArtist,management=null){
 ensureArtistGalleryStyle(content.ownerDocument);
 indexController=mountArtistIndexGallery({
  toolbarTarget:content.querySelector('[data-artist-gallery-tools]'),
  listTarget:content.querySelector('[data-artist-gallery-list]'),
  artists:rows.map(a=>({key:a.name,name:a.name,albumCount:a.count,genre:a.genre})),
  manifestUrl:ARTIST_MANIFEST,assetBaseUrl:ARTIST_ASSETS,initialView:indexView,
  // Exact Catalog display name uses the existing navigation handler unchanged.
  openArtist:a=>openArtist(a.name),pageSize:Math.max(1,rows.length),
  isAdmin:()=>Boolean(management?.enabled()),onManage:management?.open||null
 });
 return indexController;
}
export function mountArtistPortrait(target,name,isCurrent,management=null){
 ensureArtistGalleryStyle(target.ownerDocument);
 return mountArtistHomeImage({target,artistKey:name,artistName:name,
  manifestUrl:ARTIST_MANIFEST,assetBaseUrl:ARTIST_ASSETS,isCurrent,
  isAdmin:()=>Boolean(management?.enabled()),onManage:management?.open||null});
}
