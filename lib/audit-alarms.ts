export type AuditPriority = "alta" | "media" | "baja"
export type AuditStatus = "pendiente" | "en-progreso" | "completada" | "vencida"

export interface AuditReminder {
  id: string
  title: string
  description: string
  dueDate: Date
  priority: AuditPriority
  assignedTo: string[]
  category: string
  notes: string
  status: AuditStatus
  createdAt: Date
}

type StoredAuditReminder = Omit<AuditReminder, "dueDate" | "createdAt"> & {
  dueDate: string
  createdAt: string
}

const STORAGE_KEY = "audit-reminders"

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined"
}

function reviveReminder(reminder: StoredAuditReminder): AuditReminder {
  return {
    ...reminder,
    dueDate: new Date(reminder.dueDate),
    createdAt: new Date(reminder.createdAt),
  }
}

function serializeReminder(reminder: AuditReminder): StoredAuditReminder {
  return {
    ...reminder,
    dueDate: reminder.dueDate.toISOString(),
    createdAt: reminder.createdAt.toISOString(),
  }
}

function saveAuditReminders(reminders: AuditReminder[]) {
  if (!canUseStorage()) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders.map(serializeReminder)))
}

export function getAuditReminders(): AuditReminder[] {
  if (!canUseStorage()) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(reviveReminder) : []
  } catch {
    return []
  }
}

export function addAuditReminder(input: Omit<AuditReminder, "id" | "createdAt">): AuditReminder {
  const reminder: AuditReminder = {
    ...input,
    id: `audit-${Date.now()}`,
    createdAt: new Date(),
  }
  saveAuditReminders([reminder, ...getAuditReminders()])
  return reminder
}

export function deleteAuditReminder(id: string) {
  saveAuditReminders(getAuditReminders().filter((reminder) => reminder.id !== id))
}

export function completeAuditReminder(id: string) {
  saveAuditReminders(
    getAuditReminders().map((reminder) =>
      reminder.id === id ? { ...reminder, status: "completada" } : reminder,
    ),
  )
}

export function getPriorityColor(priority: AuditPriority) {
  if (priority === "alta") return "border-red-200 bg-red-50 text-red-700"
  if (priority === "media") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-emerald-200 bg-emerald-50 text-emerald-700"
}

export function getStatusColor(status: AuditStatus) {
  if (status === "completada") return "bg-emerald-100 text-emerald-700"
  if (status === "vencida") return "bg-red-100 text-red-700"
  if (status === "en-progreso") return "bg-blue-100 text-blue-700"
  return "bg-amber-100 text-amber-700"
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date)
}

export function getDaysRemaining(date: Date) {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const due = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return Math.ceil((due - start) / 86_400_000)
}
