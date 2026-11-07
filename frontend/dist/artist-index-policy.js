// Vinyl Room Artist index: display names/Catalog keys are immutable.
// The public list may be cached only against a confirmed Catalog revision.
export const artistSortKey=name=>String(name).trim().replace(/^the\s+/i,'').normalize('NFC').toLocaleLowerCase('en');
// Guest /v2/public/albums deliberately strips `initial` from the public payload.
// Derive a display group from the public artist name; do not require a backend
// schema change or loosen validation of the count/name identity fields.
const HANGUL_INITIALS=[...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
export function artistInitial(row){
 const c=artistSortKey(row.name)[0]||'',cp=c.codePointAt(0);
 if(/^[a-z]$/.test(c))return c.toUpperCase();
 if(/^[0-9]$/.test(c))return '0–9';
 if(cp>=0xAC00&&cp<=0xD7A3)return HANGUL_INITIALS[Math.floor((cp-0xAC00)/588)];
 if(HANGUL_INITIALS.includes(c))return c;
 return GROUPS.includes(row.initial)?row.initial:'기타';
}
const GROUPS=['0–9',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ','기타'];
const GROUP_RANK=new Map(GROUPS.map((value,i)=>[value,i]));
const SIZE=100;
const MAX_ROWS=5000;
const MAX_PAGES=50;
const MAX_AGE=24*60*60*1000; // A matching revision is also mandatory.
const STORAGE_PREFIX='vinyl-room:artist-index:v2:';

// Only artists with active Catalog albums belong in the public artist index.
// This is a display rule: do not delete artist profiles, folders or history.
function prepare(rows){
 return rows.filter(row=>row.count>0).map(row=>({row:{...row,initial:artistInitial(row)},sortKey:artistSortKey(row.name)}))
  .sort((a,b)=>( (GROUP_RANK.get(a.row.initial)??-1)-(GROUP_RANK.get(b.row.initial)??-1) )||a.sortKey.localeCompare(b.sortKey,'en')||a.row.name.localeCompare(b.row.name));
}
function pageFromPrepared(prepared,params){
 const q=artistSortKey(params.get('q')||''),letter=params.get('letter')||'';
 const items=letter||q?prepared.filter(({row,sortKey})=>(!letter||row.initial===letter)&&(!q||sortKey.includes(q))):prepared;
 const pages=Math.max(1,Math.ceil(items.length/SIZE));
 const number=Math.min(pages,Math.max(1,Number(params.get('page'))||1));
 return {view:'artists',items:items.slice((number-1)*SIZE,number*SIZE).map(({row})=>row),total:items.length,pages,page:number,size:SIZE};
}
export function artistIndexPage(rows,params){return pageFromPrepared(prepare(rows),params);}

function validRows(rows){
 return Array.isArray(rows)&&rows.length<=MAX_ROWS&&rows.every(row=>row&&typeof row.name==='string'&&row.name.trim()&&(row.initial==null||typeof row.initial==='string')&&Number.isSafeInteger(row.count)&&row.count>=0)&&new Set(rows.map(row=>row.name)).size===rows.length;
}
function storage(){try{return typeof localStorage!=='undefined'?localStorage:null;}catch{return null;}}
function keyFor(base){return STORAGE_PREFIX+encodeURIComponent(base);}
function restore(base,revision,now){
 if(!revision)return null;
 try{
  const json=storage()?.getItem(keyFor(base));if(!json)return null;
  const saved=JSON.parse(json);
  if(saved.version!==2||saved.revision!==revision||!Number.isFinite(saved.at)||saved.at>now||now-saved.at>MAX_AGE||!validRows(saved.rows))return null;
  return {rows:saved.rows,prepared:prepare(saved.rows),at:saved.at,revision};
 }catch{return null;}
}
function persist(base,value){
 if(!value.revision)return;
 try{storage()?.setItem(keyFor(base),JSON.stringify({version:2,revision:value.revision,at:value.at,rows:value.rows}));}catch{} // Storage is optional.
}
function aborted(signal){if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');}
function revisionKey(value){return typeof value==='string'||typeof value==='number'?String(value):'';}

// readPage signature and exported behavior remain compatible with the v192-v193 modules.
export function createArtistIndex(readPage,{now=()=>Date.now()}={}){
 const memory=new Map();
 const inflight=new Map();
 async function collect(base,onFirst){
  // Shared list retrieval is not aborted by changing the selected initial/search.
  // Keep the existing six concurrent requests: more would amplify repeated NAS aggregations.
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new Error('아티스트 조회 시간 초과')),30000);
  const load=page=>{const params=new URLSearchParams(base);params.set('page',String(page));return readPage(params,controller.signal);};
  try{
   const first=await load(1);const pages=first?.pages;
   if(first?.page!==1||!Number.isInteger(pages)||pages<1||pages>MAX_PAGES||first.total>MAX_ROWS||first.total<0||!Number.isSafeInteger(first.total)||!Array.isArray(first.items))throw Error('아티스트 목록 범위를 확인할 수 없습니다.');
   if(!validRows(first.items))throw Error('아티스트 목록이 불완전합니다.');
   // Do not briefly expose zero-album artists while loading the remaining pages.
   if(first.items.every(row=>row.count>0))onFirst({...first,items:prepare(first.items).map(x=>x.row),partial:true});
   const parts=[first];
   for(let start=2;start<=pages;start+=6){
    const batch=await Promise.all(Array.from({length:Math.min(6,pages-start+1)},(_,i)=>load(start+i)));
    for(let i=0;i<batch.length;i++){
     const p=batch[i];
     if(p?.page!==start+i||p.pages!==pages||p.total!==first.total||!Array.isArray(p.items))throw Error('아티스트 목록이 변경되었습니다. 다시 조회해 주세요.');
     parts.push(p);
    }
   }
   const rows=parts.flatMap(p=>p.items);
   if(rows.length!==first.total||!validRows(rows))throw Error('아티스트 목록이 불완전합니다.');
   return rows;
  }finally{clearTimeout(timer);}
 }
 async function getRows(base,revision,onFirst){
  const key=base.toString(),rev=revisionKey(revision);
  let found=memory.get(key);
  if(found&&now()-found.at<=MAX_AGE&&(!rev||found.revision===rev)){
   return found.prepared;
  }
  if(rev){
   const restored=restore(key,rev,now());
   if(restored){memory.set(key,restored);return restored.prepared;}
  }
  const work=inflight.get(key);
  // A request begun with an unknown revision must never be promoted to a
  // verified revision: the Catalog may have changed during its collection.
  // Sharing is safe only when the same verified revision is known, or both
  // requests are explicitly unverified in this single page lifetime.
  if(work&&work.revision===rev){
   if(onFirst){work.listeners.add(onFirst);if(work.first)onFirst(work.first);}
   const rows=await work.promise;
   const saved=memory.get(key);
   if(saved&&(!rev||saved.revision===rev))return saved.prepared;
   const value={rows,prepared:prepare(rows),at:now(),revision:rev};
   memory.set(key,value);persist(key,value);return value.prepared;
  }
  const job={revision:rev,listeners:new Set(onFirst?[onFirst]:[]),first:null,promise:null};
  job.promise=collect(base,first=>{job.first=first;for(const listener of job.listeners){try{listener(first);}catch{}}});
  inflight.set(key,job);
  try{
   const rows=await job.promise;
   // Do not let a superseded revision overwrite the current cache.
   if(inflight.get(key)!==job){const current=memory.get(key);return current?.prepared||prepare(rows);}
   const value={rows,prepared:prepare(rows),at:now(),revision:rev};
   memory.set(key,value);persist(key,value);return value.prepared;
  }finally{if(inflight.get(key)===job)inflight.delete(key);}
 }
 const baseFrom=params=>new URLSearchParams({view:'artists',genre:params.get('genre')||'',format:params.get('format')||''});
 async function index(params,signal,revision,onFirst){
  aborted(signal);
  const preview=typeof onFirst==='function'&&!params.get('q')&&!params.get('letter')&&Number(params.get('page')||1)===1?value=>{if(!signal?.aborted)onFirst(value);}:null;
  const prepared=await getRows(baseFrom(params),revision,preview);
  aborted(signal);
  return pageFromPrepared(prepared,params);
 }
 index.prefetch=(params=new URLSearchParams(),revision)=>getRows(baseFrom(params),revision).then(()=>undefined);
 return index;
}
