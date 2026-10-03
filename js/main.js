// ── CURSOR ──
const dot = document.querySelector('#mag-cursor .dot');
const ring = document.querySelector('#mag-cursor .ring');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;dot.style.left=mx+'px';dot.style.top=my+'px'});
(function tick(){rx+=(mx-rx)*.1;ry+=(my-ry)*.1;ring.style.left=rx+'px';ring.style.top=ry+'px';requestAnimationFrame(tick)})();
document.querySelectorAll('a,button').forEach(el=>{
  el.addEventListener('mouseenter',()=>document.body.classList.add('hovering'));
  el.addEventListener('mouseleave',()=>document.body.classList.remove('hovering'));
});

const nav = document.querySelector('nav');
const navToggle = document.querySelector('.nav-toggle');
navToggle?.addEventListener('click',()=>{
  const isOpen = nav.classList.toggle('menu-open');
  navToggle.setAttribute('aria-expanded',String(isOpen));
  navToggle.querySelector('.sr-only').textContent = isOpen ? 'Close menu' : 'Open menu';
});
document.querySelectorAll('.nav-links a').forEach(link=>link.addEventListener('click',()=>{
  nav?.classList.remove('menu-open');
  navToggle?.setAttribute('aria-expanded','false');
}));

// ── SCROLL REVEAL ──
const io = new IntersectionObserver(entries=>{
  entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('on') });
},{threshold:.1});
document.querySelectorAll('.sr,.sr-l,.sr-r').forEach(el=>io.observe(el));

// ── TEXT SCRAMBLE on hero ──
const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
function scramble(el, finalText, duration=1200){
  let start=null;
  const len=finalText.length;
  function frame(ts){
    if(!start) start=ts;
    const progress=Math.min((ts-start)/duration,1);
    let out='';
    for(let i=0;i<len;i++){
      if(i<Math.floor(progress*len)){
        out+=finalText[i];
      } else {
        out+=chars[Math.floor(Math.random()*chars.length)];
      }
    }
    el.textContent=out;
    if(progress<1) requestAnimationFrame(frame);
    else el.textContent=finalText;
  }
  requestAnimationFrame(frame);
}
window.addEventListener('load',()=>{
  const heroNames=document.querySelectorAll('.hero-name');
  heroNames.forEach((el,i)=>{
    const orig=el.textContent;
    setTimeout(()=>scramble(el,orig,900),300+i*150);
  });
});

// ── STAGGER cards on scroll ──
const cardObs = new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      const siblings=Array.from(e.target.parentElement.children);
      const idx=siblings.indexOf(e.target);
      e.target.style.transitionDelay=(idx*0.07)+'s';
      e.target.classList.add('on');
    }
  });
},{threshold:.08});
document.querySelectorAll('.pj,.step,.merch-item').forEach(el=>{
  el.classList.add('sr');
  cardObs.observe(el);
});

// ── MARQUEE pause on hover ──
document.querySelectorAll('.marquee-track').forEach(t=>{
  t.parentElement.addEventListener('mouseenter',()=>t.style.animationPlayState='paused');
  t.parentElement.addEventListener('mouseleave',()=>t.style.animationPlayState='running');
});

// ── PARALLAX hero bg word ──
const bgWord=document.querySelector('.hero-bg-word');
document.addEventListener('scroll',()=>{
  const y=window.scrollY;
  if(bgWord) bgWord.style.transform=`translate(-50%,calc(-50% + ${y*0.25}px))`;
});