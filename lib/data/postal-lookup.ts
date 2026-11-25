import { findCodigoPostalInfo, registerCodigoPostalInfo, type CodigoPostalInfo, type CodigoPostalSnapshot } from "./codigos-postales"

// Download the bundled public catalog, never the entered postal code.
let pending: Promise<Map<string, CodigoPostalInfo>> | undefined
export async function lookupBundledPostalCode(code: string): Promise<CodigoPostalInfo | undefined> {
  if (!/^\d{5}$/.test(code)) return undefined
  if (!pending) {
    pending = fetch("/data/sat-postal-catalog-mx.json", { redirect: "error", credentials: "same-origin" })
      .then(async res => {
        if (!res.ok) throw new Error("Catálogo postal no disponible")
        const { records } = await res.json() as CodigoPostalSnapshot
        if (!Array.isArray(records)) throw new Error("Catálogo postal inválido")
        return new Map(records.map(row => [row.codigo, row] as const))
      })
      .catch(() => { pending = undefined; return new Map<string, CodigoPostalInfo>() })
  }
  const found = (await pending).get(code)
  if (found) registerCodigoPostalInfo(found)
  return found ?? findCodigoPostalInfo(code)
}
