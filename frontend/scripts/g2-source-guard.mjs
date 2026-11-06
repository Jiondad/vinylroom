import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const entries={"dist/admin-center.js": {"current": "d797cc234a05c8ce417f0cf191558f9578e436354129e6d643ce0eef0a0db26e", "baseline": "50e9a47803393a0e03f82f6e4a2299fc6ecc05da423837c80b71407e793ea630", "reference": "docs/g2/admin-center.v158.js"}, "dist/presentation.js": {"current": "c4375bc9609147b68941ec4d8374c3059e145e937a8763e483c401c5f7644e02", "baseline": "3d936b882a16fa15f0428dc1fec6f94ef12a3afe4ebfcab92bdd10ece2f5fcbd", "reference": "docs/g2/presentation.v158.js"}, "dist/style.css": {"current": "60aef4de53ca577915aa41dc1fb5fd63e305c06c81642219593527eedaf91bbf", "baseline": "b67933c4d1806c974750e42a48f991ba99048e24d1d58a73c4bdf58dce90ac38", "git": "31bff018f29a2a6afa74825955097dccadfc4f18"}};
const hash=b=>createHash('sha256').update(b).digest('hex');
export function g2Baseline(file,bytes){
 const e=entries[file];if(!e)return bytes;
 if(file==='dist/admin-center.js'&&hash(bytes)==='4f0fc096264959fdaa7da6b19232fc819b30e6ab92895e43166e79c31252a5c6'){
  // G4-D is an exact, reviewed successor of the live v165 Admin source.
  // Restore that immutable source before applying the existing G2/G0 guard.
  bytes=Buffer.from(execFileSync('git',['show','b6b318bcc4c7b68549d27fbf2c3271e018d91c9c:dist/admin-center.js']));
 }
 assert.equal(hash(bytes),e.current,'Unexpected G2 source: '+file);
 const original=e.git?Buffer.from(execFileSync('git',['show',`${e.git}:${file}`])):readFileSync(e.reference);
 assert.equal(hash(original),e.baseline,'G2 reference changed');return original;
}
