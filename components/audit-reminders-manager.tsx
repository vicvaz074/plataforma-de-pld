"use client"

import { useState, useEffect } from "react"
import { useLanguage } from "@/lib/LanguageContext"
import { translations } from "@/lib/translations"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Search, Calendar, Users, CheckCircle, Clock, Info } from "lucide-react"
import {
  type AuditReminder,
  type AuditPriority,
  type AuditStatus,
  getAuditReminders,
  addAuditReminder,
  deleteAuditReminder,
  completeAuditReminder,
  getPriorityColor,
  getStatusColor,
  formatDate,
  getDaysRemaining,
} from "@/lib/audit-alarms"

export default function AuditRemindersManager() {
  const { language } = useLanguage()
  const t = translations[language]
  const { toast } = useToast()

  const [reminders, setReminders] = useState<AuditReminder[]>([])
  const [filteredReminders, setFilteredReminders] = useState<AuditReminder[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<AuditStatus | "all">("all")
  const [priorityFilter, setPriorityFilter] = useState<AuditPriority | "all">("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [newReminder, setNewReminder] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "media" as AuditPriority,
    assignedTo: "",
    category: "",
    notes: "",
  })

  useEffect(() => {
    setReminders(getAuditReminders())
  }, [])

  useEffect(() => {
    let filtered = reminders

    if (searchTerm) {
      filtered = filtered.filter(
        (reminder) =>
          reminder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          reminder.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          reminder.category.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((reminder) => reminder.status === statusFilter)
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter((reminder) => reminder.priority === priorityFilter)
    }

    setFilteredReminders(filtered)
  }, [reminders, searchTerm, statusFilter, priorityFilter])

  const handleAddReminder = () => {
    if (!newReminder.title || !newReminder.dueDate) {
      toast({
        title: "Error",
        description: "Por favor completa los campos requeridos (Título y Fecha Límite)",
        variant: "destructive",
      })
      return
    }

    const reminder = addAuditReminder({
      ...newReminder,
      dueDate: new Date(newReminder.dueDate),
      assignedTo: newReminder.assignedTo
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s),
      status: "pendiente",
    })

    setReminders(getAuditReminders())
    setNewReminder({
      title: "",
      description: "",
      dueDate: "",
      priority: "media",
      assignedTo: "",
      category: "",
      notes: "",
    })
    setIsAddDialogOpen(false)

    toast({
      title: t.reminderCreated || "Recordatorio creado",
      description: "El recordatorio se ha creado exitosamente y se almacenó en el sistema",
    })
  }

  const handleCompleteReminder = (id: string) => {
    completeAuditReminder(id)
    setReminders(getAuditReminders())

    toast({
      title: t.reminderCompleted || "Recordatorio completado",
      description: "El recordatorio se ha marcado como completado",
    })
  }

  const handleDeleteReminder = (id: string) => {
    deleteAuditReminder(id)
    setReminders(getAuditReminders())

    toast({
      title: t.reminderDeleted || "Recordatorio eliminado",
      description: "El recordatorio se ha eliminado exitosamente",
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              {t.auditReminders || "Recordatorios de Auditoría"}
            </CardTitle>
            <CardDescription>
              Gestiona recordatorios y tareas de auditoría basados en datos reales del sistema
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowInstructions(!showInstructions)}
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              <Info className="h-4 w-4 mr-2" />
              {showInstructions ? "Ocultar Ayuda" : "¿Cómo usar?"}
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4 mr-2" />
                  {t.addReminder || "Agregar Recordatorio"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{t.addReminder || "Agregar Recordatorio"}</DialogTitle>
                  <DialogDescription>
                    Crea un nuevo recordatorio de auditoría que se almacenará en el sistema
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">{t.reminderTitle || "Título"} *</Label>
                    <Input
                      id="title"
                      value={newReminder.title}
                      onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                      placeholder="Ej: Revisar evaluaciones de riesgo PDP"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">{t.reminderDescription || "Descripción"}</Label>
                    <Textarea
                      id="description"
                      value={newReminder.description}
                      onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
                      placeholder="Descripción detallada de la tarea a realizar"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dueDate">{t.dueDate || "Fecha Límite"} *</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={newReminder.dueDate}
                      onChange={(e) => setNewReminder({ ...newReminder, dueDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="priority">{t.priority || "Prioridad"}</Label>
                    <Select
                      value={newReminder.priority}
                      onValueChange={(value: AuditPriority) => setNewReminder({ ...newReminder, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alta">{t.highPriority || "Alta"}</SelectItem>
                        <SelectItem value="media">{t.mediumPriority || "Media"}</SelectItem>
                        <SelectItem value="baja">{t.lowPriority || "Baja"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="assignedTo">{t.assignedTo || "Asignado a"}</Label>
                    <Input
                      id="assignedTo"
                      value={newReminder.assignedTo}
                      onChange={(e) => setNewReminder({ ...newReminder, assignedTo: e.target.value })}
                      placeholder="Juan Pérez, María García (separados por comas)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">{t.category || "Categoría"}</Label>
                    <Select
                      value={newReminder.category}
                      onValueChange={(value) => setNewReminder({ ...newReminder, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sistemas IA">Sistemas IA</SelectItem>
                        <SelectItem value="Protección de Datos">Protección de Datos</SelectItem>
                        <SelectItem value="Propiedad Intelectual">Propiedad Intelectual</SelectItem>
                        <SelectItem value="Proveedores">Proveedores</SelectItem>
                        <SelectItem value="Políticas">Políticas</SelectItem>
                        <SelectItem value="Entrenamiento">Entrenamiento</SelectItem>
                        <SelectItem value="Comité">Comité</SelectItem>
                        <SelectItem value="General">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddReminder} className="bg-green-600 hover:bg-green-700">
                      Crear Recordatorio
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showInstructions && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-3">¿Cómo crear y gestionar recordatorios efectivos?</h3>
            <div className="space-y-2 text-sm text-green-700">
              <p>
                <strong>1. Título claro:</strong> Use títulos descriptivos como "Revisar sistemas IA de alto riesgo" o
                "Actualizar políticas de privacidad"
              </p>
              <p>
                <strong>2. Fechas realistas:</strong> Establezca fechas límite considerando la complejidad de la tarea
              </p>
              <p>
                <strong>3. Prioridades:</strong> Alta para problemas críticos, Media para tareas regulares, Baja para
                mejoras opcionales
              </p>
              <p>
                <strong>4. Asignación:</strong> Especifique responsables para asegurar accountability
              </p>
              <p>
                <strong>5. Categorización:</strong> Use categorías para organizar recordatorios por módulo del sistema
              </p>
              <p>
                <strong>6. Seguimiento:</strong> Marque como completado cuando termine la tarea para mantener el
                registro actualizado
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder={t.searchReminders || "Buscar recordatorios..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value: AuditStatus | "all") => setStatusFilter(value)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={t.filterByStatus || "Filtrar por Estado"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allStatuses || "Todos los Estados"}</SelectItem>
              <SelectItem value="pendiente">{t.pending || "Pendiente"}</SelectItem>
              <SelectItem value="en-progreso">{t.inProgress || "En Progreso"}</SelectItem>
              <SelectItem value="completada">{t.completed || "Completado"}</SelectItem>
              <SelectItem value="vencida">{t.overdue || "Vencido"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(value: AuditPriority | "all") => setPriorityFilter(value)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={t.filterByPriority || "Filtrar por Prioridad"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allPriorities || "Todas las Prioridades"}</SelectItem>
              <SelectItem value="alta">{t.highPriority || "Alta"}</SelectItem>
              <SelectItem value="media">{t.mediumPriority || "Media"}</SelectItem>
              <SelectItem value="baja">{t.lowPriority || "Baja"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reminders List */}
        {filteredReminders.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t.noReminders || "No hay recordatorios"}</h3>
            <p className="text-gray-600">
              {reminders.length === 0
                ? "Crea tu primer recordatorio de auditoría para comenzar a gestionar tareas"
                : "No se encontraron recordatorios con los filtros aplicados"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReminders.map((reminder) => {
              const daysRemaining = getDaysRemaining(reminder.dueDate)
              const isOverdue = daysRemaining < 0

              return (
                <div key={reminder.id} className="border rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{reminder.title}</h3>
                        <Badge className={getStatusColor(reminder.status)}>
                          {reminder.status === "pendiente"
                            ? t.pending
                            : reminder.status === "en-progreso"
                              ? t.inProgress
                              : reminder.status === "completada"
                                ? t.completed
                                : t.overdue}
                        </Badge>
                        <Badge variant="outline" className={getPriorityColor(reminder.priority)}>
                          {reminder.priority === "alta"
                            ? t.highPriority
                            : reminder.priority === "media"
                              ? t.mediumPriority
                              : t.lowPriority}
                        </Badge>
                      </div>
                      <p className="text-gray-600 mb-2">{reminder.description}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(reminder.dueDate)}
                          {isOverdue ? (
                            <span className="text-red-600 ml-1">
                              ({Math.abs(daysRemaining)} {t.daysOverdue || "días vencido"})
                            </span>
                          ) : daysRemaining === 0 ? (
                            <span className="text-yellow-600 ml-1">(Hoy)</span>
                          ) : (
                            <span className="text-green-600 ml-1">
                              ({daysRemaining} {t.daysRemaining || "días restantes"})
                            </span>
                          )}
                        </span>
                        {reminder.assignedTo.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {reminder.assignedTo.join(", ")}
                          </span>
                        )}
                        <span>{reminder.category}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {reminder.status !== "completada" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCompleteReminder(reminder.id)}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {t.markAsComplete || "Completar"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteReminder(reminder.id)}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
