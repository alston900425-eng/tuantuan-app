// 艾麗莎的 Logo、吉祥物「小團」與插圖（內嵌 SVG）。顏色用 class，跟著 style.css 的風格變數換色；固定色版本在 www/assets/。
// 圖形來自設計畫布「團團美術包 v1」（改名前的名稱）（Logo A 笑臉購物袋、小團 7 種表情、主視覺、6 張插圖、6 個進度圖示），規格見 docs/ART-BRIEF.md。
const svg=(box,body,label='')=>`<svg class="ill" viewBox="${box}" ${label?`role="img" aria-label="${label}"`:'aria-hidden="true"'} xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

// Logo A：圓角方塊裡的笑臉購物袋。small＝16／24px 簡化版（拿掉眼睛、腮紅、袋口色帶）
const LOGO=`<rect class="f-brand" width="120" height="120" rx="28"/><path class="s-accent" d="M46 46 C46 25 74 25 74 46" fill="none" stroke-width="7" stroke-linecap="round"/><path class="f-accent" d="M33 42 H87 Q93.5 42 94 48.5 L97 88 Q97.8 99 87 99 H33 Q22.2 99 23 88 L26 48.5 Q26.5 42 33 42 Z"/><path class="f-accent2" d="M26.4 47 Q27 42 33 42 H87 Q93 42 93.6 47 L94 52 H26 Z"/><circle class="f-ink" cx="46" cy="47" r="2.3"/><circle class="f-ink" cx="74" cy="47" r="2.3"/><circle class="f-ink" cx="47.5" cy="70" r="4.6"/><circle class="f-ink" cx="72.5" cy="70" r="4.6"/><circle class="f-surface" cx="49.1" cy="68.3" r="1.5"/><circle class="f-surface" cx="74.1" cy="68.3" r="1.5"/><ellipse class="f-blush" cx="38" cy="80" rx="5.6" ry="3.6"/><ellipse class="f-blush" cx="82" cy="80" rx="5.6" ry="3.6"/><path class="s-ink" d="M54 79 Q60 85.5 66 79" fill="none" stroke-width="3.2" stroke-linecap="round"/>`;
const LOGO_SMALL=`<rect class="f-brand" width="16" height="16" rx="3.6"/><path class="s-accent" d="M6 6.2 C6 3 10 3 10 6.2" fill="none" stroke-width="1.5" stroke-linecap="round"/><path class="f-accent" d="M3.6 5.8 H12.4 L12.9 12.2 Q13 13.4 11.8 13.4 H4.2 Q3 13.4 3.1 12.2 Z"/><path class="s-brand" d="M6 9.6 Q8 11.6 10 9.6" fill="none" stroke-width="1.3" stroke-linecap="round"/>`;
export const logo=(small=false)=>small?svg('0 0 16 16',LOGO_SMALL,'艾麗莎'):svg('0 0 120 120',LOGO,'艾麗莎');

// 小團（120×120 座標）：袋子本體不變，只換手、臉和小道具
const arm=d=>`<path class="s-ink" d="${d}" fill="none" stroke-width="9" stroke-linecap="round"/><path class="s-accent" d="${d}" fill="none" stroke-width="4" stroke-linecap="round"/>`;
const ARMS={
  down:['M21 72 Q13 78 14 87','M99 72 Q107 78 106 87'],
  wave:['M21 72 Q13 78 14 87','M98 70 Q110 62 109 49'],
  droop:['M21 74 Q15 82 17 92','M99 74 Q105 82 103 92'],
  up:['M22 70 Q12 64 12 54','M98 70 Q108 64 108 54'],
  raise:['M21 72 Q13 78 14 87','M98 70 Q108 60 106 46'],
  cheer:['M22 70 Q10 62 11 48','M98 70 Q110 62 109 48'],
};
const BODY='M31 40 H89 Q96 40 96.6 47 L100 92 Q101 104 89 104 H31 Q19 104 20 92 L23.4 47 Q24 40 31 40 Z';
const BAG=`<path class="s-ink" d="M45 44 C45 21 75 21 75 44" fill="none" stroke-width="6" stroke-linecap="round"/><path class="f-accent" d="${BODY}"/><path class="f-accent2" d="M23.9 46 Q24.6 40 31 40 H89 Q95.4 40 96.1 46 L96.6 52 H23.4 Z"/><path class="s-ink" d="${BODY}" fill="none" stroke-width="3" stroke-linejoin="round"/><circle class="f-ink" cx="45" cy="46.5" r="2.2"/><circle class="f-ink" cx="75" cy="46.5" r="2.2"/>`;
const blush=(y=81)=>`<ellipse class="f-blush" cx="37" cy="${y}" rx="5.8" ry="3.7"/><ellipse class="f-blush" cx="83" cy="${y}" rx="5.8" ry="3.7"/>`;
const eyes=(r=4.6,y=71,hl=1.5)=>`<circle class="f-ink" cx="47" cy="${y}" r="${r}"/><circle class="f-ink" cx="73" cy="${y}" r="${r}"/><circle class="f-surface" cx="${47+r*.35}" cy="${y-r*.37}" r="${hl}"/><circle class="f-surface" cx="${73+r*.35}" cy="${y-r*.37}" r="${hl}"/>`;
const line=(d,w)=>`<path class="s-ink" d="${d}" fill="none" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const smileEyes=line('M42 72 Q47 65.5 52 72',3.4)+line('M68 72 Q73 65.5 78 72',3.4);
const FACES={
  smile:eyes()+blush()+line('M54 80 Q60 86.5 66 80',3),
  happy:smileEyes+blush()+'<path class="f-ink" d="M52.5 78.5 Q60 92 67.5 78.5 Z"/><path class="f-blush" d="M55.5 84.5 Q60 81.5 64.5 84.5 Q60 89.5 55.5 84.5 Z"/>',
  sleepy:line('M42 70 Q47 74.5 52 70',3.2)+line('M68 70 Q73 74.5 78 70',3.2)+blush()+'<ellipse class="f-ink" cx="60" cy="83" rx="2.6" ry="2.2"/>',
  surprised:line('M41 60 Q47 56.5 53 59.5',2.6)+line('M67 59.5 Q73 56.5 79 60',2.6)+eyes(5.6,71,1.8)+blush(82)+'<ellipse class="f-ink" cx="60" cy="86" rx="4.4" ry="5.4"/>',
  alert:line('M41 61 Q47 59.5 53 61',2.6)+line('M67 60 Q73 55.5 79 58.5',2.6)+eyes()+blush()+line('M55 82 H65',3),
  celebrate:smileEyes+blush()+'<path class="f-ink" d="M51 78 Q60 95 69 78 Z"/><path class="f-blush" d="M55 85.5 Q60 82 65 85.5 Q60 91 55 85.5 Z"/>',
  sorry:line('M41 63 Q46 61.5 51 58',2.6)+line('M69 58 Q74 61.5 79 63',2.6)+eyes(3.6,72,1.2)+blush()+line('M52 85 Q56 81 60 85 Q64 89 68 85',3),
};
const EXTRAS={
  sleepy:'<path class="s-brand" d="M86 20 H95 L86 29 H95" fill="none" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path class="s-brand" d="M99 6 H105 L99 12 H105" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  surprised:'<path class="s-brand" d="M95 15 Q95 8 102 8 Q109 8 109 14.5 Q109 19 102 21 V25" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle class="f-brand" cx="102" cy="31.5" r="2.3"/>',
  alert:'<circle class="f-brand" cx="106" cy="28" r="11"/><path class="s-surface" d="M106 22 V29.5" fill="none" stroke-width="3.4" stroke-linecap="round"/><circle class="f-surface" cx="106" cy="34" r="2"/>',
  celebrate:'<rect class="f-brand" x="14" y="18" width="7" height="4" rx="1" transform="rotate(-25 17.5 20)"/><rect class="f-accent2" x="96" y="14" width="7" height="4" rx="1" transform="rotate(30 99.5 16)"/><rect class="f-blush" x="28" y="5" width="6" height="4" rx="1" transform="rotate(15 31 7)"/><rect class="f-brand" x="84" y="3" width="6" height="4" rx="1" transform="rotate(-40 87 5)"/><circle class="f-accent2" cx="60" cy="8" r="2.5"/>',
  sorry:'<path class="f-surface s-brand" d="M107 30 Q113 38 113 42 A6 6 0 0 1 101 42 Q101 38 107 30 Z" stroke-width="1.8"/>',
};
const MOOD_ARMS={smile:'down',happy:'wave',sleepy:'droop',surprised:'up',alert:'raise',celebrate:'cheer',sorry:'droop'};
// 回傳 <g> 內容；arms 可換姿勢，extras＝頭上的 Z、問號、驚嘆號、紙片、汗滴
export const mascot=(mood='smile',{arms=MOOD_ARMS[mood],extras=false}={})=>(extras?EXTRAS[mood]||'':'')+ARMS[arms].map(arm).join('')+BAG+FACES[mood];
export const mascotArt=(mood='smile',label='小團')=>svg('0 0 120 120',`<ellipse class="f-line" cx="60" cy="110" rx="36" ry="5"/>${mascot(mood,{extras:true})}`,label);

