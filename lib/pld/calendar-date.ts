/** A legal/calendar day is not an instant. Legacy ISO values retain their
 * written calendar component, rather than shifting through UTC on display. */
export function parsePldCalendarDate(value:string|Date):Date{
  if(value instanceof Date){if(!Number.isFinite(value.getTime()))return new Date(NaN);return localDay(value.getFullYear(),value.getMonth()+1,value.getDate())}
  const match=/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value)
  if(!match||value.length>10&&!Number.isFinite(Date.parse(value)))return new Date(NaN)
  return localDay(Number(match[1]),Number(match[2]),Number(match[3]))
}
function localDay(year:number,month:number,day:number){
  const result=new Date(0);result.setFullYear(year,month-1,day);result.setHours(0,0,0,0)
  return result.getFullYear()===year&&result.getMonth()===month-1&&result.getDate()===day?result:new Date(NaN)
}
export function formatPldCalendarDate(value:string|Date):string{
  const date=parsePldCalendarDate(value)
  return Number.isFinite(date.getTime())?`${String(date.getFullYear()).padStart(4,"0")}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`:""
}
/** Only explicitly named calendar fields change representation. Upload,
 * creation and log timestamps retain their complete ISO instant. */
export function stringifyPldCalendarFields(value:unknown,fields:readonly string[]):string{
  const keys=new Set(fields)
  return JSON.stringify(value,function(this:Record<string,unknown>,key,serialized){
    const original=this[key]
    return keys.has(key)&&(typeof original==="string"||original instanceof Date)?formatPldCalendarDate(original)||serialized:serialized
  })
}
