const KEY='vinyl-room-login-v1';
export function loginStorage(tab,persistent){
 return {
  read(){
   for(const [storage,remember] of [[tab,false],[persistent,true]]){
    try{const value=JSON.parse(storage.getItem(KEY)||'null');if(typeof value?.refresh_token==='string'&&value.refresh_token)return {refresh_token:value.refresh_token,remember};}catch{}
   }
   return null;
  },
  clear(){for(const storage of [tab,persistent])try{storage.removeItem(KEY);}catch{}},
  save(session,remember){
   if(!session?.refresh_token){this.clear();return;}
   const destination=remember?persistent:tab,other=remember?tab:persistent;
   destination.setItem(KEY,JSON.stringify({refresh_token:session.refresh_token}));
   try{other.removeItem(KEY);}catch{}
  }
 };
}
