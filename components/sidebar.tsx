"use client"

import Link from "next/link"
import { useLanguage } from "@/lib/LanguageContext"
import { usePathname } from "next/navigation"
import Image from "next/image"
import {
  LayoutDashboard,
  Shield,
  FileCheck,
  Lock,
  Key,
  CreditCard,
  Target,
  BookOpen,
  Shield as UserShield,
  Sparkles,
} from "lucide-react"
import { translations } from "@/lib/translations"
import { aliciaTranslations } from "@/lib/alicia-translations"

const navigationItems = [
  { key: "dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { key: "lfpdppp", icon: Shield, href: "/lfpdppp" },
  { key: "iso27001", icon: FileCheck, href: "/iso27001" },
  { key: "iso27701", icon: Lock, href: "/iso27701" },
  { key: "iso27002", icon: Key, href: "/iso27002" },
  { key: "pciDss", icon: CreditCard, href: "/pci-dss" },
  { key: "nistCsf", icon: Target, href: "/nist-csf" },
  { key: "nistSp80053", icon: BookOpen, href: "/nist-sp-800-53" },
  { key: "nistPrivacy", icon: UserShield, href: "/nist-privacy" },
  { key: "alicia", icon: Sparkles, href: "https://asistentelegal02.azurewebsites.net/", external: true },
]

export function Sidebar() {
  const { language } = useLanguage()
  const pathname = usePathname()
  const t = translations[language]
  const aliciaT = aliciaTranslations[language]

  return (
    <div className="fixed left-0 top-0 w-64 lg:w-72 h-screen bg-sidebar text-sidebar-foreground p-4 flex flex-col flex-shrink-0 z-40">
      <div className="mb-8 h-[100px]">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-KCMkMWJluvEnrZ7kiJcIZwOaH63W1s.png"
            alt="Davara Governance"
            width={280}
            height={100}
            style={{ objectFit: "contain", filter: "brightness(0) invert(1)" }}
            priority
          />
        </Link>
      </div>

      <nav className="space-y-2 flex-grow overflow-y-auto">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          const displayText = item.key === "alicia" ? aliciaT[item.key] : t[item.key]

          if (item.external) {
            return (
              <a
                key={item.key}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 transition-colors py-3 px-3 rounded-lg text-sm text-white hover:text-white hover:bg-white/10"
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">{displayText}</span>
              </a>
            )
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 transition-colors py-3 px-3 rounded-lg text-sm ${
                isActive ? "bg-white text-gray-900" : "text-white hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{displayText}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
