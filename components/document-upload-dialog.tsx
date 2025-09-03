"use client"

import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { useLanguage } from "@/lib/LanguageContext"
import { translations } from "@/lib/translations"

interface DocumentUploadDialogProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (file: File) => void
}

export function DocumentUploadDialog({ isOpen, onClose, onUpload }: DocumentUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const { toast } = useToast()
  const { language } = useLanguage()
  const t = translations[language]

  // ... rest of the component code remains the same
}
