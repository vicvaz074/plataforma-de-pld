import { dispatchStorageEvent, isBrowser, readJsonStorage, writeJsonStorage } from "./storage"

export const FILE_STORAGE_KEY = "pld-file-storage"

export interface StoredFileRecord {
  id: string
  name: string
  type: string
  size: number
  dataUrl: string
  uploadedAt: string
  module: string
  tags: string[]
  expiresAt?: string | null
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"))
    reader.readAsDataURL(file)
  })
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function persistFile(
  file: File,
  options: { module: string; tags?: string[]; expiresAt?: Date | null } = { module: "general" },
): Promise<StoredFileRecord> {
  if (!isBrowser()) throw new Error("File persistence only works in the browser")

  const dataUrl = await readFileAsDataUrl(file)
  const record: StoredFileRecord = {
    id: generateId(),
    name: file.name,
    type: file.type,
    size: file.size,
    dataUrl,
    uploadedAt: new Date().toISOString(),
    module: options.module,
    tags: options.tags ?? [],
    expiresAt: options.expiresAt ? options.expiresAt.toISOString() : null,
  }

  const current = readJsonStorage<StoredFileRecord[]>(FILE_STORAGE_KEY, [])
  writeJsonStorage(FILE_STORAGE_KEY, [...current, record])
  dispatchStorageEvent(FILE_STORAGE_KEY)
  return record
}

export function listStoredFiles(module?: string): StoredFileRecord[] {
  const records = readJsonStorage<StoredFileRecord[]>(FILE_STORAGE_KEY, [])
  return module ? records.filter((record) => record.module === module) : records
}

export function getStoredFile(id: string): StoredFileRecord | undefined {
  return listStoredFiles().find((record) => record.id === id)
}

export function deleteStoredFile(id: string): void {
  if (!isBrowser()) return
  const remaining = listStoredFiles().filter((record) => record.id !== id)
  writeJsonStorage(FILE_STORAGE_KEY, remaining)
  dispatchStorageEvent(FILE_STORAGE_KEY)
}

export function downloadStoredFile(record: StoredFileRecord): void {
  if (!isBrowser()) return
  const link = document.createElement("a")
  link.href = record.dataUrl
  link.download = record.name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export async function openStoredFile(record: StoredFileRecord): Promise<void> {
  if (!isBrowser()) return
  const newWindow = window.open()
  if (!newWindow) throw new Error("No se pudo abrir una nueva ventana para visualizar el archivo")
  const response = await fetch(record.dataUrl)
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  newWindow.location.href = blobUrl
}
