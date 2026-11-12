import type { PermissionAction } from "./contracts"

export interface ModuleControlDescriptor {
  tag: string
  type?: string
  role?: string
  text?: string
  action?: string | null
  context?: string | null
}

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
const actions: PermissionAction[] = ["view", "edit", "upload", "download", "approve", "archive"]

/** Legacy controls are classified conservatively; explicit data-pld-action wins.
 * This is presentation only. Every mutation and file request remains server-authorized. */
export function moduleControlAction(control: ModuleControlDescriptor): PermissionAction | null {
  if (control.action === "browse") return null
  if (actions.includes(control.action as PermissionAction)) return control.action as PermissionAction
  if (control.context === "browse") return null
  const text = normalize(control.text || "")
  const tag = control.tag.toLowerCase()
  if (control.role === "tab" || control.role === "navigation") return null
  if (/\b(buscar|busqueda|search|filtrar|filtro|filter|limpiar filtros|seleccionar expediente|selecciona expediente|consulta libre)\b/.test(text)) return null
  if (control.type === "file" || /\b(cargar|subir|adjuntar|importar)\b/.test(text)) return "upload"
  if (control.action === "download" || /\b(descargar|exportar|generar reporte|generar pdf|generar excel|generar xml)\b/.test(text)) return "download"
  if (/\b(eliminar|borrar|archivar|cancelar operacion|cancelar registro)\b/.test(text)) return "archive"
  if (/\b(aprobar|rechazar|firmar|firma|validar expediente|cerrar expediente|cerrar modulo|confirmar presentacion)\b/.test(text)) return "approve"
  if (control.type === "submit" || /\b(guardar|editar|actualizar|registrar|anadir|agregar|nuevo|nueva|crear|restaurar|marcar|resolver|enviar|responder|confirmar beneficiario)\b/.test(text)) return "edit"
  if (/\b(ver|visualizar|vista previa|anterior|siguiente|volver|regresar|cerrar visor|cancelar)\b/.test(text)) return null
  if (["input", "textarea", "select"].includes(tag) || ["checkbox", "radio", "switch", "combobox", "slider"].includes(control.role || "")) return "edit"
  return null
}
