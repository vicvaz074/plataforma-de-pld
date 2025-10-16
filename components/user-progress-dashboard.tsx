"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  FileText,
  Shield,
  Users,
  Database,
  FileWarning,
  FileCheck,
  UserCog,
  Bell,
  Book,
  BrainCircuit,
  ClipboardList,
  Scale,
  AlertOctagon,
  Megaphone,
} from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"

// Definición de las secciones principales con sus estados
export interface Section {
  id: string
  title: string
  description: string
  path: string
  progress: number
  status: "no-iniciado" | "en-progreso" | "completado" | "pendiente-revision"
  iconName: string
  category: "datos" | "documentacion" | "seguridad" | "cumplimiento" | "capacitacion"
  priority: number // 1 = alta, 2 = media, 3 = baja
  tasks: {
    id: string
    title: string
    completed: boolean
  }[]
}

// Función para obtener el componente de icono según su nombre
const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case "Database":
      return <Database className="h-4 w-4" />
    case "FileCheck":
      return <FileCheck className="h-4 w-4" />
    case "FileWarning":
      return <FileWarning className="h-4 w-4" />
    case "UserCog":
      return <UserCog className="h-4 w-4" />
    case "Users":
      return <Users className="h-4 w-4" />
    case "Shield":
      return <Shield className="h-4 w-4" />
    case "Book":
      return <Book className="h-4 w-4" />
    case "BrainCircuit":
      return <BrainCircuit className="h-4 w-4" />
    case "ClipboardList":
      return <ClipboardList className="h-4 w-4" />
    case "Scale":
      return <Scale className="h-4 w-4" />
    case "AlertOctagon":
      return <AlertOctagon className="h-4 w-4" />
    case "Bell":
      return <Bell className="h-4 w-4" />
    case "FileText":
      return <FileText className="h-4 w-4" />
    default:
      return <FileText className="h-4 w-4" />
  }
}

