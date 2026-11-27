import assert from 'node:assert/strict';
import {catalogTypeLabel,siteType,typeNote} from '../dist/ai-type-presentation.js';
import {albumFacts} from '../dist/presentation.js';
for(const [a,b] of [['정규','Studio'],['Compilation','Compilations'],['Bootleg','Bootlegs'],['미니/싱글','Singles & EPs'],['', '미확인'],[null,'미확인'],['OST','OST'],['Demo','Demo'],['custom','custom']]) assert.equal(catalogTypeLabel(a),b);
assert.equal(siteType('Soundtrack'),'OST');assert.equal(siteType('Demo'),'ETC');assert.ok(typeNote('work.album_type','Demo').includes('원본 Demo 보존'));
assert.ok(albumFacts({category:'정규'}).includes('<dd>Studio</dd>'));
assert.ok(albumFacts({}).includes('<dd>미확인</dd>'));
console.log('W08 display checks PASS');
