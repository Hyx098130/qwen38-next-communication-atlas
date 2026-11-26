'use strict';
const view=document.getElementById('view'), byOp=Object.fromEntries(D.ops.map(o=>[o.name,o])), phases=D.layers;
const fmt=(v,n=0)=>Number(v).toLocaleString('en-US',{minimumFractionDigits:n,maximumFractionDigits:n}),us=v=>fmt(v/1000,3),ms=v=>fmt(v/1e6,3);
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const size=b=>b>=1048576?(b/1048576)+' MiB':(b/1024)+' KiB';
const group=l=>l===-1?'采集起点':l===0?'输入准备':l===49?'输出与轮间工作':'第 '+l+' 层';
const typ=l=>l===2?'PLE + GDN':l%4===0?'QSA':'GDN';
const lopt=()=>[0,...Array.from({length:48},(_,i)=>i+1),49,-1].map(l=>'<option value="'+l+'">'+group(l)+(l>0&&l<49?' · '+typ(l):'')+'</option>').join('');
const opLink=n=>'<a class="oplink mono" href="#op/'+encodeURIComponent(n)+'">'+esc(n)+'</a>';
const layerLink=l=>'<a href="#layer/'+l+'">'+group(l)+'</a>';
const tab=(head,rows,cls='')=>'<div class="scroll"><table class="'+cls+'"><thead><tr>'+head.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(c=>'<tr>'+c.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const metrics=items=>'<div class="metric">'+items.map(([x,y])=>'<div><b>'+x+'</b><span>'+y+'</span></div>').join('')+'</div>';
const siteName=k=>D.sites[k][3];
const layerIntro=l=> l===-1?'采集刚开始时，前六个设备任务出现在本卡第一个 prefill 段标记之前。保留为独立边界；按正式窗裁剪后，8 卡共有 42 条。':l===0?'运行时准备本轮 token、请求边界、位置编码和缓存写入位置，再从词嵌入得到隐藏状态。这一段有大量本地索引与形状计算。':l===49?'第 48 层结束后，先收齐最终隐藏状态，按请求选出需要算词表分数的行；词表投影后，再把每卡各自的分数拼齐，进入采样和状态更新。样例结尾也保留了下一个 prefill 标记前的维护任务。':l===2?'这是本次唯一带 PLE 的层。先计算 n-gram 编号、查表、施加门控并收齐卷积输入；短卷积写回后，再走与第 1 层相同的 GDN 和专家路径。':l%4===0?'这一层走 QSA 稀疏注意力。索引器先收齐用于选块的键与位置，主注意力随后收齐打包的键和值，再在选中的块上计算。最后进入专家路径。':'这一层走 GDN 递推注意力。先收齐 token 行，按序做卷积和状态递推；本地输出投影完成后，用 AllReduce 得到完整输出。接着路由到专家，并将结果合回隐藏状态。';
function layer(l){
const r=phases.find(x=>x.l===l)||phases[2];l=r.l;
const ps=D.positions.filter(p=>p.l===l), seq=D.example.filter(x=>x[1]===l);
view.innerHTML='<h1>'+group(l)+(l>0&&l<49?' · '+typ(l):'')+'</h1><div class="toolbar"><label>跳到 <select id="ls">'+lopt()+'</select></label>'+(l>0?'<a href="#layer/'+(l-1)+'">← 上一段</a>':'')+(l>=0&&l<49?'<a href="#layer/'+(l+1)+'">下一段 →</a>':'')+'</div>'+
'<div class="map">'+Array.from({length:48},(_,i)=>{let n=i+1;return '<button title="第 '+n+' 层 '+typ(n)+'" class="'+(n===l?'sel':n===2?'p':n%4===0?'q':'')+'" onclick="location.hash=\'layer/'+n+'\'">'+n+'</button>'}).join('')+'</div><div class="sub">白色为 GDN，浅紫为 QSA，浅黄为含 PLE 的第 2 层。正文从第 1 层起数'+(l>=1&&l<=48?'，当前对应源码 layers.'+(l-1):'')+'。</div>'+
'<p class="lede">'+layerIntro(l)+'</p>'+metrics([[String(ps.length),'代表性完整段中的显式通信笔数'],[fmt(r.co),'全窗八卡在此位置的通信端记录'],[ms(r.ct)+' ms','全窗本段暴露卡毫秒，跨卡相加'],[fmt(r.mega),'全窗本段 MegaMoe 卡侧实例']])+
(ps.length?'<h2>每一笔通信的来龙去脉</h2>'+ps.map(p=>{let s=D.sites[p.key];return '<article class="callout" style="margin:10px 0"><span class="legend tag">第 '+p.pos+' / 111 笔　'+s[0]+'</span><h3>'+s[3]+'</h3><p>'+s[5]+'</p><p class="sub">本卡输入 '+s[4]+' · '+(s[1]==='BFP16'?'BF16':s[1])+' · '+size(s[2])+'。输入大小按元素数换算，网络字节可从通信子任务另查。</p><p>'+opLink(p.prev)+' → <b>'+s[0]+'</b> → '+opLink(p.next)+'</p><p>样例 opId '+p.oid+'：rank 0 用 '+us(p.a)+' μs，rank 1 用 '+us(p.b)+' μs；两端计算重叠均为 0。<a href="#case/0/'+p.oid+'">查看两端的等待和搬运</a></p></article>'}).join(''):'<div class="callout">这段的设备轨迹中没有显式 HCCL 调用。</div>')+
(l>=1&&l<=48?'<h3>本层专家计算</h3><p>'+opLink('MoeGatingTopK')+' 选专家 → '+opLink('MegaMoe')+' 融合分发、专家运算与回收 → 后续分支计算与残差合并。该层 MegaMoe 窗内累计 '+ms(r.mt)+' 卡毫秒，内部重叠率未知。</p>':'')+
'<h2>本段设备执行顺序</h2><p class="sub">rank 0 · prefill 段 2。按设备开始时间排列，保留重复调用。计算项可点进词典。样例共 '+seq.length+' 项；全窗统计见上方。</p>'+
(seq.length?tab(['序','阶段','设备项','用时 μs','定位 ID'],seq.map(x=>[String(D.example.indexOf(x)+1),x[2],x[4]==='HCCL'?'<a class="legend tag" href="#case/0/'+x[5]+'">'+x[3]+'</a>':opLink(x[3]),us(x[6]),x[4]==='HCCL'?String(x[5]):'<a href="#kernel/0/2/'+x[5]+'">'+x[5]+'</a>']),'seq'):'<p>边界位于第一个分段标记之前，样例段 2 没有这一段。<a href="#kernels/0/0">查看采集起点的设备实例</a>。</p>');
document.getElementById('ls').value=l;document.getElementById('ls').onchange=e=>location.hash='layer/'+e.target.value;
}
function compact(xs){let out=[],s=xs[0],last=s;function flush(){if(s!==undefined)out.push(s===last?group(s):group(s)+'–'+group(last))}for(let x of xs.slice(1)){if(x===last+1&&s>0&&x<49)last=x;else{flush();s=last=x}}flush();return out.join('、')}
function ops(){
view.innerHTML='<h1>88 种设备算子</h1><p class="lede">按真实前向中首次出现的顺序查找。选中一种算子，可以看到它做什么、出现在哪些层，以及有多少次紧挨着通信。</p><div class="toolbar"><input id="search" aria-label="查找算子" placeholder="搜名称或中文作用"><label>出现在 <select id="ol"><option value="">全部模型段</option>'+lopt()+'</select></label></div><div id="results"></div>';
const show=()=>{let t=document.getElementById('search').value.toLowerCase(),l=document.getElementById('ol').value,arr=D.ops.filter(o=>(o.name+o.desc).toLowerCase().includes(t)&&(l===''||o.layers.includes(+l)));document.getElementById('results').innerHTML='<p class="sub">找到 '+arr.length+' 种</p>'+tab(['算子','中文作用','全窗实例','紧邻通信前 / 后'],arr.map(o=>[opLink(o.name),o.desc,fmt(o.n),fmt(o.before)+' / '+fmt(o.after)]))};document.getElementById('search').oninput=show;document.getElementById('ol').onchange=show;show()}
function op(n){let o=byOp[n];if(!o)return ops();let rel=D.positions.filter(p=>p.prev===n||p.next===n);
view.innerHTML='<h1 class="mono">'+esc(n)+'</h1><p class="lede">'+o.desc+'</p>'+metrics([[fmt(o.n),'全窗八卡的实例数'],[ms(o.t)+' ms','累计窗内卡毫秒'],['0 ns','与同卡显式 HCCL 交集']])+'<h2>在哪一步出现</h2><p>'+o.phases.join('、')+'。</p><p class="sub">'+compact(o.layers)+'</p><div class="toolbar">'+o.layers.map(layerLink).join('　')+'</div><h2>它与哪笔通信相邻</h2><p>在 '+fmt(o.before)+' 条卡侧记录里，它是通信前最后一个核；在 '+fmt(o.after)+' 条里，它是通信后第一个核。相邻用于定位执行顺序。显式集合通信与它是两条设备记录。</p>'+
(n==='MegaMoe'?'<div class="callout"><b>专家分发和回收在融合算子内部。</b> 目前只能测量整个核，以及它与外部 HCCL 的交集。每一层的内部传输次数和重叠率都留为未知。</div>':'')+
(rel.length?tab(['模型段','通信序','传输对象','它的位置'],rel.map(p=>[layerLink(p.l),p.pos,siteName(p.key),p.prev===n?'通信之前':'通信之后'])):'<p class="sub">111 个显式通信位置中，没有以这个核作为最近前序或后序的位置。</p>')+'<p><a href="#kernels/0/2/'+encodeURIComponent(n)+'">查看此算子的设备实例</a>　·　<a href="#ops">回到全部算子</a></p>'}


const evAt=(dp,oid)=>D.events[dp][oid];
const positionOf=e=>D.positions[e[0]-1];
const caseLink=(r,oid)=>'<a href="#case/'+r+'/'+oid+'">DP '+Math.floor(r/2)+' · opId '+oid+'</a>';
function events(){
view.innerHTML='<h1>同一笔通信，两张卡各看见什么？</h1><p class="lede">每行是一笔已配对的集合通信。默认显示正式 20 秒，可以按层、DP 组、opId 或毫秒级长尾筛选。时间均为设备实测。</p><div class="toolbar"><select id="el" aria-label="模型段"><option value="">所有层与输出端</option>'+lopt()+'</select><select id="dp" aria-label="DP组"><option value="">全部 DP 组</option>'+[0,1,2,3].map(x=>'<option>'+x+'</option>').join('')+'</select><input id="oid" type="number" min="0" aria-label="opId" placeholder="opId" style="width:110px"><label><input id="only" type="checkbox" checked> 正式窗</label><label><input id="tail" type="checkbox"> 任一端 ≥ 1 ms</label></div><div id="matches"></div>';
let page=0;
function draw(){let rows=[],lv=document.getElementById('el').value,dp=document.getElementById('dp').value,oid=document.getElementById('oid').value,only=document.getElementById('only').checked,tail=document.getElementById('tail').checked;
 D.events.forEach((rs,i)=>{if(dp!==''&&+dp!==i)return;rs.forEach((e,j)=>{let p=positionOf(e);if((lv!==''&&p.l!==+lv)||(oid!==''&&j!==+oid)||(only&&!e[1])||(tail&&Math.max(e[3],e[8])<1e6))return;rows.push([i,j,e,p])})});
 let count=rows.length,hi=Math.max(1,Math.ceil(count/25));page=Math.min(page,hi-1);
 document.getElementById('matches').innerHTML='<div class="pagination"><button id="back">上一页</button><button id="next">下一页</button><span>'+fmt(count)+' 笔　·　第 '+(page+1)+' / '+hi+' 页　·　每页 25 笔</span></div>'+tab(['配对记录','prefill 段 / 笔','模型段','通信对象','A 端 μs','B 端 μs'],rows.slice(page*25,page*25+25).map(([i,j,e,p])=>[caseLink(i*2,j),Math.floor(j/111)+1+' / '+p.pos,layerLink(p.l),siteName(p.key),us(e[3]),us(e[8])]));
 let b=document.getElementById('back'),n=document.getElementById('next');b.disabled=page===0;n.disabled=page+1>=hi;b.onclick=()=>{page--;draw()};n.onclick=()=>{page++;draw()};}
 for(let id of ['el','dp','oid','only','tail'])document.getElementById(id).oninput=()=>{page=0;draw()};draw()}
function detail(rank,oid){
if(!Number.isInteger(rank)||rank<0||rank>7||!Number.isInteger(oid)||oid<0||oid>=D.events[rank>>1].length)return events();
let dp=rank>>1,e=evAt(dp,oid),p=positionOf(e),s=D.sites[p.key];
let a=dp*2,b=a+1;
view.innerHTML='<h1>'+s[0]+' · opId '+oid+'</h1><p class="lede">'+group(p.l)+'，'+s[3]+'。'+s[5]+'</p><p class="sub">DP '+dp+' · prefill 段 '+(Math.floor(oid/111)+1)+' · 第 '+p.pos+' / 111 笔 · '+(e[1]?'正式窗口内':'正式窗口外')+' · 单端输入 '+size(s[2])+'</p>'+
tab(['卡侧','窗内相对起点 ms','通信 μs','计算重叠 μs','计算流等待交集 μs','对端通知等待 μs','对端搬运 μs'],[[a,ms(e[2]),us(e[3]),'0',us(e[4]),us(e[5]),us(e[6])],[b,ms(e[7]),us(e[8]),'0',us(e[9]),us(e[10]),us(e[11])]])+
'<p><b>两端相差 '+us(Math.abs(e[7]-e[2]))+' μs 进入本次通信。</b> 前一项计算是 '+opLink(p.prev)+'，通信后第一项是 '+opLink(p.next)+'。</p>'+
'<p>计算流等待描述模型核为何没有继续执行。对端通知等待和对端搬运描述通信流当时在做什么。两条流可同时等待，把三个时长相加会重复计时。</p>'+
((dp===1&&oid===3904)?'<div class="callout"><b>唯一例外在 rank 2。</b> 通信持续 111.343 μs。计算流上的零时长等待在通信开始后 293.13 μs 才执行；下一项行重排在通信结束后 206.244 μs 才开始。时间线确认中间无计算，空隙的更上游原因仍待确认。</div>':'<div class="callout">本次两端的通信期间均观测到模型计算流等待事件，同时没有模型 kernel 在本卡执行。</div>')+
((dp===1&&oid===1665)?'<h2>为什么其中一张卡记录了 8 ms</h2><img src="assets/allgather.png" alt="rank 3 比 rank 2 提早约 8 毫秒进入同一次通信，主要时间在等待"><p>rank 3 早到约 7.993 ms，等对端通知花了 8.028 ms，实际对端搬运约 67 μs。两端结束时刻接近。这个例子把“等另一张卡”和“链路在搬数据”区分开来。</p>':'')+
'<p>'+layerLink(p.l)+'　·　<a href="#events">浏览所有双卡记录</a></p>'}
function method(){view.innerHTML='<h1>每个层号是怎么对出来的</h1><p class="lede">设备记录提供了开始、结束、任务名和所在卡。层号需要从顺序还原，数据用途还要结合张量形状及参考实现。</p>'+
tab(['依据','能回答的问题','核对方式'],[
['设备直接记录','什么时间、哪张卡、哪一笔通信、多少元素？','同卡 HCCL 与 COMPUTE_TASK_INFO 对应的模型 kernel 按纳秒求交；软件等待、通信调度及容器记录分别处理。'],
['还原层号','这笔通信属于 48 层中的哪一层？','每张卡以 _prepare_prefill_inputs_kernel 分段。每段恰好出现 48 个 MegaMoe。独立检查每层 CausalConv1d / LightningIndexerV2、两次 TextGatedResidual、路由 TopK 和层末核序列。'],
['交叉核对','层边界及两端是否一致？','完整采集 8 × 39 个卡侧前向段逐个核对。每段 111 笔，每笔的前后核归属同一段同一层；两端的 HCCL 名、类型、元素数与位置一致。第 109 笔属于第 48 层，第 110、111 笔属于输出端。'],
['语义解释','AllGather 到底传什么？','对照 count × 类型字节数、前后核形状和代码调用。展示层号 L1–L48 对应源码 0–47；残差边界按每层专家输出后第一个 _combine_final_kernel 划分，相邻层共享的交界操作按此约定展示。'],
['融合内部','每层专家分发、计算及回收各重叠多少？','本次没有可按同一调用配对的阶段时间戳。14,392 个窗内 MegaMoe 实例的外部重叠均为零，内部比例未知。']])+
'<h2>窗口与单位</h2><p>每卡完整采集有 39 段，正式分析使用同期回执给出的共同 20 秒。全采集 17,316 笔双卡通信、899,584 个模型核；正式窗 16,648 笔、866,522 个核。窗口末端只覆盖部分前向，故不同层的窗内次数可不同。窗内实例以有正时长交集为准。</p><p>显式通信暴露量是 HCCL 区间减去与本卡计算的交集。8 卡 × 20 秒共 160 卡秒；3.897 卡秒暴露占 2.44%。这项比例不能直接换算成吞吐提升。MiB 为 1,048,576 字节，BF16 每元素 2 字节，INT64 每元素 8 字节。不同 rank 的绝对时间依照各自的窗口回执对齐。</p>'+
'<h2>从哪里继续查</h2><p><a href="#case/3/1665">最长 AllGather</a>落在第 1 层的第一笔。83 条达到 1 ms 的端记录中，80 条在所在 prefill 段的首笔；全部 83 条均早于对端进入，带对端标记的等待均过半。进一步定位可沿晚到卡向前查输入准备与主机提交。</p>'+
'<p>在<a href="#layer/1">执行路线</a>查看代表段的全部重复计算与通信，在<a href="#kernels/0/2">设备实例</a>按卡、前向段与算子查看原始任务编号和计时。</p>';}