// Estado inicial de progreso de usuario con las 12 secciones
const initialSections: Section[] = [
  {
    id: "inventario-datos",
    title: "Inventario de Datos Personales",
    description: "Documenta el ciclo de vida de los datos y la proporcionalidad de los mismos en las distintas áreas.",
    path: "/rat",
    progress: 0,
    status: "no-iniciado",
    iconName: "Database",
    category: "datos",
    priority: 1,
    tasks: [
      { id: "idd-1", title: "Identificar áreas que procesan datos", completed: false },
      { id: "idd-2", title: "Documentar tipos de datos por área", completed: false },
      { id: "idd-3", title: "Establecer ciclos de vida", completed: false },
      { id: "idd-4", title: "Definir bases legales", completed: false },
    ],
  },
  {
    id: "avisos-privacidad",
    title: "Avisos de Privacidad",
    description: "Revisa y genera los avisos de privacidad requeridos y documenta su puesta a disposición.",
    path: "/document-management",
    progress: 0,
    status: "no-iniciado",
    iconName: "FileCheck",
    category: "documentacion",
    priority: 1,
    tasks: [
      { id: "ap-1", title: "Revisar avisos existentes", completed: false },
      { id: "ap-2", title: "Adaptar conforme a normativa", completed: false },
      { id: "ap-3", title: "Documentar puesta a disposición", completed: false },
    ],
  },
  {
    id: "contratos-terceros",
    title: "Contratos con Terceros",
    description: "Revisa y adapta instrumentos jurídicos para regular comunicaciones de datos a terceros.",
    path: "/third-party-contracts",
    progress: 0,
    status: "no-iniciado",
    iconName: "FileWarning",
    category: "documentacion",
    priority: 1,
    tasks: [
      { id: "ct-1", title: "Inventariar relaciones con terceros", completed: false },
      { id: "ct-2", title: "Revisar contratos actuales", completed: false },
      { id: "ct-3", title: "Actualizar cláusulas de protección", completed: false },
    ],
  },
  {
    id: "delegado-proteccion",
    title: "Delegado de Protección de Datos",
    description: "Documenta la designación y actividades periódicas del DPD ante la Alta Dirección.",
    path: "/dpo",
    progress: 0,
    status: "no-iniciado",
    iconName: "UserCog",
    category: "cumplimiento",
    priority: 2,
    tasks: [
      { id: "dpd-1", title: "Designar al DPD", completed: false },
      { id: "dpd-2", title: "Documentar actividades periódicas", completed: false },
      { id: "dpd-3", title: "Establecer canal de comunicación", completed: false },
    ],
  },
  {
    id: "derechos-arco",
    title: "Derechos ARCO",
    description: "Revisa procesos para atención de derechos ARCO y registra las solicitudes recibidas.",
    path: "/arco-rights",
    progress: 0,
    status: "no-iniciado",
    iconName: "Users",
    category: "cumplimiento",
    priority: 1,
    tasks: [
      { id: "arco-1", title: "Establecer procedimiento", completed: false },
      { id: "arco-2", title: "Crear formularios de solicitud", completed: false },
      { id: "arco-3", title: "Definir plazos de respuesta", completed: false },
      { id: "arco-4", title: "Registrar y dar seguimiento", completed: false },
    ],
  },
  {
    id: "sistema-seguridad",
    title: "Programa de Prevención en Lavado de Dinero",
    description: "Identifica medidas de seguridad aplicables a los datos y revisa su implementación.",
    path: "/security-system",
    progress: 0,
    status: "no-iniciado",
    iconName: "Shield",
    category: "seguridad",
    priority: 1,
    tasks: [
      { id: "ss-1", title: "Identificar medidas actuales", completed: false },
      { id: "ss-2", title: "Evaluar brechas de seguridad", completed: false },
      { id: "ss-3", title: "Implementar nuevas medidas", completed: false },
      { id: "ss-4", title: "Documentar sistema de gestión", completed: false },
    ],
  },
  {
    id: "entrenamiento-davara",
    title: "Entrenamiento con Davara",
    description: "Accede a cursos de capacitación generales y especializados en protección de datos.",
    path: "/davara-training",
    progress: 0,
    status: "no-iniciado",
    iconName: "Book",
    category: "capacitacion",
    priority: 2,
    tasks: [
      { id: "ed-1", title: "Completar curso básico", completed: false },
      { id: "ed-2", title: "Realizar evaluaciones", completed: false },
      { id: "ed-3", title: "Obtener certificaciones", completed: false },
    ],
  },
  {
    id: "concientizacion",
    title: "Concientización",
    description: "Revisa y mejora prácticas internas creando y difundiendo materiales de concientización.",
    path: "/awareness-training",
    progress: 0,
    status: "no-iniciado",
    iconName: "BrainCircuit",
    category: "capacitacion",
    priority: 2,
    tasks: [
      { id: "con-1", title: "Desarrollar materiales", completed: false },
      { id: "con-2", title: "Programar sesiones", completed: false },
      { id: "con-3", title: "Evaluar resultados", completed: false },
    ],
  },
  {
    id: "programa-gestion",
    title: "Programa de Gestión de Datos",
    description: "Revisa la implementación de políticas y procedimientos de protección de datos.",
    path: "/data-policies",
    progress: 0,
    status: "no-iniciado",
    iconName: "ClipboardList",
    category: "cumplimiento",
    priority: 2,
    tasks: [
      { id: "pg-1", title: "Revisar políticas actuales", completed: false },
      { id: "pg-2", title: "Actualizar procedimientos", completed: false },
      { id: "pg-3", title: "Documentar implementación", completed: false },
    ],
  },
  {
    id: "gestion-procedimientos",
    title: "Gestión de Procedimientos",
    description: "Registra y da seguimiento a procedimientos legales en protección de datos.",
    path: "/litigation-management",
    progress: 0,
    status: "no-iniciado",
    iconName: "Scale",
    category: "cumplimiento",
    priority: 3,
    tasks: [
      { id: "gp-1", title: "Registrar procedimientos", completed: false },
      { id: "gp-2", title: "Documentar actuaciones", completed: false },
      { id: "gp-3", title: "Establecer sistema de alertas", completed: false },
    ],
  },
  {
    id: "incidentes-seguridad",
    title: "Gestión de Incidentes",
    description: "Identifica elementos para gestión de incidentes de seguridad y realiza su registro.",
    path: "/incidents-breaches",
    progress: 0,
    status: "no-iniciado",
    iconName: "AlertOctagon",
    category: "seguridad",
    priority: 1,
    tasks: [
      { id: "is-1", title: "Definir protocolo de respuesta", completed: false },
      { id: "is-2", title: "Establecer equipo responsable", completed: false },
      { id: "is-3", title: "Implementar sistema de registro", completed: false },
      { id: "is-4", title: "Documentar acciones correctivas", completed: false },
    ],
  },
  {
    id: "recordatorios-auditoria",
    title: "Recordatorios de Auditoría",
    description: "Gestiona alertas y recordatorios para revisiones periódicas y auditorías.",
    path: "/audit-alarms",
    progress: 0,
    status: "no-iniciado",
    iconName: "Bell",
    category: "cumplimiento",
    priority: 3,
    tasks: [
      { id: "ra-1", title: "Establecer calendario", completed: false },
      { id: "ra-2", title: "Configurar alertas", completed: false },
      { id: "ra-3", title: "Documentar resultados", completed: false },
    ],
  },
]

