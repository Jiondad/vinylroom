// Inflight coalescing only: no stale search-result TTL or authentication cache.
export function createCatalogRequests(){
 let active=null;
 function cancel(){if(active){active.controller.abort();active=null;}}
 function run(key,load,timeout=20000){
  if(active?.key===key)return active.promise;
  cancel();const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  const promise=Promise.resolve().then(()=>load(controller.signal)).finally(()=>{clearTimeout(timer);if(active?.promise===promise)active=null;});
  active={key,controller,promise};return promise;
 }
 return {run,cancel};
}
