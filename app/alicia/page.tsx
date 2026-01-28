"use client"

import Link from "next/link"
import { Mail, Sparkles } from "lucide-react"
import { useLanguage } from "@/lib/LanguageContext"
import { aliciaTranslations } from "@/lib/alicia-translations"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function AliciaPage() {
  const { language } = useLanguage()
  const aliciaT = aliciaTranslations[language]

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#7c3aed33,transparent_55%),radial-gradient(circle_at_bottom,#0ea5e933,transparent_55%)]" />
      <div className="absolute inset-0 -z-10 opacity-20 [background-image:linear-gradient(to_right,#ffffff22_1px,transparent_1px),linear-gradient(to_bottom,#ffffff22_1px,transparent_1px)] [background-size:3.5rem_3.5rem]" />

      <div className="container mx-auto px-6 py-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.3em]">
            <Sparkles className="h-4 w-4 text-indigo-200" />
            {aliciaT.alicia}
          </div>
          <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl" style={{ fontFamily: "Futura PT Medium, sans-serif" }}>
            {aliciaT.aliciaTitle}
          </h1>
          <p className="mt-4 text-lg text-slate-200">{aliciaT.aliciaDescription}</p>
        </div>

        <Card className="mt-10 max-w-3xl border-white/10 bg-white/5 shadow-2xl backdrop-blur">
          <CardContent className="p-8">
            <p className="text-xl font-medium text-white">{aliciaT.aliciaMessage}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-slate-200">
              <Mail className="h-5 w-5 text-indigo-200" />
              <span>{aliciaT.aliciaContact}</span>
              <Link
                href={`mailto:${aliciaT.aliciaEmail}`}
                className="font-semibold text-white underline decoration-indigo-400 underline-offset-4"
              >
                {aliciaT.aliciaEmail}
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild className="bg-white text-slate-900 hover:bg-slate-100">
                <Link href={`mailto:${aliciaT.aliciaEmail}`}>{aliciaT.aliciaCta}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
