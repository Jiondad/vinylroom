import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dist/tag-editor-ui.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../dist/tag-editor-ui.css',import.meta.url),'utf8');
test('artist search remains outside the independently scrolling tree',()=>{
 const nav=html.slice(html.indexOf('<div id="navigation">'),html.indexOf('</aside>'));
 assert.match(nav,/<form id="artistForm"/);
 assert.match(nav,/<div id="artistScroll"[^>]+>/);
 assert.ok(nav.indexOf('<form id="artistForm"')<nav.indexOf('<div id="artistScroll"'));
 assert.ok(nav.indexOf('<div id="searchResults"')>nav.indexOf('<div id="artistScroll"'));
 assert.ok(nav.indexOf('<nav id="artistList"')>nav.indexOf('<div id="artistScroll"'));
 assert.match(css,/#artistScroll\s*\{[^}]*overflow-y:auto/);
 assert.match(css,/#navigation\s*\{[^}]*overflow:hidden/);
 assert.match(css,/\.browser\s*\{[^}]*--tag-visible-height/);
});
test('mobile collapse still hides navigation and retains available scroll on expansion',()=>{
 assert.match(css,/\.browser\.collapsed #navigation\s*\{display:none\}/);
 assert.match(css,/\.browser\.collapsed\s*\{height:auto;max-height:none\}/);
});
