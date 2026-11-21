import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Tag Editor uses its single existing full-path modal',async()=>{
 const html=await readFile(new URL('../dist/tag-editor-ui.html',import.meta.url),'utf8');
 const js=await readFile(new URL('../dist/tag-editor-ui.js',import.meta.url),'utf8');
 assert.equal((html.match(/id="pathDialog"/g)||[]).length,1);
 assert.equal((html.match(/id="closePath"/g)||[]).length,1);
 assert.match(js,/const pathDialog=\$\('#pathDialog'\)/);
 assert.match(js,/\$\('#closePath'\)\.onclick=\(\)=>pathDialog\.close\(\)/);
 assert.doesNotMatch(js,/document\.createElement\('dialog'\)/);
 assert.doesNotMatch(js,/document\.body\.append\(pathDialog\)/);
});
