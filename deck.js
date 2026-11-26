'use strict';
const slides=Array.from(document.querySelectorAll('.slide'));
const prev=document.getElementById('prev'),next=document.getElementById('next'),toc=document.getElementById('toc');
let current=1;
function gotoPage(n){if(n>=1&&n<=slides.length)location.hash='slide='+n}
function render(){
    const m=/^#slide=(\d+)$/.exec(location.hash);
    current=m?Math.max(1,Math.min(slides.length,Number(m[1]))):1;
    const active=slides[current-1];
    slides.forEach((slide,i)=>{slide.hidden=i+1!==current});
    prev.disabled=current===1;next.disabled=current===slides.length;
    document.getElementById('page').textContent=current+' / '+slides.length;
    document.getElementById('caption').textContent=active.dataset.stage;
    document.getElementById('progress').style.width=(100*current/slides.length)+'%';
    document.querySelectorAll('[data-stage-link]').forEach(el=>{
        if(el.dataset.stageLink===active.dataset.stage)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');
    });
    document.title=active.dataset.title+' · Qwen3.8-Next';
    if(toc.open)toc.close();
    window.scrollTo(0,0);
}
window.addEventListener('hashchange',()=>{render();slides[current-1].querySelector('h1,h2').focus({preventScroll:true})});
prev.onclick=()=>gotoPage(current-1);next.onclick=()=>gotoPage(current+1);
document.querySelectorAll('.toc-toggle').forEach(el=>el.onclick=()=>{if(!toc.open)toc.showModal()});
document.getElementById('close-toc').onclick=()=>toc.close();
toc.addEventListener('click',e=>{if(e.target===toc||e.target.closest('a'))toc.close()});
document.addEventListener('keydown',e=>{
    if(e.altKey||e.metaKey||e.ctrlKey||e.shiftKey||toc.open||e.target.closest('input,select,textarea,[contenteditable=true]'))return;
    if(e.key===' '&&e.target.closest('a,button'))return;
    const keys={ArrowRight:current+1,PageDown:current+1,' ':current+1,ArrowLeft:current-1,PageUp:current-1,Home:1,End:slides.length};
    if(Object.hasOwn(keys,e.key)){e.preventDefault();gotoPage(keys[e.key])}
});
let start=null;
document.addEventListener('touchstart',e=>{start=e.touches.length===1?[e.touches[0].clientX,e.touches[0].clientY]:null},{passive:true});
document.addEventListener('touchend',e=>{
    if(!start||toc.open||e.target.closest('input,select,button,.tablescroll'))return;
    const dx=e.changedTouches[0].clientX-start[0],dy=e.changedTouches[0].clientY-start[1];start=null;
    if(Math.abs(dx)>65&&Math.abs(dx)>1.8*Math.abs(dy))gotoPage(current+(dx<0?1:-1));
},{passive:true});
const fs=document.getElementById('fullscreen');fs.hidden=!document.fullscreenEnabled;
fs.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{fs.hidden=true}};
document.addEventListener('fullscreenchange',()=>{fs.textContent=document.fullscreenElement?'退出全屏':'全屏'});
render();
