import {getPlayer} from './player.js';
import {restorePlaylistPage} from './playlists.js';
getPlayer();
await import('./app-index.js');
await restorePlaylistPage();
