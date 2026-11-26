'use strict';
let renderVersion=0;
const chunkCache=new Map();
function routeRank(value,def,max){
    const n=Number(value);return value!==undefined&&Number.isInteger(n)&&n>=0&&n<=max?n:def;
}
async function getChunk(rank,segment){
    const file='data/kernels/r'+rank+'/s'+segment+'.json';
    if(!chunkCache.has(file)){
        const promise=fetch(file).then(r=>{if(!r.ok)throw new Error('设备数据读取失败');return r.json()}).catch(error=>{chunkCache.delete(file);throw error});
        if(chunkCache.size>=6)chunkCache.delete(chunkCache.keys().next().value);
        chunkCache.set(file,promise);
    }
    return chunkCache.get(file);
}
function kernelHref(rank,seg,id){return '#kernel/'+rank+'/'+seg+'/'+id}
function instanceTable(rows,rank,seg){
    return tab(['设备任务编号','模型段','设备算子','窗内时间 μs','执行时间 μs'],rows.map(r=>[
        '<a href="'+kernelHref(rank,seg,r[0])+'">'+r[0]+'</a>',layerLink(r[2]),opLink(D.ops[r[1]].name),us(r[6]),us(r[5])
    ]),'seq');
}
async function instanceList(rank,seg,filter,version){
    view.innerHTML='<h1>逐次计算实例</h1><p>按卡和前向段查看每个实际执行的设备核。选择任务编号，可以查看它的起止时间、所属层和相邻通信。</p><div class="toolbar"><label>卡 <select id="krank"></select></label><label>前向段 <select id="kseg"></select></label><label>算子 <select id="kfilter"></select></label></div><div id="krows" aria-live="polite">正在读取本段…</div>';
    const ranks=document.getElementById('krank'),segs=document.getElementById('kseg'),ops=document.getElementById('kfilter');
    ranks.replaceChildren(...Array.from({length:8},(_,i)=>new Option('rank '+i,i)));
    segs.replaceChildren(...Array.from({length:40},(_,i)=>new Option(i===0?'采集起点':String(i),i)));
    ops.replaceChildren(new Option('全部算子',''),...D.ops.map(o=>new Option(o.name,o.name)));
    ranks.value=rank;segs.value=seg;ops.value=filter;
    function change(){location.hash='kernels/'+ranks.value+'/'+segs.value+(ops.value?'/'+encodeURIComponent(ops.value):'')}
    [ranks,segs,ops].forEach(select=>select.addEventListener('change',change));
    const all=await getChunk(rank,seg);
    if(version!==renderVersion)return;
    const rows=filter?all.filter(r=>D.ops[r[1]].name===filter):all;
    let page=0;
    function draw(){
        const el=document.getElementById('krows'),pages=Math.max(1,Math.ceil(rows.length/30));
        el.innerHTML='<div class="pagination"><button id="kp">上一页</button><button id="kn">下一页</button><span>'+fmt(rows.length)+' 个实例 · 第 '+(page+1)+' / '+pages+' 页</span></div>'+instanceTable(rows.slice(page*30,page*30+30),rank,seg);
        const prev=document.getElementById('kp'),next=document.getElementById('kn');prev.disabled=page===0;next.disabled=page+1>=pages;
        prev.onclick=()=>{page--;draw()};next.onclick=()=>{page++;draw()};
    }draw();
}
async function oneKernel(rank,seg,id,version){
    view.innerHTML='<p>正在读取设备实例…</p>';
    const rows=await getChunk(rank,seg);
    if(version!==renderVersion)return;
    const r=rows.find(k=>k[0]===id);
    if(!r){view.innerHTML='<h1>没有找到该设备任务</h1><a href="#kernels/'+rank+'/'+seg+'">查看这一段的全部实例</a>';return}
    const o=D.ops[r[1]];
    const links=ids=>ids.length?ids.map(n=>caseLink(rank,n)).join('、'):'无紧邻的显式通信';
    view.innerHTML='<h1 class="mono">'+esc(o.name)+'</h1><p>'+o.desc+'</p><p class="sub">rank '+rank+' · 前向段 '+seg+' · 设备 globalTaskId '+id+' · '+layerLink(r[2])+'</p>'+
    metrics([[us(r[5])+' μs','完整执行时间'],[us(r[6])+' μs','正式窗内执行时间'],[r[7]+' ns','外部 HCCL 重叠']])+
    tab(['所属阶段','相对窗口起点 ns','相对窗口终点 ns'],[[D.kernelPhases[r[3]],String(r[4]),String(r[4]+r[5])]])+
    '<h2>前后有什么通信</h2><p>紧邻这个核之前：'+links(r[8])+'。</p><p>紧邻这个核之后：'+links(r[9])+'。</p>'+
    (o.name==='MegaMoe'?'<p>这次调用包含专家分发、计算与回收。现有 trace 没有给出各内部阶段的起止。</p>':'')+
    '<p>'+opLink(o.name)+'　·　<a href="#kernels/'+rank+'/'+seg+'/'+encodeURIComponent(o.name)+'">查看同卡同段的同类实例</a></p>';
}
async function attachNeighbors(rank,oid,version){
    const seg=Math.floor(oid/111)+1,dp=Math.floor(rank/2),ranks=[dp*2,dp*2+1];
    const chunks=await Promise.all(ranks.map(r=>getChunk(r,seg)));
    if(version!==renderVersion)return;
    const rows=ranks.map((r,i)=>{
        const before=chunks[i].find(k=>k[9].includes(oid)),after=chunks[i].find(k=>k[8].includes(oid));
        const link=k=>k?'<a href="'+kernelHref(r,seg,k[0])+'">'+D.ops[k[1]].name+' · '+k[0]+'</a>':'未定位';
        return ['rank '+r,link(before),link(after)];
    });
    view.insertAdjacentHTML('beforeend','<h2>点开两端的实际计算任务</h2>'+tab(['卡','通信前最后一个核','通信后第一个核'],rows));
}
async function render(){
    const version=++renderVersion;
    let parts;
    try{parts=decodeURIComponent(location.hash.slice(1)).split('/')}catch{parts=[]}
    const [s='layer',a,b,c]=parts,section=s||'layer';
    const current=({op:'ops',case:'events',kernel:'kernels'})[section]||section;
    document.querySelectorAll('.side nav a').forEach(el=>el.classList.toggle('on',el.hash.slice(1).split('/')[0]===current));
    try{
        if(section==='ops')ops();
        else if(section==='op')op(Object.hasOwn(byOp,a)?a:'');
        else if(section==='events')events();
        else if(section==='case'&&a!==undefined&&b!==undefined){
            const rank=routeRank(a,-1,7),oid=routeRank(b,-1,4328);
            if(rank<0||oid<0)events();else {detail(rank,oid);await attachNeighbors(rank,oid,version)}
        }else if(section==='method')method();
        else if(section==='kernels')await instanceList(routeRank(a,0,7),routeRank(b,2,39),Object.hasOwn(byOp,c)?c:'',version);
        else if(section==='kernel')await oneKernel(routeRank(a,0,7),routeRank(b,2,39),routeRank(c,-1,1e7),version);
        else layer(a!==undefined&&Number.isInteger(+a)&&+a>=-1&&+a<=49?+a:1);
        if(version===renderVersion){
            document.title=(view.querySelector('h1')?.textContent||'明细')+' · Qwen3.8-Next';
            window.scrollTo(0,0);
        }
    }catch{
        if(version===renderVersion)view.innerHTML='<h1>未能读取这段记录</h1><p>请检查网络后刷新，或<a href="#events">返回通信索引</a>。</p>';
    }
}
window.addEventListener('hashchange',render);
render();
