export interface ProcessingActivity {
  id: number | string
  name?: string
  description?: string
  status?: string
  type?: string
  [key: string]: unknown
}
