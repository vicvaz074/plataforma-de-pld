"use client"

import { useState, useEffect } from "react"
import { useLanguage } from "@/lib/LanguageContext"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import {
  Shield,
  FileCheck,
  Users,
  Eye,
  FileText,
  GraduationCap,
  Search,
  Database,
  Settings,
  Sparkles,
  Book,
} from "lucide-react"
import { motion } from "framer-motion"
import { translations } from "@/lib/translations"
import { aliciaTranslations } from "@/lib/alicia-translations"
import Image from "next/image"

const options = [
  { name: "actividadesVulnerables", icon: Shield, href: "/actividades-vulnerables" },
  { name: "registroSat", icon: FileCheck, href: "/registro-sat" },
  { name: "expedienteUnico", icon: Users, href: "/kyc-expediente" },
  { name: "beneficiarioControlador", icon: Eye, href: "/beneficiario-controlador" },
  { name: "monitoreoOperaciones", icon: FileText, href: "/monitoreo-operaciones" },
  { name: "reportesUif", icon: FileText, href: "/reportes-uif" },
  { name: "capacitacionControl", icon: GraduationCap, href: "/capacitacion-control" },
  { name: "auditoriaVerificacion", icon: Search, href: "/auditoria-verificacion" },
  { name: "evidenciasTrazabilidad", icon: Database, href: "/evidencias-trazabilidad" },
  { name: "gobernanzaControl", icon: Settings, href: "/gobernanza-control" },
  { name: "compiladoLeyes", icon: Book, href: "/compilado-leyes" },
  {
    name: "alicia",
    icon: Sparkles,
    href: "https://asistentelegal02.azurewebsites.net/",
    external: true,
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fondo9.png-AqM6pGQFnW7wv6Mud4R4MHeOdJx6s4.jpeg",
  },
]

export default function Home() {
  const { language } = useLanguage()
  const t = translations[language]
  const aliciaT = aliciaTranslations[language]
  const [userName, setUserName] = useState<string | null>(null)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  useEffect(() => {
    const storedUserName = localStorage.getItem("userName")
    setUserName(storedUserName)
  }, [])

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

      <div className="container mx-auto py-8">
        <h1 className="text-4xl font-medium text-center mb-12" style={{ fontFamily: "Futura PT Medium, sans-serif" }}>
          {userName ? `${t.welcomeMessage}, ${userName}` : t.welcomeMessage}
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {options.map((option) => {
            const CardContent = (
              <Card
                className="p-6 hover:shadow-lg transition-shadow flex flex-col items-center justify-center h-[200px] cursor-pointer group relative overflow-hidden"
                onMouseEnter={() => setHoveredCard(option.name)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {option.image ? (
                  <div className="absolute inset-0 w-full h-full">
                    <Image
                      src={option.image || "/placeholder.svg"}
                      alt={option.name === "alicia" ? aliciaT.alicia : t[option.name]}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-20" />
                  </div>
                ) : (
                  <option.icon className="h-10 w-10 mb-4 text-gray-600 group-hover:text-gray-800 transition-colors" />
                )}
                <span
                  className={`text-base font-medium text-center transition-colors leading-tight ${
                    option.image
                      ? `text-white relative z-10 ${option.name === "alicia" ? "group-hover:opacity-0" : ""}`
                      : "text-gray-700 group-hover:text-gray-900"
                  }`}
                  style={{ fontFamily: "Futura PT Medium, sans-serif" }}
                >
                  {option.name === "alicia" ? aliciaT.alicia : t[option.name]}
                </span>
                <motion.div
                  className="absolute inset-0 bg-white bg-opacity-90 p-4 flex items-center justify-center text-sm text-gray-700 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{
                    opacity: hoveredCard === option.name ? 1 : 0,
                    y: hoveredCard === option.name ? 0 : 20,
                  }}
                  transition={{ duration: 0.3 }}
                  style={{ pointerEvents: hoveredCard === option.name ? "auto" : "none" }}
                >
                  {option.name === "alicia" ? aliciaT.aliciaDescription : t[option.name + "Description"]}
                </motion.div>
              </Card>
            )

            if (option.external) {
              return (
                <a key={option.name} href={option.href} target="_blank" rel="noopener noreferrer">
                  {CardContent}
                </a>
              )
            }

            return (
              <Link key={option.name} href={option.href}>
                {CardContent}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
