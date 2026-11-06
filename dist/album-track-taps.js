import {bindTrackTaps} from './track-taps.js';
export const bindAlbumTrackTaps=(root,options)=>bindTrackTaps(root,{selector:'[data-mobile-track-play]',key:b=>b.dataset.mobileTrackPlay,...options});
