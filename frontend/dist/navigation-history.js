const views=new Set(['home','library','artists','random','top100','review','duplicates']);
export function navigationSnapshot(value={}){
 const result={view:views.has(value.view)?value.view:'home',page:Number.isSafeInteger(value.page)&&value.page>0?Math.min(value.page,100000):1};
 for(const key of ['artist','letter','category','search','genre','format','sort','seed','chart','album'])result[key]=typeof value[key]==='string'?value[key].slice(0,key==='search'?500:400):'';
 result.panel=value.panel==='playlist'?'playlist':'';return result;
}
export function createNavigationHistory({window,onNavigate,onError=()=>{},urlForSnapshot=null}){
 const history=window.history,key='vinylNavigation';
 const current=()=>{const saved=history.state?.[key];return saved?.version===1?navigationSnapshot(saved.snapshot):null;};
 function write(snapshot,replace=false){
  const next=navigationSnapshot(snapshot);if(!replace&&JSON.stringify(next)===JSON.stringify(current()))return false;
  try{const prior=history.state?.[key],position=replace?(prior?.position||0):(prior?.position||0)+1;history[replace?'replaceState':'pushState']({...history.state,[key]:{version:1,position,snapshot:next}},'',...(urlForSnapshot?[urlForSnapshot(next)]:[]));return true;}
  catch{onError('브라우저가 사이트 방문 기록 저장을 허용하지 않습니다.');return false;}
 }
 const pop=event=>{const saved=event.state?.[key];if(saved?.version!==1)return;Promise.resolve().then(()=>onNavigate(navigationSnapshot(saved.snapshot))).catch(error=>onError(error.message||'이전 화면을 복원하지 못했습니다.'));};
 window.addEventListener('popstate',pop);
 return {current,canGoBack:()=>Number(history.state?.[key]?.position||0)>0,record:snapshot=>write(snapshot),replace:snapshot=>write(snapshot,true),back:()=>history.back(),dispose:()=>window.removeEventListener('popstate',pop)};
}
