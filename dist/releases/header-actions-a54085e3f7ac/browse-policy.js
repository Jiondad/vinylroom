// Account presence only; never carries credentials or changes approval decisions.
let authenticated=null;
export const isGuestAccount=()=>authenticated===false;
export const setAccountPresence=value=>{authenticated=value===true;};
