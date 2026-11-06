// Move existing controls, preserving listeners, selected filters and node identity.
export function arrangeHomeSummary(home,count,toolbar,results){
 if(!count||!toolbar||!results)return;
 const target=home?toolbar:results;
 if(count.parentNode!==target)target.prepend(count);
 toolbar.classList.toggle('home-summary',home);
}

// Reserve the same player height even before playback, so starting a track never resizes cards.
export function todayCoverSize({viewportHeight,gridTop,columnWidth,rowMetadata,rowGap,playerHeight=88,bottomGap=8}){
 if(!rowMetadata.length||columnWidth<=0)return null;
 const budget=viewportHeight-gridTop-playerHeight-bottomGap-rowMetadata.reduce((a,b)=>a+b,0)-rowGap*(rowMetadata.length-1);
 return Math.max(32,Math.min(columnWidth,Math.floor(budget/rowMetadata.length)));
}
export function fitTodayCovers(doc=document,win=window){
 if(!doc.body.classList.contains('home-view')||!win.matchMedia('(min-width:1101px)').matches)return;
 const grid=doc.querySelector('main #content .grid');if(!grid)return;
 const cards=[...grid.querySelectorAll('.album')];if(!cards.length)return;
 const columns=win.getComputedStyle(grid).gridTemplateColumns.split(/\s+/).length;
 if(columns!==10)return;
 const rowMetadata=[];let columnWidth=Infinity;
 cards.forEach((card,index)=>{
  const cover=card.querySelector('.cover');if(!cover)return;
  const rect=card.getBoundingClientRect(),coverRect=cover.getBoundingClientRect();
  columnWidth=Math.min(columnWidth,rect.width);
  const row=Math.floor(index/columns);
  rowMetadata[row]=Math.max(rowMetadata[row]||0,rect.height-coverRect.height);
 });
 if(!Number.isFinite(columnWidth)||columnWidth<=0||rowMetadata.length!==3)return;
 const size=todayCoverSize({viewportHeight:doc.documentElement.clientHeight,gridTop:grid.getBoundingClientRect().top+win.scrollY,columnWidth,rowMetadata,rowGap:parseFloat(win.getComputedStyle(grid).rowGap)||0});
 const value=size+'px';if(grid.style.getPropertyValue('--today-cover-size')!==value)grid.style.setProperty('--today-cover-size',value);
}
