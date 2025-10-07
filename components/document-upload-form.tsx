"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { CalendarIcon, Upload } from "lucide-react"
import { format } from "date-fns"
import { cn, sortAlphabetically } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useLanguage } from "@/lib/LanguageContext"
import { translations } from "@/lib/translations"
import { addDocument, getDocuments } from "@/lib/documents"
import { syncDocumentAlerts } from "@/lib/alerts"
import { useAppContext } from "@/lib/AppContext"

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

const formSchema = z.object({
  name: z.string().min(1, "Document name is required"),
  legalEntity: z.string().min(1, "Legal entity is required"),
  description: z.string().min(1, "Description is required"),
  type: z.string().min(1, "Document type is required"),
  status: z.string().min(1, "Document status is required"),
  date: z.date({
    required_error: "Date is required",
  }),
  file: z
    .custom<FileList>()
    .refine((files) => files?.length === 1, "File is required")
    .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, "Max file size is 10MB")
    .refine((files) => ACCEPTED_FILE_TYPES.includes(files?.[0]?.type), "Only .pdf, .doc and .docx files are accepted"),
})

export function DocumentUploadForm({
  setIsDialogOpen,
  onDocumentAdded,
}: { setIsDialogOpen: (open: boolean) => void; onDocumentAdded: () => void }) {
  const { language } = useLanguage()
  const t = translations[language]
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const { addActivityUnderReview } = useAppContext()

  const documentTypes = sortAlphabetically(["Policy", "Procedure", "Form", "Other"])
  const statusOptions = sortAlphabetically(["Draft", "Under Review", "Approved"])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsUploading(true)
      const userEmail = localStorage.getItem("userEmail") || "unknown"

      const addedDocument = await addDocument({
        name: values.name,
        legalEntity: values.legalEntity,
        description: values.description,
        type: values.type,
        status: values.status,
        date: format(values.date, "yyyy-MM-dd"),
        file: values.file[0],
        userEmail,
      })

      const updatedDocuments = getDocuments()
      syncDocumentAlerts({
        module: "document-management",
        documents: updatedDocuments.map((doc) => ({
          id: doc.id,
          name: doc.name,
          dueDate: doc.renewalDate ? new Date(doc.renewalDate) : null,
        })),
      })

      if (addedDocument) {
        addActivityUnderReview({
          ...addedDocument,
          type: "document",
        })
        toast({
          title: "Success",
          description: "Document uploaded successfully",
          duration: 3000,
        })

        form.reset()
        setIsDialogOpen(false)
        onDocumentAdded()
      } else {
        throw new Error("Failed to add document")
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast({
        title: "Error",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
        duration: 3000,
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-h-[70vh] overflow-y-auto px-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.documentName}</FormLabel>
              <FormControl>
                <Input placeholder={t.documentName} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="legalEntity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.legalEntity}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t.selectLegalEntity} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Davara Abogados">Davara Abogados</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.description}</FormLabel>
              <FormControl>
                <Textarea placeholder={t.describeProcessingActivity} className="resize-none" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.documentType}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t.selectDocumentType} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.status}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t.selectStatus} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>{t.date}</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn("w-[240px] pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                    >
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="file"
          render={({ field: { onChange, value, ...field } }) => (
            <FormItem>
              <FormLabel>{t.file}</FormLabel>
              <FormControl>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Input
                    type="file"
                    accept={ACCEPTED_FILE_TYPES.join(",")}
                    onChange={(e) => {
                      onChange(e.target.files)
                    }}
                    {...field}
                  />
                </div>
              </FormControl>
              <FormDescription>Max file size: 10MB. Accepted formats: PDF, DOC, DOCX</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.reset()
              setIsDialogOpen(false)
            }}
            disabled={isUploading}
          >
            {t.cancel}
          </Button>
          <Button type="submit" disabled={isUploading} className="relative">
            {isUploading ? (
              <>
                <Upload className="mr-2 h-4 w-4 animate-spin" />
                {t.uploading}
              </>
            ) : (
              t.upload
            )}
            {isUploading && (
              <span className="absolute inset-0 h-full w-full animate-progress-indeterminate rounded-md bg-white/20"></span>
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}
