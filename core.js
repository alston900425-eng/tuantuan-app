export const cleanEmail=value=>String(value||'').trim().toLowerCase();
// 手機欄也可以填 IG 等其他聯絡方式（IG 團不收手機）。只有數字的一律當手機檢查格式；
// 其他聯絡方式去掉前後空白與開頭 @、不分大小寫，相同就視為同一人
export const isOtherContact=value=>{const s=String(value||'').trim();return s.length>0&&s.length<=60&&!/^[\d\s()+\-.]*$/.test(s);};
export const cleanPhone=value=>isOtherContact(value)?String(value).trim().replace(/^@/,'').toLowerCase():String(value||'').replace(/[\s()-]/g,'').replace(/^\+886/,'0');
export function validateOrder(o){
  const errors=[];
  if(!o.name?.trim()) errors.push('請填寫收件人');
  if(!o.campaign?.trim()) errors.push('請填寫團別');
  if(!o.item?.trim()) errors.push('請填寫商品');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(o.email))) errors.push('請填寫有效 Email');
  if(!/^09\d{8}$/.test(cleanPhone(o.phone))&&!isOtherContact(o.phone)) errors.push('手機需為 09 開頭的 10 碼，或填 IG 帳號');
  if(!Number.isSafeInteger(o.quantity)||o.quantity<1||o.quantity>10000) errors.push('數量需為 1–10,000 的整數');
  if(!Number.isSafeInteger(o.price)||o.price<0||o.price>10000000) errors.push('單價需為有效的非負整數');
  if(!Number.isSafeInteger(o.paid)||o.paid<0||o.paid>10000000) errors.push('已付金額需為有效的非負整數');
  return errors;
}
// 取消的訂單保留原始資料（cancelledAt 為取消時間），不計入件數、金額與匯出；恢復後重新計算。
export const isCancelled=o=>typeof o.cancelledAt==='string';
// noStore：不用取貨門市的團別（面交、另寄），這些團不檢查門市
export function summarize(orders, overrides={}, noStore=[]){
  const noStoreSet=new Set((noStore||[]).map(c=>String(c).trim()));
  const map=new Map();
  for(const o of orders){
    const key=JSON.stringify([o.campaign.trim(),cleanEmail(o.email)||`missing:${o.id}`]);
    if(!map.has(key)) map.set(key,{key,email:cleanEmail(o.email),campaign:o.campaign,orders:[],cancelled:[]});
    map.get(key)[isCancelled(o)?'cancelled':'orders'].push(o);
  }
  return [...map.values()].map(g=>{
    const rows=g.orders,people=rows.length?rows:g.cancelled;
    const stores=[...new Set(rows.map(o=>o.store.trim()).filter(Boolean))];
    const phones=[...new Set(people.map(o=>cleanPhone(o.phone)))];
    const names=[...new Set(people.map(o=>o.name.trim()))];
    const total=rows.reduce((n,o)=>n+o.price*o.quantity,0);
    const paid=rows.reduce((n,o)=>n+o.paid,0);
    const cancelledPaid=g.cancelled.reduce((n,o)=>n+o.paid,0);
    const fingerprints=rows.map(o=>JSON.stringify([o.item.trim(),o.quantity,o.price,o.store.trim(),o.paid]));
    const possibleDuplicate=new Set(fingerprints).size<rows.length;
    const override=overrides[g.key]||{};
    const store=stores.includes(override.store)?override.store:stores.length===1?stores[0]:'';
    // 同一位買家填了不同姓名／手機：團主選定一個寄件用，原始明細不改
    const name=names.includes(override.name)?override.name:people[0].name.trim(),phone=phones.includes(override.phone)?override.phone:phones[0];
    const issues=[],skipStore=noStoreSet.has(g.campaign.trim());
    if(rows.length){
      if(stores.length>1&&!store&&!skipStore) issues.push('取貨門市不一致');
      if(rows.some(o=>!o.store.trim())&&!override.store&&!skipStore) issues.push('缺少取貨門市');
      if(phones.length>1&&!phones.includes(override.phone)) issues.push('手機號碼不一致');
      if(names.length>1&&!names.includes(override.name)) issues.push('收件人姓名不一致');
    }
    if(possibleDuplicate&&!override.duplicateConfirmed) issues.push('疑似重複填單');
    if(paid>total) issues.push('已付金額超過商品總額');
    // 買家填的匯款金額（每份回覆記在第一項）跟艾麗莎算的不一樣 → 待確認；按「已核對」記下當時兩個數字，之後金額再變就要重新核對
    const claims=[...rows,...g.cancelled].filter(o=>'claimed' in o||'claimedText' in o);
    const claimed=claims.reduce((n,o)=>n+(o.claimed||0),0),unreadable=claims.filter(o=>'claimedText' in o).map(o=>o.claimedText);
    const claimChecked=override.claimedChecked?.claimed===claimed&&override.claimedChecked?.total===total&&override.claimedChecked?.unreadable===unreadable.length;
    const claimIssue=rows.length&&claims.length&&(unreadable.length||claimed!==total)&&!claimChecked;
    if(claimIssue) issues.push(unreadable.length?`買家填的匯款金額看不懂（「${unreadable.join('」「')}」），請看原始表單核對`:`買家填的匯款金額 ${claimed.toLocaleString('en-US')}，艾麗莎算 ${total.toLocaleString('en-US')}，${claimed<total?'少匯':'多匯'} ${Math.abs(total-claimed).toLocaleString('en-US')} 元`);
    if(cancelledPaid>0&&!override.refundChecked) issues.push(`已取消的商品已付 ${cancelledPaid.toLocaleString('en-US')} 元，請核對退款`);
    if(rows.some(o=>validateOrder(o).length)) issues.push('訂單欄位格式有誤');
    return {...g,noStore:skipStore,name,names,store,stores,phone,phones,total,paid,balance:total-paid,quantity:rows.reduce((n,o)=>n+o.quantity,0),cancelledPaid,active:rows.length>0,issues,possibleDuplicate,claims:claims.length,claimed,unreadable,claimIssue:!!claimIssue,claimChecked:claims.length>0&&claimChecked&&(unreadable.length>0||claimed!==total)};
  });
}
export function summaryCsv(groups){
  const rows=[['團別','姓名','Email','手機','取貨門市','商品件數','商品金額','已付金額','待付金額','商品明細'],...groups.map(g=>[g.campaign,g.name,g.email,g.phone,g.store,g.quantity,g.total,g.paid,g.balance,g.orders.map(o=>`${o.item} × ${o.quantity}`).join('；')])];
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export const demoOrders=[
 {id:'d1',campaign:'秋日生活選物',name:'林小美',email:'mei@example.com',phone:'0912345678',item:'日常帆布袋・奶油白',quantity:1,price:380,paid:380,store:'信義門市'},
 {id:'d2',campaign:'秋日生活選物',name:'林小美',email:'mei@example.com',phone:'0912345678',item:'陶瓷馬克杯・燕麥',quantity:2,price:260,paid:0,store:'信義門市'},
 {id:'d3',campaign:'秋日生活選物',name:'陳以安',email:'ian@example.com',phone:'0922345678',item:'日常帆布袋・墨綠',quantity:1,price:380,paid:0,store:'松仁門市'},
 {id:'d4',campaign:'秋日生活選物',name:'陳以安',email:'ian@example.com',phone:'0922345678',item:'陶瓷馬克杯・燕麥',quantity:1,price:260,paid:0,store:'光復門市'},
 {id:'d5',campaign:'秋日生活選物',name:'許庭瑜',email:'ting@example.com',phone:'0932345678',item:'居家香氛・森林',quantity:2,price:490,paid:980,store:'和平門市'},
 {id:'d6',campaign:'秋日生活選物',name:'黃子晴',email:'ching@example.com',phone:'0942345678',item:'陶瓷馬克杯・燕麥',quantity:1,price:260,paid:0,store:'民生門市'},
 {id:'d7',campaign:'秋日生活選物',name:'黃子晴',email:'ching@example.com',phone:'0942345678',item:'陶瓷馬克杯・燕麥',quantity:1,price:260,paid:0,store:'民生門市'},
 {id:'d8',campaign:'週末咖啡器物',name:'林小美',email:'mei@example.com',phone:'0912345678',item:'手沖分享壺',quantity:1,price:680,paid:680,store:'信義門市'}
];
// 叫貨統計：只算有效（未取消）商品；待確認清單的件數另外標出，叫貨前可先處理。
export function itemTotals(groups){
  const map=new Map();
  for(const g of groups)for(const o of g.orders){
    const key=JSON.stringify([g.campaign.trim(),o.item.trim()]);
    if(!map.has(key))map.set(key,{campaign:g.campaign.trim(),item:o.item.trim(),quantity:0,amount:0,pendingQuantity:0,buyers:new Set(),prices:new Set()});
    const t=map.get(key);
    t.quantity+=o.quantity;t.amount+=o.price*o.quantity;t.buyers.add(g.key);t.prices.add(o.price);
    if(g.issues.length)t.pendingQuantity+=o.quantity;
  }
  return [...map.values()].map(({buyers,prices,...t})=>({...t,buyers:buyers.size,prices:[...prices].sort((a,b)=>a-b)}))
    .sort((a,b)=>a.campaign.localeCompare(b.campaign,'zh-Hant')||b.quantity-a.quantity||a.item.localeCompare(b.item,'zh-Hant'));
}
// 跟廠商訂的數量（purchased）以「團別＋商品」為 key
export const itemKey=(campaign,item)=>JSON.stringify([String(campaign).trim(),String(item).trim()]);
// 已訂數量照表單填寫順序（訂單在清單裡的先後）分給買家：先填先分到，分完為止；取消的不分。
// 回傳 Map(訂單 id → 分到幾件)；沒填已訂數量的商品不會出現在結果裡
export function allocatePurchased(orders,purchased={}){
  const left=new Map(Object.entries(purchased||{})),got=new Map();
  for(const o of orders){
    if(isCancelled(o))continue;
    const key=itemKey(o.campaign,o.item);if(!left.has(key))continue;
    const n=Math.min(left.get(key),o.quantity);got.set(o.id,n);left.set(key,left.get(key)-n);
  }
  return got;
}
const csvCell=value=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
export function itemTotalsCsv(totals,purchased={}){
  const ordered=t=>purchased[itemKey(t.campaign,t.item)];
  const rows=[['團別','商品','總件數','買家人數','商品金額','單價','其中待確認件數','已訂件數','還差件數'],...totals.map(t=>[t.campaign,t.item,t.quantity,t.buyers,t.amount,t.prices.join('／'),t.pendingQuantity,ordered(t)??'',ordered(t)===undefined?'':Math.max(0,t.quantity-ordered(t))])];
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
// 給買家的對帳訊息（純文字，貼到 LINE／訊息）。只寫手動紀錄的金額，不代表付款證明或退款承諾。
export function buyerMessage(g,note=''){
  const n=value=>'NT$'+value.toLocaleString('en-US');
  const lines=[`${g.name} 您好，這是您在「${g.campaign}」的訂單明細：`];
  if(g.active){
    for(const o of g.orders)lines.push(`・${o.item} × ${o.quantity}　${n(o.price*o.quantity)}`);
    lines.push(`商品合計：${n(g.total)}（未含運費）`,`已付：${n(g.paid)}`);
    lines.push(g.balance>0?`待付：${n(g.balance)}`:g.balance===0?'款項已付清，謝謝！':`已付超過商品合計 ${n(-g.balance)}，我們會再與您確認。`);
    lines.push(g.noStore&&!g.store?'取貨方式：面交或另外寄送，會再跟您約':`取貨門市：${g.store||'尚待確認'}`);
  }else lines.push('您在這團的商品都已取消。');
  if(g.cancelled.length)lines.push('已取消（不計費）：'+g.cancelled.map(o=>`${o.item} × ${o.quantity}`).join('、'));
  if(String(note).trim())lines.push('',String(note).trim());
  return lines.join('\n');
}
// 買家進度（手動標記，不代表平台狀態）。progress 以合單 key 索引：{stage, at, signature}。
export const stages=[['notified','已通知'],['paid','已確認收款'],['shipped','已寄出'],['pickedUp','已取貨'],['noPickup','未取貨']];
export const stageLabel=stage=>stages.find(([key])=>key===stage)?.[1]||'未處理';
// 標記當下的筆數／件數／金額；之後不同代表標記後訂單有變動
export const groupSignature=g=>[g.orders.length,g.quantity,g.total].join('|');
export function progressOf(g,progress={}){
  const p=progress[g.key];
  if(!p)return {stage:'',label:'未處理',changed:false};
  return {...p,label:stageLabel(p.stage),changed:p.signature!==groupSignature(g)};
}
// 同一個人（Email 或手機相同）在「其他」買家清單被標未取貨 → 回傳 Map(key → 那些清單)
export function noPickupHistory(groups,progress={}){
  const bad=groups.filter(g=>progress[g.key]?.stage==='noPickup');
  const result=new Map();
  if(!bad.length)return result;
  for(const g of groups){
    const hits=bad.filter(b=>b.key!==g.key&&(b.email&&b.email===g.email||b.phone&&b.phone===g.phone));
    if(hits.length)result.set(g.key,hits);
  }
  return result;
}
// 賺多少：收入＝有效訂單的單價×數量（買家該付的商品金額，不是已收到的錢，未含運費）；
// 成本＝每件成本×件數＋這團的其他花費。costs[itemKey]＝每件成本（沒填的商品成本先算 0，另外回報 missing）；
// expenses＝[{id,campaign,label,amount}]；dates[團別]＝開團日期 YYYY-MM-DD；buyers＝這團有效的買家人數。
// 團的順序：有填開團日期的照日期，沒填的排後面、照匯入先後（訂單清單裡第一次出現的順序）。
export function profitReport(orders,groups,{costs={},expenses=[],dates={}}={}){
  const order=[...new Set(orders.map(o=>o.campaign.trim()))];
  const totals=itemTotals(groups),map=new Map();
  for(const g of groups){const c=g.campaign.trim();if(!map.has(c))map.set(c,{campaign:c,items:[],expenses:[],buyers:0});if(g.active)map.get(c).buyers++;}
  for(const t of totals){
    const unit=costs[itemKey(t.campaign,t.item)],costTotal=(unit??0)*t.quantity;
    map.get(t.campaign).items.push({item:t.item,quantity:t.quantity,amount:t.amount,prices:t.prices,cost:unit,costTotal,profit:t.amount-costTotal});
  }
  for(const e of expenses||[]){const c=map.get(String(e.campaign).trim());if(c)c.expenses.push(e);}
  const list=[...map.values()].map(c=>{
    const revenue=c.items.reduce((n,i)=>n+i.amount,0),itemCost=c.items.reduce((n,i)=>n+i.costTotal,0),extra=c.expenses.reduce((n,e)=>n+e.amount,0),cost=itemCost+extra;
    return {...c,date:dates[c.campaign]||'',revenue,itemCost,extra,cost,profit:revenue-cost,margin:revenue?(revenue-cost)/revenue:null,missing:c.items.filter(i=>i.cost===undefined).length};
  });
  const pos=c=>order.indexOf(c.campaign);
  return list.sort((a,b)=>a.date&&b.date?a.date.localeCompare(b.date)||pos(a)-pos(b):a.date?-1:b.date?1:pos(a)-pos(b));
}
// 幾團加起來（全部或自己挑的幾團）
export function profitTotal(campaigns){
  const add=key=>campaigns.reduce((n,c)=>n+c[key],0),revenue=add('revenue'),cost=add('cost');
  return {revenue,cost,itemCost:add('itemCost'),extra:add('extra'),profit:revenue-cost,margin:revenue?(revenue-cost)/revenue:null,missing:add('missing')};
}
// 賣貨便「一般交貨便-取貨付款」匯入檔（2026-10-15 照使用者提供的官方範本）：第 1 列標題（A1:R1 合併）、
// 第 2 列欄名、第 3 列起一位買家一列，A 欄留空。範本範例列不放。寄件人與收款帳戶每列相同（團主自己的，設定頁填）。
// 包裹價值＝商品合計（使用者選定，不扣已付、不含運費）。退貨門市不填（依原寄件門市）。尚未實際匯入賣貨便驗證。
export const MYSHIP_TITLE='一般交貨便-取貨付款(以下欄位皆必填)';
export const MYSHIP_HEADERS=['','寄件人姓名','寄件人電話','寄件人mail','收款人的帳戶名稱','收款人的金融機構','收款人的金融機構分行(7碼)','收款人的銀行帳號','收款人的銀行開戶之身分ID','銀行開戶使用之身分資料','包裏價值','收件門市','收件門市店號','收件人姓名\n(請填寫證件姓名)','收件人電話','收件人mail','退貨門市\n(非必填，退貨門市未填寫者，則依原寄件門市為退貨門市。此欄位有填寫者，退貨門市店號必填)','退貨門市店號\n(非必填，退貨門市未填寫者，則依原寄件門市為退貨門市。此欄位有填寫者，退貨門市必填)'];
export const MYSHIP_ACCOUNT_TYPES=['個人戶','商業戶','外籍人士'];
export const MYSHIP_SENDER_FIELDS=[['name','寄件人姓名'],['phone','寄件人手機'],['email','寄件人 Email'],['accountName','收款帳戶名稱'],['bank','銀行代碼（3 碼）'],['branch','分行代碼（7 碼）'],['account','銀行帳號'],['accountType','帳戶類型'],['id','開戶身分證字號／統編']];
// 門市欄位裡找 6 碼店號，其餘當門市名稱，例如「百建門市 211147」「百建門市(211147)」
export function parseStore(text){
  const s=String(text||'').trim(),m=s.match(/(?<!\d)(\d{6})(?!\d)/);
  if(!m)return {name:s,code:''};
  return {name:s.replace(m[0],'').replace(/[()（）[\]【】#:：,，、\s-]+/g,' ').trim(),code:m[1]};
}
export const storeText=(name,code)=>`${String(name).trim()} ${String(code).trim()}`;
const digits=v=>String(v??'').replace(/[\s-]/g,'');
export function cleanSender(s={}){
  return {name:String(s.name||'').trim(),phone:digits(s.phone),email:String(s.email||'').trim(),accountName:String(s.accountName||'').trim(),bank:digits(s.bank),branch:digits(s.branch),account:digits(s.account),accountType:MYSHIP_ACCOUNT_TYPES.includes(s.accountType)?s.accountType:'',id:String(s.id||'').trim().toUpperCase()};
}
// 回傳還沒填好的欄位（白話），空陣列＝可以匯出
export function senderProblems(raw){
  const s=cleanSender(raw),p=[];
  if(!s.name)p.push('寄件人姓名');
  if(!/^09\d{8}$/.test(s.phone))p.push('寄件人手機（09 開頭 10 碼）');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email))p.push('寄件人 Email');
  if(!s.accountName)p.push('收款帳戶名稱');
  if(!/^\d{3}$/.test(s.bank))p.push('銀行代碼（3 碼）');
  if(!/^\d{7}$/.test(s.branch))p.push('分行代碼（7 碼）');
  if(!/^\d{6,16}$/.test(s.account))p.push('銀行帳號（只填數字）');
  if(!s.accountType)p.push('帳戶類型');
  else if(!(s.accountType==='個人戶'?/^[A-Z][12]\d{8}$/:s.accountType==='商業戶'?/^\d{8}$/:/^([A-Z]{2}\d{8}|[A-Z][89]\d{8})$/).test(s.id))p.push(s.accountType==='商業戶'?'統一編號（8 碼）':s.accountType==='個人戶'?'身分證字號':'居留證號碼');
  return p;
}
// groups：summarize 的結果（已篩好團別）。只放「資料檢查完成」的買家；缺門市店號、手機、Email、姓名的列在 missing
export function myshipExport(groups,raw){
  const s=cleanSender(raw),rows=[],ready=[],missing=[];
  for(const g of groups.filter(g=>g.active&&!g.issues.length)){
    const store=parseStore(g.store),why=[];
    if(!store.code)why.push('門市店號');else if(!store.name)why.push('門市名稱');
    if(!/^09\d{8}$/.test(g.phone))why.push('手機');
    if(!g.email)why.push('Email');
    if(!g.name.trim())why.push('姓名');
    if(why.length){missing.push({group:g,why});continue;}
    ready.push(g);
    rows.push(['',s.name,s.phone,s.email,s.accountName,s.bank,s.branch,s.account,s.accountType,s.id,String(g.total),store.name,store.code,g.name.trim(),g.phone,g.email,'','']);
  }
  return {rows,ready,missing};
}
// 用 SheetJS 做成 xlsx（全部存成文字，手機開頭 0 不會不見）
export function myshipWorkbook(XLSX,rows){
  const aoa=[[MYSHIP_TITLE,...Array(17).fill('')],MYSHIP_HEADERS,...rows];
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  for(const ref of Object.keys(ws))if(ref[0]!=='!'){const c=ws[ref];if(c.v===''){delete ws[ref];continue;}c.t='s';c.v=String(c.v);c.z='@';}
  ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:17}}];
  ws['!cols']=[8,12,13,22,18,10,14,18,14,14,10,14,12,16,13,22,18,14].map(wch=>({wch}));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'工作表1');
  return XLSX.write(wb,{type:'array',bookType:'xlsx'});
}
// 訂單頁「訂到了沒」：每樣商品買家要幾個、已訂幾個（沒填已訂數量算 0）；
// 每位買家照先填先拿（allocatePurchased）算還差幾件，只看有填已訂數量的商品，都沒填的買家不出現。
export function orderProgress(groups,orders,purchased={}){
  const items=itemTotals(groups).map(t=>{const p=purchased[itemKey(t.campaign,t.item)];return {campaign:t.campaign,item:t.item,need:t.quantity,got:Math.min(p??0,t.quantity),filled:p!==undefined};});
  const got=allocatePurchased(orders,purchased),buyers=new Map();
  for(const g of groups){
    if(!g.active||!g.orders.some(o=>got.has(o.id)))continue;
    const quantity=g.orders.reduce((n,o)=>n+o.quantity,0),n=g.orders.reduce((s,o)=>s+(got.get(o.id)??0),0);
    buyers.set(g.key,{quantity,got:n,missing:quantity-n});
  }
  return {need:items.reduce((n,i)=>n+i.need,0),got:items.reduce((n,i)=>n+i.got,0),items,buyers,filled:items.some(i=>i.filled)};
}
