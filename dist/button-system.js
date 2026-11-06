import {installDesignV2} from './design-v2.js';
// DS-1 presentation only. Explicit opt-in registry; no handlers, permissions or DOM structure changes.
export const BUTTON_GROUPS=[
 ['album','.album-primary-actions button,.album-cover-tools button,.album-full-page #edit-index,.album-full-page #album-page-back'],
 ['library','main .toolbar button,.pagination button,.category-filter button,.search-actions button,.random-actions button,.top100-actions button,main .artist-index button'],
 ['admin','.vr-admin-actions button,.vr-admin-toolbar button,.vr-admin-section-head button,.vinyl-members-actions button,.vinyl-members-toolbar button,.proposal-tools button,.proposal-pager button,.selection-actions button,.field-selection-actions button,.proposal-actions button,[data-final-summary] button,#vinyl-admin-member-form button'],
 ['dialog','.modal-head .close,.album-share-head button,.album-share-buttons button,.vinyl-lyrics-header button,.vinyl-members-header button,#personal-dialog .actions button,#personal-dialog .playlist-form-actions button,#dialog .form-actions button,#dialog .actions button,#member-form button,#vinyl-signup-form button,#name-form button,#add-list-form button,#vinyl-password-change button'],
 ['account','#vinyl-check-approval,#vinyl-change-password,#member-logout,#vinyl-manage-members,#member-signup,#signup-back,#password-change-back,#signup-done,#add-list-cancel,#create-list,#playlist-login,#import-local-lists,#play-list,#rename-list,#delete-list,#delete-list-confirm'],
 ['artist','.artist-admin button,.artist-editor button,.related-heading>button']
];
const skip='.album-open,.album-card,.artist-card,.artist-name,.random-song-card,.catalog-link,.related-artist,[data-proposal],[data-list],[data-list-play],[data-image],[data-track-action],[data-mobile-track-play],[data-mobile-track-action],[data-search-play],[data-top100-action],#nav button,.sidebar button,#vinyl-header-actions button';
const primary='[data-album-action="play"],#random-play,[data-top100-all="play"],button.primary,button[type="submit"],[data-confirm-selection],[data-selection-confirm],[data-finalize],[data-selection-save]';
const danger='.danger,[data-delete],#delete-list,#delete-list-confirm,#confirm-hide,#hide-index,[data-reject]';
const tertiary='#album-page-back,#close-personal,[data-close],#add-list-cancel,#signup-back,#password-change-back,[data-cancel],[data-prev],[data-next],.pagination button';
const icon='[data-album-share],.modal-head .close,#close-personal,.vinyl-members-header .close,.album-share-head button[aria-label],.vinyl-lyrics-header button[aria-label]';
// DS-1 rollout exclusion: transport and queue descendants never acquire DS classes or group spacing.
const excludedRegion='#global-player,#queue-panel,.mobile-player,.mobile-mini-player,.mobile-player-sheet,.expanded-player,.mobile-queue,.ui6-player,.ui6-queue';
export function buttonDescriptor(button,context){if(button.closest(excludedRegion)||button.matches(skip))return null;const declared=button.getAttribute('data-vr-role');const role=['primary','secondary','tertiary','icon','danger'].includes(declared)?declared:button.matches(danger)?'danger':button.matches(icon)?'icon':button.matches(primary)?'primary':button.matches(tertiary)?'tertiary':'secondary';const density=['default','compact'].includes(button.getAttribute('data-vr-density'))?button.getAttribute('data-vr-density'):button.closest('.pagination,.artist-index,.category-filter,.proposal-pager,.vr-admin-toolbar')?'compact':'default';return {role,density,context};}
export function installButtonSystem(doc=document){return installDesignV2(doc,{groups:BUTTON_GROUPS,describe:buttonDescriptor});}
