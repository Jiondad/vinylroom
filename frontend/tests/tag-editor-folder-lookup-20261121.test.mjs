import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTagReader} from '../dist/tag-editor-host.js';

// New-only coverage: listing path fast path and bounded missing-path fallback.
const uuid=n=>String(n).padStart(8,'0')+'-1111-4111-8111-111111111111';
const wanted='JAZZ/Chet Baker',folderQuery='/api/albums?artist='+encodeURIComponent('folder:'+wanted);
const baseFolders=u=>({folders:u.searchParams.get('path')===''?
 [{name:'JAZZ',path:'JAZZ'}]:[{name:'Chet Baker',path:wanted}]});
async function ready(api){
 const read=createTagReader({api,canManage:()=>true});
 await read('/api/folders?path=');
 await read('/api/folders?path=JAZZ');
 return read;
}
function trackAlbum(id,path){
 return {id,relative_path:path,artist:'Chet Baker',title:'Example',physical_files:[
  {path:path+'/01.flac',raw_tags:{TITLE:['Track'],ARTIST:['Chet Baker']}}
 ]};
}

test('valid listing paths avoid bulk detail fetch and reject neighboring folder prefixes',async()=>{
 const id=uuid(1),other=uuid(2),calls=[];
 const api=async path=>{
  calls.push(path);const u=new URL(path,'https://fixture.invalid');
  if(u.pathname==='/v2/folders')return baseFolders(u);
  if(u.pathname==='/v2/albums')return {pages:1,items:[
   {id,title:'Album',relative_path:wanted+'/Album',original_year:'1953'},
   {id:other,title:'Wrong folder',relative_path:'JAZZ/Chet Baker Jr/Album'}]};
  if(u.pathname==='/v2/admin-album')return trackAlbum(id,wanted+'/Album');
  throw Error('Unexpected '+path);
 };
 const read=await ready(api);
 const list=await read(folderQuery);
 assert.deepEqual(list.items.map(a=>a.id),[id]);
 assert.equal(calls.filter(x=>x.startsWith('/v2/admin-album')).length,0);
 const result=await read('/api/tracks?album='+id);
 assert.equal(result.album.entries.length,1);
 assert.equal(calls.filter(x=>x.startsWith('/v2/admin-album')).length,1);
});

test('missing listing paths retain verified folder scope with only two in-flight probes',async()=>{
 const ids=[uuid(3),uuid(4),uuid(5)],calls=[];let inFlight=0,peak=0;
 const api=async path=>{
  calls.push(path);const u=new URL(path,'https://fixture.invalid');
  if(u.pathname==='/v2/folders')return baseFolders(u);
  if(u.pathname==='/v2/albums')return {pages:1,items:ids.map(id=>({id,title:'Album '+id}))};
  if(u.pathname==='/v2/admin-album'){
   inFlight++;peak=Math.max(peak,inFlight);
   try{await new Promise(resolve=>setTimeout(resolve,2));
    return trackAlbum(u.searchParams.get('id'),wanted+'/Album');
   }finally{inFlight--;}
  }
  throw Error('Unexpected '+path);
 };
 const read=await ready(api),list=await read(folderQuery);
 assert.deepEqual(list.items.map(a=>a.id),ids);
 assert.equal(calls.filter(x=>x.startsWith('/v2/admin-album')).length,ids.length);
 assert.equal(peak,2);
});
