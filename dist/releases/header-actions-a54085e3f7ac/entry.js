import {getPlayer} from './player.js';
import {restorePlaylistPage,isApprovedMember} from './playlists.js';
getPlayer();
await import('./app-index.js');
if(isApprovedMember())await restorePlaylistPage();
