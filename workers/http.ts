import { ApiError } from "./types"
export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text()
  if (text.length > 2_000_000) throw new ApiError(413, "La solicitud supera el límite permitido.", "TOO_LARGE")
  try {
    const value = JSON.parse(text)
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error()
    return value
  } catch { throw new ApiError(400, "El contenido de la solicitud no es válido.", "INVALID_BODY") }
}
export function text(value: unknown, label: string, max = 200, required = true) {
  const result = typeof value === "string" ? value.trim() : ""
  if ((required && !result) || result.length > max) throw new ApiError(400, `Revisa ${label}.`, "INVALID_FIELD")
  return result
}
export function identifier(value: unknown) { const result=text(value, "el identificador", 180);try{return decodeURIComponent(result)}catch{throw new ApiError(400,"Identificador no válido.","INVALID_FIELD")} }
export function scopedFileVersionId(value:unknown,companyId:string,origin:string){
  if(typeof value!=="string")return undefined
  try{const url=new URL(value,origin),match=url.pathname.match(/^\/api\/v1\/companies\/([^/]+)\/files\/([^/]+)$/);return url.origin===new URL(origin).origin&&match&&decodeURIComponent(match[1])===companyId?decodeURIComponent(match[2]):undefined}catch{return undefined}
}
