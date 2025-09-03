"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useLanguage } from "@/lib/LanguageContext"
import { translations } from "@/lib/translations"
import { cn } from "@/lib/utils"

const MODULES = [
  {
    key: "registro",
    restricted: true,
    name: { es: "Registro de sistemas de IA", en: "AI systems registry" },
  },
  {
    key: "evaluaciones",
    restricted: true,
    name: { es: "Evaluaciones", en: "Evaluations" },
  },
  {
    key: "comite",
    restricted: true,
    name: { es: "Comité de gobernanza", en: "Governance committee" },
  },
  {
    key: "indicadores",
    restricted: true,
    name: { es: "Indicadores de cumplimiento", en: "Compliance indicators" },
  },
  {
    key: "politicas",
    restricted: false,
    name: { es: "Políticas y concientización", en: "Policies and awareness" },
  },
]

const PRIVILEGE_OPTIONS = [
  { key: "admin", labelKey: "administration" },
  { key: "view", labelKey: "view" },
  { key: "edit", labelKey: "edit" },
  { key: "upload", labelKey: "upload" },
  { key: "download", labelKey: "download" },
  { key: "delete", labelKey: "delete" },
]

const statusColor = (status: string) => {
  switch (status) {
    case "green":
      return "bg-green-500"
    case "yellow":
      return "bg-yellow-500"
    case "red":
      return "bg-red-500"
    default:
      return "bg-gray-300"
  }
}

export function AdminUserPrivileges() {
  const { language } = useLanguage()
  const t = translations[language]
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("users") || "[]")
    setUsers(stored.filter((u: any) => u.approved))
  }, [])

  const updatePrivilege = (email: string, moduleKey: string, data: any) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.email === email) {
          const privileges = { ...(u.privileges || {}) }
          privileges[moduleKey] = { ...(privileges[moduleKey] || {}), ...data }
          return { ...u, privileges }
        }
        return u
      })
    )

    const all = JSON.parse(localStorage.getItem("users") || "[]")
    const updated = all.map((u: any) => {
      if (u.email === email) {
        const privileges = { ...(u.privileges || {}) }
        privileges[moduleKey] = { ...(privileges[moduleKey] || {}), ...data }
        return { ...u, privileges }
      }
      return u
    })
    localStorage.setItem("users", JSON.stringify(updated))
  }

  return (
    <div className="space-y-4 mt-8">
      <h2 className="text-xl font-semibold">{t.userAccessPanel}</h2>
      {users.map((user) => (
        <Card key={user.email}>
          <CardHeader>
            <CardTitle>
              {user.name} ({user.email})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {MODULES.map((m) => {
              const privilege = user.privileges?.[m.key] || {}
              const status = privilege.status || (m.restricted ? "yellow" : "green")
              return (
                <div key={m.key} className="border p-4 rounded-md space-y-4">
                  <div className="flex items-center justify-between">
                    <span>{m.name[language]}</span>
                    {m.restricted ? (
                      <Select
                        value={status}
                        onValueChange={(val) =>
                          updatePrivilege(user.email, m.key, { status: val })
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            "w-28 text-white",
                            statusColor(status)
                          )}
                        >
                          <SelectValue placeholder={t.status} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="green">{t.green}</SelectItem>
                          <SelectItem value="yellow">{t.yellow}</SelectItem>
                          <SelectItem value="red">{t.red}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="px-2 py-1 rounded text-white bg-green-500">
                        {t.noRestriction}
                      </span>
                    )}
                  </div>
                  {m.restricted && (
                    <div className="space-y-2">
                      <div>
                        <Label>{t.justification}</Label>
                        <Input
                          value={privilege.justification || ""}
                          onChange={(e) =>
                            updatePrivilege(user.email, m.key, {
                              justification: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>{t.userFunction}</Label>
                        <Select
                          value={privilege.userFunction || ""}
                          onValueChange={(val) =>
                            updatePrivilege(user.email, m.key, {
                              userFunction: val,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t.userFunction} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="administrador">
                              {language === "es" ? "Administrador" : "Administrator"}
                            </SelectItem>
                            <SelectItem value="analista">
                              {language === "es" ? "Analista" : "Analyst"}
                            </SelectItem>
                            <SelectItem value="auditor">
                              {language === "es" ? "Auditor" : "Auditor"}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{t.dateGranted}</Label>
                        <Input
                          type="date"
                          value={privilege.dateGranted || ""}
                          onChange={(e) =>
                            updatePrivilege(user.email, m.key, {
                              dateGranted: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>{t.privileges}</Label>
                        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                          {PRIVILEGE_OPTIONS.map((p) => (
                            <div
                              key={p.key}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`${user.email}-${m.key}-${p.key}`}
                                checked={privilege[p.key] || false}
                                onCheckedChange={(val) =>
                                  updatePrivilege(user.email, m.key, {
                                    [p.key]: val,
                                  })
                                }
                              />
                              <Label htmlFor={`${user.email}-${m.key}-${p.key}`}>
                                {(t as any)[p.labelKey]}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label>{t.authorizedBy}</Label>
                        <Input
                          value={privilege.authorizedBy || ""}
                          onChange={(e) =>
                            updatePrivilege(user.email, m.key, {
                              authorizedBy: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>{t.requestedBy}</Label>
                        <Input
                          value={privilege.requestedBy || ""}
                          onChange={(e) =>
                            updatePrivilege(user.email, m.key, {
                              requestedBy: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>{t.evidence}</Label>
                        <Input
                          type="file"
                          multiple
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || [])
                            const fileData = await Promise.all(
                              files.map(
                                (file) =>
                                  new Promise((resolve) => {
                                    const reader = new FileReader()
                                    reader.onload = () => {
                                      resolve({ name: file.name, data: reader.result })
                                    }
                                    reader.readAsDataURL(file)
                                  })
                              )
                            )
                            updatePrivilege(user.email, m.key, { evidence: fileData })
                          }}
                        />
                        {Array.isArray(privilege.evidence) &&
                          privilege.evidence.length > 0 && (
                            <ul className="mt-2 list-disc list-inside">
                              {privilege.evidence.map((file: any, idx: number) => (
                                <li key={idx}>
                                  <a
                                    href={file.data}
                                    download={file.name}
                                    className="text-blue-600 underline"
                                  >
                                    {file.name}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default AdminUserPrivileges
