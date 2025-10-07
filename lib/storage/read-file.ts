"use client"

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === "string") {
        resolve(result)
      } else {
        reject(new Error("No se pudo leer el archivo como cadena."))
      }
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error("Error desconocido al leer el archivo."))
    }
    reader.readAsDataURL(file)
  })

export const buildStoredDocument = async <T extends object = Record<string, never>>(
  file: File,
  metadata: T,
): Promise<
  T & {
    id: string
    name: string
    size: number
    mimeType: string
    uploadedAt: string
    dataUrl: string
  }
> => {
  const dataUrl = await readFileAsDataUrl(file)

  return {
    ...(metadata as T),
    id: crypto.randomUUID ? crypto.randomUUID() : `doc-${Date.now()}`,
    name: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    uploadedAt: new Date().toISOString(),
    dataUrl,
  }
}
