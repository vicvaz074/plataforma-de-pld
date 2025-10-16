"use client"

import { useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Info, MapPin, Phone, UserCheck } from "lucide-react"
import type { PaisOption } from "@/lib/data/paises"
import type { ExpedientePersona } from "@/lib/utils/expedientes"
import {
  type CodigoPostalInfo,
  type InmuebleAvisoForm,
  mergeExpedientePersona,
  normalizeCodigoPostal,
  type PersonaAvisoSeccion,
} from "@/lib/utils/inmuebles-form"

interface InmueblesCuestionarioProps {
  value: InmuebleAvisoForm
  onChange: (value: InmuebleAvisoForm) => void
  paises: PaisOption[]
  monedaOptions: { value: string; label: string }[]
  catalogoCodigosPostales: Map<string, CodigoPostalInfo>
  expedientePersonas: ExpedientePersona[]
  expedienteActualizadoEn?: string
  expedienteNombre?: string
  tituloActividad?: string
}

function updateFormValue(
  value: InmuebleAvisoForm,
  onChange: (value: InmuebleAvisoForm) => void,
  mutator: (draft: InmuebleAvisoForm) => void,
) {
  const draft: InmuebleAvisoForm = structuredClone(value)
  mutator(draft)
  onChange(draft)
}

function coloniasFromCatalogo(catalogo: Map<string, CodigoPostalInfo>, codigoPostal: string) {
  const info = catalogo.get(normalizeCodigoPostal(codigoPostal))
  return info ?? null
}

