export interface Document {
  id: string
  name: string
  legalEntity?: string
  description?: string
  type?: string
  status?: string
  date?: string
  fileName?: string
  userEmail?: string
  [key: string]: unknown
}

interface NewDocumentInput {
  name: string
  legalEntity?: string
  description?: string
  type?: string
  status?: string
  date?: string
  file?: File
  userEmail?: string
}

const STORAGE_KEY = "documents"

function readDocuments(): Document[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeDocuments(documents: Document[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(documents))
}

export async function addDocument(input: NewDocumentInput): Promise<Document> {
  const document: Document = {
    id: `doc-${Date.now()}`,
    name: input.name,
    legalEntity: input.legalEntity,
    description: input.description,
    type: input.type,
    status: input.status,
    date: input.date,
    fileName: input.file?.name,
    userEmail: input.userEmail,
  }

  writeDocuments([document, ...readDocuments()])
  return document
}