const star=(x,y,s,cls='f-accent2')=>`<path class="${cls}" transform="translate(${x} ${y}) scale(${s})" d="M0 -1 Q0.22 -0.22 1 0 Q0.22 0.22 0 1 Q-0.22 0.22 -1 0 Q-0.22 -0.22 0 -1 Z"/>`;
const place=(x,y,s,body)=>`<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;

// 首頁主視覺（深色底）：小團揮手＋包裹＋打勾對話框。手和把手用亮色，深色底上才看得到
export const heroArt=()=>svg('0 0 250 170',`
  <ellipse class="f-surface" fill-opacity=".14" cx="128" cy="151" rx="114" ry="7"/>
  <path class="f-surface" d="M26 10 H74 Q86 10 86 22 V34 Q86 46 74 46 H46 L35 55 L37 46 H26 Q14 46 14 34 V22 Q14 10 26 10 Z"/>
  <path class="s-brand" d="M37 28 L46 37 L63 20" fill="none" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <path class="f-accent" d="M192 14 H226 Q236 14 236 24 V30 Q236 40 226 40 H222 L226 48 L213 40 H192 Q182 40 182 30 V24 Q182 14 192 14 Z"/>
  <circle class="f-ink" cx="199" cy="27" r="2.6"/><circle class="f-ink" cx="209" cy="27" r="2.6"/><circle class="f-ink" cx="219" cy="27" r="2.6"/>
  ${star(106,22,6,'f-accent')}${star(150,44,4)}${star(238,68,5,'f-accent')}${star(22,104,5)}
  <rect class="f-accent2" x="160" y="114" width="64" height="37" rx="4"/><rect class="f-accent" x="156" y="106" width="72" height="13" rx="3"/><rect class="f-surface" fill-opacity=".75" x="186" y="106" width="12" height="45"/>
  <rect class="f-accent2" x="170" y="82" width="42" height="24" rx="3"/><rect class="f-accent" x="167" y="76" width="48" height="10" rx="2.5"/><rect class="f-surface" fill-opacity=".75" x="186" y="76" width="10" height="30"/>
  <circle class="f-surface" cx="224" cy="104" r="10"/><path class="s-brand" d="M219.5 104 L222.8 107.3 L228.8 101" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  ${place(40,46,.95,`<path class="s-accent" d="M21 72 Q13 78 14 87" fill="none" stroke-width="7" stroke-linecap="round"/><path class="s-accent" d="M98 70 Q110 62 109 49" fill="none" stroke-width="7" stroke-linecap="round"/><path class="s-accent2" d="M45 44 C45 21 75 21 75 44" fill="none" stroke-width="6" stroke-linecap="round"/><path class="f-accent" d="${BODY}"/><path class="f-accent2" d="M23.9 46 Q24.6 40 31 40 H89 Q95.4 40 96.1 46 L96.6 52 H23.4 Z"/><path class="s-ink" d="${BODY}" fill="none" stroke-width="3" stroke-linejoin="round"/><circle class="f-ink" cx="45" cy="46.5" r="2.2"/><circle class="f-ink" cx="75" cy="46.5" r="2.2"/>${FACES.happy}`)}
