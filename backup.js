import {validateOrder,summarize,stages} from './core.js';

// 4：加入已訂數量 purchased、每項已寄出 shipped、不用門市的團別 noStore、資料最後修改時間 updatedAt；
// 備份檔另外帶 savedAt／savedBy（哪時、哪裡存的），讀進來後不留在資料裡
// 5：加入賺多少用的每件成本 costs、其他花費 expenses、開團日期 dates
export const SCHEMA_VERSION=5;

export const MAX_BACKUP_BYTES=5*1024*1024;
export const storageKey='tuantuan-prototype-v1';
export const recoveryKey=storageKey+'-before-restore';
const isTime=value=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value));
// 開團日期：YYYY-MM-DD，而且是真的日期（沒有 2 月 30 日）
export const isDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function fields(value,allowed,label){
  if(!object(value))throw new Error(`${label}必須是物件`);
  if(Object.keys(value).some(key=>!allowed.includes(key)))throw new Error(`${label}包含不支援的欄位，請勿直接匯入其他版本資料`);
}

export function validateBackup(value){
  fields(value,['schemaVersion','orders','overrides','history','demo','progress','purchased','shipped','noStore','costs','expenses','dates','updatedAt','savedAt','savedBy'],'備份');
  if(value.schemaVersion!==undefined&&![1,2,3,4,5].includes(value.schemaVersion))throw new Error('不支援此備份版本');
  for(const key of ['updatedAt','savedAt'])if(value[key]!==undefined&&!isTime(value[key]))throw new Error('備份的時間紀錄無效');
  if(value.savedBy!==undefined&&!['desktop','web'].includes(value.savedBy))throw new Error('備份的來源紀錄無效');
  if(typeof value.demo!=='boolean')throw new Error('備份 demo 必須是布林值');
  if(!Array.isArray(value.orders)||value.orders.length>10000)throw new Error('訂單必須是陣列，最多 10,000 筆');
  const ids=new Set();
  const errors=[];
  value.orders.forEach((order,index)=>{
    try{
      fields(order,['id','campaign','name','email','phone','item','quantity','price','paid','store','source','cancelledAt','claimed','claimedText'],'訂單');
      if('claimed' in order&&(!Number.isSafeInteger(order.claimed)||order.claimed<0||order.claimed>99999999))throw new Error('買家填的匯款金額無效');
      if('claimedText' in order&&(typeof order.claimedText!=='string'||order.claimedText.length>500))throw new Error('買家填的匯款金額文字過長');
      if(order.cancelledAt!==undefined&&(typeof order.cancelledAt!=='string'||order.cancelledAt.length>40||!Number.isFinite(Date.parse(order.cancelledAt))))throw new Error('取消時間無效');
      if(order.source!==undefined){
        fields(order.source,['name','rowId','headers','values','parameters'],'來源紀錄');
        const source=order.source;
        if(typeof source.parameters!=='string'||source.parameters.length>2000)throw new Error('來源對應設定無效');
        if(typeof source.name!=='string'||!source.name.trim()||source.name.length>100||typeof source.rowId!=='string'||!source.rowId.trim()||source.rowId.length>500)throw new Error('來源名称或識別碼無效');
        if(!Array.isArray(source.headers)||!Array.isArray(source.values)||source.headers.length!==source.values.length||!source.headers.length||source.headers.length>100||[...source.headers,...source.values].some(v=>typeof v!=='string'||v.length>500))throw new Error('來源原始欄位無效');
      }
      for(const key of ['id','campaign','name','email','phone','item','store']){
        if(typeof order[key]!=='string'||order[key].length>500)throw new Error(`${key} 必須是 500 字以內的文字`);
      }
      if(!order.id.trim()||ids.has(order.id))throw new Error('訂單 ID 空白或重複');
      ids.add(order.id);
      const problems=validateOrder(order);
      if(problems.length)throw new Error(problems.join('；'));
    }catch(error){errors.push(`第 ${index+1} 筆：${error.message}`);}
  });
  if(errors.length)throw new Error(errors.slice(0,20).join('\n')+(errors.length>20?`\n另有 ${errors.length-20} 筆錯誤`:''));
  fields(value.overrides,Object.keys(value.overrides||{}),'確認紀錄');
  const groups=new Map(summarize(value.orders).map(group=>[group.key,group]));
  for(const [key,override] of Object.entries(value.overrides)){
    const group=groups.get(key);
    if(!group)throw new Error('確認紀錄對應不到訂單');
    fields(override,['store','duplicateConfirmed','refundChecked','claimedChecked'],'確認紀錄');
    if('claimedChecked' in override){const c=override.claimedChecked;if(!c||typeof c!=='object'||Array.isArray(c))throw new Error('匯款金額核對紀錄無效');fields(c,['claimed','total','unreadable','at'],'匯款金額核對紀錄');if(![c.claimed,c.total,c.unreadable].every(Number.isSafeInteger)||typeof c.at!=='string'||c.at.length>40||!Number.isFinite(Date.parse(c.at)))throw new Error('匯款金額核對紀錄無效');}
    if('store' in override&&(typeof override.store!=='string'||!group.stores.includes(override.store)))throw new Error('確認門市不在原始訂單中');
    if('duplicateConfirmed' in override&&typeof override.duplicateConfirmed!=='boolean')throw new Error('加購確認必須是布林值');
    if('refundChecked' in override&&typeof override.refundChecked!=='boolean')throw new Error('退款核對必須是布林值');
  }
  if(!Array.isArray(value.history)||value.history.length>10000)throw new Error('下載紀錄必須是陣列，最多 10,000 筆');
  for(const entry of value.history){
    fields(entry,['at','count'],'下載紀錄');
    if(typeof entry.at!=='string'||entry.at.length>40||!Number.isFinite(Date.parse(entry.at))||!Number.isSafeInteger(entry.count)||entry.count<0||entry.count>10000)throw new Error('下載紀錄的時間或份數無效');
  }
  // 進度不要求對應到現有清單（改 Email 後舊紀錄留著無害）
  const progress=value.progress??{};
  if(!object(progress)||Object.keys(progress).length>10000)throw new Error('買家進度必須是物件，最多 10,000 筆');
  for(const [key,entry] of Object.entries(progress)){
    fields(entry,['stage','at','signature'],'買家進度');
    if(key.length>2000||!stages.some(([stage])=>stage===entry.stage))throw new Error('買家進度的狀態無效');
    if(typeof entry.at!=='string'||entry.at.length>40||!Number.isFinite(Date.parse(entry.at))||typeof entry.signature!=='string'||entry.signature.length>100)throw new Error('買家進度的時間或紀錄無效');
  }
  const purchased=value.purchased??{};
  if(!object(purchased)||Object.keys(purchased).length>10000)throw new Error('已訂數量必須是物件，最多 10,000 項');
  for(const [key,n] of Object.entries(purchased))if(key.length>2000||!Number.isSafeInteger(n)||n<0||n>10000000)throw new Error('已訂數量無效');
  const shipped=value.shipped??{};
  if(!object(shipped)||Object.keys(shipped).length>10000)throw new Error('已寄出紀錄必須是物件，最多 10,000 筆');
  for(const [id,at] of Object.entries(shipped))if(id.length>500||!isTime(at))throw new Error('已寄出紀錄的時間無效');
  const noStore=value.noStore??[];
  if(!Array.isArray(noStore)||noStore.length>1000||noStore.some(c=>typeof c!=='string'||!c.trim()||c.length>500))throw new Error('不用門市的團別無效');
  const costs=value.costs??{};
  if(!object(costs)||Object.keys(costs).length>10000)throw new Error('商品成本必須是物件，最多 10,000 項');
  for(const [key,n] of Object.entries(costs))if(key.length>2000||!Number.isSafeInteger(n)||n<0||n>10000000)throw new Error('商品成本無效');
  const expenses=value.expenses??[];
  if(!Array.isArray(expenses)||expenses.length>1000)throw new Error('其他花費必須是陣列，最多 1,000 筆');
  const expenseIds=new Set();
  for(const e of expenses){
    fields(e,['id','campaign','label','amount'],'其他花費');
    if(typeof e.id!=='string'||!e.id.trim()||e.id.length>100||expenseIds.has(e.id))throw new Error('其他花費的 ID 空白或重複');
    expenseIds.add(e.id);
    if(typeof e.campaign!=='string'||!e.campaign.trim()||e.campaign.length>500||typeof e.label!=='string'||!e.label.trim()||e.label.length>100)throw new Error('其他花費的團別或名稱無效');
    if(!Number.isSafeInteger(e.amount)||e.amount<0||e.amount>10000000)throw new Error('其他花費的金額無效');
  }
  const dates=value.dates??{};
  if(!object(dates)||Object.keys(dates).length>1000)throw new Error('開團日期必須是物件，最多 1,000 團');
  for(const [c,d] of Object.entries(dates))if(c.length>500||!isDate(d))throw new Error('開團日期無效');
  const {savedAt,savedBy,...rest}=value;
  return structuredClone({...rest,progress,purchased,shipped,noStore,costs,expenses,dates,schemaVersion:SCHEMA_VERSION});
}
// 寫進備份檔的文字：多記哪時、哪裡存的（desktop 電腦版／web 手機或網頁版）
export function backupText(state,savedBy,now=new Date()){
  return JSON.stringify({...state,schemaVersion:SCHEMA_VERSION,savedAt:now.toISOString(),savedBy},null,2);
}
// 讀備份檔：回傳 {state, savedAt, savedBy}；舊版備份沒有時間就是 undefined
export function parseBackupFile(text){
  const state=parseBackup(text),raw=JSON.parse(text.replace(/^\uFEFF/,''));
  return {state,savedAt:raw.savedAt,savedBy:raw.savedBy};
}

export function parseBackup(text){
  if(new TextEncoder().encode(text).length>MAX_BACKUP_BYTES)throw new Error('備份超過 5 MB');
  let value;
  try{value=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('無法解析 JSON，請選擇艾麗莎備份檔');}
  return validateBackup(value);
}

// localStorage 單一 setItem 具原子性；先存回復點，才取代主資料。
export function restoreBackup(storage,current,incoming){
  const next=validateBackup(incoming);
  const previous=validateBackup(current);
  storage.setItem(recoveryKey,JSON.stringify(previous));
  storage.setItem(storageKey,JSON.stringify(next));
  return next;
}
