"use client"

import Link from "next/link"
import { useLanguage } from "@/lib/LanguageContext"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { ChevronLeft, LayoutDashboard, Shield, FileCheck, Users, FileText, GraduationCap, Search, Database, Settings, Book, ClipboardCheck, UserSearch, Monitor } from "lucide-react"
import { translations } from "@/lib/translations"
import { aliciaTranslations } from "@/lib/alicia-translations"

const navigationItems = [
  { key: "dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { key: "registroSat", icon: FileCheck, href: "/registro-sat" },
  { key: "expedienteUnico", icon: Users, href: "/kyc-expediente" },
  { key: "actividadesVulnerables", icon: Shield, href: "/actividades-vulnerables" },
  { key: "ebr", icon: ClipboardCheck, href: "/ebr" },
  { key: "pepWhois", icon: UserSearch, href: "/pep-whois" },
  { key: "avisosInformes", icon: FileText, href: "/avisos-informes" },
  { key: "capacitacionControl", icon: GraduationCap, href: "/capacitacion-control" },
  { key: "auditoriaVerificacion", icon: Search, href: "/auditoria-verificacion" },
  { key: "evidenciasTrazabilidad", icon: Database, href: "/evidencias-trazabilidad" },
  { key: "gobernanzaControl", icon: Settings, href: "/gobernanza-control" },
  { key: "compiladoLeyes", icon: Book, href: "/marco-normativo-aplicable" },
  { key: "alicia", icon: Monitor, href: "/alicia" },
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
      className="pld-reference-shell fixed left-0 z-40 flex flex-col overflow-y-auto bg-sidebar px-[clamp(10px,1.1vw,24px)] pb-4 text-sidebar-foreground transition-[width] duration-300"
      style={{ top: "var(--app-header-height)", height: "calc(100vh - var(--app-header-height))", width: collapsed ? "5rem" : "clamp(15rem, 16.9vw, 24rem)" }}
    >
      <div className="flex h-[clamp(62px,3.5vw,80px)] shrink-0 items-start justify-end pt-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/15"
        >
          <ChevronLeft className={`h-5 w-5 transition-transform ${collapsed ? "rotate-180" : "rotate-0"}`} />
        </button>
      </div>

      <nav className="flex-1 overflow-visible">
        <ul className="flex h-full flex-col justify-between gap-1 pb-[clamp(40px,4vw,90px)] pt-2">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            const displayText = item.key === "alicia" ? aliciaT[item.key] : t[item.key]

            return (
              <li key={item.key} className="relative">
                <Link
                  href={item.href}
                  className={`relative flex min-h-[42px] items-center rounded-lg transition-colors ${
                    collapsed ? "justify-center px-2 py-2" : "gap-[clamp(13px,1.33vw,30px)] px-[clamp(10px,0.8vw,18px)] py-2"
                  } ${isActive ? "bg-white/18 text-white" : "text-white hover:bg-white/10 hover:text-white"}`}
                  title={collapsed ? displayText : undefined}
                >
                  {item.key === "alicia" ? (
                    <>
                      <Icon className="h-[clamp(22px,1.5vw,34px)] w-[clamp(22px,1.5vw,34px)] shrink-0" strokeWidth={1.7} />
                      {!collapsed && <Image src="/Alicia_Sin_Despachos.png" alt="Alicia" width={645} height={248} className="h-auto w-[clamp(66px,4.5vw,102px)] object-contain" />}
                    </>
                  ) : (
                    <>
                      <Icon className="h-[clamp(22px,1.5vw,34px)] w-[clamp(22px,1.5vw,34px)] shrink-0" strokeWidth={1.7} />
                      {!collapsed && <span className="whitespace-normal text-[clamp(13px,0.8vw,18px)] leading-[1.15]" style={{ fontWeight: 600 }}>{displayText}</span>}
                    </>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
