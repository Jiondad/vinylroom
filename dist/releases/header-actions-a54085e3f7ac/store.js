import {catalogCache} from './catalog-cache.js';
import {DEFAULT_SUPABASE_URL,DEFAULT_SUPABASE_KEY,NAS_URL,ADMIN_EMAIL} from './config.js';
import {demo,validateConfig} from './core.js';
const LOCAL='music-archive-demo-v1',CONFIG='music-archive-connection-v1';
export class Repository{
 constructor({guest=false}={}){this.guestEnabled=guest;this.config=JSON.parse(localStorage.getItem(CONFIG)||'null')||{url:DEFAULT_SUPABASE_URL,key:DEFAULT_SUPABASE_KEY};if(this.config.url===DEFAULT_SUPABASE_URL&&!this.config.key)this.config.key=DEFAULT_SUPABASE_KEY;if(guest)this.config={url:DEFAULT_SUPABASE_URL,key:DEFAULT_SUPABASE_KEY};this.session=null;this.data={albums:[],artists:[]};this.covers=new Map();this.summaryIds=new Set();this.catalogCache=catalogCache;this.loadEpoch=0;} 
 get admin(){return !!this.session && (!this.guestEnabled||this.session.user?.email?.toLowerCase()===ADMIN_EMAIL);}
 get guest(){return this.guestEnabled&&!this.session;}
 get cloud(){return this.guestEnabled||!!this.session;}
 requireAdmin(){if(this.guestEnabled&&!this.admin)throw Error('관리자 로그인 후 이용하세요.');}
 async guestRequest(path){const response=await fetch(NAS_URL+path,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});const result=await response.json();if(!response.ok)throw Error(result.message||'서재 연결에 실패했습니다.');return result;}
 async loadGuest(force=false,epoch=this.loadEpoch){
  const current=()=>this.guest&&this.loadEpoch===epoch;
  const apply=data=>{this.data=data;this.summaryIds=new Set(data.albums.map(a=>a.id));};
  const refresh=async()=>{let albums=[],artists=[];for(let offset=0;;offset+=500){
   const page=await this.guestRequest('/v1/catalog?offset='+offset);if(!current())return this.data;
   albums.push(...page.albums);if(offset===0)artists=page.artists;
   if(!this.data.albums.length){apply({albums:[...albums],artists});this.onCatalogUpdate?.();}
   this.onProgress?.(albums.length);if(page.albums.length<500)break;
  }
  if(!current())return this.data;
  const snapshot={albums,artists};apply(snapshot);this.onCatalogUpdate?.();
  void this.catalogCache.write(snapshot).catch(()=>{});return this.data;};
  const cached=force?null:await this.catalogCache.read().catch(()=>null);
  if(!current())return this.data;
  if(cached){apply(cached.data);if(Date.now()-cached.savedAt>300000)this.backgroundRefresh=refresh().catch(()=>{if(current())this.onCatalogError?.('최근 저장된 목록을 표시하고 있습니다. 서버 연결 후 목록 새로고침을 눌러 주세요.');});return this.data;}
  return refresh();
 }


 async load({force=false}={}){const epoch=++this.loadEpoch;this.covers.clear();this.summaryIds.clear();if(this.guest)return this.loadGuest(force,epoch);if(!this.cloud){this.data=JSON.parse(localStorage.getItem(LOCAL)||'null')||demo();return this.data;}const [albums,artists]=await Promise.all([this.all('library_albums','id,source_id,artist:data->artist,title:data->title,original_year:data->original_year,release_year:data->release_year,edition:data->edition,label:data->label,catalog_number:data->catalog_number,country:data->country,format:data->format,genre:data->genre,genre_mode:data->genre_mode,notes:data->notes,styles:data->styles,reviewed:data->reviewed,created_at:data->created_at,tracks:data->tracks'),this.all('library_artists')]);this.data={albums:albums.map(({tracks,...a})=>({...a,track_titles:(tracks||[]).map(t=>t.title||'')})),artists:artists.map(r=>({name:r.name,genre:r.genre}))};this.summaryIds=new Set(albums.map(a=>a.id));return this.data;}
 async all(table,select='*'){let rows=[],last='';for(;;){const ids=await this.request(`/rest/v1/${table}?select=id&order=id&limit=500${last?'&id=gt.'+encodeURIComponent(last):''}`);if(!ids.length)return rows;for(let i=0;i<ids.length;i+=100){const keys=ids.slice(i,i+100).map(r=>r.id);if(keys.some(id=>! /^[0-9a-f-]{36}$/i.test(id)))throw Error('잘못된 앨범 식별자입니다.');const batch=await this.request(`/rest/v1/${table}?select=${encodeURIComponent(select)}&id=in.(${keys.join(',')})&order=id`);rows.push(...batch);if(table==='library_albums')this.onProgress?.(rows.length);}last=ids.at(-1).id;if(ids.length<500)return rows;}}

 async getAlbum(id){
  if(!this.cloud||!this.summaryIds.has(id))return this.data.albums.find(a=>a.id===id);
  if(this.guest){const a=await this.guestRequest('/v1/album?id='+encodeURIComponent(id));this.data.albums=this.data.albums.map(x=>x.id===id?a:x);this.summaryIds.delete(id);return a;}
  const rows=await this.request('/rest/v1/library_albums?select=id,source_id,data&id=eq.'+encodeURIComponent(id));
  if(!rows.length)throw Error('앨범을 찾을 수 없습니다. 다시 로그인해 목록을 갱신해 주세요.');
  const a={...rows[0].data,id:rows[0].id,source_id:rows[0].source_id};
  this.data.albums=this.data.albums.map(x=>x.id===id?a:x);this.summaryIds.delete(id);return a;
 }
 async loadCovers(ids){
  if(!this.cloud)return;
  const pending=ids.filter(id=>!this.covers.has(id));if(!pending.length)return;
  const session=this.session;
  for(let start=0;start<pending.length;start+=24){
  if(this.session!==session)return;
  const missing=pending.slice(start,start+24);
  const rows=this.guest?await this.guestRequest('/v1/covers?ids='+encodeURIComponent(missing.join(','))):await this.request('/rest/v1/library_albums?select=id,thumbnail:data->thumbnail&id=in.'+encodeURIComponent('('+missing.join(',')+')'));
  if(this.session!==session)return;
  for(const id of missing)this.covers.set(id,null);
  for(const row of rows)this.covers.set(row.id,row.thumbnail||null);
  }
 }
 async exportData(){this.requireAdmin();if(!this.cloud)return this.data;const rows=await this.all('library_albums');return {artists:this.data.artists,albums:rows.map(r=>({...r.data,id:r.id,source_id:r.source_id}))};}
 async waitForRetry(ms){await new Promise(resolve=>setTimeout(resolve,ms));}
 async request(path,options={}){
  if(!this.config)throw Error('Supabase 연결 설정이 필요합니다.');
  if(this.session&&Date.now()>this.expires-60000)await this.refresh();
  const session=this.session,config=this.config;
  const read=path.startsWith('/rest/v1/')&&(options.method||'GET').toUpperCase()==='GET';
  const delays=[1000,2000,4000];
  for(let attempt=0;;attempt++){
   if(this.session!==session||this.config!==config)throw Error('연결 상태가 변경되었습니다. 다시 시도해 주세요.');
   const res=await fetch(config.url+path,{...options,headers:{apikey:config.key,'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{}),...options.headers}});
   const text=await res.text();let data;try{data=text?JSON.parse(text):null;}catch{throw Error('서버 응답을 해석하지 못했습니다.');}
   if(res.ok)return data;
   const future=res.status===401&&data?.code==='PGRST303'&&data?.message==='JWT issued at future';
   if(future&&read&&session&&attempt<delays.length){await this.waitForRetry(delays[attempt]);continue;}
   if(future)throw Error('서버의 로그인 시간 확인이 지연되고 있습니다. 잠시 후 다시 연결해 주세요.');
   throw Error(data?.msg||data?.message||data?.error_description||'요청 실패: '+res.status);
  }
 }
 async login(url,key,email,password){this.config=validateConfig(url,key);const r=await this.request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});if(this.guestEnabled&&r.user?.email?.toLowerCase()!==ADMIN_EMAIL)throw Error('관리자 계정으로 로그인하세요.');this.session=r;this.expires=Date.now()+r.expires_in*1000;localStorage.setItem(CONFIG,JSON.stringify(this.config));try{await this.load();}catch(e){this.session=null;throw e;}}
 async refresh(){const r=await fetch(this.config.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:this.config.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:this.session.refresh_token})});if(!r.ok){this.session=null;throw Error('로그인이 만료되었습니다. 다시 로그인하세요.');}const s=await r.json();this.session=s;this.expires=Date.now()+s.expires_in*1000;}
 async logout(){if(this.session)try{await this.request('/auth/v1/logout',{method:'POST'});}finally{this.session=null;}await this.load();}
 localSave(next=this.data){try{localStorage.setItem(LOCAL,JSON.stringify(next));}catch{throw Error('이 기기의 체험 저장 공간이 부족합니다. 클라우드에 연결하거나 작은 목록을 사용하세요.');}}
 async saveAlbum(a){this.requireAdmin();if(this.cloud){const uid=this.session.user.id;await this.request('/rest/v1/library_albums?on_conflict=owner_id,source_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({id:a.id,owner_id:uid,source_id:a.source_id,data:a})});}const albums=[...this.data.albums];const i=albums.findIndex(x=>x.id===a.id);if(i<0)albums.push(a);else albums[i]=a;const next={...this.data,albums};if(!this.cloud)this.localSave(next);this.data=next;}
 async saveArtist(name,genre){this.requireAdmin();if(this.cloud)await this.request('/rest/v1/library_artists?on_conflict=owner_id,name',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({owner_id:this.session.user.id,name,genre})});const artists=[...this.data.artists];const i=artists.findIndex(x=>x.name===name);if(i<0)artists.push({name,genre});else artists[i]={name,genre};const next={...this.data,artists};if(!this.cloud)this.localSave(next);this.data=next;}
 async removeAlbum(id){this.requireAdmin();if(this.cloud)await this.request('/rest/v1/library_albums?id=eq.'+encodeURIComponent(id),{method:'DELETE'});const next={...this.data,albums:this.data.albums.filter(a=>a.id!==id)};if(!this.cloud)this.localSave(next);this.data=next;}
}