function PaisSelect({
  value,
  onChange,
  opciones,
  placeholder = "Selecciona un país",
}: {
  value: string
  onChange: (valor: string) => void
  opciones: PaisOption[]
  placeholder?: string
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="bg-white">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {opciones.map((pais) => (
          <SelectItem key={pais.value} value={pais.value}>
            {pais.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function PersonaHeader({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <UserCheck className="h-4 w-4 text-emerald-600" /> {titulo}
      </p>
      <p className="text-xs text-muted-foreground">{descripcion}</p>
    </div>
  )
}

export function InmueblesCuestionario({
  value,
  onChange,
  paises,
  monedaOptions,
  catalogoCodigosPostales,
  expedientePersonas,
  expedienteActualizadoEn,
  expedienteNombre,
  tituloActividad,
}: InmueblesCuestionarioProps) {
  const [personaImportKey, setPersonaImportKey] = useState(0)
  const [beneficiarioImportKey, setBeneficiarioImportKey] = useState(0)
  const [contraparteImportKey, setContraparteImportKey] = useState(0)

  const infoCodigoPostalPrincipal = useMemo(
    () => coloniasFromCatalogo(catalogoCodigosPostales, value.personaAviso.domicilio.nacional.codigoPostal),
    [catalogoCodigosPostales, value.personaAviso.domicilio.nacional.codigoPostal],
  )

  const coloniasPrincipales = infoCodigoPostalPrincipal?.colonias ?? []

  const infoCodigoPostalBeneficiario = useMemo(
    () =>
      coloniasFromCatalogo(
        catalogoCodigosPostales,
        value.beneficiario.datos.domicilio.nacional.codigoPostal,
      ),
    [catalogoCodigosPostales, value.beneficiario.datos.domicilio.nacional.codigoPostal],
  )

  const coloniasBeneficiario = infoCodigoPostalBeneficiario?.colonias ?? []

  const infoCodigoPostalContraparte = useMemo(
    () =>
      coloniasFromCatalogo(
        catalogoCodigosPostales,
        value.detalleOperacion.contraparte.domicilio.nacional.codigoPostal,
      ),
    [catalogoCodigosPostales, value.detalleOperacion.contraparte.domicilio.nacional.codigoPostal],
  )

  const coloniasContraparte = infoCodigoPostalContraparte?.colonias ?? []

  const infoCodigoPostalInmueble = useMemo(
    () =>
      coloniasFromCatalogo(
        catalogoCodigosPostales,
        value.detalleOperacion.caracteristicasInmueble.codigoPostal,
      ),
    [catalogoCodigosPostales, value.detalleOperacion.caracteristicasInmueble.codigoPostal],
  )

  const coloniasInmueble = infoCodigoPostalInmueble?.colonias ?? []

  const hayExpediente = expedientePersonas.length > 0

  const personaOptions = useMemo(
    () =>
      expedientePersonas.map((persona) => ({
        value: persona.id,
        label: `${persona.denominacion || "Sin nombre"} – ${persona.rolRelacion || "Sin rol"}`,
      })),
    [expedientePersonas],
  )

  const actividadReferencia = tituloActividad ?? "Comercialización de bienes inmuebles"

  const renderPersonaInputs = (ruta: "personaAviso" | "beneficiario" | "contraparte") => {
    const prefijo =
      ruta === "personaAviso"
        ? value.personaAviso
        : ruta === "beneficiario"
          ? value.beneficiario.datos
          : value.detalleOperacion.contraparte
    const tipo = prefijo.persona.tipo

    const infoActual =
      ruta === "personaAviso"
        ? infoCodigoPostalPrincipal
        : ruta === "beneficiario"
          ? infoCodigoPostalBeneficiario
          : infoCodigoPostalContraparte

    const coloniasDisponibles =
      ruta === "personaAviso"
        ? coloniasPrincipales
        : ruta === "beneficiario"
          ? coloniasBeneficiario
          : coloniasContraparte

    const etiquetaDomicilio =
      ruta === "beneficiario"
        ? "del beneficiario"
        : ruta === "contraparte"
          ? "de la contraparte"
          : "de la persona"

    const actualiza = (mutator: (draft: PersonaAvisoSeccion) => void) => {
      updateFormValue(value, onChange, (draft) => {
        if (ruta === "personaAviso") {
          mutator(draft.personaAviso)
        } else if (ruta === "beneficiario") {
          mutator(draft.beneficiario.datos)
        } else {
          mutator(draft.detalleOperacion.contraparte)
        }
      })
    }

    return (
      <>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Tipo de persona</Label>
            <Select
              value={tipo}
              onValueChange={(nuevo) =>
                actualiza((draft) => {
                  draft.persona.tipo = nuevo as PersonaAvisoSeccion["persona"]["tipo"]
                })
              }
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Selecciona tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="persona_fisica">Persona física</SelectItem>
                <SelectItem value="persona_moral">Persona moral</SelectItem>
                <SelectItem value="fideicomiso">Fideicomiso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>RFC</Label>
            <Input
              value={
                tipo === "persona_moral"
                  ? prefijo.persona.moral.rfc
                  : tipo === "persona_fisica"
                    ? prefijo.persona.fisica.rfc
                    : prefijo.persona.fideicomiso.rfc
              }
              onChange={(event) =>
                actualiza((draft) => {
                  const nuevo = event.target.value.toUpperCase()
                  if (draft.persona.tipo === "persona_moral") {
                    draft.persona.moral.rfc = nuevo
                  } else if (draft.persona.tipo === "persona_fisica") {
                    draft.persona.fisica.rfc = nuevo
                  } else {
                    draft.persona.fideicomiso.rfc = nuevo
                  }
                })
              }
              placeholder="RFC"
            />
          </div>
          {tipo === "persona_fisica" && (
            <div className="space-y-2">
              <Label>CURP</Label>
              <Input
                value={prefijo.persona.fisica.curp}
                onChange={(event) =>
                  actualiza((draft) => {
                    draft.persona.fisica.curp = event.target.value.toUpperCase()
                  })
                }
                placeholder="CURP"
              />
            </div>
          )}
        </div>

        {tipo === "persona_fisica" && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Nombre(s)</Label>
              <Input
                value={prefijo.persona.fisica.nombre}
                onChange={(event) =>
                  actualiza((draft) => {
                    draft.persona.fisica.nombre = event.target.value.toUpperCase()
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Apellido paterno</Label>
              <Input
                value={prefijo.persona.fisica.apellidoPaterno}
                onChange={(event) =>
                  actualiza((draft) => {
                    draft.persona.fisica.apellidoPaterno = event.target.value.toUpperCase()
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Apellido materno</Label>
              <Input
                value={prefijo.persona.fisica.apellidoMaterno}
                onChange={(event) =>
                  actualiza((draft) => {
                    draft.persona.fisica.apellidoMaterno = event.target.value.toUpperCase()
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha de nacimiento</Label>
              <Input
                value={prefijo.persona.fisica.fechaNacimiento}
                onChange={(event) =>
                  actualiza((draft) => {
                    draft.persona.fisica.fechaNacimiento = event.target.value
                  })
                }
                placeholder="AAAAMMDD"
              />
            </div>
            <div className="space-y-2">
              <Label>País de nacionalidad</Label>
              <PaisSelect
                value={prefijo.persona.fisica.paisNacionalidad}
                onChange={(pais) =>
                  actualiza((draft) => {
                    draft.persona.fisica.paisNacionalidad = pais
                  })
                }
                opciones={paises}
              />
            </div>
            <div className="space-y-2">
              <Label>País de nacimiento</Label>
              <PaisSelect
                value={prefijo.persona.fisica.paisNacimiento}
                onChange={(pais) =>
                  actualiza((draft) => {
                    draft.persona.fisica.paisNacimiento = pais
                  })
                }
                opciones={paises}
              />
            </div>
          </div>
        )}

        {tipo === "persona_moral" && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Denominación o razón social</Label>
              <Input
                value={prefijo.persona.moral.denominacion}
                onChange={(event) =>
                  actualiza((draft) => {
                    draft.persona.moral.denominacion = event.target.value.toUpperCase()
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha de constitución</Label>
              <Input
                value={prefijo.persona.moral.fechaConstitucion}
                onChange={(event) =>
                  actualiza((draft) => {
                    draft.persona.moral.fechaConstitucion = event.target.value
                  })
                }
                placeholder="AAAAMMDD"
              />
            </div>
            <div className="space-y-2">
              <Label>País de nacionalidad</Label>
              <PaisSelect
                value={prefijo.persona.moral.paisNacionalidad}
                onChange={(pais) =>
                  actualiza((draft) => {
                    draft.persona.moral.paisNacionalidad = pais
                  })
                }
                opciones={paises}
              />
            </div>
            <div className="space-y-2">
              <Label>Giro mercantil</Label>
              <Input
                value={prefijo.persona.moral.giroMercantil}
                onChange={(event) =>
                  actualiza((draft) => {
                    draft.persona.moral.giroMercantil = event.target.value
                  })
                }
                placeholder="Código 7 dígitos"
              />
            </div>
          </div>
        )}

        {tipo === "fideicomiso" && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Denominación del fiduciario</Label>
              <Input
                value={prefijo.persona.fideicomiso.denominacion}
                onChange={(event) =>
                  actualiza((draft) => {
                    draft.persona.fideicomiso.denominacion = event.target.value.toUpperCase()
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>RFC del fideicomiso</Label>
              <Input
                value={prefijo.persona.fideicomiso.rfc}
                onChange={(event) =>
                  actualiza((draft) => {
                    draft.persona.fideicomiso.rfc = event.target.value.toUpperCase()
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Identificador</Label>
              <Input
                value={prefijo.persona.fideicomiso.identificador}
                onChange={(event) =>
                  actualiza((draft) => {
                    draft.persona.fideicomiso.identificador = event.target.value.toUpperCase()
                  })
                }
              />
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <Label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <MapPin className="h-4 w-4 text-emerald-600" /> Domicilio {etiquetaDomicilio}
          </Label>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Tipo de domicilio</Label>
              <Select
                value={prefijo.domicilio.tipo}
                onValueChange={(nuevo) =>
                  actualiza((draft) => {
                    draft.domicilio.tipo = nuevo as "nacional" | "extranjero"
                  })
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nacional">Nacional</SelectItem>
                  <SelectItem value="extranjero">Extranjero</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {prefijo.domicilio.tipo === "nacional" ? (
              <>
                <div className="space-y-2">
                  <Label>Código postal</Label>
                  <Input
                    value={prefijo.domicilio.nacional.codigoPostal}
                    onChange={(event) =>
                      actualiza((draft) => {
                        const codigo = normalizeCodigoPostal(event.target.value)
                        draft.domicilio.nacional.codigoPostal = codigo
                        const info = catalogoCodigosPostales.get(codigo)
                        if (info) {
                          draft.domicilio.nacional.estado = info.estado
                          draft.domicilio.nacional.municipio = info.municipio
                          if (info.colonias.length > 0) {
                            draft.domicilio.nacional.colonia = info.colonias[0]
                          }
                        }
                      })
                    }
                    placeholder="#####"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Colonia</Label>
                  {coloniasDisponibles.length > 0 ? (
                    <Select
                      value={prefijo.domicilio.nacional.colonia || undefined}
                      onValueChange={(colonia) =>
                        actualiza((draft) => {
                          draft.domicilio.nacional.colonia = colonia
                        })
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {coloniasDisponibles.map((colonia) => (
                          <SelectItem key={colonia} value={colonia}>
                            {colonia}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={prefijo.domicilio.nacional.colonia}
                      onChange={(event) =>
                        actualiza((draft) => {
                          draft.domicilio.nacional.colonia = event.target.value.toUpperCase()
                        })
                      }
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input
                    value={infoActual?.estado || prefijo.domicilio.nacional.estado}
                    readOnly={Boolean(infoActual)}
                    onChange={(event) =>
                      actualiza((draft) => {
                        draft.domicilio.nacional.estado = event.target.value.toUpperCase()
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Municipio</Label>
                  <Input
                    value={infoActual?.municipio || prefijo.domicilio.nacional.municipio}
                    readOnly={Boolean(infoActual)}
                    onChange={(event) =>
                      actualiza((draft) => {
                        draft.domicilio.nacional.municipio = event.target.value.toUpperCase()
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Calle</Label>
                  <Input
                    value={prefijo.domicilio.nacional.calle}
                    onChange={(event) =>
                      actualiza((draft) => {
                        draft.domicilio.nacional.calle = event.target.value.toUpperCase()
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número exterior</Label>
                  <Input
                    value={prefijo.domicilio.nacional.numeroExterior}
                    onChange={(event) =>
                      actualiza((draft) => {
                        draft.domicilio.nacional.numeroExterior = event.target.value.toUpperCase()
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número interior</Label>
                  <Input
                    value={prefijo.domicilio.nacional.numeroInterior}
                    onChange={(event) =>
                      actualiza((draft) => {
                        draft.domicilio.nacional.numeroInterior = event.target.value.toUpperCase()
                      })
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>País</Label>
                  <PaisSelect
                    value={prefijo.domicilio.extranjero.pais}
                    onChange={(pais) =>
                      actualiza((draft) => {
                        draft.domicilio.extranjero.pais = pais
                      })
                    }
                    opciones={paises}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado / provincia</Label>
                  <Input
                    value={prefijo.domicilio.extranjero.estadoProvincia}
                    onChange={(event) =>
                      actualiza((draft) => {
                        draft.domicilio.extranjero.estadoProvincia = event.target.value.toUpperCase()
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input
                    value={prefijo.domicilio.extranjero.ciudad}
                    onChange={(event) =>
                      actualiza((draft) => {
                        draft.domicilio.extranjero.ciudad = event.target.value.toUpperCase()
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Colonia</Label>
                  <Input
                    value={prefijo.domicilio.extranjero.colonia}
                    onChange={(event) =>
                      actualiza((draft) => {
                        draft.domicilio.extranjero.colonia = event.target.value.toUpperCase()
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Calle</Label>
                  <Input
                    value={prefijo.domicilio.extranjero.calle}
                    onChange={(event) =>
                      actualiza((draft) => {
                        draft.domicilio.extranjero.calle = event.target.value.toUpperCase()
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número exterior</Label>
                  <Input
                    value={prefijo.domicilio.extranjero.numeroExterior}
                    onChange={(event) =>
                      actualiza((draft) => {
                        draft.domicilio.extranjero.numeroExterior = event.target.value.toUpperCase()
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número interior</Label>
                  <Input
                    value={prefijo.domicilio.extranjero.numeroInterior}
                    onChange={(event) =>
                      actualiza((draft) => {
                        draft.domicilio.extranjero.numeroInterior = event.target.value.toUpperCase()
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Código postal</Label>
                  <Input
                    value={prefijo.domicilio.extranjero.codigoPostal}
                    onChange={(event) =>
                      actualiza((draft) => {
                        draft.domicilio.extranjero.codigoPostal = event.target.value
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Phone className="h-4 w-4 text-emerald-600" /> Contacto
            </Label>
            <Input
              value={prefijo.telefono.clavePais}
              onChange={(event) =>
                actualiza((draft) => {
                  draft.telefono.clavePais = event.target.value.toUpperCase()
                })
              }
              placeholder="Clave de país"
            />
          </div>
          <div className="space-y-2">
            <Label>Número telefónico</Label>
            <Input
              value={prefijo.telefono.numero}
              onChange={(event) =>
                actualiza((draft) => {
                  draft.telefono.numero = event.target.value
                })
              }
              placeholder="Incluye lada"
            />
          </div>
          <div className="space-y-2">
            <Label>Correo electrónico</Label>
            <Input
              value={prefijo.telefono.correo}
              onChange={(event) =>
                actualiza((draft) => {
                  draft.telefono.correo = event.target.value
                })
              }
              placeholder="Opcional"
            />
          </div>
        </div>
      </>
    )
  }

  return (
    <Card className="border-emerald-200">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-emerald-700">
          <MapPin className="h-5 w-5" /> Cuestionario específico – {actividadReferencia}
        </CardTitle>
        <CardDescription>
          Captura la información oficial solicitada en el formato XML del SAT para la fracción de inmuebles.
        </CardDescription>
        {hayExpediente && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <Badge variant="outline" className="border-emerald-300 text-emerald-700">
              Expediente vinculado{expedienteNombre ? `: ${expedienteNombre}` : ""}
            </Badge>
            {expedienteActualizadoEn && (
              <span>Última actualización: {new Date(expedienteActualizadoEn).toLocaleDateString("es-MX")}</span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-8">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">Datos generales del aviso</p>
              <p className="text-xs text-muted-foreground">
                Define el periodo, claves oficiales y si el aviso es modificatorio o incluye alerta.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Mes reportado (AAAAMM)</Label>
              <Input
                value={value.mesReportado}
                onChange={(event) =>
                  updateFormValue(value, onChange, (draft) => {
                    draft.mesReportado = event.target.value.toUpperCase()
                  })
                }
                placeholder="Ejemplo: 202410"
              />
            </div>
            <div className="space-y-2">
              <Label>Clave entidad colegiada</Label>
              <Input
                value={value.claveEntidadColegiada}
                onChange={(event) =>
                  updateFormValue(value, onChange, (draft) => {
                    draft.claveEntidadColegiada = event.target.value.toUpperCase()
                  })
                }
                placeholder="LLLAAMMDDXXX"
              />
            </div>
            <div className="space-y-2">
              <Label>Clave sujeto obligado</Label>
              <Input
                value={value.claveSujetoObligado}
                onChange={(event) =>
                  updateFormValue(value, onChange, (draft) => {
                    draft.claveSujetoObligado = event.target.value.toUpperCase()
                  })
                }
                placeholder="LLLAAMMDDXXX"
              />
            </div>
            <div className="space-y-2">
              <Label>Clave actividad vulnerable</Label>
              <Input
                value={value.claveActividad}
                onChange={(event) =>
                  updateFormValue(value, onChange, (draft) => {
                    draft.claveActividad = event.target.value.toUpperCase()
                  })
                }
                placeholder="Ejemplo: INM"
              />
            </div>
            <div className="space-y-2">
              <Label>Referencia del aviso</Label>
              <Input
                value={value.referenciaAviso}
                onChange={(event) =>
                  updateFormValue(value, onChange, (draft) => {
                    draft.referenciaAviso = event.target.value.toUpperCase()
                  })
                }
                placeholder="Hasta 14 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Input
                value={value.prioridad}
                onChange={(event) =>
                  updateFormValue(value, onChange, (draft) => {
                    draft.prioridad = event.target.value
                  })
                }
                placeholder="9"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded border p-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  Aviso modificatorio
                </Label>
                <Checkbox
                  checked={value.modificatorio.habilitado}
                  onCheckedChange={(checked) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.modificatorio.habilitado = Boolean(checked)
                    })
                  }
                />
              </div>
              {value.modificatorio.habilitado && (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="space-y-1">
                    <Label>Folio previo</Label>
                    <Input
                      value={value.modificatorio.folio}
                      onChange={(event) =>
                        updateFormValue(value, onChange, (draft) => {
                          draft.modificatorio.folio = event.target.value.toUpperCase()
                        })
                      }
                      placeholder="AAAA-999999999"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Descripción de la modificación</Label>
                    <Textarea
                      value={value.modificatorio.descripcion}
                      onChange={(event) =>
                        updateFormValue(value, onChange, (draft) => {
                          draft.modificatorio.descripcion = event.target.value
                        })
                      }
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="rounded border p-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  Registrar alerta
                </Label>
                <Checkbox
                  checked={value.alerta.habilitado}
                  onCheckedChange={(checked) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.alerta.habilitado = Boolean(checked)
                    })
                  }
                />
              </div>
              {value.alerta.habilitado && (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="space-y-1">
                    <Label>Tipo de alerta</Label>
                    <Input
                      value={value.alerta.tipo}
                      onChange={(event) =>
                        updateFormValue(value, onChange, (draft) => {
                          draft.alerta.tipo = event.target.value
                        })
                      }
                      placeholder="Código numérico"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Descripción de la alerta</Label>
                    <Textarea
                      value={value.alerta.descripcion}
                      onChange={(event) =>
                        updateFormValue(value, onChange, (draft) => {
                          draft.alerta.descripcion = event.target.value
                        })
                      }
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <PersonaHeader
            titulo="Persona objeto del aviso"
            descripcion="Selecciona el tipo de persona y completa los datos conforme al formato oficial."
          />
          {hayExpediente && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <Select
                key={personaImportKey}
                onValueChange={(id) => {
                  const persona = expedientePersonas.find((item) => item.id === id)
                  if (!persona) return
                  updateFormValue(value, onChange, (draft) => {
                    draft.personaAviso = mergeExpedientePersona(draft.personaAviso, persona)
                  })
                  setPersonaImportKey((prev) => prev + 1)
                }}
              >
                <SelectTrigger className="w-72 bg-white text-left">
                  <SelectValue placeholder="Importar desde expediente" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {personaOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>Prellena los campos con la información del expediente único.</span>
            </div>
          )}
          {renderPersonaInputs("personaAviso")}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <PersonaHeader
              titulo="Beneficiario controlador"
              descripcion="Activa y captura los datos del beneficiario cuando aplique."
            />
            <Checkbox
              checked={value.beneficiario.habilitado}
              onCheckedChange={(checked) =>
                updateFormValue(value, onChange, (draft) => {
                  draft.beneficiario.habilitado = Boolean(checked)
                })
              }
            />
          </div>
          {value.beneficiario.habilitado && (
            <div className="rounded border border-slate-200 p-4 space-y-4">
              {hayExpediente && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <Select
                    key={beneficiarioImportKey}
                    onValueChange={(id) => {
                      const persona = expedientePersonas.find((item) => item.id === id)
                      if (!persona) return
                      updateFormValue(value, onChange, (draft) => {
                        draft.beneficiario.datos = mergeExpedientePersona(draft.beneficiario.datos, persona)
                      })
                      setBeneficiarioImportKey((prev) => prev + 1)
                    }}
                  >
                    <SelectTrigger className="w-72 bg-white text-left">
                      <SelectValue placeholder="Importar beneficiario" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {personaOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>Reutiliza la información del expediente para completar esta sección.</span>
                </div>
              )}
              {renderPersonaInputs("beneficiario")}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-700">Detalle de la operación</p>
            <p className="text-xs text-muted-foreground">
              Registra la fecha, sucursal y la forma de liquidación conforme al formato XML.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Fecha de la operación</Label>
              <Input
                value={value.detalleOperacion.fechaOperacion}
                onChange={(event) =>
                  updateFormValue(value, onChange, (draft) => {
                    draft.detalleOperacion.fechaOperacion = event.target.value
                  })
                }
                placeholder="AAAAMMDD"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de operación</Label>
              <Input
                value={value.detalleOperacion.tipoOperacion}
                onChange={(event) =>
                  updateFormValue(value, onChange, (draft) => {
                    draft.detalleOperacion.tipoOperacion = event.target.value
                  })
                }
                placeholder="Código"
              />
            </div>
            <div className="space-y-2">
              <Label>Línea de negocio</Label>
              <Input
                value={value.detalleOperacion.lineaNegocio}
                onChange={(event) =>
                  updateFormValue(value, onChange, (draft) => {
                    draft.detalleOperacion.lineaNegocio = event.target.value
                  })
                }
                placeholder="Código"
              />
            </div>
            <div className="space-y-2">
              <Label>Medio de operación</Label>
              <Input
                value={value.detalleOperacion.medioOperacion}
                onChange={(event) =>
                  updateFormValue(value, onChange, (draft) => {
                    draft.detalleOperacion.medioOperacion = event.target.value
                  })
                }
                placeholder="Código"
              />
            </div>
            <div className="space-y-2">
              <Label>Número de boletos / fichas / recibos</Label>
              <Input
                value={value.detalleOperacion.numeroBoletos}
                onChange={(event) =>
                  updateFormValue(value, onChange, (draft) => {
                    draft.detalleOperacion.numeroBoletos = event.target.value
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <Select
                value={value.detalleOperacion.tipoSucursal}
                onValueChange={(tipo) =>
                  updateFormValue(value, onChange, (draft) => {
                    draft.detalleOperacion.tipoSucursal = tipo as "propia" | "operador"
                  })
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="propia">Sucursal propia</SelectItem>
                  <SelectItem value="operador">Sucursal de operador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Figura del cliente</Label>
              <Input
                value={value.detalleOperacion.figuraCliente}
                onChange={(event) =>
                  updateFormValue(value, onChange, (draft) => {
                    draft.detalleOperacion.figuraCliente = event.target.value
                  })
                }
                placeholder="Código"
              />
            </div>
            <div className="space-y-2">
              <Label>Figura del sujeto obligado</Label>
              <Input
                value={value.detalleOperacion.figuraSujetoObligado}
                onChange={(event) =>
                  updateFormValue(value, onChange, (draft) => {
                    draft.detalleOperacion.figuraSujetoObligado = event.target.value
                  })
                }
                placeholder="Código"
              />
            </div>
          </div>

          {value.detalleOperacion.tipoSucursal === "propia" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Código postal de la sucursal</Label>
                <Input
                  value={value.detalleOperacion.sucursalPropia.codigoPostal}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.sucursalPropia.codigoPostal = normalizeCodigoPostal(
                        event.target.value,
                      )
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre de la sucursal</Label>
                <Input
                  value={value.detalleOperacion.sucursalPropia.nombre}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.sucursalPropia.nombre = event.target.value.toUpperCase()
                    })
                  }
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Nombre del operador</Label>
                <Input
                  value={value.detalleOperacion.sucursalOperador.nombre}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.sucursalOperador.nombre = event.target.value.toUpperCase()
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Código postal del establecimiento</Label>
                <Input
                  value={value.detalleOperacion.sucursalOperador.codigoPostal}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.sucursalOperador.codigoPostal = normalizeCodigoPostal(
                        event.target.value,
                      )
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre del establecimiento</Label>
                <Input
                  value={value.detalleOperacion.sucursalOperador.establecimiento}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.sucursalOperador.establecimiento = event.target.value.toUpperCase()
                    })
                  }
                />
              </div>
            </div>
          )}

          <div className="space-y-4">
            <PersonaHeader
              titulo="Datos de la contraparte"
              descripcion="Captura a la contraparte del acto u operación; puedes reutilizar datos del expediente único."
            />
            {hayExpediente && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <Select
                  key={contraparteImportKey}
                  onValueChange={(id) => {
                    const persona = expedientePersonas.find((item) => item.id === id)
                    if (!persona) return
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.contraparte = mergeExpedientePersona(
                        draft.detalleOperacion.contraparte,
                        persona,
                      )
                    })
                    setContraparteImportKey((prev) => prev + 1)
                  }}
                >
                  <SelectTrigger className="w-72 bg-white text-left">
                    <SelectValue placeholder="Importar contraparte" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {personaOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>Utiliza la información ya validada para agilizar la captura.</span>
              </div>
            )}
            {renderPersonaInputs("contraparte")}
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-700">Características del inmueble</p>
              <p className="text-xs text-muted-foreground">
                Describe el bien inmueble involucrado, incluyendo su ubicación y dimensiones principales.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Tipo de inmueble</Label>
                <Input
                  value={value.detalleOperacion.caracteristicasInmueble.tipoInmueble}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.caracteristicasInmueble.tipoInmueble = event.target.value
                    })
                  }
                  placeholder="Código"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor pactado</Label>
                <Input
                  value={value.detalleOperacion.caracteristicasInmueble.valorPactado}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.caracteristicasInmueble.valorPactado = event.target.value
                    })
                  }
                  placeholder="Importe con decimales"
                />
              </div>
              <div className="space-y-2">
                <Label>Código postal del inmueble</Label>
                <Input
                  value={value.detalleOperacion.caracteristicasInmueble.codigoPostal}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      const codigo = normalizeCodigoPostal(event.target.value)
                      draft.detalleOperacion.caracteristicasInmueble.codigoPostal = codigo
                      const info = catalogoCodigosPostales.get(codigo)
                      if (info && info.colonias.length > 0) {
                        draft.detalleOperacion.caracteristicasInmueble.colonia = info.colonias[0]
                      }
                    })
                  }
                  placeholder="#####"
                />
              </div>
              <div className="space-y-2">
                <Label>Colonia</Label>
                {coloniasInmueble.length > 0 ? (
                  <Select
                    value={value.detalleOperacion.caracteristicasInmueble.colonia || undefined}
                    onValueChange={(colonia) =>
                      updateFormValue(value, onChange, (draft) => {
                        draft.detalleOperacion.caracteristicasInmueble.colonia = colonia
                      })
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {coloniasInmueble.map((colonia) => (
                        <SelectItem key={colonia} value={colonia}>
                          {colonia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={value.detalleOperacion.caracteristicasInmueble.colonia}
                    onChange={(event) =>
                      updateFormValue(value, onChange, (draft) => {
                        draft.detalleOperacion.caracteristicasInmueble.colonia = event.target.value.toUpperCase()
                      })
                    }
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Calle</Label>
                <Input
                  value={value.detalleOperacion.caracteristicasInmueble.calle}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.caracteristicasInmueble.calle = event.target.value.toUpperCase()
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Número exterior</Label>
                <Input
                  value={value.detalleOperacion.caracteristicasInmueble.numeroExterior}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.caracteristicasInmueble.numeroExterior = event.target.value.toUpperCase()
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Número interior</Label>
                <Input
                  value={value.detalleOperacion.caracteristicasInmueble.numeroInterior}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.caracteristicasInmueble.numeroInterior = event.target.value.toUpperCase()
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Dimensión del terreno</Label>
                <Input
                  value={value.detalleOperacion.caracteristicasInmueble.dimensionTerreno}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.caracteristicasInmueble.dimensionTerreno = event.target.value
                    })
                  }
                  placeholder="Metros cuadrados"
                />
              </div>
              <div className="space-y-2">
                <Label>Dimensión construida</Label>
                <Input
                  value={value.detalleOperacion.caracteristicasInmueble.dimensionConstruido}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.caracteristicasInmueble.dimensionConstruido = event.target.value
                    })
                  }
                  placeholder="Metros cuadrados"
                />
              </div>
              <div className="space-y-2">
                <Label>Folio real</Label>
                <Input
                  value={value.detalleOperacion.caracteristicasInmueble.folioReal}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.caracteristicasInmueble.folioReal = event.target.value.toUpperCase()
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700">Contrato o instrumento público</p>
              <span className="text-xs text-muted-foreground">
                Registra los datos notariales o de avalúo cuando aplique.
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Número de instrumento</Label>
                <Input
                  value={value.detalleOperacion.contratoInstrumento.numeroInstrumento}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.contratoInstrumento.numeroInstrumento = event.target.value.toUpperCase()
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha del instrumento</Label>
                <Input
                  value={value.detalleOperacion.contratoInstrumento.fechaInstrumento}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.contratoInstrumento.fechaInstrumento = event.target.value
                    })
                  }
                  placeholder="AAAAMMDD"
                />
              </div>
              <div className="space-y-2">
                <Label>Número de notario / corredor</Label>
                <Input
                  value={value.detalleOperacion.contratoInstrumento.notario}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.contratoInstrumento.notario = event.target.value.toUpperCase()
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Entidad federativa</Label>
                <Input
                  value={value.detalleOperacion.contratoInstrumento.entidad}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.contratoInstrumento.entidad = event.target.value.toUpperCase()
                    })
                  }
                  placeholder="Código numérico"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor avalúo / catastral</Label>
                <Input
                  value={value.detalleOperacion.contratoInstrumento.valorAvaluo}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.contratoInstrumento.valorAvaluo = event.target.value
                    })
                  }
                  placeholder="Importe con decimales"
                />
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Liquidación en numerario</p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Fecha de pago</Label>
                <Input
                  value={value.detalleOperacion.liquidacionNumerario.fechaPago}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.liquidacionNumerario.fechaPago = event.target.value
                    })
                  }
                  placeholder="AAAAMMDD"
                />
              </div>
              <div className="space-y-2">
                <Label>Forma de pago</Label>
                <Input
                  value={value.detalleOperacion.liquidacionNumerario.formaPago}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.liquidacionNumerario.formaPago = event.target.value
                    })
                  }
                  placeholder="Código"
                />
              </div>
              <div className="space-y-2">
                <Label>Instrumento monetario</Label>
                <Input
                  value={value.detalleOperacion.liquidacionNumerario.instrumentoMonetario}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.liquidacionNumerario.instrumentoMonetario = event.target.value
                    })
                  }
                  placeholder="Código"
                />
              </div>
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Select
                  value={value.detalleOperacion.liquidacionNumerario.moneda}
                  onValueChange={(moneda) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.liquidacionNumerario.moneda = moneda
                    })
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {monedaOptions.map((moneda) => (
                      <SelectItem key={moneda.value} value={moneda.value}>
                        {moneda.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input
                  value={value.detalleOperacion.liquidacionNumerario.monto}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.liquidacionNumerario.monto = event.target.value
                    })
                  }
                  placeholder="Incluye decimales"
                />
              </div>
              <div className="space-y-2">
                <Label>Institución</Label>
                <Input
                  value={value.detalleOperacion.liquidacionNumerario.detalle.institucion}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.liquidacionNumerario.detalle.institucion = event.target.value.toUpperCase()
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Número de cuenta / documento</Label>
                <Input
                  value={value.detalleOperacion.liquidacionNumerario.detalle.numeroCuenta}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.liquidacionNumerario.detalle.numeroCuenta = event.target.value
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Liquidación en especie</p>
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                <Info className="h-3 w-3" /> Describe el bien cuando aplique
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Valor del bien</Label>
                <Input
                  value={value.detalleOperacion.liquidacionEspecie.valorBien}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.liquidacionEspecie.valorBien = event.target.value
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Select
                  value={value.detalleOperacion.liquidacionEspecie.moneda}
                  onValueChange={(moneda) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.liquidacionEspecie.moneda = moneda
                    })
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {monedaOptions.map((moneda) => (
                      <SelectItem key={moneda.value} value={moneda.value}>
                        {moneda.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de bien</Label>
                <Input
                  value={value.detalleOperacion.liquidacionEspecie.tipoBien}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.liquidacionEspecie.tipoBien = event.target.value
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de inmueble</Label>
                <Input
                  value={value.detalleOperacion.liquidacionEspecie.tipoInmueble}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.liquidacionEspecie.tipoInmueble = event.target.value
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Código postal del inmueble</Label>
                <Input
                  value={value.detalleOperacion.liquidacionEspecie.codigoPostal}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.liquidacionEspecie.codigoPostal = normalizeCodigoPostal(
                        event.target.value,
                      )
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Folio real</Label>
                <Input
                  value={value.detalleOperacion.liquidacionEspecie.folioReal}
                  onChange={(event) =>
                    updateFormValue(value, onChange, (draft) => {
                      draft.detalleOperacion.liquidacionEspecie.folioReal = event.target.value.toUpperCase()
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción del bien</Label>
              <Textarea
                value={value.detalleOperacion.liquidacionEspecie.descripcionBien}
                onChange={(event) =>
                  updateFormValue(value, onChange, (draft) => {
                    draft.detalleOperacion.liquidacionEspecie.descripcionBien = event.target.value
                  })
                }
                rows={3}
              />
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
