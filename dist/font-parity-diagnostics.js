/* Paste into DevTools Console of actual Sites renderer, AFTER fonts are loaded.
 * Read only. No cookies, session tokens or network, no DOM modifications.
 * Use the SAME code on demo and deployed Sites. */
(() => {
  const root = document.body;
  const sel = {
    page: '#page-title', albumTitle: '.album-full-page.ui6-album .ui6-album-info h2',
    albumMetaLabel: '.album-full-page.ui6-album .album-facts dt',
    albumMetaValue: '.album-full-page.ui6-album .album-facts dd',
    trackNumber: '.album-full-page.ui6-album .ui6-track-table td:first-child',
    trackTitle: '.album-full-page.ui6-album .mobile-track-title-play, .album-full-page.ui6-album .desktop-track-title',
    trackMeta: '.album-full-page.ui6-album .mobile-track-meta',
    sidebar: '.sidebar nav button', player: '#global-player .player-info strong',
    albumCard: '.album h3', artist: '.artist-name',
    top100: '.top100-track strong', dialog: 'dialog button'
  };
  const rows = Object.entries(sel).map(([name,query])=>{
    const node=document.querySelector(query);
    if(!node)return {name, status:'NOT_FOUND'};
    const s=getComputedStyle(node);
    return {name,status:'FOUND',text:(node.textContent||'').trim().slice(0,32),fontFamily:s.fontFamily,
      fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,
      letterSpacing:s.letterSpacing,fontSynthesis:s.fontSynthesis};
  });
  const faces=[...document.fonts].filter(f=>/Noto Sans KR/i.test(f.family));
  console.table(rows);console.log('FONT_PARITY_ROWS '+JSON.stringify(rows));
  console.log('FONT_PARITY_FACES '+JSON.stringify({fontFaces:faces.map(f=>({family:f.family,weight:f.weight,status:f.status})),
    bodyFont:getComputedStyle(root).fontFamily, bodyWeight:getComputedStyle(root).fontWeight,
    cssVar:getComputedStyle(root).getPropertyValue('--vr-font').trim()}));
  return rows;
})();
