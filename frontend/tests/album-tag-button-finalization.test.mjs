import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../dist/app-index.js',import.meta.url),'utf8');
const anchor=' // Keep both album editing buttons visibly together after the existing header';
const begin=src.indexOf(anchor);
const end=src.indexOf('\n }\n}',begin);
assert.ok(begin>0&&end>begin,'finalization block not found');
// Exercise only the new album-button finalization; do not execute the full app.
const block=src.slice(begin,end+3);
const finalize=new Function('repo','albumPage','action','openAdminCenter','a','document',block);
const makeButton=()=>({type:'button',id:'tag-edit-index',textContent:'태그 수정',hidden:false});
function fixture(exists){
 const info={id:'edit-index',textContent:'정보 수정'};
 const existing=exists?makeButton():null;
 const tools={children:[info],append(element){
   this.children=this.children.filter(x=>x!==element);
   this.children.push(element);
 }};
 const albumPage={querySelector(s){
   if(s==='.album-cover-tools')return tools;
   if(s==='#tag-edit-index')return existing;
   throw Error('Unexpected selector: '+s);
 }};
 let calls=0;
 const action=fn=>()=>{calls++;return fn()};
 const openAdminCenter=a=>a.id;
 const document={createElement(t){assert.equal(t,'button');return makeButton()}};
 finalize({admin:true},albumPage,action,openAdminCenter,{id:'album-123'},document);
 return {tools,calls:()=>calls};
}
test('existing Tag Edit button remains with Info Edit and is active',()=>{
 const f=fixture(true);
 assert.deepEqual(f.tools.children.map(x=>x.id),['edit-index','tag-edit-index']);
 assert.equal(f.tools.children[1].hidden,false);
 assert.equal(f.tools.children[1].onclick(),'album-123');
 assert.equal(f.calls(),1);
});
test('missing Tag Edit button is restored beside Info Edit',()=>{
 const f=fixture(false);
 assert.deepEqual(f.tools.children.map(x=>x.id),['edit-index','tag-edit-index']);
 assert.equal(f.tools.children[1].textContent,'태그 수정');
 assert.equal(f.tools.children[1].onclick(),'album-123');
});
test('guest album detail never receives an editing button',()=>{
 const tools={children:[],append(){throw Error('must not append')}};
 const albumPage={querySelector(){return tools}};
 finalize({admin:false},albumPage,()=>{},()=>{}, {id:'album-123'}, {createElement(){throw Error('must not create')}});
 assert.equal(tools.children.length,0);
});
