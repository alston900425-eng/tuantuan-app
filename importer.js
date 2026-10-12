import {validateOrder,summarize,cleanEmail} from './core.js';
import {validateBackup,SCHEMA_VERSION} from './backup.js';

export const importFields=[['rowId','來源識別碼／時間戳記'],['name','收件人'],['email','Email'],['phone','手機（沒有可以用 IG）'],['campaign','團別（表單有團別題目才選）'],['item','商品名稱'],['quantity','數量'],['price','單價'],['paid','本筆已付金額'],['claimed','買家填的匯款金額（只用來核對，不算已付）'],['store','取貨門市']];
const aliases={rowId:['來源識別碼','時間戳記','timestamp','id'],name:['收件人','姓名'],email:['email','電子郵件地址','電子郵件'],phone:['手機','手機號碼','電話'],campaign:['團別'],item:['商品名稱','商品'],quantity:['數量'],price:['單價','單價（nt$）'],paid:['本筆已付金額','已付金額','本次已付','本次已付金額'],claimed:['買家填的匯款金額','匯款金額','應匯金額','轉帳金額','付款金額'],store:['取貨門市','門市','取貨門市名稱／代碼']};
// IG 團沒有姓名、手機題：收件人與手機都用 IG（這兩個可以對應同一欄）
const igHeader=h=>/^(ig|instagram)(\s*帳號)?$/i.test(h.trim());
export function guessMapping(headers){
 const mapping=Object.fromEntries(importFields.map(([key])=>[key,headers.findIndex(h=>aliases[key].includes(h.trim().toLowerCase()))]));
 const ig=headers.findIndex(igHeader);
 if(ig>=0)for(const key of ['name','phone'])if(mapping[key]<0)mapping[key]=ig;
 return mapping;
}
// 一列多商品：每種商品一個數量欄（例如「袋子數量」），單價固定。
// 題目尾巴是價錢（「幸運抽徽章160」）就帶入名稱與單價；方格題「冰淇淋甜筒吊飾650 [2]」是勾選款式，每勾一個算 2 件。
export const MAX_PRODUCTS=99;
export const pickTimes=header=>{const m=String(header).trim().match(/\[(\d{1,2})\]$/);return m&&Number(m[1])>0?Number(m[1]):0;};
export function guessProducts(headers){
 const used=new Set(Object.values(guessMapping(headers)).filter(i=>i>=0));
 return headers.flatMap((h,quantity)=>{
  if(used.has(quantity))return [];
  const base=h.trim().replace(/\s*\[\d{1,2}\]$/,'');
  const priced=base.match(/^(.*?\D)\s*(\d{1,7})\s*元?$/);
  if(/.數量$/.test(base))return [{name:base.replace(/數量$/,'').trim(),quantity,price:''}];
  if(priced&&priced[1].trim())return [{name:priced[1].trim(),quantity,price:priced[2]}];
  if(pickTimes(h)&&base)return [{name:base,quantity,price:''}];
  return [];
 });
}
// 勾選款式的格子：「哲, 奎」→ 哲、奎；括號註記「(還沒)」略過；疊字「哲哲」＝哲；
// 團主手打的「哲勳燦」用整張表出現過的款式拆開（出現 2 次以上的當成正式款式，不拆；拆不完就當成一個款式）
const stripNote=s=>s.replace(/[(（][^)）]*[)）]/g,'').trim();
const unrepeat=s=>{for(let n=1;n<=s.length/2;n++)if(s.length%n===0&&s===s.slice(0,n).repeat(s.length/n))return s.slice(0,n);return s;};
const parts=cell=>String(cell).split(/[,，、]/).map(stripNote).filter(Boolean);
function pickVocabulary(rows,columns){
 const count=new Map();
 for(const row of rows)for(const i of columns)for(const p of parts(row.values[i])){const w=unrepeat(p);count.set(w,(count.get(w)||0)+1);}
 return count;
}
function splitPicks(cell,vocab){
 const out=[];
 for(const part of parts(cell)){
  const word=unrepeat(part);
  if((vocab.get(word)||0)>=2){out.push(word);continue;}
  // 整段用其他款式（可疊字）拆完才採用；先只用出現 2 次以上的正式款式拆，拆不完才用全部
  // （不然別人手打的「漢奎」會被當成一個款式，「哲漢奎」就少算一個）
  const split=words=>{const seg=i=>{if(i===part.length)return [];for(const w of words){let k=0;while(part.startsWith(w,i+k*w.length))k++;
   for(;k>0;k--){const rest=seg(i+k*w.length);if(rest)return [w,...rest];}}return null;};return seg(0);};
  const others=[...vocab.keys()].filter(w=>w!==word).sort((a,b)=>b.length-a.length);
  out.push(...(split(others.filter(w=>vocab.get(w)>=2))||split(others)||[word]));
 }
 return out;
}
// 團別選成時間或識別碼欄 → 每次填表都不同，同一個人會被拆成好幾份
const notCampaign=h=>/時間|日期|時戳|timestamp|time|date|識別碼|^id$/i.test(h.trim());
function checkProducts(products,headers){
 if(products.length>MAX_PRODUCTS)throw new Error(`最多設定 ${MAX_PRODUCTS} 種商品`);
 const names=new Set(),pickPrices=new Map();
 return products.map((p,i)=>{
  const name=String(p.name??'').trim(),price=String(p.price??'').trim();
  if(!name||name.length>500)throw new Error(`第 ${i+1} 種商品缺少名稱`);
  if(!Number.isInteger(p.quantity)||p.quantity<0||p.quantity>=headers.length)throw new Error(`請選擇「${name}」的數量欄位`);
  if(!/^\d+$/.test(price)||Number(price)>10000000)throw new Error(`「${name}」的單價需為純數字整數`);
  // 同一商品的 [1][2][3] 可以同名，但單價要一樣；填數量的商品不可同名
  if(pickTimes(headers[p.quantity])){if(names.has(name)||pickPrices.has(name)&&pickPrices.get(name)!==price)throw new Error(`商品名稱「${name}」重複或單價不一致`);pickPrices.set(name,price);}
  else{if(names.has(name)||pickPrices.has(name))throw new Error(`商品名稱「${name}」重複`);names.add(name);}
  return {name,quantity:p.quantity,price:Number(price)};
 });
}

