export interface ExternalRecipient {
  id: string
  name?: string
  email?: string
  purpose?: string
  status?: string
  [key: string]: unknown
}
