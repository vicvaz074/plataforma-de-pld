export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function readJsonStorage<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch (error) {
    console.error(`[storage] Failed to read key "${key}":`, error)
    return fallback
  }
}

export function writeJsonStorage<T>(key: string, value: T): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`[storage] Failed to write key "${key}":`, error)
  }
}

export function removeStorageKey(key: string): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(key)
  } catch (error) {
    console.error(`[storage] Failed to remove key "${key}":`, error)
  }
}

export function dispatchStorageEvent(key: string): void {
  if (!isBrowser()) return
  const event = new CustomEvent("pld-storage-updated", { detail: { key } })
  window.dispatchEvent(event)
}
