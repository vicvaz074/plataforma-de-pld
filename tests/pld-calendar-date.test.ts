import assert from "node:assert/strict"
import test from "node:test"
import { differenceInBusinessDays,format } from "date-fns"
import { parsePldCalendarDate,formatPldCalendarDate,stringifyPldCalendarFields } from "../lib/pld/calendar-date"

test("Auditoría conserva el día de captura, recarga, CSV y PDF sin desplazar timestamps",()=>{
  const originalZone=process.env.TZ
  try{
    for(const zone of ["America/Mexico_City","UTC","Asia/Tokyo"]){
      process.env.TZ=zone
      for(const day of ["2026-11-11","2026-01-01","2024-02-29","2026-03-01"]){
        const date=parsePldCalendarDate(day),timestamp=new Date("2026-11-11T02:30:45.123Z")
        assert.equal(formatPldCalendarDate(date),day,zone)
        const encoded=stringifyPldCalendarFields({date,deadline:date,followUpDue:date,receivedAt:date,dueDate:date,respondedAt:date,uploadedAt:timestamp,createdAt:timestamp,trace:[{timestamp}]},["date","deadline","followUpDue","receivedAt","dueDate","respondedAt"])
        const restored=JSON.parse(encoded)
        for(const key of ["date","deadline","followUpDue","receivedAt","dueDate","respondedAt"]){assert.equal(restored[key],day);assert.equal(format(parsePldCalendarDate(restored[key]),"yyyy-MM-dd"),day,`CSV ${zone}`);assert.equal(format(parsePldCalendarDate(restored[key]),"dd/MM/yyyy"),day.split("-").reverse().join("/"),`PDF/resumen ${zone}`)}
        assert.equal(restored.uploadedAt,timestamp.toISOString());assert.equal(restored.createdAt,timestamp.toISOString());assert.equal(restored.trace[0].timestamp,timestamp.toISOString())
        assert.equal(differenceInBusinessDays(parsePldCalendarDate(day),parsePldCalendarDate(restored.deadline)),0)
      }
      assert.equal(formatPldCalendarDate("2026-11-11T00:00:00.000Z"),"2026-11-11",`ISO legacy ${zone}`)
      assert.equal(formatPldCalendarDate("2026-11-11T00:00:00.000-06:00"),"2026-11-11",`ISO offset ${zone}`)
    }
  }finally{if(originalZone===undefined)delete process.env.TZ;else process.env.TZ=originalZone}
})
test("fechas inválidas no se normalizan a otro día ni se borran al serializar",()=>{
  for(const invalid of ["2026-02-30","2026-13-01","2026-00-10","2026-11-11Tinvalid","dato antiguo ilegible"]){assert.equal(Number.isNaN(parsePldCalendarDate(invalid).getTime()),true);assert.equal(formatPldCalendarDate(invalid),"");assert.equal(JSON.parse(stringifyPldCalendarFields({date:invalid},["date"])).date,invalid)}
})
