const KEY='vinyl-room-login-v1';
export function loginStorage(tab,persistent){
 return {
  // Keep tab-only policy, but expose each scope so a rejected tab credential
  // cannot delete an independent remembered session.
  candidates(){
   const records=[];
   for(const [storage,remember] of [[tab,false],[persistent,true]]){
    try{const value=JSON.parse(storage.getItem(KEY)||'null');if(typeof value?.refresh_token==='string'&&value.refresh_token)records.push({refresh_token:value.refresh_token,remember});}catch{}
   }
   return records;
  },
  read(remember=null){return this.candidates().find(value=>remember===null||value.remember===remember)||null;},
  discard(record){
   if(!record)return;
   const storage=record.remember?persistent:tab;
   // Compare before removing: a newer rotation/login must survive a late failure.
   try{const current=JSON.parse(storage.getItem(KEY)||'null');if(current?.refresh_token===record.refresh_token)storage.removeItem(KEY);}catch{}
  },
  clear(){for(const storage of [tab,persistent])try{storage.removeItem(KEY);}catch{}},
  save(session,remember){
   if(!session?.refresh_token){this.clear();return;}
   const destination=remember?persistent:tab,other=remember?tab:persistent;
   const value=JSON.stringify({refresh_token:session.refresh_token});
   destination.setItem(KEY,value);
   if(destination.getItem(KEY)!==value)throw Error('로그인 저장소에 기록하지 못했습니다.');
   try{other.removeItem(KEY);}catch{}
  }
 };
}

// Refresh tokens rotate. Serialize this origin's tabs when Web Locks is available.
export function withSessionLock(task){
 const locks=globalThis.navigator?.locks;
 return locks?.request?locks.request('vinyl-room-session-refresh',task):Promise.resolve().then(task);
}
