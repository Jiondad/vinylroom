import test from 'node:test';import assert from 'node:assert/strict';
import {createTagReader}from '../../frontend/dist/tag-editor-host.js';
const id='fda876f3-b821-40ed-b8ed-26881c4f256c';
test('new cover bridge uses known album-relative file; rejects arbitrary apply and absolute files',async()=>{
 const calls=[];const api=async(p,o)=>{calls.push({p,o});if(p.includes('view=artists'))return{items:[{name:'A',count:1}]};if(p.startsWith('/v2/albums'))return{items:[{id,title:'B'}],pages:1};if(p.startsWith('/v2/admin-album'))return{id,artist:'A',title:'B',relative_path:'KPOP/A/B',physical_files:[{path:'/music/KPOP/A/B/01.flac',raw_tags:{}}]};return {state:'EMBEDDED_COVER_INSPECTED'};};
 const read=createTagReader({api,canManage:()=>true});await read('/api/artists?q=A');await read('/api/albums?artist=A');await read('/api/tracks?album='+id);
 await read('/api/cover/inspect',{album_id:id,file:'/music/KPOP/A/B/01.flac'});const call=calls.at(-1);assert.equal(new URL(call.p,'https://test').searchParams.get('file'),'KPOP/A/B/01.flac');assert.equal(call.o.body,undefined);assert.equal(call.o.admin,true);
 const count=calls.length;await assert.rejects(read('/api/cover/apply',{}),/비활성/);await assert.rejects(read('/api/cover/inspect',{album_id:id,file:'/music/private.flac'}),/현재/);assert.equal(calls.length,count);
});
test('new cover UI has no apply request, desktop/mobile styles and disabled save',async()=>{const{readFile}=await import('node:fs/promises');const s=await readFile(new URL('../../frontend/dist/tag-editor-cover-draft.js',import.meta.url),'utf8'),css=await readFile(new URL('../../frontend/dist/tag-editor-cover-draft.css',import.meta.url),'utf8');assert.match(s,/disabled title=/);assert.doesNotMatch(s,/api\(['"]\/api\/cover\/(apply|restore)/);assert.match(css,/@media\(max-width:700px\)/);assert.match(s,/원본과 변경 예정 커버 비교/);});
