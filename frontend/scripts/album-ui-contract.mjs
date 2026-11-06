// Minimal build gate for the user's four album UI invariants. No browser/DB/network.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const readDefault=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
export function assertAlbumUIContract(read=readDefault){
 const app=read('dist/app-index.js'),ref=read('dist/reference-ui.js'),css=read('dist/design-v2.css'),legacy=read('dist/reference-ui.css');
 const nav=app.slice(app.indexOf('function albumPageLayout('),app.indexOf('function modal('));
 assert.match(nav,/<\/strong><\/div><nav class="album-page-navigation"[^]*?id="album-page-back"/,'album list must live outside the shared header');
 assert.equal((nav.match(/id="album-page-back"/g)||[]).length,1,'one album navigation entry');
 assert.match(nav,/querySelector\('#album-page-back'\)\.onclick=/,'original navigation callback must remain');
 const album=ref.slice(ref.indexOf('export function mountAlbumReference'),ref.indexOf('function updateAlbum'));
 assert.doesNotMatch(album,/앨범 정보 더 보기|ui6-extra-facts|createElement\(['"](?:details|summary)['"]\)/,'album metadata disclosure must not be recreated');
 assert.match(album,/column\.append\(cover\)/);assert.match(album,/tools\.append\(edit\);column\.append\(tools\)/,'existing edit button must remain in cover column');
 assert.match(album,/for\(const facts of allFacts\)factsArea\.append\(facts\)/,'metadata nodes must be retained');
 assert.match(app,/if\(repo\.admin\)\{\$\('#edit-index'\)\.onclick=\(\)=>edit\(a\)/,'existing permission/editor event must remain');
 assert.match(read('dist/typography-operational.css'),/--vr-weight-album-detail:350!important/,'latest user-approved album title weight must be 350');
 assert.match(css,/\.ui6-album-info h2\{[^}]*font-weight:var\(--vr-weight-album-detail\)/);
 for(const line of legacy.split('\n').filter(l=>l.includes('.ui6-album-info h2{'))){assert.doesNotMatch(line,/Georgia|Times|Noto Serif|AppleMyungjo|Batang|weight:(?:400|500|600|700)/,'no legacy serif/bold title declaration');}
 assert.doesNotMatch(read('dist/header-actions.css'),/:is\([^)]*#album-page-back/,'shared header layout must not own album navigation');
 assert.doesNotMatch(app,/<dt>소장\s*판본<\/dt>/,'album detail must not generate an edition row');
 assert.doesNotMatch(app,/class="album-chips"/,'album detail must not generate the legacy summary');
 assert.doesNotMatch(album,/ui6-album-meta|ui6-album-quality|album-release-date/,'no summary renderer');
 assert.match(album,/primary\.after\(actions\)/,'original action group must follow the canonical facts');
 const polish=read('dist/ui-polish.js');
 assert.doesNotMatch(polish,/label\.nextElementSibling\.remove\(|createElement\(['"]p['"]\)/,'polish may not extract/remove the release date');
 return true;
}
assertAlbumUIContract();
