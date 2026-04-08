"use client"

import Link from "next/link"
import { useLanguage } from "@/lib/LanguageContext"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { ChevronLeft, LayoutDashboard, Shield, FileCheck, Users, FileText, GraduationCap, Search, Database, Settings, Sparkles, Book, ClipboardCheck } from "lucide-react"
import { translations } from "@/lib/translations"
import { aliciaTranslations } from "@/lib/alicia-translations"

const navigationItems = [
  { key: "dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { key: "registroSat", icon: FileCheck, href: "/registro-sat" },
  { key: "expedienteUnico", icon: Users, href: "/kyc-expediente" },
  { key: "actividadesVulnerables", icon: Shield, href: "/actividades-vulnerables" },
  { key: "ebr", icon: ClipboardCheck, href: "/ebr" },
  { key: "avisosInformes", icon: FileText, href: "/avisos-informes" },
  { key: "capacitacionControl", icon: GraduationCap, href: "/capacitacion-control" },
  { key: "auditoriaVerificacion", icon: Search, href: "/auditoria-verificacion" },
  { key: "evidenciasTrazabilidad", icon: Database, href: "/evidencias-trazabilidad" },
  { key: "gobernanzaControl", icon: Settings, href: "/gobernanza-control" },
  { key: "compiladoLeyes", icon: Book, href: "/marco-normativo-aplicable" },
  { key: "alicia", icon: Sparkles, href: "/alicia" },
]

type SidebarProps = {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { language } = useLanguage()
  const pathname = usePathname()
  const t = translations[language]
  const aliciaT = aliciaTranslations[language]

  return (
    <aside
      className="fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground px-3 pt-0 pb-4 flex flex-col flex-shrink-0 z-40 transition-[width] duration-300"
      style={{ width: collapsed ? "5rem" : "16.42rem" }}
    >
      <div className="mb-3 h-16 flex items-center justify-end">
        {!collapsed && (
          <Link href="/" className="flex items-center justify-center flex-1 min-w-0 mr-2 h-full">
            <Image
              src="/images/design-mode/image.png"
              alt="Davara Governance"
              width={170}
              height={44}
              className="h-11 w-auto object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
              priority
            />
          </Link>
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          className="h-9 w-9 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0"
        >
          <ChevronLeft className={`h-5 w-5 transition-transform ${collapsed ? "rotate-180" : "rotate-0"}`} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto">
        <ul className="h-full flex flex-col justify-evenly gap-1 py-1">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            const displayText = item.key === "alicia" ? aliciaT[item.key] : t[item.key]

            return (
              <li key={item.key} className="relative">
                <Link
                  href={item.href}
                  className={`relative flex items-center transition-colors rounded-xl text-sm ${
                    item.key === "alicia" ? "justify-center px-2 py-3" : collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-3"
                  } ${isActive ? "bg-white text-gray-900" : "text-white hover:text-white hover:bg-white/10"}`}
                  title={collapsed ? displayText : undefined}
                >
                  {item.key === "alicia" ? (
                    <Image
                      src="/Alicia_Sin_Despachos.png"
                      alt="Alicia"
                      width={collapsed ? 74 : 98}
                      height={collapsed ? 22 : 30}
                      className={`object-contain transition-all ${isActive ? "brightness-0 contrast-200" : ""}`}
                      unoptimized
                    />
                  ) : (
                    <>
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && <span className="text-[13px] leading-tight whitespace-normal">{displayText}</span>}
                    </>
                  )}
                </Link>

                {isActive && (
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 h-0 w-0 border-y-transparent border-r-white ${
                      collapsed
                        ? "right-[-10px] border-y-[10px] border-r-[10px]"
                        : "right-[-12px] border-y-[12px] border-r-[12px]"
                    }`}
                  />
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
