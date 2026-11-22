import test from 'node:test';import assert from 'node:assert/strict';import {createTagReader} from '../dist/tag-editor-host.js';
const uid='11111111-1111-4111-8111-111111111111',file='KPOP/Test/Album/01.flac',next='KPOP/Test/Album/1 - 01. Death Penalty.flac';
// Use the existing folder/album registration via artist view, not fabricated file authority.
async function reader(qualified=true){const calls=[];let renamed=false,manage=true;const read=createTagReader({canManage:()=>manage,api:async(path,opt={})=>{calls.push({path,body:opt.body});
 if(path.startsWith('/v2/albums?'))return path.includes('view=artists')?{items:[{name:'Test',count:1}],pages:1}:{items:[{id:uid,artist:'Test',title:'Album',relative_path:'KPOP/Test/Album'}],pages:1};
 if(path.startsWith('/v2/admin-album'))return {id:uid,artist:'Test',title:'Album',relative_path:'KPOP/Test/Album',physical_files:[{path:renamed?next:file,raw_tags:{title:['Stale index title']}}]};
 if(path.endsWith('/save-capabilities'))return {state:'TAG_EDITOR_SAVE_CAPABILITIES',version:'tag-editor-save-v1',rename:qualified,live_tags:true};
 if(path.includes('/tag-cover/tags?'))return {state:'ACTUAL_ALBUM_TAGS',album:{id:uid,artist:'Test',title:'Album',path:'KPOP/Test/Album',year:'2026'},entries:[{file:renamed?next:file,tags:{title:['Actual audio title']}}]};
 if(path.endsWith('/rename-plan'))return {state:'READ_ONLY_RENAME_PLAN',plan_id:'a'.repeat(64)};
 if(path.endsWith('/rename-apply')){renamed=true;return {state:'RENAME_WRITE_COMPLETED',new_file:next,saved_tags:{title:['Actual audio title']}};}
 throw Error('Unexpected '+path);
 }});await read('/api/artists?q=Test');await read('/api/albums?artist=Test');const tracks=await read('/api/tracks?album='+uid);return {read,calls,tracks,revoke:()=>manage=false};}
test('Rename route registers new path, rejects old/outside path, rereads real tags',async()=>{const r=await reader();assert.equal(r.tracks.album.entries[0].tags.title[0],'Actual audio title');
 await assert.rejects(r.read('/api/rename/plan',{album_id:uid,file:'KPOP/Other/Album/01.flac',new_name:'new.flac'}));
 await r.read('/api/rename/plan',{album_id:uid,file,new_name:'1 - 01. Death Penalty.flac'});
 await r.read('/api/rename/apply',{album_id:uid,file,new_name:'1 - 01. Death Penalty.flac',confirm_write:true,expected_plan_id:'a'.repeat(64)});
 await assert.rejects(r.read('/api/rename/plan',{album_id:uid,file,new_name:'again.flac'}));
 const fresh=await r.read('/api/tracks?album='+uid);assert.equal(fresh.album.entries[0].file,next);
});
test('Unqualified Rename never sends apply; revocation blocks new routes',async()=>{const r=await reader(false);await assert.rejects(r.read('/api/rename/apply',{album_id:uid,file,new_name:'next.flac',confirm_write:true}));assert.equal(r.calls.filter(x=>x.path.endsWith('/rename-apply')).length,0);r.revoke();await assert.rejects(r.read('/api/rename/plan',{album_id:uid,file,new_name:'next.flac'}));});
import fs from 'node:fs';import vm from 'node:vm';
const uiSource=fs.readFileSync(new URL('../dist/tag-editor-ui.js',import.meta.url),'utf8');
async function controller(failSecond=false){
 const ids=['KPOP/Test/Album/01.flac','KPOP/Test/Album/02.mp3','KPOP/Test/Album/03.flac'];
 const original=ids.map(file=>({file,tags:{title:['Original']}}));
 const state={album:{id:uid},original, draft:structuredClone(original),selected:new Set(ids.slice(0,2)),renames:Object.fromEntries(ids.slice(0,2).map((f,i)=>[f,`1 - 0${i+1}. New.${f.split('.').pop()}`])),warnings:{},anchor:ids[0]};
 state.draft[0].tags.title=['Unstored draft'];
 const nodes=new Map(),get=key=>{if(!nodes.has(key))nodes.set(key,{});return nodes.get(key);};const sent=[];
 const context={S:state,saveCaps:{rename:true},window:{confirm:()=>true},toast:()=>{},$:get,clone:structuredClone,saveDraft:()=>{},renderTracks:()=>{},saveButtonState:()=>{},api:async(path,b)=>{
  if(path==='/api/rename/plan')return {state:'READ_ONLY_RENAME_PLAN',plan_id:'a'.repeat(64)};
  if(path==='/api/rename/apply'){sent.push(b.file);if(failSecond&&sent.length===2)return {state:'HOLD',reason:'collision'};return {state:'RENAME_WRITE_COMPLETED',new_file:b.file.replace(/[^/]+$/,b.new_name),saved_tags:{title:['Original']},operation_id:'operation'};}
  if(path.startsWith('/api/tracks'))return {album:{entries:state.original}};
  throw Error(path);
 }};
 await vm.runInNewContext(uiSource.slice(uiSource.indexOf('async function saveRenames()'))+'\nsaveRenames()',context);
 return {state,sent,nodes};
}
test('UI rename keeps tag drafts, limits selection and stores new paths',async()=>{const r=await controller();assert.equal(r.sent.length,2);assert.ok(r.state.original[0].file.includes('1 - 01. New'));assert.equal(r.state.draft[0].tags.title[0],'Unstored draft');assert.ok(r.state.original[2].file.endsWith('/03.flac'));assert.equal(Object.keys(r.state.renames).length,0);});
test('UI partial failure keeps unsaved rename draft and reports exact count',async()=>{const r=await controller(true);assert.equal(r.sent.length,2);assert.equal(Object.keys(r.state.renames).length,1);assert.ok(r.state.original[1].file.endsWith('/02.mp3'));assert.match(r.nodes.get('#saveStatus').textContent,/저장 1곡.*collision/);});
