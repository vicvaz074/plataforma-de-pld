"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { LockKeyhole } from "lucide-react"
import { MODULE_LABELS, sessionCan, type Company, type ModuleKey, type PilotSession } from "@/lib/pilot/contracts"
import { moduleControlAction } from "@/lib/pilot/control-permissions"
import { pilotApi, jsonRequest } from "@/lib/pilot/api"

const selector = "button, input, textarea, select, a[download], a[href], [role=checkbox], [role=radio], [role=switch], [role=combobox], [role=slider]"

/** Presentation guard for older forms. data-pld-action makes an action explicit;
 * data-pld-context="browse" keeps selectors/search/navigation usable in read-only mode. */
export function ModuleActionGuard({ children, moduleKey, session, company, mode }: {
  children: ReactNode; moduleKey?: ModuleKey; session: PilotSession | null; company: Company | null; mode: "cloud" | "demo"
}) {
  const root = useRef<HTMLDivElement>(null)
  const [error, setError] = useState("")
  const readOnly = mode === "cloud" && moduleKey && !sessionCan(session, company, moduleKey, "edit")
  useEffect(() => {
    if (mode !== "cloud" || !moduleKey || !root.current) return
    const container = root.current
    const verifiedDownloads = new WeakSet<HTMLElement>()
    const controlled = new Map<HTMLElement, { disabled?: boolean; title: string | null; aria: string | null }>()
    // Header/company navigation is not a domain edit control.
    const isInScope = (node: HTMLElement) => (container.contains(node) && Boolean(node.closest("main"))) || Boolean(node.closest('[role="dialog"], [role="alertdialog"], [role="listbox"]'))
    const actionFor = (node: HTMLElement) => {
      const explicit = node.closest<HTMLElement>("[data-pld-action]")
      const context = node.closest<HTMLElement>("[data-pld-context]")?.dataset.pldContext
      const field = node as HTMLInputElement
      const labels = "labels" in field ? Array.from(field.labels || []).map((label) => label.textContent).join(" ") : ""
      const fileLink = node.tagName === "A" && (node.hasAttribute("download") || /^(?:data:|\/api\/)/.test(node.getAttribute("href") || ""))
      return moduleControlAction({ tag: node.tagName, type: node.getAttribute("type") || undefined,
        role: node.getAttribute("role") || undefined, action: explicit?.dataset.pldAction || (fileLink ? "download" : undefined), context,
        text: [node.getAttribute("aria-label"), node.getAttribute("title"), field.placeholder, field.name, node.id, labels, node.textContent].filter(Boolean).join(" ") })
    }
    const denied = (node: HTMLElement) => {
      const action = actionFor(node)
      return action && !sessionCan(session, company, moduleKey, action) ? action : null
    }
    const scan = () => {
      document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
        if (!isInScope(node)) return
        const action = denied(node)
        if (!action) return
        if (!controlled.has(node)) controlled.set(node, { disabled: "disabled" in node ? (node as HTMLButtonElement).disabled : undefined, title: node.getAttribute("title"), aria: node.getAttribute("aria-disabled") })
        if ("disabled" in node && !(node as HTMLButtonElement).disabled) (node as HTMLButtonElement).disabled = true
        if (node.getAttribute("aria-disabled") !== "true") node.setAttribute("aria-disabled", "true")
        if (!node.hasAttribute("data-pld-guarded")) node.setAttribute("data-pld-guarded", action)
        if (!node.title) node.title = `No tienes permiso de ${action === "download" ? "descarga" : action === "upload" ? "carga" : action === "approve" ? "aprobación" : action === "archive" ? "archivo" : "edición"} en este módulo.`
      })
    }
    const prevent = (event: Event) => {
      if (!(event.target instanceof Element)) return
      if (event.type === "submit" && container.contains(event.target) && !sessionCan(session, company, moduleKey, "edit")) { event.preventDefault(); event.stopImmediatePropagation(); return }
      const node = event.target.closest<HTMLElement>(selector)
      if (node && isInScope(node) && denied(node)) { event.preventDefault(); event.stopImmediatePropagation() }
      else if (event.type === "click" && node && isInScope(node) && actionFor(node) === "download" && company) {
        if (verifiedDownloads.has(node)) { verifiedDownloads.delete(node); return }
        event.preventDefault(); event.stopImmediatePropagation()
        void pilotApi(`/companies/${encodeURIComponent(company.id)}/authorize`, jsonRequest("POST", { moduleKey, action: "download" })).then(() => { setError(""); verifiedDownloads.add(node); node.click() }).catch((reason) => setError(reason instanceof Error ? reason.message : "No se autorizó la descarga."))
      }
    }
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "role", "data-pld-action", "aria-label"] })
    document.addEventListener("click", prevent, true)
    document.addEventListener("change", prevent, true)
    document.addEventListener("submit", prevent, true)
    return () => {
      observer.disconnect()
      document.removeEventListener("click", prevent, true); document.removeEventListener("change", prevent, true); document.removeEventListener("submit", prevent, true)
      controlled.forEach((previous, node) => {
        if (previous.disabled !== undefined) (node as HTMLButtonElement).disabled = previous.disabled
        for (const [name, value] of [["title", previous.title], ["aria-disabled", previous.aria]] as const) value === null ? node.removeAttribute(name) : node.setAttribute(name, value)
        node.removeAttribute("data-pld-guarded")
      })
    }
  }, [mode, moduleKey, session, company])
  return <div ref={root}>{error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}{readOnly && <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"><LockKeyhole className="h-4 w-4 shrink-0" />Modo consulta · {MODULE_LABELS[moduleKey!]}. Puedes navegar y consultar; las modificaciones requieren permiso.</div>}{children}</div>
}
