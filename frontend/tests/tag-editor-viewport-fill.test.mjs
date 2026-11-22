import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const file=name=>readFileSync(new URL('../dist/'+name,import.meta.url),'utf8');
test('visible viewport height does not depend on short iframe bottom',()=>{
 const host=file('tag-editor-host.js');
 assert.match(host,/innerHeight-Math\.max\(0,r\.top\)-12/);
 assert.doesNotMatch(host,/Math\.min\(innerHeight,r\.bottom\)/);
 assert.match(host,/tag-editor-ui\.html\?v=20261122-viewport-fill/);
 assert.match(host,/ResizeObserver\(fit\)/);
});
test('desktop pane fills screen and artist search remains fixed',()=>{
 const css=file('tag-editor-ui.css');
 assert.match(css,/min-height:max\(460px,calc\(var\(--tag-visible-height,100dvh\) - 12px\)\)/);
 assert.match(css,/\.workspace>\.browser\{\s*height:100%;\s*max-height:none/);
 assert.match(css,/#artistScroll\{[\s\S]*?overflow-y:auto/);
 assert.match(css,/\.workspace \.track-panel \.table-scroll\{[\s\S]*?overflow-y:auto/);
 assert.match(css,/@media\(min-width:651px\)/);
 assert.match(file('tag-editor-ui.html'),/tag-editor-ui\.css\?v=20261122-viewport-fill/);
});
test('existing nine-column editor, mobile browser and save controls remain',()=>{
 const page=file('tag-editor-ui.html'),css=file('tag-editor-ui.css');
 assert.match(page,/<th>ALBUMARTIST<\/th>/);
 assert.match(page,/id="saveTags"/);
 assert.match(css,/\.browser\.collapsed\{height:auto;max-height:none\}/);
 assert.match(page,/id="artistScroll"/);
});
