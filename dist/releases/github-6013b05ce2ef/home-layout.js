// Move existing controls, preserving listeners, selected filters and node identity.
export function arrangeHomeSummary(home,count,toolbar,results){
 if(!count||!toolbar||!results)return;
 const target=home?toolbar:results;
 if(count.parentNode!==target)target.prepend(count);
 toolbar.classList.toggle('home-summary',home);
}
