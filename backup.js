import {validateOrder,summarize,stages} from './core.js';

export const SCHEMA_VERSION=3;

export const MAX_BACKUP_BYTES=5*1024*1024;
export const storageKey='tuantuan-prototype-v1';
export const recoveryKey=storageKey+'-before-restore';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function fields(value,allowed,label){
  if(!object(value))throw new Error(`${label}必須是物件`);
  if(Object.keys(value).some(key=>!allowed.includes(key)))throw new Error(`${label}包含不支援的欄位，請勿直接匯入其他版本資料`);
}

export function validateBackup(value){
  fields(value,['schemaVersion','orders','overrides','history','demo','progress'],'備份');
  if(value.schemaVersion!==undefined&&![1,2,3].includes(value.schemaVersion))throw new Error('不支援此備份版本');
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
  return structuredClone({...value,progress,schemaVersion:SCHEMA_VERSION});
}

export function parseBackup(text){
  if(new TextEncoder().encode(text).length>MAX_BACKUP_BYTES)throw new Error('備份超過 5 MB');
  let value;
  try{value=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('無法解析 JSON，請選擇團團備份檔');}
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
