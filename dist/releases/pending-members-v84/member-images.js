import {NAS_URL} from './config.js';
const imageUrls=new WeakMap();
export async function loadMemberImage(img,url){
 if(!img)return;
 const marker=Symbol('image request');img.__vinylImageRequest=marker;
 const previous=imageUrls.get(img);
 if(previous){URL.revokeObjectURL(previous);imageUrls.delete(img);}
 img.removeAttribute('src');
 const token=await (await import('./playlists.js')).currentMemberToken();
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('이미지 요청 권한이 없거나 이미지를 불러올 수 없습니다.');
 const blob=await response.blob();
 if(!blob.type.startsWith('image/'))throw Error('올바른 이미지가 아닙니다.');
 if(img.__vinylImageRequest!==marker)return;
 const objectUrl=URL.createObjectURL(blob);imageUrls.set(img,objectUrl);img.src=objectUrl;
}
export function clearMemberImage(img){if(!img)return;img.__vinylImageRequest=Symbol('cleared');const old=imageUrls.get(img);if(old)URL.revokeObjectURL(old);imageUrls.delete(img);img.removeAttribute('src');}
export function coverMemberImage(img,id){return loadMemberImage(img,NAS_URL+'/v2/cover?id='+encodeURIComponent(id));}
