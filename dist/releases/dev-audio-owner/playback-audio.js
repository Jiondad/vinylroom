// The media owner lives outside responsive player views and modal dialogs.
// UI visibility never mounts, hides, moves or replaces this element.
const owners = new WeakMap();
export function getPlaybackAudio(doc = document) {
 let audio = owners.get(doc);
 if (audio) return audio;
 // Refuse an ambiguous owner rather than creating a second playback engine.
 if (doc.getElementById('track-player')) throw new Error('Playback audio already exists');
 audio = doc.createElement('audio');
 audio.id = 'track-player';
 audio.preload = 'auto';
 audio.controls = false;
 audio.tabIndex = -1;
 audio.setAttribute('aria-hidden', 'true');
 // Keep a layout box without native controls, occupying no document space.
 // No visibility/display changes are tied to mobile, queue or dialog state.
 audio.style.cssText = 'display:block;position:fixed;width:1px;height:1px;left:0;bottom:0;opacity:0;pointer-events:none;';
 doc.body.append(audio);
 owners.set(doc, audio);
 return audio;
}
