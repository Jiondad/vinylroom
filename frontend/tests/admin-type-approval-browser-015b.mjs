import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const release=process.env.RELEASE;
assert.match(release,/^header-actions-[a-f0-9]{12}$/);
const base=path.resolve('out');
const html='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/releases/'+release+'/admin-center.css"><link rel="stylesheet" href="/releases/'+release+'/ai-proposal-review.css"><body><main class="nas-proposals" id="host"></main></body></html>';
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
  const p=path.resolve(base,'.'+url.pathname);if(!p.startsWith(base+path.sep))throw Error('path');
  res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'application/octet-stream');
  res.end(await readFile(p));
 }catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true});
 await mkdir('qa-015b',{recursive:true});
 for(const [width,height] of [[1280,800],[390,844]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>{errors.push('unexpected dialog');void d.dismiss();});
  await page.goto(origin+'/fixture');
  await page.evaluate(async release=>{
   const {mountAdminTypeApproval}=await import('/releases/'+release+'/admin-type-approval-015b.js');
   const album='2ecf4e94-f4fb-4da2-afca-a1e91ecdfb65',proposal='1c486689-5e8c-4a22-a4ee-5bc52ede4243',binding='596e850e08c484a52ea3a27d1e92aeb4d272a1aa0048aaf903e9b79925898445';
   window.calls=[];
   mountAdminTypeApproval({host:document.getElementById('host'),canManage:()=>true,signal:new AbortController().signal,api:async(p,o)=>{
    window.calls.push({p,admin:o.admin,body:o.body});
    if(o.body)return {state:'completed',status:'succeeded',operation:'admin_review_apply',album_id:album,proposal_id:proposal,operation_id:'a'.repeat(64),feed_seq:1,catalog_changed:true};
    return {ok:true,apply_enabled:true,confirmation_required:true,binding_sha256:binding,binding:{album_id:album,proposal_id:proposal,field:'work.album_type',before:'미확인',after:'Studio',apply_authorized:false,excluded_fields:['work.genre','work.secondary_genres']}};
   }});
  },release);
  const preview=page.getByRole('button',{name:'승인 내용 확인'}),apply=page.getByRole('button',{name:'Studio 승인 반영'});
  assert.equal(await apply.isEnabled(),false);
  assert.equal(await page.evaluate(()=>window.calls.length),0);
  await preview.click();await page.waitForFunction(()=>!document.querySelector('[data-type-apply]').disabled);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'horizontal overflow');
  await page.screenshot({path:'qa-015b/preview-'+width+'.png'});
  await apply.click();await page.waitForFunction(()=>document.querySelector('[data-type-status]').textContent.includes('반영 완료'));
  assert.equal(await apply.isEnabled(),false);
  assert.deepEqual(await page.evaluate(()=>window.calls.map(c=>[c.p,c.admin,Boolean(c.body)])),[['/v2/ai-classification/admin-review-type',true,false],['/v2/ai-classification/admin-review-type',true,true]]);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'qa-015b/receipt-'+width+'.png'});
  await page.close();
  console.log('PASS browser fixture '+width+'px; mock API only');
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
