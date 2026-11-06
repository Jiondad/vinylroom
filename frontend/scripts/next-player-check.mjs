import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const run=args=>{const result=spawnSync(process.execPath,args,{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);};
run(['scripts/next-player-release.mjs']);
run(['--test','tests/next-player.test.mjs']);
// Apply the same existing integration contract to the isolated generated build.
let suite=await readFile('tests/audio-owner-integration.test.mjs','utf8');
// Revocation now performs the same queue clear as the app's approval handler.
// Re-authorizing alone must not resurrect the revoked queue or pending source.
suite=suite.replace('setLibraryAccess(true);await p.play(0);',"assert.equal(p.items.length,0);setLibraryAccess(true);p.add([{title:'one',artist:'Artist'}]);await p.play(0);");
suite=suite.replaceAll(/'\.\.\/dist\/([^']+)'/g,(_,module)=>JSON.stringify(pathToFileURL(path.resolve('output/next-player/dist',module)).href));
await writeFile('output/next-player/ui-integration.test.mjs',suite);
run(['--test','output/next-player/ui-integration.test.mjs']);
run(['--test','tests/next-player-build.test.mjs']);
const metadata=JSON.parse(await readFile('output/next-player-release/source.json','utf8'));
let productionSuite=suite.replaceAll(pathToFileURL(path.resolve('output/next-player/dist')).href,pathToFileURL(path.resolve('output/next-player-release/dist/releases',metadata.release)).href);
await writeFile('output/next-player-release/ui-integration.test.mjs',productionSuite);
run(['--test','output/next-player-release/ui-integration.test.mjs']);
console.log('Next-engine core comparison and shared PC/mobile/MediaSession contract passed');
