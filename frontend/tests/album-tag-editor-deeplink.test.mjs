import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTagReader} from '../dist/tag-editor-host.js';

const read=name=>readFileSync(new URL('../dist/'+name,import.meta.url),'utf8');
const id='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const folder='KPOP/Silent Eye/First EP';
const file=folder+'/01.flac';

test('album detail keeps two admin-only buttons and directs to selected album',()=>{
 const app=read('app-index.js');
 assert.match(app,/<button id="edit-index">정보 수정<\/button><button id="tag-edit-index">태그 수정<\/button>/);
 assert.match(app,/\$\('#tag-edit-index'\)\.onclick=action\(\(\)=>openAdminCenter\(a\)\)/);
 assert.match(app,/initialTagAlbum=albumToEdit\?\.id/);
 const polish=read('ui-polish.js');
 assert.match(polish,/tools\.append\(edit\);const tag=root\.querySelector\('#tag-edit-index'\);if\(tag\)tools\.append\(tag\)/);
 const css=read('ui-polish.css');
 assert.match(css,/\.album-cover-tools\{display:flex;justify-content:center;align-items:center;gap:8px/);
});
test('admin Tab and iframe get exact verified target album',()=>{
 const admin=read('admin-center.js');
 const host=read('tag-editor-host.js');
 const ui=read('tag-editor-ui.js');
 assert.match(admin,/if\(initialTagAlbum\?\.id\)tab\('tag-editor'\)/);
 assert.match(host,/initialAlbum:allowedInitialAlbum/);
 assert.match(ui,/if\(m\.initialAlbum\)openLinkedAlbum\(m\.initialAlbum\)/);
 assert.match(ui,/void selectAlbum\(id\)/);
});
test('direct album reader admits selected ID only and still demands authenticated detail',async()=>{
 const calls=[];
 const api=async (path,options)=>{
   calls.push({path,options});
   if(path.startsWith('/v2/admin-album?'))return {
     id,artist:'Silent Eye',title:'First EP',relative_path:folder,
     physical_files:[{path:file,raw_tags:{title:['Death Penalty'],tracknumber:['01'],discnumber:['1']}}]
   };
   throw Error('unexpected request '+path);
 };
 const reader=createTagReader({api,canManage:()=>true,initialAlbumId:id});
 const result=await reader('/api/tracks?album='+id);
 assert.equal(result.album.id,id);
 assert.equal(result.album.entries[0].file,file);
 assert.ok(calls.some(x=>x.path.includes('/v2/admin-album?')));
 assert.ok(calls.every(x=>!x.options?.body));
 await assert.rejects(reader('/api/tracks?album='+other),/먼저 조회한 앨범/);
 const defaultReader=createTagReader({api,canManage:()=>true});
 await assert.rejects(defaultReader('/api/tracks?album='+id),/먼저 조회한 앨범/);
});
