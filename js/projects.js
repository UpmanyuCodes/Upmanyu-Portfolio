// Quick fade between pages
document.querySelectorAll('a[href]').forEach(a=>{
  const h=a.getAttribute('href');
  if(!h||h.startsWith('#')||h.startsWith('http')||h.startsWith('mailto')) return;
  a.addEventListener('click',e=>{
    e.preventDefault();
    document.body.classList.add('leaving');
    setTimeout(()=>location.href=h,250);
  });
});
window.addEventListener('pageshow',()=>document.body.classList.remove('leaving'));