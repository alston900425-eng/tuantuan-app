import {summarize,validateOrder,demoOrders,summaryCsv,itemTotals,itemTotalsCsv,buyerMessage,cleanPhone,stages,progressOf,groupSignature,noPickupHistory,allocatePurchased,itemKey,profitReport,profitTotal} from './core.js';
import {trendChart,barsChart,donutChart,chartColor,lineSeries,legendKey,shareMode,rankRows,rankList,fmt,pct1} from './charts.js';
const messageNoteKey='tuantuan-message-note';
import {importFields,guessMapping,guessProducts,readTable,planImport,MAX_PRODUCTS,pickTimes} from './importer.js';
import {formIdFromUrl,responsesToTable,splitNew,mappingToNames,namesToMapping} from './google-sync.js';
import {logo,heroArt,emptyArt,stageIcon,themes,themeKey,applyTheme,sizes,sizeKey,applySize} from './art.js';
import {storageKey,recoveryKey,MAX_BACKUP_BYTES,SCHEMA_VERSION,parseBackup,parseBackupFile,backupText,restoreBackup,isDate} from './backup.js';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>'NT$ '+value.toLocaleString('en-US');
const paths={home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z M9 21v-8h6v8',orders:'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h4',sources:'M8 3H4v18h16V7h-8V3z M12 3l8 4 M8 12h8 M8 16h5',export:'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',plus:'M12 5v14 M5 12h14',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',alert:'M12 3 2 21h20L12 3z M12 9v5 M12 17v1',people:'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M2 21v-3a7 7 0 0 1 14 0v3 M17 4a4 4 0 0 1 0 7 M19 14a6 6 0 0 1 3 5',box:'M3 7l9-5 9 5v11l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v11 M8 4l9 5',check:'M5 12l4 4L19 6',profit:'M3 3v18h18 M7 15l4-4 3 3 6-7',arrow:'M9 5l7 7-7 7'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.orders}"/></svg>`;
let pendingRestore=null;
let importBook=null,importTable=null,importPlan=null,importFileName='';
const demoCosts=()=>Object.fromEntries([['秋日生活選物','日常帆布袋・奶油白',240],['秋日生活選物','日常帆布袋・墨綠',240],['秋日生活選物','陶瓷馬克杯・燕麥',150],['秋日生活選物','居家香氛・森林',300],['週末咖啡器物','手沖分享壺',430]].map(([c,i,n])=>[itemKey(c,i),n]));
const emptyState=demo=>({schemaVersion:SCHEMA_VERSION,orders:demo?structuredClone(demoOrders):[],overrides:{},history:[],demo,progress:{},purchased:{},shipped:{},noStore:[],costs:demo?demoCosts():{},expenses:demo?[{id:'demo-ship',campaign:'秋日生活選物',label:'包材',amount:200}]:[],dates:demo?{'週末咖啡器物':'2026-09-20','秋日生活選物':'2026-10-05'}:{}});
let state=emptyState(true);
let storageWarning='';
try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved&&Array.isArray(saved.orders)&&saved.orders.every(o=>typeof o.id==='string'&&typeof o.store==='string'&&validateOrder(o).length===0)&&saved.overrides&&Array.isArray(saved.history))state=saved;}catch{storageWarning='無法讀取本機資料，已載入示範訂單。';}
for(const key of ['progress','purchased','shipped','costs','dates'])if(!state[key]||typeof state[key]!=='object'||Array.isArray(state[key]))state[key]={};
if(!Array.isArray(state.noStore))state.noStore=[];
if(!Array.isArray(state.expenses))state.expenses=[];
let currentTheme='';try{currentTheme=localStorage.getItem(themeKey)||'';}catch{}
if(!themes.some(t=>t[0]===currentTheme))currentTheme='';
applyTheme(currentTheme);
let currentSize='';try{currentSize=localStorage.getItem(sizeKey)||'';}catch{}
if(!sizes.some(s=>s[0]===currentSize))currentSize='';
applySize(currentSize);
let page='home',filter='all',query='',campaign='all',stageFilter='any';
const when=at=>new Date(at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'});
const nav=[['home','總覽'],['orders','訂單'],['profit','賺多少'],['sources','資料來源'],['export','匯出'],['settings','設定']];
const allGroups=()=>summarize(state.orders,state.overrides,state.noStore);
const groups=()=>allGroups().filter(g=>campaign==='all'||g.campaign===campaign);
const save=()=>{try{state.updatedAt=new Date().toISOString();localStorage.setItem(storageKey,JSON.stringify(state));scheduleAutoBackup();return true;}catch{toast('本機儲存失敗，請先備份資料，關閉後可能遺失。');return false;}};
// EXE 自動備份：修改後 1.5 秒存「最新」（main 另建每日一份）；清空／重設／還原／匯入前先存「變更前」。網頁版沒有。
const desktop=globalThis.tuantuanDesktop;
let backupTimer,backupStatus={};
async function runAutoBackup(kind='latest'){
 if(!desktop?.autoBackup)return {skipped:true};
 clearTimeout(backupTimer);backupTimer=null;
 let result;try{result=await desktop.autoBackup(backupText(state,'desktop'),kind);}catch(error){result={error:error.message||'未知錯誤'};}
 if(result.error&&!backupStatus.error)toast('自動備份失敗：'+result.error);
 backupStatus=result;if(page==='settings')renderBackupStatus();
 return result;
}
function scheduleAutoBackup(){if(!desktop?.autoBackup)return;clearTimeout(backupTimer);backupTimer=setTimeout(()=>runAutoBackup(),1500);}
addEventListener('beforeunload',()=>{if(backupTimer)runAutoBackup();});
let toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function modal(title,body){$('#dialog').innerHTML=`<div class="dialog-head"><h2>${escape(title)}</h2><button class="close" data-action="close" aria-label="關閉">×</button></div><div class="dialog-body">${body}</div>`;if(!$('#dialog').open)$('#dialog').showModal();}
function greeting(){const now=new Date(),hour=Number(now.toLocaleString('en-US',{timeZone:'Asia/Taipei',hour:'numeric',hourCycle:'h23'}));return now.toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei',month:'long',day:'numeric',weekday:'long'})+' · '+(hour<5?'夜深了':hour<11?'早安':hour<18?'午安':'晚安');}
function heading(title,sub,action='',eyebrow=''){return `<div class="heading"><div>${eyebrow?`<p class="eyebrow">${eyebrow}</p>`:''}<h1>${title}</h1><p class="subtitle">${sub}</p></div>${action}</div>`;}
const addButton=()=>`<button class="primary" data-action="add">${icon('plus')}新增訂單</button>`;
function campaignSelect(){return `<select id="campaign" aria-label="選擇團別"><option value="all">所有團別</option>${[...new Set(state.orders.map(o=>o.campaign))].map(c=>`<option ${campaign===c?'selected':''} value="${escape(c)}">${escape(c)}</option>`).join('')}</select>`;}
function render(){
  for(const id of ['desktop-nav','mobile-nav'])$('#'+id).innerHTML=nav.map(([key,label])=>`<button data-page="${key}" class="${page===key?'active':''}" ${page===key?'aria-current="page"':''}>${icon(key)}${label}</button>`).join('');
  $('#page-label').textContent={home:'訂單總覽',orders:'買家訂單',profit:'賺多少',sources:'資料來源',export:'匯出中心',settings:'工作室設定'}[page];
  $('.source-pill').innerHTML=`<span class="dot"></span>${state.demo?'示範資料':'本機資料'}`;
  if(page==='home'||page==='orders')renderOrders();
  else if(page==='profit')renderProfit();
  else if(page==='sources')renderSources();
  else if(page==='export')renderExport();
  else renderSettings();
}
function renderOrders(){
  const gs=groups(),issues=gs.filter(g=>g.issues.length).length,total=gs.reduce((s,g)=>s+g.total,0),count=gs.reduce((s,g)=>s+g.orders.length,0),cancelledCount=gs.reduce((s,g)=>s+g.cancelled.length,0),liveCount=gs.filter(g=>g.active).length;
  // 每位買家都標了「已取貨」或「未取貨」→ 這一團結束，顯示慶祝
  const allDone=liveCount>0&&!issues&&gs.filter(g=>g.active).every(g=>['pickedUp','noPickup'].includes(progressOf(g,state.progress).stage));
  $('#view').innerHTML=(page==='home'?heading('把訂單交給艾麗莎。','從收單到整理，讓你的每一團井然有序。',addButton(),greeting()):heading('每位買家，一目瞭然。','點一位買家，就能看明細、改訂單、傳訊息。',addButton()))+(page==='home'?purchaseSection(gs)+`
    <section class="hero"><div><p class="eyebrow">今天也輕鬆整單</p><h2>${count} 筆訂單，<br>已整理成 <strong>${liveCount} 份買家清單。</strong></h2><p>依 Email ＋ 團別合併，保留每一筆加購明細。</p></div><div class="hero-art">${heroArt()}</div></section>
    <div class="stats"><div class="stat"><div class="stat-top">原始訂單${icon('orders')}</div><strong>${count}<small> 筆</small></strong><small>${cancelledCount?`另有 ${cancelledCount} 筆已取消`:'保留完整填單紀錄'}</small></div><div class="stat"><div class="stat-top">合併後清單${icon('people')}</div><strong>${liveCount}<small> 份</small></strong><small>同一買家、同一團合併</small></div><div class="stat"><div class="stat-top">商品總額${icon('box')}</div><strong><small>NT$ </small>${total.toLocaleString()}</strong><small>未含運費與平台費用</small></div><div class="stat ${issues?'warn':'done'}"><div class="stat-top">需要確認${icon(issues?'alert':'check')}</div><strong>${issues}<small> 份</small></strong><small>${issues?'處理後才能匯出':'所有資料已通過檢查'}</small></div></div>`:'')+
    `<div class="section-top"><h2>買家清單<span>每筆加購，都幫你記好</span></h2>${campaignSelect()}</div>${issues?`<div class="alert">${icon('alert')}<span>有 ${issues} 份清單需要你的確認</span><button data-action="review">前往處理 →</button></div>`:''}${allDone?`<div class="celebrate">${emptyArt('done')}<div><b>全部處理完了！</b><p>${campaign==='all'?'每一團':'這一團'}的買家都標好取貨狀態了，辛苦了。</p></div></div>`:''}
    <section class="panel"><div class="tools"><div class="tabs">${[['all','全部'],['ready','可匯出'],['issues','待確認'],['cancelled','有取消']].map(([key,label])=>`<button data-filter="${key}" class="${filter===key?'selected':''}">${label}</button>`).join('')}</div>${stageSelect()}<label class="search">${icon('search')}<input id="search" aria-label="搜尋姓名、Email、手機或商品" placeholder="搜尋姓名、Email、手機或商品" value="${escape(query)}"></label></div><div class="table-head"><span>買家</span><span>訂單明細</span><span>商品合計</span><span>整理狀態</span><span></span></div><div id="rows"></div><div class="table-bottom"><span id="row-count"></span><span>點選買家查看明細 →</span></div></section>`;
  renderRows();
}
// 訂購選單：每種商品買家要幾個、跟廠商訂了幾個（自己填）；艾麗莎照表單填寫順序（先填先拿）分給買家
function purchaseSection(gs){
 const totals=itemTotals(gs);if(!totals.length)return '';
 return `<section class="card buy-card"><h2>訂購選單</h2><p class="footnote">跟廠商訂了幾個就填幾個，艾麗莎會照表單填寫順序（先填先拿）分給買家，買家明細裡會顯示「已訂到」或「還沒訂到」。</p><div class="buy-list">${totals.map(t=>{const key=itemKey(t.campaign,t.item),n=state.purchased[key];return `<div class="buy-row"><div class="buy-name"><b>${escape(t.item)}</b><small>${campaign==='all'?escape(t.campaign)+' · ':''}買家要 <b>${t.quantity.toLocaleString('en-US')}</b> 個${t.pendingQuantity?`（含待確認 ${t.pendingQuantity}）`:''}</small></div><label class="buy-input">已訂<input type="number" inputmode="numeric" min="0" max="10000000" step="1" placeholder="0" data-buy="${escape(key)}" data-need="${t.quantity}" value="${n??''}" aria-label="${escape(t.item)} 已訂幾個"></label><span class="buy-status" data-buy-status="${escape(key)}">${buyStatus(t.quantity,n)}</span></div>`;}).join('')}</div><p class="footnote">已取消的不算；「待確認」的買家也照順序算在內。</p></section>`;
}
const buyStatus=(need,n)=>n===undefined?'<span class="muted">還沒填</span>':n<need?`<span class="warn-text">還差 ${(need-n).toLocaleString('en-US')} 個</span>`:n===need?'<span class="ok-text">✓ 剛好夠</span>':`<span class="ok-text">多訂 ${(n-need).toLocaleString('en-US')} 個</span>`;
const shortWhen=at=>new Date(at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const progressLabel=g=>{const p=progressOf(g,state.progress);return escape(p.label)+(p.changed?'（標記後有變動）':'');};
const stagePill=g=>{const p=progressOf(g,state.progress);return `<span class="stage st-${p.stage||'none'}${p.changed?' changed':''}" title="${progressLabel(g)}">${stageIcon(p.stage)}${escape(p.label)}</span>`;};
function claimNotice(gs){
 gs=gs.filter(g=>g.claims&&g.active);if(!gs.length)return '';
 const bad=gs.filter(g=>g.claimIssue),unreadable=bad.filter(g=>g.unreadable.length),diff=bad.filter(g=>!g.unreadable.length);
 const sum=list=>money(list.reduce((n,g)=>n+g.claimed,0)),total=money(gs.reduce((n,g)=>n+g.total,0));
 if(!bad.length)return `<div class="notice ok">✓ 試算表的匯款金額跟艾麗莎算的都一樣（${gs.length} 位，合計 ${total}）。</div>`;
 return `<div class="notice">⚠ 試算表的匯款金額跟艾麗莎算的<b>有 ${bad.length} 位不一樣</b>：${[[diff.filter(g=>g.claimed<g.total).length,'少匯'],[diff.filter(g=>g.claimed>g.total).length,'多匯'],[unreadable.length,'金額寫了文字']].filter(([n])=>n).map(([n,t])=>`${t} ${n} 位`).join('、')}；其他 ${gs.length-bad.length} 位一樣。<br>試算表填的合計 ${sum(gs)}${unreadable.length?'（不含寫了文字的）':''}，艾麗莎算 ${total}。到訂單頁進度選單選「試算表金額對不上」就能一位一位核對。</div>`;
}
function stageSelect(){
 const all=allGroups(),history=noPickupHistory(all,state.progress),gs=groups(),count=stage=>gs.filter(g=>progressOf(g,state.progress).stage===stage).length;
 return `<select id="stage-filter" aria-label="依進度篩選"><option value="any">全部進度</option>${[['','未處理'],...stages].map(([key,label])=>`<option value="${key}" ${stageFilter===key?'selected':''}>${label}（${count(key)}）</option>`).join('')}<option value="history" ${stageFilter==='history'?'selected':''}>曾未取貨的買家（${gs.filter(g=>history.has(g.key)).length}）</option>${gs.some(g=>g.claims)?`<option value="claim" ${stageFilter==='claim'?'selected':''}>試算表金額對不上（${gs.filter(g=>g.claimIssue).length}）</option>`:''}</select>`;
}
// 搜尋姓名、Email、手機（可含空白或連字號）或商品名稱
// 頭像：姓名取最後兩字；IG 帳號（英數）取前兩個字母，略過 @ _ . 等符號
const initials=name=>{const t=String(name).replace(/[^\p{L}\p{N}]/gu,'');return /^[\x00-\x7f]+$/.test(t)?t.slice(0,2).toUpperCase():(t||String(name)).slice(-2);};
const matches=g=>{const q=query.trim().toLowerCase();if(!q)return true;const phone=cleanPhone(q);return [g.name,g.email,g.phone,...[...g.orders,...g.cancelled].map(o=>o.item)].join(' ').toLowerCase().includes(q)||/^\d{3,}$/.test(phone)&&g.phone.includes(phone);};
function renderRows(){
  const history=noPickupHistory(allGroups(),state.progress);
  const stageMatch=g=>stageFilter==='any'||(stageFilter==='history'?history.has(g.key):stageFilter==='claim'?g.claimIssue:progressOf(g,state.progress).stage===stageFilter);
  const gs=groups().filter(g=>stageMatch(g)&&({all:true,ready:g.active&&!g.issues.length,issues:g.issues.length>0,cancelled:g.cancelled.length>0})[filter]&&matches(g));
  $('#rows').innerHTML=gs.length?gs.map(g=>`<button class="order-row" data-detail="${escape(g.key)}"><span class="buyer"><span class="avatar">${escape(initials(g.name))}</span><span><b>${escape(g.name)}</b><small>${escape(g.email)}</small>${progressOf(g,state.progress).stage?`<small class="mobile-only">${stagePill(g)}</small>`:''}${history.has(g.key)?`<small class="warn-text">⚠ 曾未取貨 ${history.get(g.key).length} 次</small>`:''}</span></span><span class="meta">${g.active?`${g.orders.length} 筆訂單 · ${g.quantity} 件`:'全部已取消'}${g.cancelled.length&&g.active?` · 取消 ${g.cancelled.length}`:''}${g.active&&g.orders.some(o=>state.shipped[o.id])?` · 已寄出 ${g.orders.filter(o=>state.shipped[o.id]).length}/${g.orders.length}`:''}<small>${escape(g.campaign)}</small>${stagePill(g)}</span><span class="amount">$${g.total.toLocaleString()}</span><span class="badge ${g.issues.length?'amber':g.active?'':'neutral'}">${g.issues.length?'待確認 '+g.issues.length+' 項':g.active?'✓ 可匯出':'已取消'}</span><span class="arrow">${icon('arrow')}</span></button>`).join(''):!state.orders.length?`<div class="empty">${emptyArt('orders')}<b>還沒有訂單</b>到「資料來源」匯入表單，或按「新增訂單」。</div>`
   :filter==='issues'&&!query.trim()&&stageFilter==='any'?`<div class="empty">${emptyArt('done')}<b>都確認好了！</b>沒有需要你處理的買家。</div>`
   :`<div class="empty">${emptyArt('search')}<b>沒有符合的買家</b>換個篩選或搜尋字試試看。</div>`;
  $('#row-count').textContent=`顯示 ${gs.length} 份買家清單`;
}
function detail(key){
 const g=allGroups().find(g=>g.key===key);if(!g)return;
 const got=allocatePurchased(state.orders,state.purchased),stage=progressOf(g,state.progress).stage;
 const buyTag=o=>!got.has(o.id)?'':got.get(o.id)===o.quantity?'<span class="tag ok">✓ 已訂到</span>':got.get(o.id)?`<span class="tag warn">已訂到 ${got.get(o.id)}／${o.quantity}</span>`:'<span class="tag warn">還沒訂到</span>';
 const allShipped=g.active&&g.orders.every(o=>state.shipped[o.id]);
 modal(g.name+' 的訂單',`<span class="badge neutral">${escape(g.campaign)}</span><p class="footnote">${escape(g.email)} · ${escape(g.phone)}<br>${g.noStore&&!g.store?`取貨：這團不用門市（面交／另寄） <button class="link" data-needstore="${escape(g.campaign)}" data-key="${escape(key)}">改回需要門市</button>`:`取貨門市：${escape(g.store||'尚待確認')}`}</p><div class="detail-stats"><div><small>商品合計</small><b>${money(g.total)}</b></div><div><small>已付金額</small><b>${money(g.paid)}</b></div><div><small>待付金額</small><b>${money(g.balance)}</b></div></div>${g.claims?`<p class="footnote">買家填的匯款金額：${g.unreadable.length?escape(g.unreadable.join('、'))+(g.claimed?`＋${money(g.claimed)}`:''):money(g.claimed)}（只用來核對，不算已付）${g.claimChecked?`<br>✓ 已核對差額（${escape(new Date(state.overrides[key].claimedChecked.at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}))}）`:''}</p>`:''}<button class="secondary" data-message="${escape(key)}">產生給買家的訊息</button>${progressBox(g)}${allShipped&&!['shipped','pickedUp','noPickup'].includes(stage)?`<div class="notice ok">商品都標成已寄出了。<button class="secondary" data-stage="shipped" data-key="${escape(key)}">把進度標成「已寄出」</button></div>`:''}${g.orders.map(o=>`<div class="detail-item"><div><span>${escape(o.item)} × ${o.quantity}</span><b>${money(o.price*o.quantity)}</b></div><small>${escape(o.store||(g.noStore?'不用門市':'未填門市'))} · 本筆已付 ${money(o.paid)}</small>${buyTag(o)||state.shipped[o.id]?`<div class="item-tags">${buyTag(o)}${state.shipped[o.id]?`<span class="tag ok">已寄出 ${escape(shortWhen(state.shipped[o.id]))}</span>`:''}</div>`:''}${o.source?`<details><summary>查看匯入原始列</summary><p class="footnote">來源：${escape(o.source.name)}<br>識別碼：${escape(o.source.rowId)}</p>${o.source.headers.map((header,index)=>`<p class="footnote">${escape(header)}：${escape(o.source.values[index])}</p>`).join('')}</details>`:''}<div class="item-actions"><button class="secondary ship${state.shipped[o.id]?' on':''}" data-ship="${escape(o.id)}" aria-pressed="${!!state.shipped[o.id]}">${state.shipped[o.id]?'✓ 已寄出（再按取消）':'已寄出'}</button><button class="secondary" data-edit="${escape(o.id)}">修改這筆</button><button class="secondary danger" data-cancel="${escape(o.id)}">取消這筆</button></div></div>`).join('')||'<p class="footnote">這位買家在此團的商品都已取消。</p>'}${g.cancelled.length?`<h3 class="cancelled-head">已取消 ${g.cancelled.length} 筆<small>不計入金額與匯出，原始資料保留</small></h3>${g.cancelled.map(o=>`<div class="detail-item cancelled"><div><span>${escape(o.item)} × ${o.quantity}</span><b>${money(o.price*o.quantity)}</b></div><small>${escape(new Date(o.cancelledAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}))} 取消 · 本筆已付 ${money(o.paid)}</small><div class="item-actions"><button class="secondary" data-restore="${escape(o.id)}">恢復這筆</button></div></div>`).join('')}`:''}${g.issues.length?`<div class="resolve"><b>需要確認</b><p>${g.issues.map(escape).join('<br>')}</p>${g.stores.length&&g.issues.some(i=>i.includes('門市'))?`<label class="field">本次合單使用的門市<select id="resolved-store">${g.stores.map(s=>`<option value="${escape(s)}">${escape(s)}</option>`).join('')}</select></label><button class="secondary" data-store="${escape(key)}">確認使用此門市</button>`:''}${g.issues.some(i=>i.includes('門市'))?`<p>這團是面交或另外寄送、不用取貨門市的話：</p><button class="secondary" data-nostore="${escape(g.campaign)}" data-key="${escape(key)}">這團都不用門市</button>`:''}${g.issues.includes('疑似重複填單')?`<p>請先確認是加購，還是重複送出。兩筆目前都計入金額。</p><button class="secondary" data-duplicate="${escape(key)}">確認都是有效加購</button>`:''}${g.cancelledPaid&&!state.overrides[key]?.refundChecked?`<p>取消不會自動退款。請先退款給買家，或把這筆款項改填到其他商品，再按下方按鈕。</p><button class="secondary" data-refund="${escape(key)}">已核對退款</button>`:''}${g.claimIssue?`<p>請對一下匯款紀錄。如果是之後補尾款、或已經跟買家講好，可以按下方按鈕放行，艾麗莎會記下核對時間。買家原本填的內容在上面「查看匯入原始列」。</p><button class="secondary" data-claimed="${escape(key)}">已核對匯款金額</button>`:''}</div>`:(g.active?'<p class="footnote">✓ 資料檢查完成，可以匯出整理摘要。</p>':'')}<p class="footnote">商品金額未含運費。「已付」是手動紀錄，尚未連接付款系統。</p>`);
}
function progressBox(g){
 const p=progressOf(g,state.progress),hits=noPickupHistory(allGroups(),state.progress).get(g.key)||[];
 return `<div class="progress-box"><b>進度</b><div class="stage-buttons">${[['','未處理'],...stages].map(([key,label])=>`<button class="chip st-${key||'none'} ${p.stage===key?'selected':''}" data-stage="${key}" data-key="${escape(g.key)}" aria-pressed="${p.stage===key}">${stageIcon(key)}${label}</button>`).join('')}</div><small>${p.stage?`${escape(when(p.at))} 標記為「${escape(p.label)}」`:'還沒標記。進度是你自己的紀錄，不會通知買家或賣貨便。'}</small>${p.changed?'<p class="warn-text">⚠ 標記之後，這位買家的商品數量或金額有變動，請再確認一次。</p>':''}${hits.length?`<p class="warn-text">⚠ 同一個人（Email 或手機相同）曾在 ${hits.map(h=>`「${escape(h.campaign)}」`).join('、')} 被標記未取貨，可考慮先收款再出貨。</p>`:''}</div>`;
}
// 設定進度；存不進本機就退回。stay=true 時留在目前視窗（例如訊息視窗）
function setStage(key,stage,stay=false){
 const g=allGroups().find(g=>g.key===key);if(!g)return;
 const before=state.progress[key];
 if(stage)state.progress[key]={stage,at:new Date().toISOString(),signature:groupSignature(g)};else delete state.progress[key];
 if(!save()){if(before)state.progress[key]=before;else delete state.progress[key];return;}
 render();
 if(stay)toast(`已標記為「${progressOf(g,state.progress).label}」。`);else detail(key);
}
function messageModal(key){
 const g=allGroups().find(g=>g.key===key);if(!g)return;
 let note='';try{note=localStorage.getItem(messageNoteKey)||'';}catch{}
 modal('給 '+g.name+' 的訊息',`<p class="footnote">可以直接修改下方文字，再按「複製」貼到 LINE 或簡訊。金額是艾麗莎裡的手動紀錄；送出前請自己看過一次。</p><label class="field">固定附註（例如匯款帳號、取貨期限；會記住，之後每位買家都會帶上）<textarea id="message-note" rows="2" maxlength="500">${escape(note)}</textarea></label><label class="field">訊息內容<textarea id="buyer-message" data-key="${escape(key)}" rows="12">${escape(buyerMessage(g,note))}</textarea></label><div id="message-error" class="error" role="alert"></div><div class="form-actions"><button class="secondary" data-detail="${escape(key)}">返回明細</button>${progressOf(g,state.progress).stage?'':`<button class="secondary" data-stage="notified" data-key="${escape(key)}" data-stay="1">送出後標記「已通知」</button>`}<button class="primary" data-action="copy-message">複製訊息</button></div>`);
}
// 先用系統剪貼簿，不行再用舊方法；都失敗就請使用者自己選取複製
async function copyText(textarea){
 try{await navigator.clipboard.writeText(textarea.value);return true;}catch{}
 try{textarea.select();return document.execCommand('copy');}catch{return false;}
}
function orderForm(id){
 const o=state.orders.find(o=>o.id===id)||{name:'',email:'',phone:'',campaign:campaign==='all'?'秋日生活選物':campaign,item:'',quantity:1,price:0,paid:0,store:''};
 modal(id?'修改訂單':'新增一筆訂單',`<form id="order-form" data-id="${escape(id||'')}"><div class="form-grid">${[['name','收件人','text'],['phone','手機（或 IG）','text'],['email','Email','email'],['campaign','團別','text'],['item','商品名稱','text'],['store','取貨門市名稱／代碼','text'],['quantity','數量','number'],['price','單價（NT$）','number'],['paid','本筆已付金額（NT$）','number']].map(([key,label,type])=>`<label class="field ${['email','item','store'].includes(key)?'wide':''}">${label}<input name="${key}" type="${type}" value="${escape(o[key])}" ${type==='number'?`min="${key==='quantity'?1:0}" step="1" max="${key==='quantity'?10000:10000000}"`:''} ${key==='store'?'':'required'}></label>`).join('')}</div><p class="footnote">同 Email ＋ 同團別自動合併。付款金額只填本筆分配到的款項，避免重複計算。</p><div id="form-error" class="error" role="alert"></div><div class="form-actions"><button type="button" class="secondary" data-action="close">取消</button><button class="primary" type="submit">儲存訂單</button></div></form>`);
}
function renderSources(){
 $('#view').innerHTML=heading('你的訂單，從這裡開始。','先試用整理流程，再接上實際資料。')+`<section class="card"><h2>Excel／CSV 匯入</h2><p>從 Google 表單下載回覆 CSV，或從回覆試算表下載 Excel，再對應欄位加入訂單。支援一列一項商品，或每種商品各一個數量欄的多商品表單。</p><button class="primary" data-action="import-file">選擇 Excel／CSV</button><p><a href="import-example.csv" download="艾麗莎-匯入範例.csv">下載測試用 CSV 範例</a></p><p class="footnote">支援 .xlsx 與 UTF-8 CSV，最多 5 MB。請保留唯一來源識別碼或時間戳記；同一份來源請固定使用相同名稱。</p></section><div class="grid2"><section class="card"><span class="badge neutral">第一版可用</span><h2>手動建立訂單</h2><p>輸入買家、商品與金額，立即測試加購合併、金額計算與異常提醒。</p>${addButton()}</section><section class="card" id="google-card"></section></div><section class="card"><h2>目前的資料</h2><p>${state.demo?'以示範資料為基礎，所有變更僅保存在目前的本機環境。':'使用本機資料，所有變更僅保存在目前的本機環境。'} 不會傳送至 Google 或賣貨便，也不會跨裝置同步。</p><div class="notice">請先使用測試資料體驗。本版尚未建置帳號登入、雲端備份與權限管理。</div></section>`;
 renderGoogleCard();
}
// ===== Google 表單自動更新（只有 EXE）=====
// 設定記在本機 tuantuan-google（表單 ID、來源名稱、團別、用題目名稱記的對應），不在 JSON 備份裡；token 在 main process。
const googleKey='tuantuan-google',GOOGLE_EVERY=5*60*1000;
let googleSetup=null,googleSyncing=false,googleTimer=null,googleLastError='';
const googleConfig=()=>{try{const c=JSON.parse(localStorage.getItem(googleKey));return c&&c.formId?c:null;}catch{return null;}};
const saveGoogleConfig=c=>{try{if(c)localStorage.setItem(googleKey,JSON.stringify(c));else localStorage.removeItem(googleKey);}catch{}};
async function renderGoogleCard(){
 const box=$('#google-card');if(!box)return;
 if(!desktop?.googleStatus){box.innerHTML='<span class="badge neutral">只有電腦版</span><h2>Google 表單自動更新</h2><p>有人填表單，艾麗莎就自動把訂單加進來。這個功能只有電腦版艾麗莎可以用。網頁版請用上面的 Excel／CSV 匯入。</p><button class="secondary" data-action="google-info">查看手動下載步驟</button>';return;}
 let st;try{st=await desktop.googleStatus();}catch(error){st={error:error.message};}
 if(!box.isConnected)return;
 const cfg=googleConfig(),last=cfg?.last;
 const step=(n,done,title,body)=>`<li class="gstep ${done?'done':''}"><span class="gnum">${done?icon('check'):n}</span><div><b>${title}</b>${body}</div></li>`;
 const ready=st.connected&&cfg;
 box.innerHTML=`<span class="badge ${ready?'':'amber'}">${ready?'自動更新中':'設定中'}</span><h2>Google 表單自動更新</h2><p>有人填表單，艾麗莎開著時每 5 分鐘自動把新訂單加進來。只會「讀」表單，不會改表單。</p>${st.error?`<div class="notice">${escape(st.error)}</div>`:''}
 ${ready?`<div class="gsync"><div><b>${escape(cfg.title)}</b><small>上次檢查：${last?.at?escape(when(last.at)):'還沒檢查'}${last&&!last.error?` · 表單共 ${last.count} 筆回覆${last.added?`，這次新增 ${last.added} 筆商品`:'，沒有新的'}`:''}</small></div><button class="primary" data-action="google-sync" ${googleSyncing?'disabled':''}>${googleSyncing?'更新中…':'立即更新'}</button></div>${last?.error?`<div class="notice">⚠ ${escape(last.error)}</div>`:''}${last?.edited?.length?`<div class="notice">⚠ 有 ${last.edited.length} 筆回覆在匯入後被買家修改過：${last.edited.map(escape).join('、')}。艾麗莎沒有自動改，請到訂單頁自己核對。</div>`:''}<p class="gactions"><button class="secondary" data-action="google-remap">重新設定對應</button> <button class="secondary danger" data-action="google-disconnect">中斷連接</button></p>`
 :`<ol class="gsteps">${step(1,st.hasClient,'選擇從 Google 下載的鑰匙檔',`<small>就是在 Google 按「下載 JSON」存下來的那個檔案。</small><button class="secondary" data-action="google-client">${st.hasClient?'換一個鑰匙檔':'選擇鑰匙檔'}</button>`)}
 ${step(2,st.connected,'用 Google 登入',`<small>會打開瀏覽器。如果看到「Google 尚未驗證這個應用程式」，點「繼續」；兩個權限都要勾。完成後回到艾麗莎。</small><button class="secondary" data-action="google-connect" ${st.hasClient?'':'disabled'}>${st.connected?'重新登入':'用 Google 登入'}</button>`)}
 ${step(3,false,'貼上表單的「編輯」網址',`<small>打開表單編輯頁，複製網址列（裡面有 /edit）。不是給買家填的網址。</small><div class="gform"><input id="google-url" aria-label="表單編輯網址" placeholder="https://docs.google.com/forms/d/…/edit" value="${escape(cfg?.url||'')}" ${st.connected?'':'disabled'}><button class="primary" data-action="google-read" ${st.connected?'':'disabled'}>讀取表單</button></div><div id="google-error" class="error" role="alert"></div>`)}</ol>`}`;
}
// 讀表單 → 進入跟 Excel 一樣的對應畫面
async function googleRead(url,button){
 const output=$('#google-error');
 let formId;try{formId=formIdFromUrl(url);}catch(error){if(output)output.textContent=error.message;else toast(error.message);return;}
 if(button){button.disabled=true;button.textContent='讀取中…';}
 const result=await desktop.googleFetch(formId);
 if(button&&button.isConnected){button.disabled=false;button.textContent='讀取表單';}
 if(result.error){if(output&&output.isConnected)output.textContent=result.error;else toast(result.error);if(result.reauth)renderGoogleCard();return;}
 let table;try{table=responsesToTable(result.form,result.responses);}catch(error){if(output)output.textContent=error.message;else toast(error.message);return;}
 const old=googleConfig(),same=old?.formId===formId;
 googleSetup={formId,url:String(url).trim(),title:table.title,sourceName:same?old.sourceName:'',saved:same?old:null};
 importPlan=null;importTable=table;
 modal('設定 Google 表單',`<p>表單「<b>${escape(table.title)}</b>」目前有 ${table.rows.length} 筆回覆。${table.rows.length?'':'還沒有人填也沒關係，可以先設定，之後有人填就會自動加進來。'}</p><div id="import-mapping"></div><div id="import-error" class="error" role="alert" style="white-space:pre-wrap"></div>`);
 showImportMapping(table);
}
// 自動／手動更新。有對話框開著時不自動套用（避免跟正在編輯的資料打架），下一輪再試
async function googleSync(manual=false){
 const cfg=googleConfig();if(!cfg||!desktop?.googleFetch||googleSyncing)return;
 if(!manual&&$('#dialog').open)return;
 googleSyncing=true;if(page==='sources')renderGoogleCard();
 const last={at:new Date().toISOString()};
 try{
  const result=await desktop.googleFetch(cfg.formId);
  if(result.error)throw new Error(result.error);
  const table=responsesToTable(result.form,result.responses);
  const {mapping,products}=namesToMapping(table.headers,cfg);mapping.rowId=0;
  const split=splitNew(state.orders,table,cfg.sourceName);
  last.count=table.rows.length;last.edited=split.edited.map(e=>e.name);last.added=0;
  if(split.table.rows.length){
   const plan=await planImport(state,split.table,mapping,cfg.sourceName,cfg.defaultCampaign,products);
   if(plan.added){
    if($('#dialog').open&&!manual)throw new Error('有視窗開著，這次先不加，關掉視窗後下一輪會自動加。');
    await runAutoBackup('before');
    plan.next.updatedAt=new Date().toISOString();state=restoreBackup(localStorage,state,plan.next);scheduleAutoBackup();
    last.added=plan.added;render();
    toast(`Google 表單有新訂單：加入 ${plan.added} 筆商品（${money(plan.total)}）。`);
   }
  }
  googleLastError='';
  if(manual&&!last.added)toast('已檢查，沒有新的回覆。');
 }catch(error){
  last.error=error.message;
  if(manual||googleLastError!==error.message)toast('Google 表單更新失敗：'+error.message.split('\n')[0]);
  googleLastError=error.message;
 }
 saveGoogleConfig({...cfg,last});
 googleSyncing=false;if(page==='sources')renderGoogleCard();
}
function startGoogleTimer(){clearInterval(googleTimer);googleTimer=null;if(desktop?.googleFetch&&googleConfig())googleTimer=setInterval(()=>googleSync(),GOOGLE_EVERY);}
// ===== 賺多少：成本、利潤、圖表（照美術稿「賺多少｜圖表規格 v1」，2026-10-13）=====
// profitView：'all' 全部、'compare' 自己挑幾團比、其他＝某一團；這些只記在畫面上，不存檔
// profitPoint：null＝預設（單一團時選那團，其他不選）、-1＝不選、數字＝點選的那團
// profitDraft：「自己挑來比」正在勾的（按完成才換圖）；profitRows：商品成本清單的順序，進來時排一次，填成本時不重排
let profitView='all',profitPick=null,profitDraft=null,profitPoint=null,profitLine=null,profitRows=null,profitMissingFirst=false,profitAllRows=false;
const MAX_PICK=8;
const narrow=()=>matchMedia('(max-width:760px)').matches;
const shortDate=d=>d?Number(d.slice(5,7))+'/'+Number(d.slice(8,10)):'';
const checkMark='<svg class="pill-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
const chevron='<svg class="pill-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function profitData(){
 const all=profitReport(state.orders,allGroups(),state),names=all.map(c=>c.campaign);
 if(!['all','compare'].includes(profitView)&&!names.includes(profitView))profitView='all';
 if(profitView==='compare'&&all.length<3)profitView='all';
 profitPick=new Set([...(profitPick||[])].filter(c=>names.includes(c)));
 if(profitPick.size<2)profitPick=new Set(names.slice(-3));
 const chosen=profitView==='all'?all:profitView==='compare'?all.filter(c=>profitPick.has(c.campaign)):all.filter(c=>c.campaign===profitView);
 // 只有一團時，「全部」就是那一團：直接給商品明細
 return {all,chosen,one:['all','compare'].includes(profitView)?(all.length===1?all[0]:null):chosen[0]};
}
function setProfitView(view){
 profitView=view;profitPoint=null;profitRows=null;profitMissingFirst=false;profitAllRows=false;profitDraft=null;
 if(view==='compare')profitDraft=new Set(profitData().chosen.map(c=>c.campaign));
 renderProfit();
}
function renderProfit(){
 // 重畫前記住游標在哪一格（填完成本按 Tab 跳下一格時不要跳掉）
 const active=document.activeElement,keep=active?.dataset&&['cost','date','pick'].find(k=>active.dataset[k]!==undefined),keepValue=keep&&active.dataset[keep];
 const {all,chosen,one}=profitData(),sum=profitTotal(chosen);
 const head=heading('賺多少','看每一團收了多少、花了多少、賺了多少。');
 if(!all.length){$('#view').innerHTML=head+`<section class="card"><div class="empty-art">${emptyArt('orders')}<b>還沒有訂單</b><p>匯入第一團訂單後，這裡會算出每一團賺多少。</p></div></section>`;return;}
 $('#view').innerHTML=head+`<p class="footnote profit-note">只有你看得到：成本和利潤不會出現在整單摘要 CSV 和給買家的訊息裡（會跟著資料備份一起存）。收入＝買家該付的商品金額，含待確認、不含取消和運費，不是已經收到的錢。</p>
  ${profitPills(all)}${profitView==='compare'?pickPanel(all):''}
  ${sum.missing?`<div class="alert profit-alert" role="status">${icon('alert')}<span><b>還有 ${sum.missing} 個商品沒填成本。</b>成本可能算少了，利潤可能算多了。</span><button class="dark" data-action="profit-fill">去填成本</button></div>`:''}
  ${profitCards(sum,chosen,one)}
  <section class="card trend-card"><div class="card-title"><div><h2>每一團賺多少</h2><p class="chart-sub">${profitLineList(all,chosen,one).length>1?'照開團日期排　·　點一團看詳細數字':escape(chosen[0]?.campaign||'')+(chosen[0]?.date?'　·　'+shortDate(chosen[0].date)+' 開團':'')}</p></div><div class="chart-legend">${lineSeries.map(([,label,cls])=>`<span>${legendKey(cls)}${label}</span>`).join('')}</div></div><div id="line-box" class="line-box" tabindex="0"></div><p id="trend-hint" class="chart-sub m-only" hidden>← 往左滑看更早的團（打開時停在最新一團）</p><div id="line-readout" class="readout" aria-live="polite"></div></section>
  <div class="grid2 profit-charts"><section class="card"><h2>利潤從哪裡來</h2>${shareSection(all,chosen,one)}</section>${expenseCard(chosen,one)}</div>
  ${costCard(chosen,one)}${one?'':campaignCard(chosen)}`;
 const list=profitLineList(all,chosen,one);
 profitLine={list,selected:profitPoint===-1?null:profitPoint!==null&&profitPoint<list.length?profitPoint:one?list.indexOf(one):null};
 drawProfitLine();fitPills();
 if(keep){const el=[...document.querySelectorAll(`[data-${keep}]`)].find(el=>el.dataset[keep]===keepValue);el?.focus();}
}
// 折線圖畫哪幾團：看單一團時畫全部（那團選起來），其他照選的
const profitLineList=(all,chosen,one)=>one?all:chosen;
// 上方選擇：「全部」永遠最左；電腦版放最新的團到快超出寬度，剩下的收進「更多 N 團」；手機一排左右滑
function profitPills(all){
 const pill=(value,label,cls='')=>{const on=profitView===value;return `<button class="pill${cls}${on?' on':''}" data-profit="${escape(value)}" aria-pressed="${on}" title="${escape(label)}">${on&&cls===' grp'?checkMark:''}<span>${escape(label)}</span></button>`;};
 return `<div class="profit-bar"><div class="profit-pills" role="group" aria-label="選擇要看的團">${pill('all','全部')}${all.map(c=>pill(c.campaign,c.campaign,' grp')).join('')}<button class="pill more" data-action="profit-menu" aria-expanded="false" hidden>更多</button>${all.length>2?`<span class="pill-sep" aria-hidden="true"></span>${pill('compare','自己挑來比',' cmp')}`:''}</div><span class="pills-fade" aria-hidden="true"></span><div id="profit-menu" class="profit-menu" hidden></div></div><div class="pills-hint" hidden><span>共 ${all.length} 團，往左滑看更多</span><button class="link" data-action="profit-menu" aria-expanded="false">全部列出${chevron}</button></div>`;
}
function fitPills(){
 const row=$('.profit-pills');if(!row)return;
 const pills=[...row.querySelectorAll('.pill.grp')],more=row.querySelector('.more'),hint=$('.pills-hint'),on=row.querySelector('.pill.on');
 pills.forEach(b=>b.hidden=false);more.hidden=true;
 if(narrow()){
  // 手機：選取中的那顆自動捲到看得見的位置（第二顆）
  if(on)row.scrollLeft=Math.max(0,on.offsetLeft-row.firstElementChild.offsetWidth-24);
  hint.hidden=row.scrollWidth<=row.clientWidth+1;
  $('.profit-bar').classList.toggle('scrolls',!hint.hidden);
  return;
 }
 hint.hidden=true;$('.profit-bar').classList.remove('scrolls');
 if(row.scrollWidth<=row.clientWidth+1)return;
 more.hidden=false;more.innerHTML=`更多 ${pills.length} 團${chevron}`;
 let room=row.clientWidth-[...row.children].filter(el=>!el.classList.contains('grp')).reduce((n,el)=>n+el.offsetWidth+8,0);
 const keep=new Set(),mine=pills.find(b=>b.classList.contains('on'));
 // 選取中的那顆不管多舊都留在外面；其餘從最新的往前放，放不下就停
 if(mine){keep.add(mine);room-=mine.offsetWidth+8;}
 for(const b of [...pills].reverse()){if(keep.has(b))continue;if(b.offsetWidth+8>room)break;keep.add(b);room-=b.offsetWidth+8;}
 pills.forEach(b=>b.hidden=!keep.has(b));
 more.innerHTML=`更多 ${pills.length-keep.size} 團${chevron}`;
}
function openProfitMenu(button){
 const menu=$('#profit-menu');if(!menu)return;
 if(!menu.hidden){closeProfitMenu();return;}
 const {all}=profitData(),hidden=new Set([...document.querySelectorAll('.profit-pills .pill.grp[hidden]')].map(b=>b.dataset.profit));
 const list=[...all].reverse().filter(c=>narrow()||hidden.has(c.campaign));
 menu.innerHTML=`<label class="menu-search">${icon('search')}<input id="profit-menu-q" type="search" placeholder="找團名" aria-label="找團名" autocomplete="off"></label><ul>${list.map(c=>`<li><button data-profit="${escape(c.campaign)}" class="${profitView===c.campaign?'on':''}"><span>${escape(c.campaign)}</span><small>${shortDate(c.date)}</small></button></li>`).join('')}</ul><p class="menu-empty" hidden>找不到這個團名</p>`;
 menu.style.left=narrow()?'':Math.max(0,Math.min(button.offsetLeft,$('.profit-bar').clientWidth-300))+'px';
 menu.hidden=false;document.querySelectorAll('[data-action="profit-menu"]').forEach(b=>b.setAttribute('aria-expanded','true'));
 if(!narrow())$('#profit-menu-q').focus();
}
function closeProfitMenu(){const menu=$('#profit-menu');if(!menu||menu.hidden)return;menu.hidden=true;document.querySelectorAll('[data-action="profit-menu"]').forEach(b=>b.setAttribute('aria-expanded','false'));}
// 自己挑來比：可勾選的按鈕，最少 2 團、最多 8 團；手機從下方滑出
function pickPanel(all){
 if(!profitDraft)return `<div class="pick-summary"><span>正在比 <b>${profitPick.size}</b> 團</span><button class="link" data-action="profit-repick">改挑選</button></div>`;
 const n=profitDraft.size,box=on=>on?'<svg class="pick-box" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" class="pick-on"/><path d="M7.5 12l3 3 6-6.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>':'<svg class="pick-box" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4.5" class="pick-off"/></svg>';
 return `<button class="sheet-backdrop" data-action="profit-pick-cancel" aria-label="關閉挑選" tabindex="-1"></button><div class="pick-panel" role="group" aria-label="自己挑來比"><div class="sheet-grip" aria-hidden="true"></div><div class="pick-head"><span><b>自己挑來比</b>　<span class="muted">已選 ${n} 團（最多 ${MAX_PICK} 團）</span></span><span class="pick-actions"><button class="pill" data-action="profit-pick-clear">清除</button><button class="pill on" data-action="profit-pick-done" ${n<2?'disabled':''}>完成</button></span></div><div class="pick-list">${[...all].reverse().map(c=>{const on=profitDraft.has(c.campaign);return `<button class="pick${on?' on':''}" data-pick="${escape(c.campaign)}" aria-pressed="${on}">${box(on)}<span>${escape(c.campaign)}</span><small>${shortDate(c.date)}</small></button>`;}).join('')}</div>${n<2?'<p class="pick-hint">至少挑 2 團才能比</p>':''}<button class="primary full pick-go" data-action="profit-pick-done" ${n<2?'disabled':''}>比較這 ${n} 團</button></div>`;
}
// 四張數字卡：虧錢時利潤、賺幾成換淡紅底＋「▼ 虧錢」；還有商品沒填成本時大數字前面加「至少／最多」
function profitCards(sum,chosen,one){
 const miss=sum.missing>0,loss=sum.profit<0,m=sum.margin;
 const pre=t=>`<small class="pre">${t}</small>`,cur='<small class="pre cur">NT$</small>';
 const scope=one?`${one.buyers} 人下單`:`${profitView==='compare'?'挑的 ':''}${chosen.length} 團合計`;
 const costSub=miss?`<span class="tag-miss">! ${sum.missing} 項未填</span>`:loss?`比收入多 ${fmt(-sum.profit)}`:sum.extra?`商品 ${fmt(sum.itemCost)}＋其他花費 ${fmt(sum.extra)}`:'商品成本';
 const lossTag='<span class="tag-loss">▼ 虧錢</span>';
 const profitSub=miss?(loss?lossTag+'填完成本才準':'填完成本才準'):loss?lossTag+(one?'<button class="link" data-action="profit-to-costs">看哪些商品虧</button>':'收入 − 成本'):sum.profit>0?'<span class="tag-gain">▲ 賺錢</span>收入 − 成本':'打平，沒賺也沒虧';
 const per=m===null?'還沒有收入':`<span>每收 100 元，${m<0?'<b>虧</b>':'賺'} ${Math.abs(Math.round(m*100))} 元</span>`;
 return `<div class="stats profit-stats">
  <div class="stat"><div class="stat-top">${legendKey('rev')}收入</div><strong>${cur}${fmt(sum.revenue)}</strong><small>${scope}</small></div>
  <div class="stat"><div class="stat-top">${legendKey('cost')}成本</div><strong>${miss?pre('至少'):cur}${fmt(sum.cost)}</strong><small>${costSub}</small></div>
  <div class="stat${loss?' loss':''}"><div class="stat-top">${legendKey('profit',loss)}利潤</div><strong>${miss?pre('最多'):cur}${fmt(sum.profit)}</strong><small>${profitSub}</small></div>
  <div class="stat${loss?' loss':''}"><div class="stat-top">賺幾成</div><strong>${miss?pre('最多'):''}${pct1(m)}</strong><small>${miss?'填完成本才準':per}</small></div></div>`;
}
// 每一團賺多少：1 團畫三根直條，2 團以上畫折線；點一團，下面出現那團的明細
function drawProfitLine(){
 const box=$('#line-box');if(!box||!profitLine)return;
 const {list,selected}=profitLine,mobile=narrow();
 if(list.length===1){
  box.innerHTML=`<div class="bars-wrap">${barsChart(list[0],{width:mobile?box.clientWidth:Math.min(box.clientWidth,460),mobile})}<p class="bars-note">現在只有一團，所以先用直條看收入、成本、利潤。<button class="link" data-action="sources">再匯入一團</button>，這裡就會變成折線，看出每一團的變化。</p></div>`;
  box.removeAttribute('tabindex');$('#line-readout').innerHTML='';$('#trend-hint').hidden=true;return;
 }
 const losing=list.filter(c=>c.profit<0),label=`每一團賺多少，共 ${list.length} 團`+(losing.length?'；'+losing.map(c=>`${c.campaign}虧 ${Math.abs(c.profit).toLocaleString('en-US')} 元`).join('、'):'')+'。用左右鍵換團。';
 box.setAttribute('tabindex','0');box.setAttribute('aria-label',label);
 box.innerHTML=trendChart(list.map(c=>({label:c.campaign,date:c.date,revenue:c.revenue,cost:c.cost,profit:c.profit})),{width:box.clientWidth,mobile,selected,label});
 const scroll=box.querySelector('.trend-scroll'),wrap=box.querySelector('.trend'),scrolls=scroll.scrollWidth>scroll.clientWidth+1;
 $('#trend-hint').hidden=!scrolls;
 if(scrolls){
  // 打開時捲到最新一團；有選的話捲到選的那團
  const col=scroll.scrollWidth/list.length,at=selected??list.length-1;
  scroll.scrollLeft=Math.max(0,Math.min(scroll.scrollWidth-scroll.clientWidth,col*(at+1)-scroll.clientWidth+col));
  const edge=()=>{wrap.classList.toggle('at-end',scroll.scrollLeft+scroll.clientWidth>=scroll.scrollWidth-2);wrap.classList.toggle('at-start',scroll.scrollLeft<=2);};
  edge();scroll.addEventListener('scroll',edge,{passive:true});
 }
 const c=selected===null?null:list[selected];
 $('#line-readout').innerHTML=c?`<div class="detail-row"><div class="detail-name"><b>${escape(c.campaign)}</b><small>${c.date?shortDate(c.date)+' 開團　·　':''}${c.buyers} 人　·　${c.items.length} 個商品</small></div><dl><div><dt>收入</dt><dd>${fmt(c.revenue)}</dd></div><div><dt>成本</dt><dd>${fmt(c.cost)}</dd></div><div><dt>利潤</dt><dd>${fmt(c.profit)}${c.profit<0?' <span class="tag-loss">▼ 虧錢</span>':''}</dd></div><div><dt>賺幾成</dt><dd>${pct1(c.margin)}</dd></div></dl><button class="close" data-action="profit-unpick" aria-label="取消選取">×</button></div>`:`<p class="readout-hint">點一團看詳細數字${mobile?'':'（也可以按 Tab 進到圖上，用 ← → 換團）'}</p>`;
}
function pickPoint(i){
 if(!profitLine||profitLine.list.length<2)return;
 profitPoint=profitLine.selected=i===profitLine.selected||i===null?-1:i;
 if(profitPoint===-1)profitLine.selected=null;
 drawProfitLine();
}
// 利潤從哪裡來（只算賺錢的項目）：1–5 項圓圈、6–10 項橫條、11 項以上前 10 名＋其他；虧錢的不畫，下面另寫一行
function shareSection(all,chosen,one){
 // 單一團：還沒填成本的商品利潤會算太多，先不畫，下面另外寫
 const entries=one?one.items.map((it,i)=>({label:it.item,value:it.profit,color:chartColor(i),missing:it.cost===undefined})).filter(e=>!e.missing):chosen.map(c=>({label:c.campaign,value:c.profit,color:chartColor(all.indexOf(c))}));
 const unfilled=one?one.missing:0;
 const gain=entries.filter(e=>e.value>0),lose=entries.filter(e=>e.value<0),total=gain.reduce((n,e)=>n+e.value,0),mode=shareMode(gain.length);
 const what=one?'商品':'團',loseSum=lose.reduce((n,e)=>n+e.value,0);
 if(!entries.length)return unfilled?`<div class="empty-art">${emptyArt('export')}<b>還沒填成本</b><p>填好商品成本後，這裡會畫出利潤從哪個商品來。</p><button class="secondary" data-action="profit-fill">去填成本</button></div>`:`<div class="empty-art">${emptyArt('export')}<b>這團目前沒有有效的商品</b><p>商品都取消了，沒有利潤可以分。</p></div>`;
 if(mode==='empty')return `<div class="empty-art share-empty">${emptyArt('export')}<b>${one?'這一團的商品都沒賺到錢':'這幾團都沒賺到錢'}</b><p>${one?`${entries.length} 個商品的成本都不比售價低`:'每一團的成本都不比收入低'}，所以沒有利潤可以分。看看成本有沒有填錯，或下次調整售價。</p><button class="secondary" data-action="profit-to-costs">看商品成本清單</button></div>`;
 const sub=mode==='donut'?(one?'每個商品佔多少':'每一團佔多少（只算賺錢的團）'):mode==='bars'?`${gain.length} 個${what}，由多到少`:`${gain.length} 個${what}，前 10 名`;
 let body;
 if(mode==='donut')body=`<div class="donut-wrap">${donutChart(gain,{label:one?'商品利潤':`${gain.length} 團賺了`,size:narrow()?160:200})}<ul class="donut-legend">${gain.map(p=>`<li><i class="key" style="background:${p.color}"></i><span>${escape(p.label)}</span><b class="num">${fmt(p.value)}</b><small class="num">${pct1(p.value/total)}</small></li>`).join('')}</ul></div>`;
 else{
  const {rows,rest}=rankRows(gain);
  const top=rest?`<div class="rank-sum"><span>前 10 名 佔 <b>${pct1(rows.reduce((n,e)=>n+e.value,0)/total)}</b></span><span>其他 ${rest.count} 項 佔 <b>${pct1(rest.value/total)}</b></span></div>`:'';
  body=top+rankList(rows,{total,rest})+(gain.length>5?`<button class="link rank-more m-only" data-action="profit-rank-more">再看 ${Math.min(rows.length,10)-5} 名（共 ${gain.length} 項）</button>`:'')+(rest?`<button class="link rank-all" data-action="profit-rank-all">看全部 ${gain.length} 項</button>`:'');
 }
 const loseNote=lose.length?`<p class="loss-note">▼ ${!one&&lose.length===1?`${escape(lose[0].label)}虧 ${Math.abs(lose[0].value).toLocaleString('en-US')} 元，沒有畫進圖裡。<button class="link" data-profit="${escape(lose[0].label)}">看是哪些商品虧</button>`:`另有 ${lose.length} 個${what}虧錢，共 ${fmt(loseSum)} 元，沒有算進來。`}</p>`:'';
 const missNote=unfilled?`<p class="loss-note">! 另有 ${unfilled} 個商品還沒填成本，沒有算進來。<button class="link" data-action="profit-fill">去填成本</button></p>`:'';
 return `<p class="chart-sub">${one?escape(one.campaign)+'　·　':''}${sub}</p>${body}${loseNote}${missNote}${one&&one.extra?`<p class="footnote">這是商品本身的利潤，還沒扣其他花費 ${money(one.extra)}。</p>`:''}`;
}
// 「看全部 N 項」：彈出視窗列出全部（由多到少）
function shareAllModal(){
 const {chosen,one}=profitData(),entries=one?one.items.filter(it=>it.cost!==undefined).map(it=>({label:it.item,value:it.profit})):chosen.map(c=>({label:c.campaign,value:c.profit}));
 const gain=entries.filter(e=>e.value>0),total=gain.reduce((n,e)=>n+e.value,0);
 modal(`利潤從哪裡來（全部 ${gain.length} 項）`,`<div class="rank-all-list">${rankList(rankRows(gain,Infinity).rows,{total})}</div>`);
}
// 商品成本：依利潤由少到多（按「去填成本」時沒填的排最前面）；超過 12 項先列 10 項
function costRows(chosen){
 const rows=chosen.flatMap(c=>c.items.map(it=>({...it,campaign:c.campaign,key:itemKey(c.campaign,it.item)})));
 if(!profitRows){
  const missing=r=>r.cost===undefined?0:1;
  profitRows=[...rows].sort((a,b)=>(profitMissingFirst?missing(a)-missing(b):0)||a.profit-b.profit).map(r=>r.key);
 }
 const pos=new Map(profitRows.map((k,i)=>[k,i]));
 return rows.sort((a,b)=>(pos.get(a.key)??1e9)-(pos.get(b.key)??1e9));
}
function costCard(chosen,one){
 const rows=costRows(chosen),many=!one,show=rows.length>12&&!profitAllRows?10:rows.length;
 const cell=it=>it.cost===undefined?'<span class="muted">還沒填</span>':it.profit<0?`<span class="neg">▼ ${fmt(it.profit)}</span>`:fmt(it.profit);
 const row=it=>`<div class="cost-row${many?' many':''}"><div class="cost-name"><b>${escape(it.item)}</b><small class="m-only">售價 ${it.prices.map(p=>p.toLocaleString('en-US')).join('／')} × 賣出 ${it.quantity.toLocaleString('en-US')}</small>${many?`<small class="m-only">${escape(it.campaign)}</small>`:''}</div>${many?`<span class="cost-camp d-only">${escape(it.campaign)}</span>`:''}<span class="num d-only">${it.prices.map(p=>p.toLocaleString('en-US')).join('／')}</span><span class="num d-only">${it.quantity.toLocaleString('en-US')}</span><label class="cost-input"><span class="m-only">成本</span><input type="number" inputmode="numeric" min="0" max="10000000" step="1" placeholder="還沒填" data-cost="${escape(it.key)}" value="${it.cost??''}" aria-label="${escape(it.item)} 每件成本"></label><span class="num cost-profit"><span class="m-only">利潤 </span>${cell(it)}</span></div>`;
 return `<section class="card" id="cost-card"><div class="card-title"><div><h2>商品成本</h2><p class="chart-sub">填每一件的進貨價，利潤會自動算；填一次就好，之後重新匯入也會記得。</p></div>${one?`<label class="buy-input">開團日期<input type="date" data-date="${escape(one.campaign)}" value="${escape(one.date)}" aria-label="${escape(one.campaign)} 開團日期"></label>`:''}</div>${rows.length?`<p class="chart-sub cost-count">共 ${rows.length} 個商品，${profitMissingFirst?'沒填成本的排最前面':'依利潤由少到多'}</p><div class="cost-table"><div class="cost-row cost-head${many?' many':''} d-only" aria-hidden="true"><span>商品</span>${many?'<span>哪一團</span>':''}<span class="num">售價</span><span class="num">賣出</span><span class="num">成本（每件）</span><span class="num">利潤</span></div>${rows.slice(0,show).map(row).join('')}</div>${show<rows.length?`<button class="secondary full" data-action="profit-all-rows">看全部 ${rows.length} 個商品</button>`:''}`:'<p class="footnote">這團目前沒有有效的商品（都取消了）。</p>'}</section>`;
}
// 其他花費：運費、包材這些不是商品的錢；看全部或比較時，加一筆要選是哪一團的
function expenseCard(chosen,one){
 const list=chosen.flatMap(c=>c.expenses.map(e=>({...e,campaign:c.campaign}))),extra=chosen.reduce((n,c)=>n+c.extra,0);
 return `<section class="card"><h2>其他花費</h2><p class="chart-sub">運費、包材這些不是商品的錢，會從利潤扣掉。</p><div class="expense-list">${list.map(e=>`<div class="preview-row"><div>${escape(e.label)}${one?'':`<small>${escape(e.campaign)}</small>`}</div><div class="expense-right"><b class="num">${fmt(e.amount)}</b><button class="link" data-expense-del="${escape(e.id)}" aria-label="刪除 ${escape(e.label)}">刪除</button></div></div>`).join('')||'<p class="footnote">還沒有其他花費。</p>'}</div><div class="expense-add${one?'':' pick-camp'}">${one?'':`<select id="expense-campaign" aria-label="這筆是哪一團的">${[...chosen].reverse().map(c=>`<option value="${escape(c.campaign)}">${escape(c.campaign)}</option>`).join('')}</select>`}<input id="expense-label" maxlength="100" placeholder="項目，例如：國際運費" aria-label="花費名稱"><input id="expense-amount" type="number" inputmode="numeric" min="0" max="10000000" step="1" placeholder="金額" aria-label="花費金額"><button class="secondary" data-action="add-expense">${icon('plus')}加一筆</button></div><div id="expense-error" class="error" role="alert"></div><div class="export-total"><span>合計</span><span>${money(extra)}</span></div></section>`;
}
function campaignCard(list){
 return `<section class="card"><h2>${profitView==='compare'?'挑的這幾團':'每一團'}</h2><p class="chart-sub">點團名可以只看那一團。開團日期填了，圖上就照日期排；沒填的照匯入先後排在後面。</p><div class="buy-list profit-list">${list.map(c=>`<div class="buy-row"><div class="buy-name"><button class="link-name" data-profit="${escape(c.campaign)}">${escape(c.campaign)}</button><small>收入 ${fmt(c.revenue)} · 成本 ${fmt(c.cost)}${c.missing?` · <span class="warn-inline">${c.missing} 個商品沒填成本</span>`:''}</small></div><label class="buy-input">開團<input type="date" data-date="${escape(c.campaign)}" value="${escape(c.date)}" aria-label="${escape(c.campaign)} 開團日期"></label><span class="buy-status"><span class="${c.profit<0?'neg':'num'}">${c.profit<0?'▼ ':''}${fmt(c.profit)}</span><small class="muted">賺幾成 ${pct1(c.margin)}</small></span></div>`).join('')}</div></section>`;
}
// 點折線圖的某一團（點那團整欄任何地方都算）；鍵盤：← → 換團、Esc 取消
document.addEventListener('click',event=>{
 const hit=event.target.closest?.('[data-point]');if(hit)pickPoint(Number(hit.dataset.point));
 if(!event.target.closest?.('.profit-bar,.pills-hint'))closeProfitMenu();
});
document.addEventListener('keydown',event=>{
 if(page!=='profit')return;
 const menu=$('#profit-menu');
 if(event.key==='Escape'&&menu&&!menu.hidden){closeProfitMenu();return;}
 if(event.target.id!=='line-box'||!profitLine||profitLine.list.length<2)return;
 const n=profitLine.list.length,at=profitLine.selected;
 if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();pickPoint(at===null?(event.key==='ArrowRight'?0:n-1):Math.max(0,Math.min(n-1,at+(event.key==='ArrowRight'?1:-1))));$('#line-box').focus();}
 if(event.key==='Escape'&&at!==null){pickPoint(null);$('#line-box').focus();}
});
document.addEventListener('input',event=>{
 if(event.target.id!=='profit-menu-q')return;
 const q=event.target.value.trim().toLowerCase(),items=[...document.querySelectorAll('#profit-menu li')];
 for(const li of items)li.hidden=!!q&&!li.textContent.toLowerCase().includes(q);
 $('#profit-menu .menu-empty').hidden=items.some(li=>!li.hidden);
});
let resizeFrame;addEventListener('resize',()=>{if(page!=='profit')return;cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{drawProfitLine();fitPills();});});
function renderExport(){
 const gs=groups(),ready=gs.filter(g=>g.active&&!g.issues.length),blocked=gs.filter(g=>g.issues.length).length;
 $('#view').innerHTML=heading('出發前，再確認一次。','預覽整理好的買家清單與金額。')+`<div class="section-top"><h2>匯出範圍</h2>${campaignSelect()}</div><div class="notice">目前可下載「整單摘要 CSV」，可用 Excel 開啟。這不是賣貨便正式匯入檔；取得官方範本後才能完成格式對接。金額未含運費。</div><div class="grid2" style="margin-top:20px"><section class="card"><h2>本次可匯出 ${ready.length} 份</h2>${ready.map(g=>`<div class="preview-row"><div>${escape(g.name)}<small>${escape(g.campaign)} · ${g.quantity} 件</small></div><b>${money(g.total)}</b></div>`).join('')||`<div class="empty-art">${emptyArt('export')}<b>目前沒有可匯出的清單</b><p>處理完「待確認」的買家，就會出現在這裡。</p></div>`}<div class="export-total"><span>商品總額</span><span>${money(ready.reduce((n,g)=>n+g.total,0))}</span></div><button class="primary full" data-action="download" ${ready.length?'':'disabled'}>${icon('export')}下載整單摘要 CSV</button><p class="footnote">${blocked} 份待確認清單會排除。重複下載只會產生摘要，不會建立賣貨便訂單。</p></section><section class="card"><h2>摘要下載紀錄</h2>${state.history.length?state.history.slice(0,5).map(h=>`<div class="preview-row"><div>${escape(h.count)} 份清單<small>${escape(new Date(h.at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}))}</small></div><span class="badge neutral">已產生</span></div>`).join(''):`<div class="empty-art">${emptyArt('history')}<b>還沒有下載紀錄</b><p>下載過摘要後，這裡會記下時間和份數。</p></div>`}<p class="footnote">紀錄代表已產生下載檔案，不代表訂單已匯入、付款或出貨。</p></section></div>${itemSection(gs)}`;
}
function itemSection(gs){
 const totals=itemTotals(gs);
 return `<section class="card" style="margin-top:20px"><h2>叫貨統計</h2><p class="footnote">每種商品一共要準備幾件，方便跟廠商叫貨。已取消的不算；有「待確認」的件數會標出，可能含重複填單，叫貨前建議先處理。</p>${totals.map(t=>`<div class="preview-row"><div>${escape(t.item)}<small>${campaign==='all'?escape(t.campaign)+' · ':''}${t.buyers} 位買家 · 單價 ${t.prices.map(p=>p.toLocaleString('en-US')).join('／')}${t.prices.length>1?'（單價不一，請核對）':''} · ${money(t.amount)}</small></div><div class="item-count"><b>${t.quantity.toLocaleString('en-US')} 件</b>${t.pendingQuantity?`<small class="badge amber">含待確認 ${t.pendingQuantity}</small>`:''}</div></div>`).join('')||`<div class="empty-art">${emptyArt('export')}<b>目前沒有商品要叫貨</b></div>`}<button class="secondary full" data-action="download-items" ${totals.length?'':'disabled'}>${icon('export')}下載叫貨統計 CSV</button></section>`;
}
async function renderBackupStatus(){
 const box=$('#backup-status');if(!box)return;
 if(!desktop?.backupInfo){box.innerHTML='<p class="footnote">網頁版沒有自動備份，請定期按「下載資料備份」。</p>';return;}
 let info;try{info=await desktop.backupInfo();}catch(error){info={error:error.message};}
 if(!box.isConnected)return;
 const failed=backupStatus.error||info.error;
 box.innerHTML=`<h3>自動備份 <span class="badge ${failed?'amber':''}">${failed?'上次失敗':'已開啟'}</span></h3><p class="footnote">每次修改後自動存一份「最新」，每天另外留一份（保留 30 天）；清空、重設、還原、匯入前也會先存一份。</p><p class="footnote">位置：${escape(info.dir||'讀取失敗')}<br>最近一次：${info.latestAt?escape(when(info.latestAt)):'尚未備份'} · 共 ${info.count||0} 個備份檔${failed?`<br>失敗原因：${escape(failed)}`:''}</p><p><button class="secondary" data-action="open-backup-dir">打開備份資料夾</button> <button class="secondary" data-action="choose-backup-dir">更換位置</button></p><p class="footnote">想要雲端備份：把位置改到 OneDrive 或 Google 雲端硬碟同步的資料夾。備份含買家個資，請勿放在和別人共用的資料夾。要還原時，用下方「從 JSON 備份還原」選擇備份檔。</p>`;
}
function renderSettings(){
 $('#view').innerHTML=heading('簡單設定，安心整單。','先把規則講清楚，每一筆才算得準。')+`<div class="grid2"><section class="card"><h2>目前的整單規則</h2><ol class="steps"><li>以 Email ＋ 團別辨認同一份清單</li><li>Email 忽略前後空白及大小寫</li><li>商品總額＝各筆單價 × 數量</li><li>待付金額＝商品總額 − 已付金額</li><li>不同門市或疑似重複需人工確認</li><li>取消的商品保留原始資料，不計入金額與匯出，可以恢復</li></ol><p>取消不會自動退款；已付款的取消商品需核對退款後才能匯出。</p><p>本版暫不計算運費、折扣、平台費用。</p></section><section class="card"><h2>本機資料管理</h2><p>訂單僅儲存在目前的本機環境。清除應用程式或瀏覽器資料會遺失紀錄，請先下載備份。</p><button class="secondary" data-action="backup">下載資料備份</button><div id="backup-status" class="backup-status"></div><p><button class="secondary" data-action="restore">從 JSON 備份還原</button></p><p><button class="secondary" data-action="recover">回復上次匯入／還原前資料</button></p><p class="footnote">還原會取代全部訂單與確認紀錄，不會合併。成功前會保留一份本機回復點；回復點不是雲端備份。</p><p>想用自己的測試資料從零開始？</p><button class="secondary" data-action="clear">清空並開始使用</button><p>或重新載入最初的範例，體驗異常處理。</p><button class="secondary" data-action="reset">重設示範資料</button></section></div><section class="card"><h2>外觀風格</h2><p>選一個你喜歡的樣子，只改顏色和圓角，不會動到訂單。這個選擇只記在這台電腦。</p><div class="themes" role="radiogroup" aria-label="外觀風格">${themes.map(([key,name,desc,colors])=>`<button class="theme-option ${currentTheme===key?'selected':''}" role="radio" aria-checked="${currentTheme===key}" data-theme-pick="${key}"><span class="swatch">${colors.map(c=>`<i style="background:${c}"></i>`).join('')}</span><b>${name}</b><small>${desc}</small></button>`).join('')}</div><h3 class="setting-sub">字體大小</h3><div class="sizes" role="radiogroup" aria-label="字體大小">${sizes.map(([key,name,desc])=>`<button class="theme-option size-option ${currentSize===key?'selected':''}" role="radio" aria-checked="${currentSize===key}" data-size-pick="${key}"><b class="size-sample ${key}">${name}<span>艾麗莎整單</span></b><small>${desc}</small></button>`).join('')}</div></section><section class="card"><h2>產品進度</h2><p>已可操作：訂單新增與修改、合單加總、異常確認、摘要下載、Google 表單自動更新（只有電腦版，測試中）。<br>待建置：賣貨便格式對接、線上啟用、雲端帳號，以及 iPhone 打包與上架。</p></section>`;
 renderBackupStatus();
}
const columnOptions=(selected,empty)=>`<option value="-1">${empty}</option>`+importTable.headers.map((header,index)=>`<option value="${index}" ${selected===index?'selected':''}>${escape(header)}（${escape(importTable.rows[0].values[index].slice(0,30))}）</option>`).join('');
const pickHint=index=>{const n=index>=0?pickTimes(importTable.headers[index]):0;return n?`勾選款式：每勾一個算 ${n} 件，會分開記成「商品（款式）」`:'';};
const productRow=p=>`<div class="product-row"><label class="field">商品名稱<input data-product="name" maxlength="500" value="${escape(p.name)}" placeholder="例如：帆布袋"></label><label class="field">數量欄位<select data-product="quantity">${columnOptions(p.quantity,'請選擇欄位')}</select></label><label class="field">單價（NT$）<input data-product="price" inputmode="numeric" value="${escape(p.price)}" placeholder="150"></label><button class="secondary remove" data-action="remove-product" aria-label="移除這項商品">移除</button><small class="pick-hint">${pickHint(p.quantity)}</small></div>`;
function readProducts(){return [...document.querySelectorAll('.product-row')].map(row=>({name:row.querySelector('[data-product=name]').value,quantity:Number(row.querySelector('[data-product=quantity]').value),price:row.querySelector('[data-product=price]').value}));}
function showImportMapping(table){
 $('#import-mapping').innerHTML='';
 importTable=table||readTable(globalThis.XLSX,importBook,$('#import-sheet').value);
 if(!table)googleSetup=null;
 let mapping=guessMapping(importTable.headers),source='',defaultCampaign='',products=guessProducts(importTable.headers),multi=products.length>0&&mapping.item<0;
 try{const saved=JSON.parse(localStorage.getItem('tuantuan-import-mapping'));if(saved&&JSON.stringify(saved.headers)===JSON.stringify(importTable.headers)){mapping=saved.mapping;source=saved.source;defaultCampaign=saved.defaultCampaign;if(Array.isArray(saved.products)){multi=saved.products.length>0;if(multi)products=saved.products;}}}catch{}
 if(!products.length)products=[{name:'',quantity:-1,price:''}];
 if(!defaultCampaign)defaultCampaign=(table?.title||importFileName.replace(/\.(xlsx|csv)$/i,'').replace(/\s*[(（]回覆[)）]$/,'')).trim().slice(0,100);
 $('#import-error').textContent='';
 $('#import-mapping').className=multi?'multi':'';
 $('#import-mapping').innerHTML=`<p>共 ${importTable.rows.length} 列。請核對欄位與第一筆範例。</p><label class="field">固定來源名稱（例如：秋日表單；之後請用相同名稱）<input id="import-source" maxlength="100" value="${escape(source)}"></label><label class="field">團別名稱（這一團叫什麼，例如：10月團；先帶入檔案／表單名稱，可以改）<input id="import-campaign" maxlength="500" value="${escape(defaultCampaign)}"></label>
 <div class="mode" role="radiogroup" aria-label="表單格式"><label><input type="radio" name="import-mode" value="single" ${multi?'':'checked'}>一列一項商品<small>表單有「商品名稱、數量、單價」欄</small></label><label><input type="radio" name="import-mode" value="multi" ${multi?'checked':''}>一列多項商品<small>每種商品各有一個數量欄，例如「袋子數量」</small></label></div>
 <div class="form-grid">${importFields.map(([key,label])=>`<label class="field ${['item','quantity','price'].includes(key)?'single-only':''}" ${key==='campaign'?'id="campaign-column"':''}>${label}<select id="map-${key}">${columnOptions(mapping[key],key==='paid'?'未提供，全部記為 0':key==='store'?'未提供，匯入後待確認':'請選擇欄位')}</select></label>`).join('')}</div>
 <section class="products multi-only"><h3>商品與單價</h3><p class="footnote">每種商品一列；數量 0 或空白不產生訂單。本筆已付只算在該回覆的第一項商品，避免重複計算。</p><div id="product-rows">${products.map(productRow).join('')}</div><button class="secondary" data-action="add-product" style="margin-top:12px">＋ 新增商品</button></section>
 <p class="footnote">單價不是訂單總金額；本筆已付不可填買家累計付款。時間戳記如有重複，請在試算表加一欄固定且唯一的識別碼。來源名稱或識別碼改變會視為新資料。重複匯入請沿用相同下載格式與時間格式，優先使用固定識別碼。</p><button class="primary" data-action="preview-import">檢查並預覽</button>`;
 if(googleSetup)googleMappingDefaults();
 campaignColumn();
}
// 表單沒有「團別」題目時藏起團別欄位選單，只留「團別名稱」，避免選到時間欄
function campaignColumn(show){
 const select=$('#map-campaign'),label=$('#campaign-column');if(!select||!label)return;
 show=show||select.value!=='-1'||importTable.headers.some(h=>/團別/.test(h));
 label.hidden=!show;
 $('#show-campaign-column')?.remove();
 if(!show)label.insertAdjacentHTML('afterend','<p class="footnote" id="show-campaign-column">表單裡有「團別」題目？<button class="secondary" data-action="show-campaign-column">改用表單的團別</button></p>');
}
// Google：識別碼固定用回覆 ID；來源名稱設定後不能改（改了舊回覆會被當成新的再加一次）
function googleMappingDefaults(){
 const id=$('#map-rowId');id.value='0';id.disabled=true;
 const source=$('#import-source');
 if(googleSetup.sourceName){source.value=googleSetup.sourceName;source.disabled=true;}else source.value=('Google-'+googleSetup.title).slice(0,100);
 const saved=googleSetup.saved;
 if(saved){try{const back=namesToMapping(importTable.headers,saved);for(const [key,index] of Object.entries(back.mapping))if(key!=='rowId'&&$('#map-'+key))$('#map-'+key).value=String(index);if(saved.defaultCampaign)$('#import-campaign').value=saved.defaultCampaign;if(back.products.length){$('#import-mapping').classList.add('multi');document.querySelector('[name=import-mode][value=multi]').checked=true;$('#product-rows').innerHTML=back.products.map(productRow).join('');}}catch{}}
}
// 手機：跳出分享選單（儲存到檔案、LINE、AirDrop）；不支援或分享失敗就照舊下載
async function shareFile(filename,text,type){
 if(!/iPhone|iPad|iPod|Android/.test(navigator.userAgent)||!navigator.canShare)return null;
 const file=new File([text],filename,{type:type.split(';')[0]});
 if(!navigator.canShare({files:[file]}))return null;
 try{await navigator.share({files:[file]});return {shared:true};}catch(error){return error?.name==='AbortError'?{canceled:true}:null;}
}
function download(filename,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
// 回傳 {ok:true,path} 已存好並讀回核對；{canceled:true} 使用者取消；{error} 失敗；{browser:true} 網頁版交給瀏覽器下載，無法確認是否存好
async function saveFile(filename,text,type){
 const desktop=globalThis.tuantuanDesktop;
 if(!desktop?.saveFile){const shared=await shareFile(filename,text,type);if(shared)return shared;download(filename,text,type);return {browser:true};}
 try{return await desktop.saveFile(filename,text);}catch(error){return {error:error.message||'未知錯誤'};}
}
function saveMessage(result,what){return result.ok?`${what}已存到：${result.path}`:result.canceled?`已取消，${what}沒有存檔。`:result.shared?`已打開分享選單，${what}可以「儲存到檔案」或傳到 LINE。`:result.browser?`已交給瀏覽器下載${what}，請到下載清單確認。`:`${what}存檔失敗：${result.error}`;}
// 取消／恢復只改狀態；存不進本機就整個退回，不留下一半的變更。
// 仍然有效的人工確認保留：門市仍在有效訂單中、取消不會產生新重複、退款核對在已取消付款沒增加時。
function setCancelled(id,cancelled){
 const o=state.orders.find(o=>o.id===id);if(!o)return;
 const key=summarize([o])[0].key,before={...o},override=state.overrides[key];
 const group=()=>summarize(state.orders).find(g=>g.key===key),prev=group();
 if(cancelled)o.cancelledAt=new Date().toISOString();else delete o.cancelledAt;
 const next=group(),kept={};
 if(override?.store&&next.stores.includes(override.store))kept.store=override.store;
 if(override?.duplicateConfirmed&&cancelled)kept.duplicateConfirmed=true;
 if(override?.refundChecked&&next.cancelledPaid<=prev.cancelledPaid)kept.refundChecked=true;
 if(override?.claimedChecked)kept.claimedChecked=override.claimedChecked;
 if(Object.keys(kept).length)state.overrides[key]=kept;else delete state.overrides[key];
 if(!save()){for(const k of Object.keys(o))delete o[k];Object.assign(o,before);if(override)state.overrides[key]=override;render();detail(key);return;}
 render();detail(key);toast(cancelled?'已取消這筆，金額已重新計算；可在買家明細恢復。':'已恢復這筆，金額已重新計算。');
}
document.addEventListener('input',event=>{
 if(event.target.id==='search'){query=event.target.value;renderRows();}
 if(event.target.id==='message-note'){const note=event.target.value,box=$('#buyer-message'),g=allGroups().find(g=>g.key===box.dataset.key);try{localStorage.setItem(messageNoteKey,note);}catch{}if(g)box.value=buyerMessage(g,note);}
});
document.addEventListener('change',async event=>{
 if(event.target.id==='import-sheet'){try{showImportMapping();}catch(error){$('#import-error').textContent=error.message;}}
 if(event.target.name==='import-mode')$('#import-mapping').classList.toggle('multi',event.target.value==='multi');
 if(event.target.dataset.product==='quantity')event.target.closest('.product-row').querySelector('.pick-hint').textContent=pickHint(Number(event.target.value));
 if(event.target.id==='import-file-input'){
  const input=event.target,file=input.files[0];if(!file)return;
  importFileName=file.name;
  try{
   if(file.size>MAX_BACKUP_BYTES)throw new Error('檔案超過 5 MB');
   if(!/\.(xlsx|csv)$/i.test(file.name))throw new Error('請選擇 .xlsx 或 UTF-8 .csv');
   const bytes=new Uint8Array(await file.arrayBuffer());
   const isCsv=/\.csv$/i.test(file.name);
   if(!isCsv&&(bytes[0]!==80||bytes[1]!==75))throw new Error('檔案不是有效的 Excel .xlsx');
   const data=isCsv?new TextDecoder('utf-8',{fatal:true}).decode(bytes):bytes;
   importBook=globalThis.XLSX.read(data,{type:isCsv?'string':'array',raw:true,cellFormula:true,sheetRows:10002});
   if(!input.isConnected||!$('#dialog').open)return;
   if(!importBook.SheetNames.length)throw new Error('檔案沒有工作表');
   modal('對應匯入欄位',`<label class="field">工作表<select id="import-sheet">${importBook.SheetNames.map(name=>`<option>${escape(name)}</option>`).join('')}</select></label><div id="import-mapping"></div><div id="import-error" class="error" role="alert" style="white-space:pre-wrap"></div>`);
   showImportMapping();
  }catch(error){const output=$('#import-error');if(output)output.textContent='無法匯入：'+error.message;}
 }

 // 訂購選單填「已訂幾個」：空白＝還沒填；只更新旁邊的狀態，不重畫整頁（才不會跳掉正在打的格子）
 if(event.target.dataset.buy!==undefined){
  const input=event.target,key=input.dataset.buy,raw=input.value.trim(),n=Number(raw),before=state.purchased[key];
  if(raw&&(!Number.isSafeInteger(n)||n<0||n>10000000)){toast('已訂數量要填 0 以上的整數');input.value=before??'';return;}
  if(raw)state.purchased[key]=n;else delete state.purchased[key];
  if(!save()){if(before===undefined)delete state.purchased[key];else state.purchased[key]=before;input.value=before??'';return;}
  const status=[...document.querySelectorAll('[data-buy-status]')].find(el=>el.dataset.buyStatus===key);
  if(status)status.innerHTML=buyStatus(Number(input.dataset.need),state.purchased[key]);
 }
 // 賺多少：每個成本、開團日期；空白＝還沒填。存不進本機就退回
 if(event.target.dataset.cost!==undefined){
  const input=event.target,key=input.dataset.cost,raw=input.value.trim(),n=Number(raw),before=state.costs[key];
  if(raw&&(!Number.isSafeInteger(n)||n<0||n>10000000)){toast('成本要填 0 以上的整數');input.value=before??'';return;}
  if(raw)state.costs[key]=n;else delete state.costs[key];
  if(!save()){if(before===undefined)delete state.costs[key];else state.costs[key]=before;}
  // 等 Tab 把游標移到下一格再重畫，重畫後游標才會留在下一格
  setTimeout(()=>{if(page==='profit')renderProfit();});
 }
 if(event.target.dataset.date!==undefined){
  const input=event.target,name=input.dataset.date,value=input.value,before=state.dates[name];
  if(value&&!isDate(value)){toast('開團日期看不懂，請重新選');input.value=before??'';return;}
  if(value)state.dates[name]=value;else delete state.dates[name];
  if(!save()){if(before===undefined)delete state.dates[name];else state.dates[name]=before;}
  profitPoint=null;renderProfit();
 }
 if(event.target.id==='campaign'){campaign=event.target.value;render();}
 if(event.target.id==='stage-filter'){stageFilter=event.target.value;renderRows();}
 if(event.target.id==='backup-file'){
  const file=event.target.files[0];if(!file)return;
  const input=event.target;
  try{
   if(file.size>MAX_BACKUP_BYTES)throw new Error('備份超過 5 MB');
   const {state:candidate,savedAt,savedBy}=parseBackupFile(await file.text());
   if(input.isConnected&&$('#dialog').open)previewRestore(candidate,{savedAt,savedBy});
  }catch(error){if(input.isConnected)$('#restore-error').textContent=error.message;}
 }
});
function previewRestore(candidate,meta={}){
 pendingRestore=candidate;
 const gs=summarize(candidate.orders,candidate.overrides,candidate.noStore);
 const by={desktop:'電腦版',web:'手機／網頁版'}[meta.savedBy]||'艾麗莎',theirs=candidate.updatedAt||meta.savedAt,mine=state.updatedAt;
 const older=theirs&&mine&&Date.parse(theirs)<Date.parse(mine);
 const times=`<p>${meta.savedAt?`這份備份是 <b>${escape(when(meta.savedAt))}</b> 從${by}存的。`:'這份備份沒有記錄存檔時間（舊版艾麗莎存的）。'}${candidate.updatedAt?`<br>裡面的資料最後修改：${escape(when(candidate.updatedAt))}`:''}${mine?`<br>這台目前的資料最後修改：${escape(when(mine))}`:''}</p>${older?'<div class="notice">⚠ 這份備份比這台現有的資料舊。還原後，這台比較新的修改會不見。</div>':''}`;
 modal('確認還原備份',`${times}<p>備份內有 <b>${candidate.orders.length} 筆訂單</b>、${gs.length} 份買家清單，商品總額 ${money(gs.reduce((sum,g)=>sum+g.total,0))}。</p><p>將取代目前 ${state.orders.length} 筆訂單，以及全部確認與下載紀錄。這不是加購匯入。</p><p class="footnote">確認後先保存還原前資料；若本機空間不足，會停止還原。只保留最近一次回復點。</p><div id="restore-error" class="error" role="alert" style="white-space:pre-wrap"></div><div class="form-actions"><button class="secondary" data-action="close">取消</button><button class="primary" data-action="confirm-restore">確認取代並還原</button></div>`);
}
document.addEventListener('submit',event=>{
 if(event.target.id!=='order-form')return;event.preventDefault();
 const form=event.target,values=Object.fromEntries(new FormData(form));
 for(const key of Object.keys(values))values[key]=values[key].trim();
 for(const key of ['quantity','price','paid'])values[key]=Number(values[key]);
 const errors=validateOrder(values);if(errors.length){$('#form-error').textContent=errors.join('；');return;}
 const id=form.dataset.id,old=state.orders.find(o=>o.id===id);
 const affected=summarize([...state.orders,...(!old?[{...values,id:'new'}]:[])],{}).filter(g=>g.orders.some(o=>o.id===id)||g.email===values.email.trim().toLowerCase()&&g.campaign===values.campaign);
 for(const g of affected)delete state.overrides[g.key];
 if(old)Object.assign(old,values);else state.orders.push({...values,id:crypto.randomUUID()});
 const persisted=save();$('#dialog').close();render();if(persisted)toast('訂單已儲存，買家金額已重新計算。');
});
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.page){page=button.dataset.page;render();window.scrollTo({top:0});return;}
 if(button.dataset.profit!==undefined){setProfitView(button.dataset.profit);if(button.closest('#profit-menu'))window.scrollTo({top:0});return;}
 if(button.dataset.pick!==undefined){const name=button.dataset.pick;if(profitDraft.has(name))profitDraft.delete(name);else if(profitDraft.size>=MAX_PICK){toast(`最多挑 ${MAX_PICK} 團。`);return;}else profitDraft.add(name);renderProfit();return;}
 if(button.dataset.expenseDel!==undefined){const before=state.expenses;state.expenses=before.filter(e=>e.id!==button.dataset.expenseDel);if(!save())state.expenses=before;renderProfit();toast('已刪除這筆花費。');return;}
 if('sizePick' in button.dataset){currentSize=button.dataset.sizePick;applySize(currentSize);try{localStorage.setItem(sizeKey,currentSize);}catch{}renderSettings();toast('字體大小改成「'+sizes.find(s=>s[0]===currentSize)[1]+'」。');return;}
 if('themePick' in button.dataset){currentTheme=button.dataset.themePick;applyTheme(currentTheme);try{localStorage.setItem(themeKey,currentTheme);}catch{}renderSettings();toast('已換成「'+themes.find(t=>t[0]===currentTheme)[1]+'」風格。');return;}
 if(button.dataset.filter){filter=button.dataset.filter;renderOrders();return;}
 if(button.dataset.detail){detail(button.dataset.detail);return;}
 if(button.dataset.edit){orderForm(button.dataset.edit);return;}
 if(button.dataset.message){messageModal(button.dataset.message);return;}
 if('stage' in button.dataset){setStage(button.dataset.key,button.dataset.stage,!!button.dataset.stay);if(button.dataset.stay){button.disabled=true;button.textContent='✓ 已標記已通知';}return;}
 if(button.dataset.store){const key=button.dataset.store;state.overrides[key]={...state.overrides[key],store:$('#resolved-store').value};save();render();detail(key);return;}
 if(button.dataset.duplicate){const key=button.dataset.duplicate;state.overrides[key]={...state.overrides[key],duplicateConfirmed:true};save();render();detail(key);return;}
 if(button.dataset.claimed){const key=button.dataset.claimed,g=allGroups().find(g=>g.key===key);if(!g)return;state.overrides[key]={...state.overrides[key],claimedChecked:{claimed:g.claimed,total:g.total,unreadable:g.unreadable.length,at:new Date().toISOString()}};save();render();detail(key);return;}
 if(button.dataset.refund){const key=button.dataset.refund;state.overrides[key]={...state.overrides[key],refundChecked:true};save();render();detail(key);return;}
 if(button.dataset.cancel){const o=state.orders.find(o=>o.id===button.dataset.cancel);if(!o)return;const key=summarize([o])[0].key;modal('取消這筆商品？',`<p><b>${escape(o.item)} × ${o.quantity}</b>（${money(o.price*o.quantity)}）</p><p>取消後不計入件數、金額與匯出。原始資料會保留，之後可以在買家明細「恢復這筆」。</p>${o.paid?`<div class="notice">這筆已付 ${money(o.paid)}。取消<b>不會自動退款</b>，之後要核對退款才能匯出這位買家。</div>`:''}<div class="form-actions"><button class="secondary" data-detail="${escape(key)}">返回</button><button class="primary" data-confirm-cancel="${escape(o.id)}">確認取消</button></div>`);return;}
 if(button.dataset.ship){const o=state.orders.find(o=>o.id===button.dataset.ship);if(!o)return;const key=summarize([o])[0].key,before=state.shipped[o.id];if(before)delete state.shipped[o.id];else state.shipped[o.id]=new Date().toISOString();if(!save()){if(before)state.shipped[o.id]=before;else delete state.shipped[o.id];}render();detail(key);toast(before?'已改回「還沒寄出」。':`「${o.item}」標記為已寄出。`);return;}
 if(button.dataset.nostore||button.dataset.needstore){const name=button.dataset.nostore||button.dataset.needstore,on=!!button.dataset.nostore,before=[...state.noStore];state.noStore=on?[...new Set([...state.noStore,name])]:state.noStore.filter(c=>c!==name);if(!save())state.noStore=before;render();detail(button.dataset.key);toast(on?`「${name}」整團改成不用門市，不會再提醒缺門市；可在買家明細改回。`:`「${name}」改回需要取貨門市。`);return;}
 if(button.dataset.confirmCancel){setCancelled(button.dataset.confirmCancel,true);return;}
 if(button.dataset.restore){setCancelled(button.dataset.restore,false);return;}
 switch(button.dataset.action){
  case 'close':$('#dialog').close();break;
  case 'add':orderForm();break;
  case 'sources':page='sources';render();break;
  case 'review':filter='issues';renderOrders();$('#rows').scrollIntoView({behavior:'smooth',block:'center'});break;
  case 'google-client':{const result=await desktop.googleChooseClient();if(result.error)toast(result.error);else if(result.ok)toast('鑰匙檔已收好（加密保存在這台電腦）。下一步：用 Google 登入。');renderGoogleCard();break;}
  case 'google-connect':{button.disabled=true;button.textContent='請到瀏覽器完成登入…';toast('已打開瀏覽器，請在 Google 畫面登入並按「允許」。');const result=await desktop.googleConnect();if(result.error)toast(result.error);else{toast('Google 已連接！');if(googleConfig()){startGoogleTimer();googleSync(true);}}renderGoogleCard();break;}
  case 'google-read':googleRead($('#google-url').value,button);break;
  case 'google-remap':{const cfg=googleConfig();if(cfg)googleRead(cfg.url||cfg.formId);break;}
  case 'google-sync':googleSync(true);break;
  case 'google-disconnect':modal('中斷 Google 連接？',`<p>艾麗莎會請 Google 作廢這次的登入，並刪掉這台電腦裡的鑰匙檔，之後不再自動更新。</p><p>已經加進來的訂單<b>不會</b>被刪掉。要再用就重新做一次設定。</p><div class="form-actions"><button class="secondary" data-action="close">取消</button><button class="primary" data-action="confirm-google-disconnect">確認中斷</button></div>`);break;
  case 'confirm-google-disconnect':{await desktop.googleDisconnect();saveGoogleConfig(null);startGoogleTimer();$('#dialog').close();page='sources';render();toast('已中斷 Google 連接。');break;}
  case 'google-info':modal('Google 表單回覆如何匯入',`<ol class="steps"><li>使用表單擁有者帳號開啟表單，切到「回覆」。</li><li>點右上角更多選單，選「下載回覆（.csv）」；若下載為壓縮檔，先解壓縮取出 CSV。</li><li>也可點「連結至試算表」，從試算表的「檔案 → 下載」取得 Microsoft Excel（.xlsx）。</li><li>回到艾麗莎的「資料來源」，選擇 Excel／CSV，對應欄位、指定固定來源名稱與團別。</li><li>以唯一識別碼或時間戳記辨認每列，先預覽再確認匯入；下次沿用來源名稱與識別碼。</li></ol><div class="notice">目前是手動下載再匯入，不會自動同步 Google。表單填寫網址不能讀取回覆；多商品表單需每種商品各有一個數量欄。</div>`);break;
  case 'download':{const ready=groups().filter(g=>g.active&&!g.issues.length);if(!ready.length)return;button.disabled=true;const result=await saveFile('艾麗莎-整單摘要-非賣貨便匯入檔.csv',summaryCsv(ready),'text/csv;charset=utf-8');if(result.ok||result.browser||result.shared){state.history.unshift({at:new Date().toISOString(),count:ready.length});save();}renderExport();toast(saveMessage(result,'整單摘要'));break;}
  case 'download-items':{const totals=itemTotals(groups());if(!totals.length)return;button.disabled=true;const result=await saveFile('艾麗莎-叫貨統計.csv',itemTotalsCsv(totals,state.purchased),'text/csv;charset=utf-8');button.disabled=false;toast(saveMessage(result,'叫貨統計'));break;}
  case 'copy-message':{const box=$('#buyer-message');if(await copyText(box)){toast('已複製，可以貼到 LINE 或簡訊。');$('#message-error').textContent='';}else{box.select();$('#message-error').textContent='無法自動複製，文字已全選，請按 Ctrl+C（手機長按）複製。';}break;}
  case 'add-expense':{
   const {chosen,one}=profitData(),c=one||chosen.find(c=>c.campaign===$('#expense-campaign')?.value);if(!c)break;
   const label=$('#expense-label').value.trim(),raw=$('#expense-amount').value.trim(),amount=Number(raw);
   if(!label){$('#expense-error').textContent='請填花費名稱，例如：國際運費';break;}
   if(!raw||!Number.isSafeInteger(amount)||amount<0||amount>10000000){$('#expense-error').textContent='金額要填 0 以上的整數';break;}
   const before=state.expenses;state.expenses=[...before,{id:crypto.randomUUID(),campaign:c.campaign,label,amount}];
   if(!save()){state.expenses=before;break;}
   renderProfit();toast('已加一筆花費，利潤已重新計算。');break;
  }
  case 'profit-menu':openProfitMenu(button);break;
  case 'profit-fill':{profitRows=null;profitMissingFirst=true;profitAllRows=true;renderProfit();const card=$('#cost-card');card?.scrollIntoView({behavior:'smooth',block:'start'});[...document.querySelectorAll('[data-cost]')].find(el=>!el.value)?.focus({preventScroll:true});break;}
  case 'profit-to-costs':$('#cost-card')?.scrollIntoView({behavior:'smooth',block:'start'});break;
  case 'profit-unpick':pickPoint(null);break;
  case 'profit-all-rows':profitAllRows=true;renderProfit();break;
  case 'profit-rank-more':button.closest('.card').querySelector('.rank')?.classList.add('open');button.hidden=true;break;
  case 'profit-rank-all':shareAllModal();break;
  case 'profit-repick':profitDraft=new Set(profitPick);renderProfit();break;
  case 'profit-pick-clear':profitDraft=new Set();renderProfit();break;
  case 'profit-pick-cancel':profitDraft=null;renderProfit();break;
  case 'profit-pick-done':if(profitDraft.size<2)break;profitPick=new Set(profitDraft);profitDraft=null;profitPoint=null;profitRows=null;renderProfit();break;
  case 'open-backup-dir':{const result=await desktop.openBackupDir();if(result.error)toast('無法打開備份資料夾：'+result.error);break;}
  case 'choose-backup-dir':{const result=await desktop.chooseBackupDir();if(result.error){toast('無法使用這個位置：'+result.error);break;}if(result.canceled)break;backupStatus={};const saved=await runAutoBackup();renderBackupStatus();if(!saved.error)toast('之後的自動備份會存到：'+result.dir);break;}
  case 'backup':{button.disabled=true;const now=new Date(),pad=n=>String(n).padStart(2,'0'),stamp=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;const result=await saveFile(`艾麗莎-備份-${stamp}.json`,backupText(state,desktop?'desktop':'web',now),'application/json');button.disabled=false;toast(saveMessage(result,'備份'));break;}
  case 'show-campaign-column':campaignColumn(true);$('#map-campaign')?.focus();break;
  case 'import-file':importPlan=null;modal('匯入 Excel／CSV',`<p>第一列需為欄位名稱。可一列一項商品，或一列多項商品；公式請先貼上為值，手機請保留開頭的 0。</p><label class="field">選擇檔案<input id="import-file-input" type="file" accept=".xlsx,.csv"></label><div id="import-error" class="error" role="alert" style="white-space:pre-wrap"></div>`);break;
  case 'preview-import':{
   button.disabled=true;
   try{
    const mapping=Object.fromEntries(importFields.map(([key])=>[key,Number($('#map-'+key).value)]));
    const source=$('#import-source').value,defaultCampaign=$('#import-campaign').value;
    const products=$('#import-mapping').classList.contains('multi')?readProducts():[];
    if($('#import-mapping').classList.contains('multi')&&!products.length)throw new Error('請至少設定一種商品');
    let table=importTable,split=null;
    if(googleSetup){mapping.rowId=0;split=splitNew(state.orders,importTable,source.trim());table=split.table;}
    const result=await planImport(state,table,mapping,source,defaultCampaign,products);
    Object.assign(result,{mapping,products,source,defaultCampaign,split});
    if(!button.isConnected||!$('#dialog').open)break;
    importPlan=result;
    try{localStorage.setItem('tuantuan-import-mapping',JSON.stringify({headers:importTable.headers,mapping,source,defaultCampaign,products}));}catch{}
    const known=new Set(state.orders.map(o=>o.id)),nextGroups=summarize(result.next.orders,result.next.overrides),nextHistory=noPickupHistory(nextGroups,result.next.progress);
    const flagged=nextGroups.filter(g=>nextHistory.has(g.key)&&g.orders.some(o=>!known.has(o.id)));
    modal('確認匯入',`${flagged.length?`<div class="notice">⚠ 這次有 ${flagged.length} 位買家曾被標記未取貨：${flagged.map(g=>escape(g.name)).join('、')}。匯入後可在訂單頁用「曾未取貨的買家」找到。</div>`:''}${claimNotice(nextGroups.filter(g=>g.orders.some(o=>!known.has(o.id))))}<p>新增 <b>${result.added} 筆</b>商品明細，略過 ${result.skipped+(split?.known||0)} 列已匯入紀錄${result.empty?`、${result.empty} 列沒有選購商品`:''}${result.ignored?`、${result.ignored} 列沒有時間和 Email（像是自己加的統計列）`:''}。</p>${split?.edited.length?`<div class="notice">⚠ ${split.edited.length} 筆回覆在匯入後被修改過：${split.edited.map(e=>escape(e.name)).join('、')}。艾麗莎不會自動改，請到訂單頁核對。</div>`:''}${googleSetup?'<p class="footnote">確認後，艾麗莎開著時每 5 分鐘會自動檢查這份表單，有新回覆就照這次的設定加進來。</p>':''}<p>新增商品總額：${money(result.total)}</p><p>原有訂單會保留。新增同 Email＋同團別的訂單會合單，原始列與疑似重複紀錄仍保留。</p><p class="footnote">匯入前會保存回復點，可於設定回復。已付金額為手動分配紀錄，並非付款證明。</p><div id="import-error" class="error" role="alert"></div><div class="form-actions"><button class="secondary" data-action="close">取消</button><button class="primary" data-action="confirm-import" ${result.added||googleSetup?'':'disabled'}>${googleSetup?(result.added?'確認加入並開始自動更新':'儲存設定並開始自動更新'):'確認加入訂單'}</button></div>`);
   }catch(error){if($('#import-error'))$('#import-error').textContent=error.message;}finally{button.disabled=false;}
   break;
  }
  case 'add-product':{const rows=$('#product-rows');if(rows.children.length>=MAX_PRODUCTS){$('#import-error').textContent=`最多設定 ${MAX_PRODUCTS} 種商品`;break;}rows.insertAdjacentHTML('beforeend',productRow({name:'',quantity:-1,price:''}));break;}
  case 'remove-product':button.closest('.product-row').remove();break;
  case 'confirm-import':{
   if(!importPlan)return;
   const known=new Set(state.orders.map(o=>o.id));
   if(importPlan.added){
    await runAutoBackup('before');
    try{importPlan.next.updatedAt=new Date().toISOString();state=restoreBackup(localStorage,state,importPlan.next);scheduleAutoBackup();}catch{$('#import-error').textContent='匯入未完成，原訂單未變更。請確認本機儲存空間。';break;}
   }
   if(googleSetup){
    const names=mappingToNames(importTable.headers,importPlan.mapping,importPlan.products);
    saveGoogleConfig({formId:googleSetup.formId,url:googleSetup.url,title:googleSetup.title,sourceName:importPlan.source.trim(),defaultCampaign:importPlan.defaultCampaign.trim(),...names,last:{at:new Date().toISOString(),count:importTable.rows.length,added:importPlan.added,edited:importPlan.split.edited.map(e=>e.name)}});
    googleSetup=null;startGoogleTimer();
    if(!importPlan.added){importPlan=null;$('#dialog').close();page='sources';render();toast('設定好了。艾麗莎開著時每 5 分鐘會自動檢查新回覆。');break;}
   }
   const added=importPlan.added,addedIds=new Set(importPlan.next.orders.map(o=>o.id).filter(id=>!known.has(id)));
   importPlan=null;campaign='all';filter='all';query='';page='home';render();
   const pending=groups().filter(g=>g.issues.length).length;
   modal('匯入完成',`<div class="done-art">${emptyArt('imported')}<b>匯入成功</b><p>新增 ${added} 筆訂單，已依 Email＋團別合併成買家清單。${pending?`<br>有 ${pending} 份清單需要你確認，請先核對。`:''}</p></div>${claimNotice(groups().filter(g=>g.orders.some(o=>addedIds.has(o.id))))}<div class="form-actions"><button class="primary" data-action="close">好，去看看</button></div>`);break;
  }
  case 'restore':pendingRestore=null;modal('從 JSON 備份還原',`<p>選擇艾麗莎 JSON 備份（最多 5 MB）。支援舊版無版本號的備份；檢查完成後會先顯示預覽。</p><label class="field">備份檔案<input id="backup-file" type="file" accept=".json,application/json"></label><div id="restore-error" class="error" role="alert" style="white-space:pre-wrap"></div>`);break;
  case 'recover':try{const saved=localStorage.getItem(recoveryKey);if(!saved){toast('尚無還原前的回復點。');break;}previewRestore(parseBackup(saved));}catch(error){toast('無法讀取回復點：'+error.message);}break;
  case 'confirm-restore':{
   if(!pendingRestore)return;
   await runAutoBackup('before');
   try{state=restoreBackup(localStorage,state,pendingRestore);scheduleAutoBackup();}catch{$('#restore-error').textContent='還原未完成，目前訂單未變更。請確認本機儲存空間與備份格式後重試。';break;}
   pendingRestore=null;campaign='all';filter='all';query='';$('#dialog').close();page='home';render();toast('備份已還原；可在設定回復還原前資料。');break;
  }
  case 'clear':case 'reset':{const reset=button.dataset.action==='reset';modal(reset?'重設示範資料？':'清空本機訂單？',`<p>目前訂單、確認紀錄、進度與下載紀錄將被取代。${desktop?.autoBackup?'艾麗莎會先自動存一份「變更前」備份。':'請先到設定下載備份。'}</p><div id="clear-error" class="error" role="alert"></div><div class="form-actions"><button class="secondary" data-action="close">取消</button><button class="primary" data-action="${reset?'confirm-reset':'confirm-clear'}">確認${reset?'重設':'清空'}</button></div>`);break;}
  case 'confirm-reset':case 'confirm-clear':{const demo=button.dataset.action==='confirm-reset';button.disabled=true;const backup=await runAutoBackup('before');if(backup.error){button.disabled=false;$('#clear-error').textContent='變更前備份失敗，所以沒有清空：'+backup.error+'。請先到設定下載備份或更換備份位置。';break;}state=emptyState(demo);save();campaign='all';filter='all';query='';$('#dialog').close();page='home';render();break;}
 }
});
document.querySelector('.brandmark').innerHTML=logo();document.querySelector('.mobile-brand i').innerHTML=logo();
render();if(storageWarning)toast(storageWarning);
// iPhone 網頁版：沒加入主畫面時 Safari 可能清掉資料，每次從 Safari 打開都提醒
if(!desktop&&/iPhone|iPad|iPod/.test(navigator.userAgent)&&!navigator.standalone)modal('先加入主畫面','<p>請按 Safari 下方的「分享」→「加入主畫面」，之後從桌面的艾麗莎圖示打開。</p><p>直接用 Safari 開的話，太久沒用時 iPhone 可能會清掉艾麗莎裡的訂單。</p><p class="footnote">訂單只存在這支手機，不會上傳到網路。換手機或清除 Safari 資料前，請先到設定「下載資料備份」。</p>');
runAutoBackup();
// 開啟 5 秒後先檢查一次 Google 表單，之後每 5 分鐘
if(desktop?.googleFetch&&googleConfig()){startGoogleTimer();setTimeout(()=>googleSync(),5000);}
