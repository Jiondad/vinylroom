import {getPlayer} from './player.js';
import {restorePlaylistPage,isApprovedMember} from './playlists.js';
getPlayer();
await import('./app-index.js?v=artist-back-removed-v123');
if(isApprovedMember())await restorePlaylistPage();
