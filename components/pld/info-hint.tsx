"use client"

import { useState } from "react"
import { Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { InfoHintContent } from "@/lib/pld"
import { cn } from "@/lib/utils"

interface InfoHintProps {
  content: InfoHintContent
  className?: string
  label?: string
}

export function InfoHint({ content, className, label = "Más información" }: InfoHintProps) {
  const [open, setOpen] = useState(false)
  const hasDetails = Boolean(content.body?.length)

  return (
    <>
      <TooltipProvider delayDuration={120}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={label}
              className={cn("h-7 w-7 rounded-full p-0 text-slate-500 hover:text-slate-800", className)}
              onClick={() => {
                if (hasDetails) setOpen(true)
              }}
            >
              <Info className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{content.title}</p>
            <p className="mt-1 text-muted-foreground">{content.summary}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {hasDetails && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>{content.title}</DialogTitle>
              <DialogDescription>{content.summary}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm text-slate-700">
              {content.body?.map((paragraph) => (
                <p key={paragraph} className="break-words">
                  {paragraph}
                </p>
              ))}
              {content.sourceUrl && (
                <a
                  className="inline-flex max-w-full items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  href={content.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="truncate">{content.sourceLabel ?? "Fuente oficial"}</span>
                </a>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Entendido
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
