// Save-only candidate: reuse the v172 production builder, with a fresh UI namespace.
import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {readFile,writeFile,rename} from 'node:fs/promises';
const build=spawnSync(process.execPath,['scripts/admin-integration-release.mjs'],{stdio:'inherit'});if(build.status!==0)process.exit(build.status||1);
for(const root of ['out','output/next-player-release/dist']){
 const html=await readFile(root+'/index.html','utf8'),previous=html.match(/releases\/([^/"']+)\/entry\.js/)?.[1];if(!previous)throw Error('Release missing');
 const hash=createHash('sha256').update(previous);
 for(const name of ['button-system.js','button-system.css','reference-ui.js','reference-ui.css','presentation.js','ui-polish.js','ui-polish.css','back-to-top.js','back-to-top.css','header-actions.js','header-actions.css','playlists.js','app-index.js','artist-home.js','artist-home.css','artist-metadata.js','artist-relations.js','artist-verified-sidecar.js','artist-index-policy.js','album-track-taps.js','track-taps.js','random-mobile-actions.js','top100-ui.js','catalog-links.js','media.js','player.js','mobile-player.js','ai-proposal-review.js'])hash.update(await readFile(root+'/releases/'+previous+'/'+name));
 const release='header-actions-'+hash.digest('hex').slice(0,12);await rename(root+'/releases/'+previous,root+'/releases/'+release);await writeFile(root+'/index.html',html.replaceAll(previous,release));
 console.log('Shared header candidate, not published:',release);
}
