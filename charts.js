// 賺多少頁的圖：自己畫 SVG，不另外下載圖表程式（電腦版、手機網頁版離線都能用）。
// 顏色在 style.css 的 --chart-*；文字一律用 --muted／--ink，顏色只放在線和色塊上。
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 圖上的金額：一萬以上寫「2.8萬」，負數負號在前
export const shortMoney=value=>{const a=Math.abs(Math.round(value)),sign=value<0?'-':'';return a>=10000?sign+Math.round(a/1000)/10+'萬':sign+a.toLocaleString('en-US');};
const niceStep=range=>{const raw=range/4||1,p=10**Math.floor(Math.log10(raw)),m=raw/p;return (m<=1?1:m<=2?2:m<=5?5:10)*p;};
export const lineSeries=[['revenue','收入','rev'],['cost','成本','cost'],['profit','利潤','profit']];
// points：[{label, revenue, cost, profit}]，照團的先後；width 用畫面實際寬度，字才不會被縮小
export function lineChart(points,width,selected=points.length-1){
  const h=240,L=48,R=18,T=16,B=36,w=Math.max(Math.round(width),260);
  const values=points.flatMap(p=>[p.revenue,p.cost,p.profit]);
  let lo=Math.min(0,...values),hi=Math.max(0,...values);
  const step=niceStep(hi-lo);lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step||step;
  const col=(w-L-R)/Math.max(points.length-1,1);
  const x=i=>points.length===1?L+(w-L-R)/2:L+i*col,y=v=>T+(hi-v)*(h-T-B)/(hi-lo);
  const r=n=>Math.round(n*10)/10;
  // 軸上的數字同一種寫法：最大到一萬以上就全部用「萬」
  const wan=Math.max(-lo,hi)>=10000,axis=v=>wan&&v?Math.round(v/1000)/10+'萬':v.toLocaleString('en-US');
  let svg=`<svg class="line-chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="每一團的收入、成本、利潤折線圖">`;
  for(let v=lo;v<=hi+step/2;v+=step)svg+=`<line x1="${L}" x2="${w-R}" y1="${r(y(v))}" y2="${r(y(v))}" class="${v===0?'axis':'grid'}"/><text x="${L-8}" y="${r(y(v))+4}" text-anchor="end" class="tick">${axis(v)}</text>`;
  // 團太多時隔幾個才寫名字，名字太長就截斷；最左、最右的名字往內對齊，才不會被切掉
  const every=Math.max(1,Math.ceil(points.length*58/(w-L-R+58))),chars=Math.max(3,Math.floor(Math.min(col||w,120)*every/13));
  points.forEach((p,i)=>{if(i===selected||i%every===0&&Math.abs(i-selected)>=every){const t=p.label.length>chars?p.label.slice(0,chars-1)+'…':p.label;const edge=points.length>1&&(i===0?'start':i===points.length-1?'end':'');svg+=`<text x="${r(x(i))}" y="${h-12}" text-anchor="${edge||'middle'}" class="tick${i===selected?' on':''}">${escape(t)}</text>`;}});
  if(selected>=0&&selected<points.length)svg+=`<line x1="${r(x(selected))}" x2="${r(x(selected))}" y1="${T}" y2="${h-B}" class="cross"/>`;
  const path=key=>points.map((p,i)=>(i?'L':'M')+r(x(i))+' '+r(y(p[key]))).join(' ');
  if(points.length>1)svg+=`<path d="${path('profit')} L${r(x(points.length-1))} ${r(y(0))} L${r(x(0))} ${r(y(0))} Z" class="area"/>`;
  for(const [key,,cls] of lineSeries)if(points.length>1)svg+=`<path d="${path(key)}" class="line ${cls}"/>`;
  // 點的形狀也不同（收入圓點、成本菱形、利潤方塊），不只靠顏色分辨
  points.forEach((p,i)=>{
    const cx=r(x(i)),big=i===selected?1.4:1;
    svg+=`<circle cx="${cx}" cy="${r(y(p.revenue))}" r="${4*big}" class="dot rev"/>`;
    svg+=`<rect x="${cx-4*big}" y="${r(y(p.cost))-4*big}" width="${8*big}" height="${8*big}" transform="rotate(45 ${cx} ${r(y(p.cost))})" class="dot cost"/>`;
    svg+=`<rect x="${cx-4*big}" y="${r(y(p.profit))-4*big}" width="${8*big}" height="${8*big}" rx="1" class="dot profit"/>`;
  });
  // 點／滑過整條直欄就選到那一團（手機手指比較好點）
  points.forEach((p,i)=>{const half=points.length===1?(w-L-R)/2:col/2;svg+=`<rect x="${r(Math.max(L-half,x(i)-half))}" y="0" width="${r(half*2)}" height="${h}" class="hit" data-point="${i}"><title>${escape(p.label)}</title></rect>`;});
  return svg+'</svg>';
}
// parts：[{label, value(>0), color}]；中間寫總數
export function donutChart(parts,centerLabel,size=184){
  const total=parts.reduce((n,p)=>n+p.value,0),mid=size/2,ring=size*0.19,radius=mid-ring/2,len=2*Math.PI*radius;
  const gap=parts.length>1?2:0;let start=0,svg=`<svg class="donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escape(centerLabel)}圓餅圖">`;
  for(const p of parts){
    const piece=len*p.value/total,dash=Math.max(piece-gap,0.5);
    svg+=`<circle cx="${mid}" cy="${mid}" r="${radius}" fill="none" stroke="${p.color}" stroke-width="${ring}" stroke-dasharray="${dash.toFixed(2)} ${(len-dash).toFixed(2)}" stroke-dashoffset="${(-start).toFixed(2)}" transform="rotate(-90 ${mid} ${mid})"><title>${escape(p.label)} ${Math.round(p.value).toLocaleString('en-US')}</title></circle>`;
    start+=piece;
  }
  return svg+`<text x="${mid}" y="${mid-4}" text-anchor="middle" class="donut-num">${shortMoney(total)}</text><text x="${mid}" y="${mid+16}" text-anchor="middle" class="donut-label">${escape(centerLabel)}</text></svg>`;
}
// 圓餅最多 8 色（固定順序，顏色跟著團／商品走，不跟排名走），第 9 個以後併成「其他」
export const chartColor=i=>`var(--chart-${i%8+1})`;
export function donutParts(entries){
  const positive=entries.filter(e=>e.value>0);
  if(positive.length<=8)return positive;
  const sorted=[...positive].sort((a,b)=>b.value-a.value),keep=new Set(sorted.slice(0,7));
  return [...positive.filter(e=>keep.has(e)),{label:'其他',value:sorted.slice(7).reduce((n,e)=>n+e.value,0),color:'var(--chart-other)'}];
}
