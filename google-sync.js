// Google 表單自動更新：把 Forms API 的表單與回覆轉成跟 Excel／CSV 匯入一樣的表格，再交給 importer.planImport。
// 回覆以 responseId 當來源識別碼；已匯入過的回覆一律略過（不重算、不覆蓋），被買家修改過的另外列出請團主手動核對。
// 對應設定用「題目名稱」記，表單加題目或換順序不會對錯欄；對應的題目不見了就停下來請團主重新對應。
// 前三欄固定；表單有收集 Email 時才加「電子郵件地址」（沒收集還加空白欄，會被自動對應誤選）
export const GOOGLE_HEADERS=['來源識別碼','時間戳記','最後修改時間'];
const EMAIL_HEADER='電子郵件地址';
const MAX_ROWS=10000,MAX_TEXT=500;

// 從表單「編輯」網址取出表單 ID；給買家填的 /forms/d/e/... 網址不能用
export function formIdFromUrl(text){
  const value=String(text??'').trim();
  if(/\/forms\/d\/e\//.test(value))throw new Error('這是給買家填寫的網址。請打開表單的「編輯」頁面，複製網址裡有 /edit 的那個。');
  const match=value.match(/\/forms\/d\/([A-Za-z0-9_-]{20,100})/)||value.match(/^([A-Za-z0-9_-]{20,100})$/);
  if(!match)throw new Error('看不懂這個網址。請打開表單的「編輯」頁面，複製整個網址貼上。');
  return match[1];
}

const taipei=iso=>{
  if(!iso)return '';
  const d=new Date(iso);if(Number.isNaN(d.getTime()))return '';
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}:${p.second}`;
};

// 表單題目 → 欄位。方格題每一列各一欄（「題目 [列]」）；標題、圖片、分段不是題目，略過
export function formQuestions(form,reserved=GOOGLE_HEADERS){
  const questions=[];
  for(const item of form?.items||[]){
    const title=String(item.title??'').trim()||'未命名題目';
    if(item.questionItem?.question?.questionId)questions.push({id:item.questionItem.question.questionId,title});
    for(const q of item.questionGroupItem?.questions||[])if(q.questionId)questions.push({id:q.questionId,title:`${title} [${String(q.rowQuestion?.title??'').trim()}]`});
  }
  // 題目同名時加編號，表格欄名才不會重複
  const used=new Set(reserved);
  for(const q of questions){let name=q.title,n=2;while(used.has(name))name=`${q.title} (${n++})`;used.add(name);q.header=name;}
  return questions;
}

const answerText=answer=>{
  if(!answer)return '';
  if(answer.textAnswers)return (answer.textAnswers.answers||[]).map(a=>String(a.value??'')).join('、');
  if(answer.fileUploadAnswers)return (answer.fileUploadAnswers.answers||[]).map(a=>String(a.fileName??'')).join('、');
  return '';
};

export function responsesToTable(form,responses){
  const type=form?.settings?.emailCollectionType;
  const email=type?type!=='DO_NOT_COLLECT':(responses||[]).some(r=>r.respondentEmail);
  const fixed=email?[...GOOGLE_HEADERS,EMAIL_HEADER]:GOOGLE_HEADERS;
  const questions=formQuestions(form,fixed);
  const headers=[...fixed,...questions.map(q=>q.header)];
  if(headers.length>100)throw new Error('表單題目太多（最多 96 題）');
  const list=[...(responses||[])].sort((a,b)=>String(a.createTime).localeCompare(String(b.createTime)));
  if(list.length>MAX_ROWS)throw new Error('回覆超過 10,000 筆');
  const rows=list.map((r,index)=>({row:index+1,values:[String(r.responseId??''),taipei(r.createTime),taipei(r.lastSubmittedTime),...(email?[String(r.respondentEmail??'')]:[]),...questions.map(q=>answerText(r.answers?.[q.id]))]}));
  for(const row of rows){
    if(!row.values[0])throw new Error('Google 回傳的回覆缺少識別碼');
    if(row.values.some(v=>v.length>MAX_TEXT))throw new Error(`第 ${row.row} 筆回覆有超過 500 字的答案`);
  }
  return {headers,rows,title:String(form?.info?.title||form?.info?.documentTitle||'未命名表單')};
}

// 已匯入過的回覆（含已取消）略過；最後修改時間跟匯入時不同 → 列為「被修改過」
export function splitNew(orders,table,sourceName){
  const imported=new Map();
  for(const o of orders)if(o.source?.name===sourceName&&!imported.has(o.source.rowId))imported.set(o.source.rowId,o);
  const fresh=[],edited=[];
  for(const row of table.rows){
    const old=imported.get(row.values[0]);
    if(!old){fresh.push(row);continue;}
    const at=old.source.headers.indexOf('最後修改時間');
    if(at>=0&&old.source.values[at]!==row.values[2])edited.push({rowId:row.values[0],name:old.name,campaign:old.campaign});
  }
  // vocabRows：拆「勾選款式」時用全部回覆認款式，只抓新回覆也拆得一樣
  return {table:{...table,rows:fresh,vocabRows:table.rows},known:table.rows.length-fresh.length,edited};
}

// 對應設定 ↔ 題目名稱
export function mappingToNames(headers,mapping,products){
  return {mapping:Object.fromEntries(Object.entries(mapping).map(([key,index])=>[key,index>=0?headers[index]:''])),products:products.map(p=>({name:p.name,price:p.price,quantity:p.quantity>=0?headers[p.quantity]:''}))};
}
export function namesToMapping(headers,saved){
  const missing=[];
  const find=name=>{if(!name)return -1;const i=headers.indexOf(name);if(i<0)missing.push(name);return i;};
  const mapping=Object.fromEntries(Object.entries(saved.mapping).map(([key,name])=>[key,find(name)]));
  const products=saved.products.map(p=>({name:p.name,price:p.price,quantity:find(p.quantity)}));
  if(missing.length)throw new Error(`表單裡找不到這些題目：${missing.map(m=>`「${m}」`).join('、')}。題目可能改過名字，請到「資料來源」重新設定 Google 表單。`);
  return {mapping,products};
}
