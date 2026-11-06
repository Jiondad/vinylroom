import {g2Baseline} from './g2-source-guard.mjs';
import {normalizeMobileAdminChange} from './mobile-admin-source-guard.mjs';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const hash=v=>createHash('sha256').update(v).digest('hex');
const baseline=JSON.parse(readFileSync('docs/g1b/v153-existing-files.json','utf8'));
for(const [file,digest] of Object.entries(baseline.files)){
 let bytes=normalizeMobileAdminChange(file,readFileSync(file));
 bytes=g2Baseline(file,bytes);
 if(file==='dist/app-index.js')bytes=Buffer.from(bytes.toString().replace("import {installCompactUI,polishAlbumHeader} from './ui-polish.js';\n",'').replace('installCompactUI();\n','').replace(' polishAlbumHeader(albumPage,a);\n',''));
 if(file==='dist/admin-center.css'){const text=bytes.toString(),at=text.indexOf('/* G1-C:');if(at>=0){assert.equal(hash(text.slice(at)),'7ca2a0aeffd98c0ca9cdb40736af26ea2a2f6ac54a1670704350ba5f43a48fe0','Unexpected G1-C CSS change');bytes=Buffer.from(text.slice(0,at-1));}}
 assert.equal(hash(bytes),digest,'Unexpected v153 source modification: '+file);
}
console.log(JSON.stringify({v153_protection:'PASS',base:baseline.base_commit,existing_files_checked:Object.keys(baseline.files).length,only_app_changes:'UI setup hooks and scoped Admin account callback',g1c_css:'exact additive patch hash checked',indexing_playback_auth_lyrics_share:'unchanged'}));
