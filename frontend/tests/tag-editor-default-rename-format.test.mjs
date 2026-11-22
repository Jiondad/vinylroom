import test from 'node:test';
import assert from 'node:assert/strict';
import {renderFormat,previewPlan,parseFormat} from '../dist/tag-editor-plan.js';

const fmt='%discnumber% - $num(%track%,2). %title%';
const titles=['Death Penalty','Silent Eye','Transformation','Eliminate My Eyes'];
test('default Mp3tag format produces disc and padded track name',()=>{
 const entries=titles.map((title,i)=>({file:'ALBUM/old'+(i+1)+'.flac',tags:{discnumber:['1'],tracknumber:[String(i+1)],title:[title]}}));
 const results=previewPlan({entries,selected:entries.map(e=>e.file),mode:'to',format:fmt});
 assert.deepEqual(results.rows.map(r=>r.suggested_file_name),titles.map((title,i)=>`1 - ${String(i+1).padStart(2,'0')}. ${title}.flac`));
 assert.equal(results.rows.every(r=>r.state==='RENAME_PROPOSED'),true);
});
test('track numbers 9, 10 and 99 retain exactly two digits',()=>{
 for(const n of [9,10,99])assert.equal(renderFormat(fmt,{discnumber:['2'],tracknumber:[String(n)],title:['X']}),`2 - ${String(n).padStart(2,'0')}. X`);
 assert.equal(parseFormat(fmt,false).some(([kind,value])=>kind==='var'&&value==='track'),true);
});
test('only the exact supported $num track expression is accepted',()=>{
 assert.throws(()=>renderFormat('%discnumber% - $num(%artist%,2). %title%',{discnumber:['1'],artist:['A'],title:['X']}),/unsupported_num_expression/);
});
