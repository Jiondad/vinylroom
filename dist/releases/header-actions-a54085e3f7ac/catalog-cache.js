// Only public catalog summaries are stored here, never sessions or album details.
import {NAS_URL} from './config.js';
const KEY=NAS_URL+'|public-catalog-v1';
async function access(mode,value){
 if(!globalThis.indexedDB)return null;
 return new Promise(resolve=>{
  let db,done=false;const finish=result=>{if(done)return;done=true;clearTimeout(timer);db?.close();resolve(result);};
  const timer=setTimeout(()=>finish(null),3000);
  try{
   const open=indexedDB.open('music-public-catalog',1);
   open.onupgradeneeded=()=>open.result.createObjectStore('catalog');
   open.onerror=()=>finish(null);open.onblocked=()=>finish(null);
   open.onsuccess=()=>{
    db=open.result;if(done){db.close();return;}
    const tx=db.transaction('catalog',mode),store=tx.objectStore('catalog');
    const request=mode==='readonly'?store.get(KEY):store.put(value,KEY);
    tx.oncomplete=()=>finish(mode==='readonly'?request.result:true);
    tx.onerror=tx.onabort=()=>finish(null);
   };
  }catch{finish(null);}
 });
}
export const catalogCache={
 async read(){const r=await access('readonly');return r?.version===1&&Number.isFinite(r.savedAt)&&Array.isArray(r.data?.albums)&&Array.isArray(r.data?.artists)?r:null;},
 write(data){return access('readwrite',{version:1,savedAt:Date.now(),data});}
};
