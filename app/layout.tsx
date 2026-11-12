import type React from "react"
import type { Metadata } from "next"
import { ClientLayout } from "./ClientLayout"
import "./globals.css"

export const metadata: Metadata = {
  title: "Programa de Prevención en Lavado de Dinero",
  description: "Identificación, operaciones, riesgos y evidencias para la prevención de lavado de dinero en México.",
  icons: { icon: "/logo-davara-governance/logo-davara-governance-black.png" },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
