'use strict';
let D;
const requestedSlide=Number(new URLSearchParams(location.search).get('from'));
const slide=Number.isInteger(requestedSlide)&&requestedSlide>=1&&requestedSlide<=12?requestedSlide:12;
const returnLink=document.getElementById('deck-return');
returnLink.href='index.html#slide='+slide;
returnLink.textContent='返回演示 · 第 '+slide+' 页';
function loadScript(src){
    return new Promise((resolve,reject)=>{
        const el=document.createElement('script');
        el.src=src;el.onload=resolve;el.onerror=reject;document.body.appendChild(el);
    });
}
(async()=>{
    try{
        const response=await fetch('data/atlas.json');
        if(!response.ok)throw Error('数据加载失败');
        D=await response.json();
        await loadScript('reader.js');
        await loadScript('instances.js');
    }catch{
        document.getElementById('view').innerHTML='<h1>未能加载明细</h1><p>请检查网络连接，然后刷新本页。</p><button onclick="location.reload()">重新加载</button>';
    }
})();
