import { dispatchStorageEvent, isBrowser, readJsonStorage, writeJsonStorage } from "./storage"
import { persistFile } from "./files"

export const DOCUMENT_STORAGE_KEY = "pld-documents"

export interface DocumentRecord {
  id: string
  name: string
  legalEntity: string
  description: string
  type: string
  status: string
  date: string
  renewalDate?: string | null
  fileId: string
  fileName: string
  fileType: string
  fileSize: number
  uploadedAt: string
  userEmail: string
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function readDocuments(): DocumentRecord[] {
  return readJsonStorage<DocumentRecord[]>(DOCUMENT_STORAGE_KEY, [])
}

function writeDocuments(documents: DocumentRecord[]): void {
  writeJsonStorage(DOCUMENT_STORAGE_KEY, documents)
  dispatchStorageEvent(DOCUMENT_STORAGE_KEY)
}

export function getDocuments(): DocumentRecord[] {
  return readDocuments()
}

export async function addDocument(input: {
  name: string
  legalEntity: string
  description: string
  type: string
  status: string
  date: string
  file: File
  userEmail: string
}): Promise<DocumentRecord> {
  if (!isBrowser()) throw new Error("Document creation is only available in the browser")

  const documentDate = new Date(input.date)
  const renewalDate = new Date(documentDate)
  renewalDate.setFullYear(renewalDate.getFullYear() + 1)

  const storedFile = await persistFile(input.file, {
    module: "document-management",
    tags: [input.type],
    expiresAt: renewalDate,
  })

  const record: DocumentRecord = {
    id: generateId(),
    name: input.name,
    legalEntity: input.legalEntity,
    description: input.description,
    type: input.type,
    status: input.status,
    date: input.date,
    renewalDate: renewalDate.toISOString(),
    fileId: storedFile.id,
    fileName: storedFile.name,
    fileType: storedFile.type,
    fileSize: storedFile.size,
    uploadedAt: storedFile.uploadedAt,
    userEmail: input.userEmail,
  }

  const documents = readDocuments()
  writeDocuments([...documents, record])
  return record
}

export function removeDocument(id: string): void {
  if (!isBrowser()) return
  const documents = readDocuments().filter((doc) => doc.id !== id)
  writeDocuments(documents)
}

export function updateDocument(id: string, patch: Partial<DocumentRecord>): DocumentRecord | null {
  if (!isBrowser()) return null
  const documents = readDocuments()
  const updated = documents.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc))
  writeDocuments(updated)
  return updated.find((doc) => doc.id === id) ?? null
}
