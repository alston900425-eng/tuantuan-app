// 賺多少頁的圖：自己畫 SVG，不另外下載圖表程式（電腦版、手機網頁版離線都能用）。
// 規格照美術稿「賺多少｜圖表規格 v1」（2026-10-13，見 docs/ART-BRIEF.md「6. 圖表」）：
// 顏色在 style.css 的 --chart-*，三種風格共用；字一律用 --ink／--muted，顏色只放在線、點、色塊上；
// 賺／虧一定同時有符號（▲▼）和文字，不只靠顏色。
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r=n=>Math.round(n*10)/10;
export const MINUS='−';
// 金額：千分位，負號用「−」（不是連字號）
export const fmt=value=>(Math.round(value)<0?MINUS:'')+Math.abs(Math.round(value)).toLocaleString('en-US');
// 百分比：小數一位，例如 26.5%、−11.7%
export const pct1=m=>{if(m===null||m===undefined)return '—';const v=Math.round(m*1000)/10;return (v<0?MINUS:'')+Math.abs(v).toFixed(1)+'%';};
// 軸上的字：5千、1萬、1.5萬
export function axisLabel(value){
  if(!value)return '0';
  const a=Math.abs(value),sign=value<0?MINUS:'';
  return sign+(a>=10000?Math.round(a/1000)/10+'萬':a>=1000?Math.round(a/100)/10+'千':String(a));
}
// Y 軸刻度：間距取 1／2／5×10ⁿ，最多 5 格（4–6 個刻度）；一定包含 0
export function niceScale(values){
  let lo=Math.min(0,...values),hi=Math.max(0,...values);
  if(hi===lo)hi=lo+1000;
  let step=1;
  for(let p=1;p<1e12;p*=10){const s=[1,2,5].map(m=>m*p).find(s=>Math.ceil(hi/s)-Math.floor(lo/s)<=5);if(s){step=s;break;}}
  lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step;
  const ticks=[];for(let v=lo;v<=hi+step/2;v+=step)ticks.push(Math.round(v));
  return {lo,hi,step,ticks};
}
// 收入、成本、利潤三條線（形狀也不同：圓點、菱形、方塊）
export const lineSeries=[['revenue','收入','rev'],['cost','成本','cost'],['profit','利潤','profit']];
// 圖例用的小圖：線＋點，跟圖上一樣；hollow＝虧錢時利潤方塊空心
export function legendKey(cls,hollow=false){
  const line=cls==='cost'?'<line x1="1" y1="6" x2="23" y2="6" stroke-dasharray="5 3"/>':'<line x1="1" y1="6" x2="23" y2="6"/>';
  const mark=cls==='rev'?'<circle cx="12" cy="6" r="4"/>':cls==='cost'?'<polygon points="12,1 17,6 12,11 7,6"/>':'<rect x="8" y="2" width="8" height="8" rx="1"/>';
  return `<svg class="lkey ${cls}${hollow?' hollow':''}" width="24" height="12" viewBox="0 0 24 12" aria-hidden="true">${line}${mark}</svg>`;
}
const shortDate=d=>d?Number(d.slice(5,7))+'/'+Number(d.slice(8,10)):'';
const size=mobile=>mobile?{H:260,plotH:200,T:20,axisW:44}:{H:320,plotH:248,T:20,axisW:52};
// 點：每個點外圈 2px 白邊；選取中放大 1.25 倍；利潤虧錢時方塊空心
function marks(cx,p,y,big){
  const k=big?1.25:1,ry=r(y(p.revenue)),cy=r(y(p.cost)),py=r(y(p.profit)),d=6*k,s=4.5*k;
  return `<circle cx="${cx}" cy="${ry}" r="${r(4.5*k)}" class="dot rev"/>`+
    `<polygon points="${cx},${r(cy-d)} ${r(cx+d)},${cy} ${cx},${r(cy+d)} ${r(cx-d)},${cy}" class="dot cost"/>`+
    `<rect x="${r(cx-s)}" y="${r(py-s)}" width="${r(s*2)}" height="${r(s*2)}" rx="1" class="dot profit${p.profit<0?' hollow':''}"/>`;
}
const hatch=(id,cls)=>`<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="${cls}"/></pattern>`;
// 左邊固定的 Y 軸（圖左右捲時不跟著捲）
function axisSvg(ticks,y,{H,axisW}){
  return `<svg class="trend-axis" width="${axisW}" height="${H}" viewBox="0 0 ${axisW} ${H}" aria-hidden="true">${ticks.map(v=>`<text x="${axisW-8}" y="${r(y(v))+4}" text-anchor="end" class="tick${v?'':' zero'}">${axisLabel(v)}</text>`).join('')}</svg>`;
}
function gridLines(ticks,y,w){
  return ticks.map(v=>`<line x1="0" x2="${w}" y1="${r(y(v))}" y2="${r(y(v))}" class="${v?'grid':'zero'}"/>`).join('');
}
// 0 以下的「虧錢區」：淡紅底＋斜線
function lossZone(lo,y,w,bottom){
  if(lo>=0)return '';
  const top=r(y(0)),h=r(bottom-top);
  return `<rect x="0" y="${top}" width="${w}" height="${h}" class="loss-zone"/><rect x="0" y="${top}" width="${w}" height="${h}" fill="url(#loss-hatch)"/>${h>=20?`<text x="6" y="${r(bottom-6)}" class="zone-label">虧錢區</text>`:''}`;
}
// 每一團賺多少（2 團以上）：points＝[{label, date, revenue, cost, profit}]，照開團日期排。
// 每團一格、至少 84px（手機 56px），放不下就左右捲；selected＝選取中的那團（null＝沒選）。
export function trendChart(points,{width,mobile=false,selected=null,label='每一團賺多少'}={}){
  const {H,plotH,T,axisW}=size(mobile),n=points.length,bottom=T+plotH;
  const col=Math.max(mobile?56:84,(Math.max(width,0)-axisW)/Math.max(n,1)),w=Math.round(col*n),scrolls=w>Math.max(width,0)-axisW+1;
  const {lo,hi,ticks}=niceScale(points.flatMap(p=>[p.revenue,p.cost,p.profit]));
  const y=v=>T+(hi-v)*plotH/(hi-lo),x=i=>r(col*i+col/2);
  let svg=`<svg class="trend-plot" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" role="img" aria-label="${escape(label)}"><defs>${hatch('loss-hatch','hatch-loss')}</defs>`;
  svg+=lossZone(lo,y,w,bottom)+gridLines(ticks,y,w);
  if(selected!==null&&selected>=0&&selected<n)svg+=`<rect x="${r(col*selected+4)}" y="${T-12}" width="${r(col-8)}" height="${H-T+10}" rx="10" class="sel"/>`;
  const path=key=>points.map((p,i)=>(i?'L':'M')+x(i)+' '+r(y(p[key]))).join(' ');
  if(n>1)for(const [key,,cls] of lineSeries)svg+=`<path d="${path(key)}" class="line ${cls}"/>`;
  points.forEach((p,i)=>{
    svg+=marks(x(i),p,y,i===selected);
    if(p.profit<0)svg+=`<text x="${x(i)}" y="${r(Math.min(y(p.profit)+22,bottom-4))}" text-anchor="middle" class="loss-label">▼ 虧 ${Math.abs(Math.round(p.profit)).toLocaleString('en-US')}</text>`;
  });
  // 橫軸：電腦版寫團名（最多兩行）＋日期，手機版只寫日期（沒填日期就寫團名前幾個字）
  const chars=Math.max(3,Math.floor((col-8)/12.5));
  points.forEach((p,i)=>{
    const on=i===selected?' on':'';
    if(mobile){svg+=`<text x="${x(i)}" y="${bottom+20}" text-anchor="middle" class="tick${on}">${escape(shortDate(p.date)||(p.label.length>3?p.label.slice(0,3)+'…':p.label))}</text>`;return;}
    const first=p.label.slice(0,chars),rest=p.label.slice(chars),second=rest.length>chars?rest.slice(0,chars-1)+'…':rest;
    const lines=[first,second].filter(Boolean);
    lines.forEach((t,k)=>{svg+=`<text x="${x(i)}" y="${bottom+18+k*15}" text-anchor="middle" class="tick name${on}">${escape(t)}</text>`;});
    if(p.date)svg+=`<text x="${x(i)}" y="${bottom+18+lines.length*15}" text-anchor="middle" class="tick">${shortDate(p.date)}</text>`;
  });
  // 點那團整欄任何地方都算點到
  points.forEach((p,i)=>{svg+=`<rect x="${r(col*i)}" y="0" width="${r(col)}" height="${H}" class="hit" data-point="${i}"><title>${escape(p.label)}</title></rect>`;});
  svg+='</svg>';
  return `<div class="trend${scrolls?' scrolls':''}">${axisSvg(ticks,y,{H,axisW})}<div class="trend-scroll">${svg}</div><span class="trend-fade left" style="--axis-w:${axisW}px" aria-hidden="true"></span><span class="trend-fade" aria-hidden="true"></span></div>`;
}
// 只有 1 團：改畫三根直條（收入／成本／利潤）。寬 96px（手機 64），上方圓角 6，數字寫在長條上方；負的往 0 線下長，空心＋斜線
export function barsChart(p,{width,mobile=false}={}){
  const {H,plotH,T,axisW}=size(mobile),bottom=T+plotH,bw=mobile?64:96,w=Math.max(Math.round(width)-axisW,bw*3+24);
  const {lo,hi,ticks}=niceScale([p.revenue,p.cost,p.profit]);
  const y=v=>T+(hi-v)*plotH/(hi-lo),zero=y(0),slot=w/3;
  let svg=`<svg class="trend-plot" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" role="img" aria-label="收入 ${fmt(p.revenue)}、成本 ${fmt(p.cost)}、利潤 ${fmt(p.profit)}"><defs>${hatch('loss-hatch','hatch-loss')}${lineSeries.map(([,,cls])=>hatch('bar-hatch-'+cls,'hatch-'+cls)).join('')}</defs>`;
  svg+=lossZone(lo,y,w,bottom)+gridLines(ticks,y,w);
  lineSeries.forEach(([key,name,cls],i)=>{
    const v=p[key],cx=slot*i+slot/2,x0=r(cx-bw/2),x1=r(cx+bw/2),top=r(y(v)),z=r(zero),rad=Math.min(6,Math.abs(z-top));
    if(v>=0)svg+=`<path d="M${x0} ${z} V${r(top+rad)} Q${x0} ${top} ${r(x0+rad)} ${top} H${r(x1-rad)} Q${x1} ${top} ${x1} ${r(top+rad)} V${z} Z" class="bar ${cls}"/>`;
    else svg+=`<rect x="${x0+1}" y="${z}" width="${bw-2}" height="${r(top-z)}" class="bar neg ${cls}" fill="url(#bar-hatch-${cls})"/>`;
    svg+=`<text x="${r(cx)}" y="${v>=0?top-8:r(Math.min(top+18,bottom-4))}" text-anchor="middle" class="bar-num">${fmt(v)}</text>`;
    svg+=`<g transform="translate(${r(cx-(mobile?24:28))} ${bottom+10})">${legendKey(cls,key==='profit'&&v<0).replace('<svg ','<svg x="0" y="0" ')}<text x="${mobile?28:30}" y="10" class="tick">${name}</text></g>`;
  });
  svg+='</svg>';
  return `<div class="trend">${axisSvg(ticks,y,{H,axisW})}<div class="trend-scroll">${svg}</div></div>`;
}
// 分類色（每一團／每個商品）：固定 7 色照順序，第 n 個用第 ((n−1) mod 7)+1 色；篩選、換風格都不重算
export const chartColor=i=>`var(--chart-${i%7+1})`;
// 利潤從哪裡來：只算賺錢的項目。0 項＝空白、1–5 項＝圓圈、6–10 項＝橫條全部列、11 項以上＝前 10 名＋其他
export const shareMode=n=>n===0?'empty':n<=5?'donut':n<=10?'bars':'top';
// parts：[{label, value(>0), color}]，照固定順序（不依大小）從 12 點鐘順時針；外徑 200（手機 160），環寬 30（24），塊與塊留 2px
export function donutChart(parts,{label='利潤',size=200}={}){
  const total=parts.reduce((n,p)=>n+p.value,0),mid=size/2,ring=Math.round(size*0.15),radius=mid-ring/2,len=2*Math.PI*radius;
  const gap=parts.length>1?2:0,seen=new Set();let start=0;
  let svg=`<svg class="donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escape(label)} ${fmt(total)}"><defs><pattern id="donut-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="6" fill="#fff"/></pattern></defs>`;
  for(const p of parts){
    const piece=len*p.value/total,dash=Math.max(piece-gap,0.5),arc=`cx="${mid}" cy="${mid}" r="${radius}" fill="none" stroke-width="${ring}" stroke-dasharray="${dash.toFixed(2)} ${(len-dash).toFixed(2)}" stroke-dashoffset="${(-start).toFixed(2)}" transform="rotate(-90 ${mid} ${mid})"`;
    svg+=`<circle ${arc} stroke="${p.color}"><title>${escape(p.label)} ${fmt(p.value)}</title></circle>`;
    // 萬一兩塊撞色，後面那塊加白色斜線紋
    if(seen.has(p.color))svg+=`<circle ${arc} stroke="url(#donut-hatch)" aria-hidden="true"/>`;
    seen.add(p.color);start+=piece;
  }
  return svg+`<text x="${mid}" y="${mid-8}" text-anchor="middle" class="donut-label">${escape(label)}</text><text x="${mid}" y="${mid+18}" text-anchor="middle" class="donut-num">${fmt(total)}</text></svg>`;
}
// 橫條排行：由多到少；超過 limit 項時，前 limit 名＋「其他 N 項」一條
export function rankRows(entries,limit=10){
  const sorted=[...entries].sort((a,b)=>b.value-a.value);
  if(sorted.length<=limit)return {rows:sorted,rest:null};
  const others=sorted.slice(limit);
  return {rows:sorted.slice(0,limit),rest:{label:`其他 ${others.length} 項`,value:others.reduce((n,e)=>n+e.value,0),count:others.length}};
}
// 排行清單（HTML）：條長照第 1 名比例，條一律用利潤綠；「其他」用灰、最長到滿格；手機先給前 5 名（第 6 名以後加 r-more，由 CSS 收起）
export function rankList(rows,{total,rest=null,numbered=true}={}){
  const max=Math.max(...rows.map(e=>e.value),1);
  const row=(e,i,cls='')=>`<li class="rank-row${cls}${i>=5?' r-more':''}">${numbered?`<span class="rank-no">${i<0?'':i+1}</span>`:''}<span class="rank-name">${escape(e.label)}</span><span class="rank-bar"><i style="width:${Math.min(100,Math.max(1,Math.round(e.value/max*1000)/10))}%"></i></span><b class="num">${fmt(e.value)}</b><span class="num rank-pct">${pct1(total?e.value/total:null)}</span></li>`;
  return `<ol class="rank${numbered?'':' plain'}">${rows.map((e,i)=>row(e,i)).join('')}${rest?row(rest,-1,' other r-more'):''}</ol>`;
}