`);

// 空白畫面與完成插圖（150×110）：orders＝還沒有訂單、search＝找不到、export＝沒有可匯出、history＝沒有下載紀錄、imported＝匯入成功、done＝全部完成
const shadow=(cx=72,cy=97,rx=64)=>`<ellipse class="f-line" cx="${cx}" cy="${cy}" rx="${rx}" ry="5"/>`;
const check=(cx,cy,r)=>`<circle class="f-brand" cx="${cx}" cy="${cy}" r="${r}"/><path class="s-surface" d="M${cx-r*.5} ${cy} L${cx-r*.15} ${cy+r*.35} L${cx+r*.5} ${cy-r*.3}" fill="none" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>`;
const SCENES={
  orders:()=>shadow()+'<rect class="f-surface s-accent2" x="86" y="16" width="52" height="68" rx="7" stroke-width="2"/><path class="f-accent2" d="M86 23 Q86 16 93 16 H131 Q138 16 138 23 V30 H86 Z"/><rect class="f-line" x="94" y="40" width="36" height="5" rx="2.5"/><rect class="f-line" x="94" y="52" width="28" height="5" rx="2.5"/><rect class="f-line" x="94" y="64" width="32" height="5" rx="2.5"/><circle class="f-brand" cx="134" cy="84" r="10"/><path class="s-surface" d="M134 79 V89 M129 84 H139" fill="none" stroke-width="2.6" stroke-linecap="round"/>'+place(4,28,.62,mascot('smile',{arms:'wave'})),
  search:()=>shadow()+'<path class="s-brand" d="M122 60 L138 76" fill="none" stroke-width="8" stroke-linecap="round"/><circle class="f-soft s-brand" cx="106" cy="44" r="22" stroke-width="5"/><path class="s-ink" d="M100 38 Q100 31 106 31 Q112 31 112 37 Q112 42 106 44 V48" fill="none" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><circle class="f-ink" cx="106" cy="55" r="2.2"/>'+place(2,28,.62,mascot('surprised')),
  export:()=>shadow(75,100,56)+'<rect class="s-brand" x="114" y="10" width="26" height="32" rx="4" fill="none" stroke-width="1.6" stroke-dasharray="4 3"/><path class="s-brand" d="M120 21 H134 M120 28 H130" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="3 3"/>'+star(16,20,5)+'<path class="f-ink" fill-opacity=".16" d="M38 58 L48 48 H102 L112 58 Z"/>'+place(45,14,.5,BAG+eyes(4.6,68)+line('M55 79 Q60 76 65 79',3))+'<rect class="f-accent2 s-ink" x="38" y="58" width="74" height="40" rx="4" stroke-width="2"/><path class="f-accent s-ink" d="M38 58 L22 46 L40 40 L48 48 Z" stroke-width="2" stroke-linejoin="round"/><path class="f-accent s-ink" d="M112 58 L128 46 L110 40 L102 48 Z" stroke-width="2" stroke-linejoin="round"/><rect class="f-surface" x="48" y="68" width="24" height="15" rx="2"/><path class="s-ink" d="M52 73 H66 M52 78 H61" fill="none" stroke-width="1.6" stroke-linecap="round"/>',
  history:()=>shadow()+'<rect class="f-soft" x="96" y="70" width="40" height="15" rx="4"/><path class="s-brand" d="M94 66 V80 Q94 87 101 87 H131 Q138 87 138 80 V66" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path class="s-brand" d="M116 20 V46" fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 8"/><path class="s-brand" d="M106 50 L116 60 L126 50" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'+place(4,28,.62,mascot('sleepy',{extras:true})),
  imported:()=>shadow()+'<rect class="f-surface s-accent2" x="92" y="10" width="44" height="54" rx="6" stroke-width="2"/><rect class="f-line" x="100" y="21" width="28" height="4" rx="2"/><rect class="f-line" x="100" y="30" width="22" height="4" rx="2"/><rect class="f-line" x="100" y="39" width="26" height="4" rx="2"/><rect class="f-line" x="100" y="48" width="16" height="4" rx="2"/>'+check(132,60,11)+'<path class="s-brand" d="M89 34 Q78 26 74 42" fill="none" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 4"/>'+star(16,22,5)+star(104,84,4)+place(6,28,.62,mascot('happy')),
  done:()=>'<rect class="f-brand" x="12" y="28" width="8" height="4" rx="1" transform="rotate(-25 16 30)"/><rect class="f-blush" x="128" y="18" width="8" height="4" rx="1" transform="rotate(35 132 20)"/><rect class="f-accent2" x="18" y="74" width="8" height="4" rx="1" transform="rotate(20 22 76)"/><rect class="f-brand" x="134" y="66" width="7" height="4" rx="1" transform="rotate(-30 137.5 68)"/><circle class="f-accent2" cx="30" cy="12" r="2.4"/><circle class="f-blush" cx="120" cy="40" r="2.2"/><circle class="f-brand" cx="8" cy="54" r="2"/>'+star(14,48,5)+star(138,44,5)+place(34,10,.68,'<ellipse class="f-line" cx="60" cy="110" rx="44" ry="5"/>'+mascot('celebrate',{extras:true}))+check(122,88,10),
};
export const emptyArt=name=>svg('0 0 150 110',(SCENES[name]||SCENES.orders)());

// 進度小圖示（24×24，線條跟著文字色）。「已取貨／未取貨」同一個袋子，只換勾和驚嘆號
const BAG_ICON='<path d="M5.5 8.5h13l-.9 10.6a1.6 1.6 0 0 1-1.6 1.4H8a1.6 1.6 0 0 1-1.6-1.4z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>';
const STAGE_ICONS={
  '':'<circle cx="12" cy="12" r="8.5" stroke-dasharray="3 2.6"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  notified:'<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  paid:'<rect x="3" y="6.5" width="18" height="11" rx="2"/><path d="M8.6 12.1l2.3 2.3 4.5-4.6"/>',
  shipped:'<path d="M2.8 6.5h10.4v8.8H2.8z"/><path d="M13.2 9.5h3.7l2.8 3v2.8h-6.5"/><circle cx="7" cy="17.4" r="1.8"/><circle cx="16.6" cy="17.4" r="1.8"/>',
  pickedUp:BAG_ICON+'<path d="M9.4 14.4l1.8 1.8 3.5-3.6"/>',
  noPickup:BAG_ICON+'<path d="M12 12.2v2.8"/><path d="M12 17.6h.01"/>',
};
export const stageIcon=stage=>`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${STAGE_ICONS[stage]??STAGE_ICONS['']}</svg>`;

// 外觀風格（存在這台電腦，不跟備份走）
export const themes=[
  ['','森林綠','清爽的綠色，跟原本一樣，字更清楚',['#145949','#e4edb8','#f5f6f1']],
  ['milk','奶茶可愛','暖暖的莓果奶茶色，圓角更圓',['#b0475c','#ffe3cf','#fcf7f2']],
  ['pro','沉穩專業','深藍色、方正，看起來像正式軟體',['#1f3a5f','#d4e3f6','#f2f4f7']],
];
export const themeKey='tuantuan-theme';
// 字體大小：以 rem 放大文字，按鈕隨內容撐高，不縮放整個頁面的座標。
export const sizes=[['','一般','現在的大小'],['large','大','字和按鈕都放大一點，看得更清楚']];
export const sizeKey='tuantuan-size';
export function applySize(name){
  if(name)document.documentElement.dataset.size=name;else delete document.documentElement.dataset.size;
}
export function applyTheme(name){
  if(name)document.documentElement.dataset.theme=name;else delete document.documentElement.dataset.theme;
  const meta=document.querySelector('meta[name=theme-color]');
  if(meta)meta.content=(themes.find(t=>t[0]===name)||themes[0])[3][0];
}
