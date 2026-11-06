// Local candidate projection. Never publishes or changes operational NAS state.
import {readFile,writeFile,cp,mkdir} from 'node:fs/promises';
const release='artist-profile-admin-v241-candidate';
const html='out/index.html';
const current=await readFile(html,'utf8');
const match=current.match(/releases\/([^/]+)\/entry\.js/);
if(!match)throw Error('existing_release_not_found');
const prior=match[1];
if(prior!==release){
 await mkdir('out/releases',{recursive:true});
 await cp(`out/releases/${prior}`,`out/releases/${release}`,{recursive:true,errorOnExist:true,force:false});
 await writeFile(html,current.replaceAll(`releases/${prior}/`,`releases/${release}/`));
}
for(const name of ['ai-type-presentation.js','admin-center.js','ai-operation-status.js','ai-field-selection.js','ai-proposal-review.js','ai-classification.js','ai-classification.css','app-index.js','artist-index-policy.js','artist-experience.css','artist-home.css','artist-gallery.js','artist-gallery-integration.js','artist-home.js','artist-image-core.js','artist-profile-editor.js','lyrics-dialog.js','lyrics-dialog.css','ui-polish.css'])
 await cp(`dist/${name}`,`out/releases/${release}/${name}`,{force:true});
console.log(`CANDIDATE_STATIC_RELEASE=out/releases/${release}`);

await cp('dist/lyrics-dialog.css','out/lyrics-dialog.css',{force:true});
await writeFile(html,(await readFile(html,'utf8')).replace(/lyrics-dialog\.css\?v=[^\"]+/g,'lyrics-dialog.css?v=lyrics-gold-20261105'));
