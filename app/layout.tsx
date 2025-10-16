import type React from "react"
import type { Metadata } from "next"
import { ClientLayout } from "./ClientLayout"
import "./globals.css"

export const metadata: Metadata = {
  title: "Programa de Prevención en Lavado de Dinero",
  description: "Plataforma integral para la gestión y gobernanza de sistemas de inteligencia artificial",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
