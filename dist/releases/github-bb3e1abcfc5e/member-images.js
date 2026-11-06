import {readRequest,publicBrowseEnabled} from './browse-access.js';
import {NAS_URL} from './config.js';
const imageUrls=new WeakMap();
const coverCache=new Map();
const inflight=new Map();
const MAX_COVER_CACHE=180;
const MAX_PARALLEL=5;
let active=0,cacheEpoch=0;
const waiting=[];
function schedule(job){
 return new Promise((resolve,reject)=>{
  waiting.push({job,resolve,reject});
  drain();
 });
}
function drain(){
 while(active<MAX_PARALLEL&&waiting.length){
  const {job,resolve,reject}=waiting.shift();
  active++;
  Promise.resolve().then(job).then(resolve,reject).finally(()=>{active--;drain();});
 }
}
function cacheGet(key){
 const blob=coverCache.get(key);
 if(blob){coverCache.delete(key);coverCache.set(key,blob);}
 return blob;
}
async function imageBlob(url){
 const account=await import('./playlists.js');
 if(!publicBrowseEnabled())await account.currentMemberToken();
 const version=cacheEpoch;
 const cacheable=url.includes('/v2/cover?');
 const cached=cacheable?cacheGet(url):null;
 if(cached)return cached;
 if(inflight.has(url))return inflight.get(url);
 const task=schedule(async()=>{
  const response=await readRequest(url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('이미지를 불러올 수 없습니다.');
  const blob=await response.blob();
  if(!blob.type.startsWith('image/'))throw Error('올바른 이미지가 아닙니다.');
  if(cacheable&&version===cacheEpoch){
   coverCache.set(url,blob);
   while(coverCache.size>MAX_COVER_CACHE)coverCache.delete(coverCache.keys().next().value);
  }
  return blob;
 });
 inflight.set(url,task);
 try{return await task;}finally{inflight.delete(url);}
}
export async function loadMemberImage(img,url,{preserveSource=false}={}){
 if(!img)return;
 const marker=Symbol('image request');img.__vinylImageRequest=marker;
 const previous=imageUrls.get(img);
 if(!preserveSource){
  if(previous){URL.revokeObjectURL(previous);imageUrls.delete(img);}
  img.removeAttribute('src');
 }
 const blob=await imageBlob(url);
 if(img.__vinylImageRequest!==marker||!img.isConnected)return;
 const objectUrl=URL.createObjectURL(blob);
 if(preserveSource){
  try{const decoded=new Image();decoded.src=objectUrl;await decoded.decode();}
  catch(error){URL.revokeObjectURL(objectUrl);throw error;}
 }
 if(img.__vinylImageRequest!==marker||!img.isConnected){URL.revokeObjectURL(objectUrl);return;}
 if(preserveSource&&previous)URL.revokeObjectURL(previous);
 imageUrls.set(img,objectUrl);img.src=objectUrl;
}
export function clearMemberImage(img){
 if(!img)return;
 img.__vinylImageRequest=Symbol('cleared');
 const old=imageUrls.get(img);if(old)URL.revokeObjectURL(old);
 imageUrls.delete(img);img.removeAttribute('src');
}
export function coverMemberImage(img,id){return loadMemberImage(img,NAS_URL+'/v2/cover?id='+encodeURIComponent(id));}


globalThis.window?.addEventListener('vinyl-approval-change',async()=>{
 const {isApprovedMember}=await import('./playlists.js');
 if(!isApprovedMember()){cacheEpoch++;coverCache.clear();inflight.clear();}
});
