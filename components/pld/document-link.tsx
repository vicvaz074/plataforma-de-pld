"use client"

import { forwardRef, type AnchorHTMLAttributes } from "react"
import { usePilot } from "@/components/pilot/pilot-provider"
import { resolveSafeDocumentHref } from "@/lib/pld/document-links"

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: unknown }

/** Render legacy metadata, but never activate a non-document destination. */
export const DocumentLink = forwardRef<HTMLAnchorElement, Props>(function DocumentLink({ href, onClick, title, download, ...props }, ref) {
  const { mode, company } = usePilot()
  const safeHref = resolveSafeDocumentHref(href, { mode, companyId: company?.id,
    origin: typeof window === "undefined" ? undefined : window.location.origin,
    purpose: download === undefined ? "preview" : "download" })
  return <a {...props} ref={ref} href={safeHref || undefined} download={safeHref ? download : undefined}
    aria-disabled={safeHref ? props["aria-disabled"] : true}
    title={safeHref ? title : "Referencia bloqueada. Vuelve a cargar el archivo; su historial se conserva."}
    onClick={(event) => { if (!safeHref) { event.preventDefault(); event.stopPropagation(); return } onClick?.(event) }} />
})