export function readTable(XLSX,workbook,sheetName){
 const sheet=workbook.Sheets[sheetName];
 if(!sheet||!sheet['!ref'])throw new Error('工作表沒有資料');
 const range=XLSX.utils.decode_range(sheet['!ref']);
 if(range.e.r>10000||range.e.c>99)throw new Error('最多 10,000 筆資料、100 欄');
 for(const [address,cell] of Object.entries(sheet))if(!address.startsWith('!')&&(cell.f||cell.t==='e'))throw new Error('工作表含公式或錯誤儲存格，請先貼上為值再匯入');
 const rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:'',blankrows:true});
 const headers=(rows.shift()||[]).map(String);
 if(!headers.length||headers.some(h=>!h.trim()||h.length>500)||new Set(headers).size!==headers.length)throw new Error('第一列需為不重複、非空白的欄位名稱（最多 500 字）');
 const data=rows.map((values,index)=>({row:index+2,values:headers.map((_,i)=>String(values[i]??''))})).filter(row=>row.values.some(v=>v.trim()));
 if(!data.length)throw new Error('沒有可匯入的資料列');
 if(data.some(row=>row.values.some(v=>v.length>500)))throw new Error('儲存格文字不得超過 500 字');
 return {headers,rows:data};
}

async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function planImport(current,table,mapping,sourceName,defaultCampaign,products=[]){
 sourceName=sourceName.trim();defaultCampaign=defaultCampaign.trim();
 if(!sourceName||sourceName.length>100)throw new Error('請填寫 100 字內的固定來源名稱');
 const multi=products.length>0;
 products=checkProducts(products,table.headers);
 if(multi)mapping={...mapping,item:-1,quantity:-1,price:-1};
 const required=multi?['rowId','name','email','phone']:['rowId','name','email','phone','item','quantity','price'];
 if(mapping.campaign<0&&!defaultCampaign)throw new Error('請在「團別名稱」打這一團的名字（例如：10月團）');
 if(mapping.campaign>=0&&notCampaign(table.headers[mapping.campaign]??''))throw new Error(`「團別」不能選「${table.headers[mapping.campaign]}」：每次填表都不一樣，同一個人會被拆成好幾份。請改回「請選擇欄位」，在上面「團別名稱」打團的名字。`);
 for(const key of required)if(!Number.isInteger(mapping[key])||mapping[key]<0||mapping[key]>=table.headers.length)throw new Error(`請對應「${importFields.find(f=>f[0]===key)[1]}」欄位`);
 const selected=[...Object.entries(mapping).filter(([key,i])=>!(key==='phone'&&i===mapping.name)).map(([,i])=>i),...products.map(p=>p.quantity)].filter(i=>i>=0);
 if(new Set(selected).size!==selected.length)throw new Error('同一欄不可重複對應，請區分單價、數量與本筆付款');
 // 沒用到「買家填的匯款金額」時維持舊格式，舊檔案重跑才不會被當成「有變更」
 const keys=importFields.map(([key])=>key).filter(key=>key!=='claimed'||mapping.claimed>=0);
 const parameters=JSON.stringify(multi?[keys.map(key=>mapping[key]),defaultCampaign,products]:[keys.map(key=>mapping[key]),defaultCampaign]);
 const additions=[],errors=[],seen=new Set();let skipped=0,empty=0,ignored=0;
 // 已匯入過的列用「來源＋識別碼」找，款式拆法或商品名稱改變也不會重複加單
 const byRow=new Map();for(const o of current.orders)if(o.source)byRow.set(JSON.stringify([o.source.name,o.source.rowId]),o);
 // 識別碼用「時間戳記」時，兩個人同一秒填表會撞號：改用「時間＋Email」；舊版只存時間的紀錄，Email 相同也認得
 const byTime=/時間|timestamp/i.test(table.headers[mapping.rowId]??'');
 const sameSource=(a,b)=>JSON.stringify([a.headers,a.values,a.parameters])===JSON.stringify([b.headers,b.values,b.parameters]);
 const pickColumns=products.filter(p=>pickTimes(table.headers[p.quantity])).map(p=>p.quantity);
 const vocab=pickVocabulary(table.vocabRows||table.rows,pickColumns);
 const whole=(text,label,blankIsZero)=>{if(blankIsZero&&text==='')return 0;if(!/^\d+$/.test(text))throw new Error(`${label}需為純數字整數，不可空白或含貨幣／千分位符號`);return Number(text);};
 for(const row of table.rows){
  try{
   const get=key=>mapping[key]>=0?row.values[mapping[key]].trim():'';
   // 沒有識別碼、姓名、Email 的列不是回覆（例如團主自己在表單下面加的統計），略過
   if(!get('rowId')&&!get('name')&&!get('email')){ignored++;continue;}
   const time=get('rowId'),rowId=byTime&&time?`${time}｜${cleanEmail(get('email'))}`:time;
   if(!time||seen.has(rowId))throw new Error(byTime&&time?'同一個時間、同一個 Email 出現兩次，可能重複填單；請核對後刪掉一列':'來源識別碼空白或重複；請改用唯一識別碼');seen.add(rowId);
   const base={};
   for(const key of ['name','email','phone','store'])base[key]=get(key);
   base.campaign=mapping.campaign>=0?get('campaign'):defaultCampaign;
   const paid=mapping.paid<0?0:whole(get('paid'),'本筆已付金額');
   // 買家自己填的匯款金額：看得懂（可含逗號、元）就記數字，看不懂就原文保留，之後在明細標待確認；不算已付
   const claimedCell=get('claimed'),claimedNumber=claimedCell.replace(/[,，\s]/g,'').replace(/^(nt\$|\$)/i,'').replace(/元$/,'');
   const claim=!claimedCell?{}:/^\d{1,8}$/.test(claimedNumber)?{claimed:Number(claimedNumber)}:{claimedText:claimedCell};
   const source={name:sourceName,rowId,headers:table.headers,values:row.values,parameters};
   const orders=[];
   if(multi){
    const lines=new Map();
    for(const p of products){
     const cell=row.values[p.quantity].trim(),times=pickTimes(table.headers[p.quantity]);
     const add=(item,quantity)=>{if(quantity>0)lines.set(item,{price:p.price,quantity:(lines.get(item)?.quantity||0)+quantity});};
     if(times)for(const pick of splitPicks(cell,vocab))add(`${p.name}（${pick}）`,times);
     else add(p.name,whole(cell,`「${p.name}」數量`,true));
    }
    for(const [item,{quantity,price}] of lines)orders.push({id:'import-'+await digest(JSON.stringify([sourceName,rowId,item])),...base,item,quantity,price,paid:orders.length?0:paid,...(orders.length?{}:claim),source});
    if(!orders.length&&paid>0)throw new Error('沒有任何商品數量卻有付款，請先核對');
    if(!orders.length&&claim.claimed>0)throw new Error('沒有選任何商品，卻填了匯款金額，請先核對');
   }else{
    orders.push({id:'import-'+await digest(JSON.stringify([sourceName,rowId])),...base,item:get('item'),quantity:whole(get('quantity'),'數量'),price:whole(get('price'),'單價'),paid,...claim,source});
   }
   for(const order of orders){const invalid=validateOrder(order);if(invalid.length)throw new Error(invalid.join('；'));}
   const legacy=byTime&&byRow.get(JSON.stringify([sourceName,time])),old=byRow.get(JSON.stringify([sourceName,rowId]))||(legacy&&cleanEmail(legacy.email)===cleanEmail(base.email)?legacy:null);
   if(old){
    if(!sameSource(old.source,source))throw new Error('已匯入的來源列內容有變更；請先核對並在訂單頁修改，本版不自動覆蓋');
    skipped++;continue;
   }
   if(!orders.length){empty++;continue;}
   additions.push(...orders);
  }catch(error){errors.push(`第 ${row.row} 列：${error.message}`);}
 }
 if(errors.length)throw new Error(errors.slice(0,20).join('\n')+(errors.length>20?`\n另有 ${errors.length-20} 列錯誤`:'')+'\n整批未匯入。');
 const overrides=structuredClone(current.overrides);
 const affected=new Set(summarize(additions).map(g=>g.key));for(const key of affected)delete overrides[key];
 const next=validateBackup({...current,schemaVersion:SCHEMA_VERSION,orders:[...current.orders,...additions],overrides});
 if(new TextEncoder().encode(JSON.stringify(next,null,2)).length>5*1024*1024)throw new Error('匯入後備份會超過 5 MB，請減少資料量');
 return {next,added:additions.length,skipped,empty,ignored,total:additions.reduce((sum,o)=>sum+o.price*o.quantity,0)};
}