// Categorías para la vista por pestañas
const categories = [
  { id: "todas", name: "Todas las secciones", iconName: "FileText" },
  { id: "datos", name: "Gestión de Datos", iconName: "Database" },
  { id: "documentacion", name: "Documentación", iconName: "FileText" },
  { id: "seguridad", name: "Seguridad", iconName: "Shield" },
  { id: "cumplimiento", name: "Cumplimiento", iconName: "ClipboardList" },
  { id: "capacitacion", name: "Capacitación", iconName: "Book" },
]

// Componente para tarjeta de sección con progreso
const SectionCard = ({
  section,
  onUpdateTask,
}: {
  section: Section
  onUpdateTask: (sectionId: string, taskId: string, completed: boolean) => void
}) => {
  // Obtener color según el estado
  const getStatusColor = (status: Section["status"]) => {
    switch (status) {
      case "completado":
        return "text-green-500"
      case "en-progreso":
        return "text-blue-500"
      case "pendiente-revision":
        return "text-amber-500"
      default:
        return "text-gray-400"
    }
  }

  // Obtener icono según el estado
  const getStatusIcon = (status: Section["status"]) => {
    switch (status) {
      case "completado":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "en-progreso":
        return <Clock className="h-5 w-5 text-blue-500" />
      case "pendiente-revision":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  // Obtener icono de prioridad
  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1:
        return <span className="text-xs font-medium bg-red-100 text-red-800 px-2 py-1 rounded-full">Alta</span>
      case 2:
        return <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Media</span>
      case 3:
        return <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-1 rounded-full">Baja</span>
      default:
        return null
    }
  }

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center">
          <div className="mr-2 rounded-full bg-muted p-2">{getIconComponent(section.iconName)}</div>
          <div>
            <CardTitle className="text-md font-medium">{section.title}</CardTitle>
            <div className="mt-1">{getPriorityBadge(section.priority)}</div>
          </div>
        </div>
        <div className={getStatusColor(section.status)}>{getStatusIcon(section.status)}</div>
      </CardHeader>
      <CardContent className="pb-2">
        <CardDescription className="line-clamp-2">{section.description}</CardDescription>
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progreso</span>
            <span className="font-medium">{section.progress}%</span>
          </div>
          <Progress value={section.progress} className="h-2" />
        </div>
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Tareas pendientes:</h4>
          <ScrollArea className="h-[105px]">
            <ul className="space-y-1 pr-4">
              {section.tasks.map((task) => (
                <li key={task.id} className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    id={task.id}
                    checked={task.completed}
                    onChange={(e) => onUpdateTask(section.id, task.id, e.target.checked)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <label htmlFor={task.id} className={task.completed ? "line-through text-muted-foreground" : ""}>
                    {task.title}
                  </label>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      </CardContent>
      <CardFooter>
        <Link href={section.path} className="w-full">
          <Button variant="outline" className="w-full bg-transparent">
            <span>Ir a sección</span>
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}

// Componente para mostrar las próximas tareas
const NextTasksList = ({ sections }: { sections: Section[] }) => {
  // Obtener todas las tareas no completadas, priorizadas
  const pendingTasks = sections
    .flatMap((section) =>
      section.tasks
        .filter((task) => !task.completed)
        .map((task) => ({
          sectionId: section.id,
          sectionTitle: section.title,
          sectionPath: section.path,
          sectionPriority: section.priority,
          taskId: task.id,
          taskTitle: task.title,
        })),
    )
    .sort((a, b) => a.sectionPriority - b.sectionPriority)
    .slice(0, 5) // Solo mostrar las 5 primeras tareas

  if (pendingTasks.length === 0) {
    return <div className="text-center p-4 text-muted-foreground">¡Todas las tareas están completadas!</div>
  }

  return (
    <ul className="space-y-3">
      {pendingTasks.map((task) => (
        <li key={task.taskId} className="bg-muted p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-sm">{task.taskTitle}</span>
              <div className="text-xs text-muted-foreground mt-1">{task.sectionTitle}</div>
            </div>
            <Link href={task.sectionPath}>
              <Button variant="ghost" size="sm">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </li>
      ))}
    </ul>
  )
}

export const UserProgressDashboard = () => {
  const { toast } = useToast()
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [overallProgress, setOverallProgress] = useState(0)
  const [nextRecommendedSection, setNextRecommendedSection] = useState<Section | null>(null)
  const [activeCategory, setActiveCategory] = useState("todas")

  // Cargar datos de localStorage al iniciar
  useEffect(() => {
    const savedProgress = localStorage.getItem("userSectionsProgress")
    if (savedProgress) {
      try {
        const parsedData = JSON.parse(savedProgress)
        setSections(parsedData)
      } catch (error) {
        console.error("Error al cargar datos de progreso:", error)
      }
    }
  }, [])

  // Actualizar progreso general y recomendación cuando cambian las secciones
  useEffect(() => {
    // Calcular progreso general
    const totalTasks = sections.reduce((acc, section) => acc + section.tasks.length, 0)
    const completedTasks = sections.reduce((acc, section) => acc + section.tasks.filter((t) => t.completed).length, 0)

    const newOverallProgress = Math.round((completedTasks / totalTasks) * 100) || 0
    setOverallProgress(newOverallProgress)

    // Guardar en localStorage
    localStorage.setItem("userSectionsProgress", JSON.stringify(sections))

    // Determinar próxima sección recomendada (prioridad alta primero)
    const notCompletedSections = sections
      .filter((s) => s.progress < 100)
      .sort((a, b) => {
        // Primero por prioridad
        if (a.priority !== b.priority) return a.priority - b.priority
        // Luego por progreso (prefiriendo secciones ya iniciadas)
        return b.progress - a.progress
      })

    setNextRecommendedSection(notCompletedSections.length > 0 ? notCompletedSections[0] : null)
  }, [sections])

  // Actualizar tarea y recalcular progreso de sección
  const handleUpdateTask = (sectionId: string, taskId: string, completed: boolean) => {
    setSections((prevSections) => {
      const updatedSections = prevSections.map((section) => {
        if (section.id === sectionId) {
          // Actualizar la tarea específica
          const updatedTasks = section.tasks.map((task) => (task.id === taskId ? { ...task, completed } : task))

          // Calcular nuevo progreso
          const completedTasksCount = updatedTasks.filter((t) => t.completed).length
          const totalTasksCount = updatedTasks.length
          const newProgress = Math.round((completedTasksCount / totalTasksCount) * 100)

          // Determinar nuevo estado
          let newStatus: Section["status"] = "no-iniciado"
          if (newProgress === 100) {
            newStatus = "pendiente-revision"
            // Notificar al usuario
            toast({
              title: "¡Sección completada!",
              description: `Has completado todas las tareas de ${section.title}. Un administrador revisará tu progreso.`,
            })
          } else if (newProgress > 0) {
            newStatus = "en-progreso"
          }

          return {
            ...section,
            tasks: updatedTasks,
            progress: newProgress,
            status: newProgress > 0 ? newStatus : "no-iniciado",
          }
        }
        return section
      })

      return updatedSections
    })
  }

  // Obtener secciones filtradas por categoría
  const filteredSections =
    activeCategory === "todas" ? sections : sections.filter((section) => section.category === activeCategory)

  // Calcular progreso por categoría
  const getCategoryProgress = (categoryId: string) => {
    const categorySections = sections.filter((section) => categoryId === "todas" || section.category === categoryId)

    if (!categorySections.length) return 0

    const totalTasks = categorySections.reduce((acc, section) => acc + section.tasks.length, 0)
    const completedTasks = categorySections.reduce(
      (acc, section) => acc + section.tasks.filter((t) => t.completed).length,
      0,
    )

    return Math.round((completedTasks / totalTasks) * 100) || 0
  }

  // Función para simular progreso aleatorio (para demo)
  const simulateRandomProgress = () => {
    setSections((prevSections) => {
      return prevSections.map((section) => {
        // Generar progreso aleatorio entre 0-100%
        const randomProgress = Math.floor(Math.random() * 101)
        // Actualizar tareas según el progreso
        const updatedTasks = section.tasks.map((task) => {
          // Probabilidad de que la tarea esté completada basada en el progreso
          const isCompleted = Math.random() * 100 < randomProgress
          return { ...task, completed: isCompleted }
        })

        // Determinar estado
        let newStatus: Section["status"] = "no-iniciado"
        if (randomProgress === 100) {
          newStatus = Math.random() > 0.5 ? "completado" : "pendiente-revision"
        } else if (randomProgress > 0) {
          newStatus = "en-progreso"
        }

        return {
          ...section,
          tasks: updatedTasks,
          progress: randomProgress,
          status: randomProgress > 0 ? newStatus : "no-iniciado",
        }
      })
    })

    toast({
      title: "Datos de demostración generados",
      description: "Se ha generado progreso aleatorio en las secciones para fines de demostración.",
    })
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8 space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Panel de Control de Cumplimiento</h1>
        <p className="text-muted-foreground">
          Bienvenido a tu panel de control. Aquí puedes ver tu progreso en el cumplimiento normativo y gestionar tus
          tareas.
        </p>
      </div>

      {/* Resumen y recomendación */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-6 mb-8">
        <Card className="col-span-1 md:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-medium">Progreso General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Estado general</span>
                  <span className="text-sm font-bold">{overallProgress}% completado</span>
                </div>
                <Progress value={overallProgress} className="h-2" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Has completado {sections.filter((s) => s.status === "completado").length} de {sections.length}{" "}
                  secciones principales.
                </p>
              </div>

              {/* Progreso por categoría */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                {categories
                  .filter((cat) => cat.id !== "todas")
                  .map((category) => (
                    <div key={category.id} className="bg-muted rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        {getIconComponent(category.iconName)}
                        <span className="text-xs font-medium">{category.name}</span>
                      </div>
                      <Progress value={getCategoryProgress(category.id)} className="h-1.5" />
                      <span className="text-xs block mt-1 text-right">{getCategoryProgress(category.id)}%</span>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-medium">Próximas Tareas</CardTitle>
          </CardHeader>
          <CardContent>
            <NextTasksList sections={sections} />
          </CardContent>
        </Card>
      </div>

      {/* Recomendación principal si hay una sección prioritaria */}
      {nextRecommendedSection && (
        <div className="mb-8">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="bg-primary rounded-full p-3">
                  <Megaphone className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-lg">Recomendación prioritaria</h3>
                  <p className="text-muted-foreground">
                    {nextRecommendedSection.progress > 0
                      ? `Continúa trabajando en "${nextRecommendedSection.title}" (${nextRecommendedSection.progress}% completado)`
                      : `Comienza con "${nextRecommendedSection.title}"`}
                  </p>
                  <p className="mt-1 text-sm">{nextRecommendedSection.description}</p>
                </div>
                <Link href={nextRecommendedSection.path}>
                  <Button className="shrink-0">Ir ahora</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Botones de acción para demo */}
      <div className="mb-6 flex items-center justify-between">
        <Button variant="outline" onClick={simulateRandomProgress} className="text-xs bg-transparent">
          Generar datos de demo
        </Button>

        {/* Botones para aprobar secciones */}
        {sections.some((s) => s.status === "pendiente-revision") && (
          <Button
            onClick={() => {
              setSections((prevSections) =>
                prevSections.map((section) =>
                  section.status === "pendiente-revision" ? { ...section, status: "completado" } : section,
                ),
              )
              toast({
                title: "Secciones aprobadas",
                description: "Un administrador ha revisado y aprobado las secciones pendientes.",
              })
            }}
            variant="secondary"
            className="text-xs"
          >
            Simular aprobación de administrador
          </Button>
        )}
      </div>

      {/* Pestañas por categoría */}
      <Tabs defaultValue="todas" value={activeCategory} onValueChange={setActiveCategory} className="mb-8">
        <TabsList className="mb-4">
          {categories.map((category) => (
            <TabsTrigger key={category.id} value={category.id} className="flex items-center gap-1">
              {getIconComponent(category.iconName)}
              <span>{category.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSections.map((section) => (
              <SectionCard key={section.id} section={section} onUpdateTask={handleUpdateTask} />
            ))}
          </div>

          {filteredSections.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No hay secciones en esta categoría</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Resumen estadístico */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tareas Completadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sections.reduce((acc, section) => acc + section.tasks.filter((t) => t.completed).length, 0)}
              <span className="text-sm text-muted-foreground ml-1">
                /{sections.reduce((acc, section) => acc + section.tasks.length, 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Secciones en Progreso</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sections.filter((s) => s.status === "en-progreso").length}
              <span className="text-sm text-muted-foreground ml-1">/{sections.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendientes Revisión</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sections.filter((s) => s.status === "pendiente-revision").length}
              <span className="text-sm text-muted-foreground ml-1">/{sections.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Secciones Completadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sections.filter((s) => s.status === "completado").length}
              <span className="text-sm text-muted-foreground ml-1">/{sections.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
