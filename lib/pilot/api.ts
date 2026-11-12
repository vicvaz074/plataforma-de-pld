export class PilotApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); this.name = "PilotApiError" }
}
export async function pilotApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path.startsWith("/api/") ? path : `/api/v1${path}`, {
    ...options, credentials: "same-origin", cache: "no-store",
    headers: { ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options.headers },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new PilotApiError(response.status, body?.message || body?.error || `No se pudo completar la solicitud (${response.status}).`, body)
  return body as T
}
export const jsonRequest = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })
