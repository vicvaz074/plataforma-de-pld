"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import {
  Book,
  ClipboardCheck,
  Database,
  FileCheck,
  FileText,
  GraduationCap,
  MoreHorizontal,
  Search,
  Settings,
  Shield,
  Sparkles,
  UserSearch,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PldDemoDataControls } from "@/components/pld-demo-data-controls"
import { useLanguage } from "@/lib/LanguageContext"
import { PLD_DASHBOARD_MODULES } from "@/lib/pld/navigation"
import styles from "./home.module.css"
import { usePilot } from "@/components/pilot/pilot-provider"
import { PATH_MODULES, sessionCanNavigate } from "@/lib/pilot/contracts"

const moduleIcons: Record<string, LucideIcon> = {
  FileCheck,
  Users,
  Shield,
  ClipboardCheck,
  UserSearch,
  FileText,
  GraduationCap,
  Search,
  Database,
  Settings,
  Book,
  Sparkles,
}

export default function Home() {
  const { language } = useLanguage()
  const { mode, company, session } = usePilot()
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    setShowWelcome(localStorage.getItem("showPostLoginWelcome") === "true")
  }, [])

  return (
    <div className={styles.home}>
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar text-white"
          >
            <div className="flex max-w-3xl flex-col items-center px-6 text-center">
              <Image
                src="/logo-davara-governance/logo-davara-governance-white.png"
                alt="Davara Governance"
                width={200}
                height={48}
                className="mb-14 h-auto w-[200px]"
                priority
              />
              <h2 className="mb-4 text-2xl tracking-wide md:text-3xl">
                Bienvenido a la Plataforma de Prevención en Lavado de Dinero
              </h2>
              <p className="mb-12 text-white/80">
                Gestiona, protege y audita la información de manera segura, en estricto cumplimiento normativo.
              </p>
              <Button
                variant="outline"
                size="lg"
                className="border-white/50 bg-transparent text-white hover:bg-white hover:text-orange-600"
                onClick={() => {
                  setShowWelcome(false)
                  localStorage.removeItem("showPostLoginWelcome")
                }}
              >
                Continuar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <h1 className={styles.heading}>
        {language === "es" ? "Programa de Prevención en Lavado de Dinero" : "Anti-Money Laundering Prevention Program"}
      </h1>

      {mode === "cloud" && session?.user.platformRole === "superadmin" && !company && (
        <Alert className="mx-auto mb-6 max-w-3xl">
          <AlertTitle>Tu acceso de superadministrador está activo</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>Puedes administrar todas las organizaciones, empresas, usuarios y módulos. Crea tu primera empresa para comenzar a capturar datos sin mezclar razones sociales.</p>
            <Button asChild className="w-fit"><Link href="/dashboard?setup=company">Crear mi primera empresa</Link></Button>
          </AlertDescription>
        </Alert>
      )}

      <div className={styles.grid}>
        {PLD_DASHBOARD_MODULES.filter((module) => mode === "demo" || !PATH_MODULES[module.href] || sessionCanNavigate(session, company, PATH_MODULES[module.href])).map((module) => {
          const Icon = moduleIcons[module.iconName] ?? FileText
          const isAlicia = module.key === "alicia"
          return (
            <Link
              key={module.key}
              href={module.href}
              className={styles.moduleCard}
              aria-label={`${module.title[language]}. ${module.description[language]}`}
            >
              <span className={styles.cardVisual} aria-hidden="true">
                {isAlicia ? (
                  <Image
                    src="/Alicia_Sin_Despachos.png"
                    alt=""
                    width={645}
                    height={248}
                    className={styles.aliciaLogo}
                  />
                ) : (
                  <Icon className={styles.cardIcon} strokeWidth={1.9} />
                )}
              </span>
              <span className={styles.cardTitle}>{module.title[language]}</span>
              <MoreHorizontal className={styles.cardMore} aria-hidden="true" />
              <span className={styles.cardDescription} aria-hidden="true">
                {module.description[language]}
              </span>
            </Link>
          )
        })}
      </div>

      {mode === "demo" && <details className={styles.demoTools}>
        <summary>Herramientas de datos demo</summary>
        <div className="mt-4"><PldDemoDataControls /></div>
      </details>}
    </div>
  )
}
