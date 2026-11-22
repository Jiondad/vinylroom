import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../dist/'+p,import.meta.url),'utf8');
const html=read('tag-editor-ui.html'),js=read('tag-editor-ui.js'),css=read('tag-editor-ui.css'),admin=read('admin-center.css'),host=read('tag-editor-host.js');
test('9-column track header and dynamic rows include editable ALBUMARTIST',()=>{
 assert.match(html,/<th>ARTIST<\/th><th>ALBUMARTIST<\/th><th>FEATURING<\/th>/);
 assert.match(js,/\['tracknumber','title','artist','album_artist','featuring','genre'\]\.map\(f=>cell\(e,f\)\)/);
 assert.match(js,/const f=e\.target\.dataset\.field/);
 assert.equal((html.match(/<th[ >]/g)||[]).length,9);
 assert.match(html,/colspan="9"/);
 assert.match(js,/colspan="9">DISC/);
 assert.match(js,/colspan="9" class="empty"/);
});
test('artist browser expanded 30%, title and artist width prioritized',()=>{
 assert.match(css,/grid-template-columns:minmax\(0,28\.6%\)/);
 assert.match(css,/grid-template-columns:minmax\(0,29\.9%\)/);
 assert.match(css,/min-width:1260px/);
 assert.match(css,/\.track-panel th:nth-child\(4\)\{width:21%\}/);
 assert.match(css,/\.track-panel th:nth-child\(5\)\{width:18%\}/);
 assert.match(css,/\.track-panel th:nth-child\(6\)\{width:17%\}/);
 assert.match(css,/overflow-x:auto/);
 assert.match(css,/nth-child\(6\)::before\{content:'ALBUMARTIST'\}/);
});
test('Tag Editor only removes admin max-width cap and changes module versions',()=>{
 assert.match(admin,/\.vinyl-admin-page\.vr-tag-editor-active \.vr-admin-inner/);
 assert.match(admin,/max-width:none/);
 assert.match(html,/tag-editor-ui.css\?v=20261122-wide-albumartist/);
 assert.match(html,/tag-editor-ui.js\?v=20261122-wide-albumartist/);
 assert.match(host,/tag-editor-ui.html\?v=20261122-wide-albumartist/);
 assert.match(host,/vr-tag-editor-active/);
});
