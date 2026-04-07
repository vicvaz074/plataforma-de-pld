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
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#ff751f1f,transparent_55%),radial-gradient(circle_at_bottom,#ffb37a1f,transparent_55%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

      <div className="container mx-auto px-6 py-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm uppercase tracking-[0.3em] text-primary">
            <Sparkles className="h-4 w-4 text-primary" />
            {aliciaT.alicia}
          </div>
          <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl" style={{ fontFamily: "Futura Std, sans-serif" }}>
            {aliciaT.aliciaTitle}
          </h1>
          <p className="mt-4 text-lg text-slate-600">{aliciaT.aliciaDescription}</p>
        </div>

        <Card className="mt-10 max-w-3xl border-orange-100 bg-white/90 shadow-xl backdrop-blur">
          <CardContent className="p-8">
            <p className="text-xl font-medium text-slate-900">{aliciaT.aliciaMessage}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-slate-600">
              <Mail className="h-5 w-5 text-primary" />
              <span>{aliciaT.aliciaContact}</span>
              <Link
                href={`mailto:${aliciaT.aliciaEmail}`}
                className="font-semibold text-slate-900 underline decoration-primary underline-offset-4"
              >
                {aliciaT.aliciaEmail}
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href={`mailto:${aliciaT.aliciaEmail}`}>{aliciaT.aliciaCta}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
