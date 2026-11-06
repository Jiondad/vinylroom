import {bindTrackTaps} from './track-taps.js';
export const bindRandomTrackActions=(root,options)=>bindTrackTaps(root,{selector:'[data-random-track]',key:b=>b.dataset.randomTrack,...options});
