// Focused build gate: queue presentation + explicitly approved typography amendment.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ref=read('dist/reference-ui.js'),a2=read('dist/typography-a2.css');
assert.doesNotMatch(ref,/대기열 관리|createElement\(['"](?:details|summary)['"]\)/,'queue management popup must never be generated');
assert.match(ref,/tools\.append\(all\)/);assert.match(ref,/header\.append\(tools\)/);
assert.match(ref,/bindDesktopQueueInline\(panel,save,clear/);
assert.match(read('dist/queue-controls.js'),/inlineHost/);
assert.match(read('dist/design-v2.js'),/\['typography-a2.css','design-v2-tokens.css','design-v2.css'\]/);
assert.match(a2,/--vr-weight-body:350/);assert.match(a2,/--vr-weight-album-detail:200/);
assert.match(a2,/font-synthesis:none!important/);
assert.doesNotMatch(a2,/(?:font-size|line-height|letter-spacing|padding|margin|background|color)\s*:/,'A2 may change typography weight/family only');

const operational=read('dist/typography-operational.css');
assert.match(operational,/Noto Sans KR/);assert.match(operational,/--vr-weight-album-detail:350!important/);assert.match(operational,/font-weight:350!important/);
assert(read('dist/design-v2.js').indexOf("new URL('./typography-operational.css'")<read('dist/design-v2.js').indexOf("['typography-a2.css'"),'latest typography must precede historical A2');
