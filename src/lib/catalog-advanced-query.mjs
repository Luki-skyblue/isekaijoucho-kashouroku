const one=value=>Array.isArray(value)?value[0]:value;
const text=value=>typeof one(value)==='string'?one(value).trim().slice(0,120):'';
export const validCreatorKey=value=>typeof value==='string'&&(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)||/^credit-[a-f0-9]{64}$/.test(value));
export const validCreditRole=value=>typeof value==='string'&&value.length>0&&value.length<=120&&value===value.trim()&&!/[\u0000-\u001f\u007f]/.test(value);
export function readCreditQuery(creator,role){
 const key=text(creator),duty=text(role);
 return {creatorKey:validCreatorKey(key)?key:'',creditRole:validCreditRole(duty)?duty:''};
}
export function validFirstDate(value){
 return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!value.startsWith('0000-')&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
}
/** Retain invalid bounds for editing; do not silently broaden the results. */
export function readFirstRange(from,to){
 const firstFrom=text(from),firstTo=text(to);
 const dateError=(firstFrom&&!validFirstDate(firstFrom))||(firstTo&&!validFirstDate(firstTo))
  ?'初出日は有効な日付を指定してください。'
  :firstFrom&&firstTo&&firstFrom>firstTo?'初出日の開始は終了以前にしてください。':null;
 return {firstFrom,firstTo,dateError};
}
