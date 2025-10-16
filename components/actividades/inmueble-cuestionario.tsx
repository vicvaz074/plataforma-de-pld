"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { MONEDAS_CATALOGO, PAISES } from "@/lib/data/catalogos"
import { buscarCodigoPostalMx } from "@/lib/data/codigos-postales"
import type { ExpedienteDetallado } from "@/lib/types/expediente"

export type PersonaAvisoTipo = "persona_fisica" | "persona_moral" | "fideicomiso"

export interface InmuebleCuestionarioData {
  mesReportado: string
  claveSujetoObligado: string
  claveActividad: string
  referenciaAviso: string
  prioridad: string
  personaTipo: PersonaAvisoTipo
  personaFisica: {
    nombre: string
    apellidoPaterno: string
    apellidoMaterno: string
    fechaNacimiento: string
    rfc: string
    curp: string
    paisNacionalidad: string
    paisNacimiento: string
    actividadEconomica: string
    tipoIdentificacion: string
    identificacionOtro: string
    autoridadIdentificacion: string
    numeroIdentificacion: string
  }
  personaMoral: {
    denominacion: string
    fechaConstitucion: string
    rfc: string
    paisNacionalidad: string
    giroMercantil: string
    representante: {
      nombre: string
      apellidoPaterno: string
      apellidoMaterno: string
      fechaNacimiento: string
      rfc: string
      curp: string
      tipoIdentificacion: string
      identificacionOtro: string
      autoridadIdentificacion: string
      numeroIdentificacion: string
    }
  }
  fideicomiso: {
    denominacion: string
    rfc: string
    identificador: string
    apoderado: {
      nombre: string
      apellidoPaterno: string
      apellidoMaterno: string
      fechaNacimiento: string
      rfc: string
      curp: string
      tipoIdentificacion: string
      identificacionOtro: string
      autoridadIdentificacion: string
      numeroIdentificacion: string
    }
  }
  domicilioTipo: "nacional" | "extranjero"
  domicilioNacional: {
    codigoPostal: string
    estado: string
    municipio: string
    ciudad: string
    colonia: string
    calle: string
    numeroExterior: string
    numeroInterior: string
  }
  domicilioExtranjero: {
    pais: string
    estadoProvincia: string
    ciudad: string
    colonia: string
    calle: string
    numeroExterior: string
    numeroInterior: string
    codigoPostal: string
  }
  telefono: {
    clavePais: string
    numero: string
    correo: string
  }
  beneficiarioActivo: boolean
  beneficiarioTipo: PersonaAvisoTipo
  beneficiarioFisica: {
    nombre: string
    apellidoPaterno: string
    apellidoMaterno: string
    fechaNacimiento: string
    rfc: string
    curp: string
    paisNacionalidad: string
    paisNacimiento: string
    actividadEconomica: string
  }
  beneficiarioMoral: {
    denominacion: string
    fechaConstitucion: string
    rfc: string
    paisNacionalidad: string
    giroMercantil: string
  }
  beneficiarioFideicomiso: {
    denominacion: string
    rfc: string
    identificador: string
  }
  operacion: {
    fechaOperacion: string
    tipoSucursal: "propia" | "operador"
    sucursalCodigoPostal: string
    sucursalNombre: string
    operadorNombre: string
    operadorCodigoPostal: string
    operadorEstablecimiento: string
    tipoOperacion: string
    lineaNegocio: string
    medio: string
    numeroBoletos: string
    moneda: string
    monto: string
    tipoLiquidacion: "numerario" | "especie"
    instrumentoMonetario: string
    fechaPago: string
    valorBien: string
    monedaBien: string
    tipoBien: string
    tipoInmueble: string
    codigoPostalInmueble: string
    coloniaInmueble: string
    calleInmueble: string
    numeroExteriorInmueble: string
    folioReal: string
  }
  notasAdicionales: string
}

export const PERSONA_OPCIONES: { value: PersonaAvisoTipo; label: string }[] = [
  { value: "persona_fisica", label: "Persona física" },
  { value: "persona_moral", label: "Persona moral" },
  { value: "fideicomiso", label: "Fideicomiso" },
]

export function crearInmuebleDataInicial(): InmuebleCuestionarioData {
  return {
    mesReportado: "",
    claveSujetoObligado: "",
    claveActividad: "",
    referenciaAviso: "",
    prioridad: "1",
    personaTipo: "persona_moral",
    personaFisica: {
      nombre: "",
      apellidoPaterno: "",
      apellidoMaterno: "",
      fechaNacimiento: "",
      rfc: "",
      curp: "",
      paisNacionalidad: "MX",
      paisNacimiento: "MX",
      actividadEconomica: "",
      tipoIdentificacion: "",
      identificacionOtro: "",
      autoridadIdentificacion: "",
      numeroIdentificacion: "",
    },
    personaMoral: {
      denominacion: "",
      fechaConstitucion: "",
      rfc: "",
      paisNacionalidad: "MX",
      giroMercantil: "",
      representante: {
        nombre: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
        fechaNacimiento: "",
        rfc: "",
        curp: "",
        tipoIdentificacion: "",
        identificacionOtro: "",
        autoridadIdentificacion: "",
        numeroIdentificacion: "",
      },
    },
    fideicomiso: {
      denominacion: "",
      rfc: "",
      identificador: "",
      apoderado: {
        nombre: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
        fechaNacimiento: "",
        rfc: "",
        curp: "",
        tipoIdentificacion: "",
        identificacionOtro: "",
        autoridadIdentificacion: "",
        numeroIdentificacion: "",
      },
    },
    domicilioTipo: "nacional",
    domicilioNacional: {
      codigoPostal: "",
      estado: "",
      municipio: "",
      ciudad: "",
      colonia: "",
      calle: "",
      numeroExterior: "",
      numeroInterior: "",
    },
    domicilioExtranjero: {
      pais: "",
      estadoProvincia: "",
      ciudad: "",
      colonia: "",
      calle: "",
      numeroExterior: "",
      numeroInterior: "",
      codigoPostal: "",
    },
    telefono: {
      clavePais: "MX",
      numero: "",
      correo: "",
    },
    beneficiarioActivo: false,
    beneficiarioTipo: "persona_fisica",
    beneficiarioFisica: {
      nombre: "",
      apellidoPaterno: "",
      apellidoMaterno: "",
      fechaNacimiento: "",
      rfc: "",
      curp: "",
      paisNacionalidad: "MX",
      paisNacimiento: "MX",
      actividadEconomica: "",
    },
    beneficiarioMoral: {
      denominacion: "",
      fechaConstitucion: "",
      rfc: "",
      paisNacionalidad: "MX",
      giroMercantil: "",
    },
    beneficiarioFideicomiso: {
      denominacion: "",
      rfc: "",
      identificador: "",
    },
    operacion: {
      fechaOperacion: "",
      tipoSucursal: "propia",
      sucursalCodigoPostal: "",
      sucursalNombre: "",
      operadorNombre: "",
      operadorCodigoPostal: "",
      operadorEstablecimiento: "",
      tipoOperacion: "",
      lineaNegocio: "",
      medio: "",
      numeroBoletos: "",
      moneda: "MXN",
      monto: "",
      tipoLiquidacion: "numerario",
      instrumentoMonetario: "",
      fechaPago: "",
      valorBien: "",
      monedaBien: "MXN",
      tipoBien: "",
      tipoInmueble: "",
      codigoPostalInmueble: "",
      coloniaInmueble: "",
      calleInmueble: "",
      numeroExteriorInmueble: "",
      folioReal: "",
    },
    notasAdicionales: "",
  }
}

interface InmuebleCuestionarioProps {
  data: InmuebleCuestionarioData
  onChange: (value: InmuebleCuestionarioData) => void
  expediente?: ExpedienteDetallado | null
}

export function InmuebleCuestionario({ data, onChange }: InmuebleCuestionarioProps) {
  const coloniasDomicilio = useMemo(() => {
    const info = buscarCodigoPostalMx(data.domicilioNacional.codigoPostal)
    return info?.colonias ?? []
  }, [data.domicilioNacional.codigoPostal])

  const coloniasInmueble = useMemo(() => {
    const info = buscarCodigoPostalMx(data.operacion.codigoPostalInmueble)
    return info?.colonias ?? []
  }, [data.operacion.codigoPostalInmueble])

  const handleUpdate = (updater: (prev: InmuebleCuestionarioData) => InmuebleCuestionarioData) => {
    onChange(updater(data))
  }

  const handleCodigoPostalNacional = (codigo: string) => {
    const sanitized = codigo.replace(/[^0-9]/g, "").slice(0, 5)
    const info = buscarCodigoPostalMx(sanitized)
    handleUpdate((prev) => ({
      ...prev,
      domicilioNacional: {
        ...prev.domicilioNacional,
        codigoPostal: sanitized,
        estado: info?.estado ?? prev.domicilioNacional.estado,
        municipio: info?.municipio ?? prev.domicilioNacional.municipio,
        ciudad: info?.ciudad ?? prev.domicilioNacional.ciudad,
        colonia: info?.colonias.includes(prev.domicilioNacional.colonia)
          ? prev.domicilioNacional.colonia
          : "",
      },
    }))
  }

  const handleCodigoPostalInmueble = (codigo: string) => {
    const sanitized = codigo.replace(/[^0-9]/g, "").slice(0, 5)
    const info = buscarCodigoPostalMx(sanitized)
    handleUpdate((prev) => ({
      ...prev,
      operacion: {
        ...prev.operacion,
        codigoPostalInmueble: sanitized,
        coloniaInmueble: info?.colonias.includes(prev.operacion.coloniaInmueble)
          ? prev.operacion.coloniaInmueble
          : "",
      },
    }))
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base text-slate-700">
            Encabezado del aviso inmobiliario
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Mes reportado (AAAAMM)</Label>
            <Input
              value={data.mesReportado}
              maxLength={6}
              onChange={(event) =>
                handleUpdate((prev) => ({ ...prev, mesReportado: event.target.value.replace(/[^0-9]/g, "").slice(0, 6) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Clave del sujeto obligado</Label>
            <Input
              value={data.claveSujetoObligado}
              maxLength={13}
              onChange={(event) =>
                handleUpdate((prev) => ({ ...prev, claveSujetoObligado: event.target.value.toUpperCase().slice(0, 13) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Clave de la actividad vulnerable</Label>
            <Input
              value={data.claveActividad}
              maxLength={3}
              onChange={(event) =>
                handleUpdate((prev) => ({ ...prev, claveActividad: event.target.value.toUpperCase().slice(0, 3) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Referencia del aviso</Label>
            <Input
              value={data.referenciaAviso}
              maxLength={14}
              onChange={(event) =>
                handleUpdate((prev) => ({ ...prev, referenciaAviso: event.target.value.slice(0, 14) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Prioridad</Label>
            <Input
              value={data.prioridad}
              maxLength={1}
              onChange={(event) =>
                handleUpdate((prev) => ({ ...prev, prioridad: event.target.value.replace(/[^0-9]/g, "").slice(0, 1) }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base text-slate-700">
            Persona objeto del aviso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo de persona</Label>
              <Select
                value={data.personaTipo}
                onValueChange={(value) =>
                  handleUpdate((prev) => ({ ...prev, personaTipo: value as PersonaAvisoTipo }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {PERSONA_OPCIONES.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {data.personaTipo === "persona_fisica" && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Nombre(s)</Label>
                <Input
                  value={data.personaFisica.nombre}
                  maxLength={200}
                  onChange={(event) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      personaFisica: { ...prev.personaFisica, nombre: event.target.value.slice(0, 200) },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido paterno</Label>
                <Input
                  value={data.personaFisica.apellidoPaterno}
                  maxLength={200}
                  onChange={(event) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      personaFisica: { ...prev.personaFisica, apellidoPaterno: event.target.value.slice(0, 200) },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido materno</Label>
                <Input
                  value={data.personaFisica.apellidoMaterno}
                  maxLength={200}
                  onChange={(event) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      personaFisica: { ...prev.personaFisica, apellidoMaterno: event.target.value.slice(0, 200) },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de nacimiento</Label>
                <Input
                  type="date"
                  value={data.personaFisica.fechaNacimiento}
                  onChange={(event) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      personaFisica: { ...prev.personaFisica, fechaNacimiento: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>RFC</Label>
                <Input
                  value={data.personaFisica.rfc}
                  maxLength={13}
                  onChange={(event) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      personaFisica: { ...prev.personaFisica, rfc: event.target.value.toUpperCase().slice(0, 13) },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>CURP</Label>
                <Input
                  value={data.personaFisica.curp}
                  maxLength={18}
                  onChange={(event) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      personaFisica: { ...prev.personaFisica, curp: event.target.value.toUpperCase().slice(0, 18) },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>País de nacionalidad</Label>
                <Select
                  value={data.personaFisica.paisNacionalidad}
                  onValueChange={(value) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      personaFisica: { ...prev.personaFisica, paisNacionalidad: value },
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAISES.map((pais) => (
                      <SelectItem key={pais.value} value={pais.value}>
                        {pais.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>País de nacimiento</Label>
                <Select
                  value={data.personaFisica.paisNacimiento}
                  onValueChange={(value) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      personaFisica: { ...prev.personaFisica, paisNacimiento: value },
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAISES.map((pais) => (
                      <SelectItem key={pais.value} value={pais.value}>
                        {pais.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Actividad económica</Label>
                <Input
                  value={data.personaFisica.actividadEconomica}
                  maxLength={7}
                  onChange={(event) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      personaFisica: {
                        ...prev.personaFisica,
                        actividadEconomica: event.target.value.replace(/[^0-9]/g, "").slice(0, 7),
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de identificación</Label>
                <Input
                  value={data.personaFisica.tipoIdentificacion}
                  maxLength={2}
                  onChange={(event) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      personaFisica: {
                        ...prev.personaFisica,
                        tipoIdentificacion: event.target.value.replace(/[^0-9]/g, "").slice(0, 2),
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Número de identificación</Label>
                <Input
                  value={data.personaFisica.numeroIdentificacion}
                  maxLength={40}
                  onChange={(event) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      personaFisica: {
                        ...prev.personaFisica,
                        numeroIdentificacion: event.target.value.slice(0, 40),
                      },
                    }))
                  }
                />
              </div>
            </div>
          )}

          {data.personaTipo === "persona_moral" && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Denominación o razón social</Label>
                  <Input
                    value={data.personaMoral.denominacion}
                    maxLength={254}
                    onChange={(event) =>
                      handleUpdate((prev) => ({
                        ...prev,
                        personaMoral: {
                          ...prev.personaMoral,
                          denominacion: event.target.value.slice(0, 254),
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de constitución</Label>
                  <Input
                    type="date"
                    value={data.personaMoral.fechaConstitucion}
                    onChange={(event) =>
                      handleUpdate((prev) => ({
                        ...prev,
                        personaMoral: { ...prev.personaMoral, fechaConstitucion: event.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>RFC</Label>
                  <Input
                    value={data.personaMoral.rfc}
                    maxLength={13}
                    onChange={(event) =>
                      handleUpdate((prev) => ({
                        ...prev,
                        personaMoral: { ...prev.personaMoral, rfc: event.target.value.toUpperCase().slice(0, 13) },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>País de nacionalidad</Label>
                  <Select
                    value={data.personaMoral.paisNacionalidad}
                    onValueChange={(value) =>
                      handleUpdate((prev) => ({
                        ...prev,
                        personaMoral: { ...prev.personaMoral, paisNacionalidad: value },
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAISES.map((pais) => (
                        <SelectItem key={pais.value} value={pais.value}>
                          {pais.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Actividad económica / giro</Label>
                  <Input
                    value={data.personaMoral.giroMercantil}
                    maxLength={7}
                    onChange={(event) =>
                      handleUpdate((prev) => ({
                        ...prev,
                        personaMoral: {
                          ...prev.personaMoral,
                          giroMercantil: event.target.value.replace(/[^0-9]/g, "").slice(0, 7),
                        },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Nombre del representante</Label>
                  <Input
                    value={data.personaMoral.representante.nombre}
                    maxLength={200}
                    onChange={(event) =>
                      handleUpdate((prev) => ({
                        ...prev,
                        personaMoral: {
                          ...prev.personaMoral,
                          representante: {
                            ...prev.personaMoral.representante,
                            nombre: event.target.value.slice(0, 200),
                          },
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apellido paterno</Label>
                  <Input
                    value={data.personaMoral.representante.apellidoPaterno}
                    maxLength={200}
                    onChange={(event) =>
                      handleUpdate((prev) => ({
                        ...prev,
                        personaMoral: {
                          ...prev.personaMoral,
                          representante: {
                            ...prev.personaMoral.representante,
                            apellidoPaterno: event.target.value.slice(0, 200),
                          },
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apellido materno</Label>
                  <Input
                    value={data.personaMoral.representante.apellidoMaterno}
                    maxLength={200}
                    onChange={(event) =>
                      handleUpdate((prev) => ({
                        ...prev,
                        personaMoral: {
                          ...prev.personaMoral,
                          representante: {
                            ...prev.personaMoral.representante,
                            apellidoMaterno: event.target.value.slice(0, 200),
                          },
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de nacimiento</Label>
                  <Input
                    type="date"
                    value={data.personaMoral.representante.fechaNacimiento}
                    onChange={(event) =>
                      handleUpdate((prev) => ({
                        ...prev,
                        personaMoral: {
                          ...prev.personaMoral,
                          representante: {
                            ...prev.personaMoral.representante,
                            fechaNacimiento: event.target.value,
                          },
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>RFC</Label>
                  <Input
                    value={data.personaMoral.representante.rfc}
                    maxLength={13}
                    onChange={(event) =>
                      handleUpdate((prev) => ({
                        ...prev,
                        personaMoral: {
                          ...prev.personaMoral,
                          representante: {
                            ...prev.personaMoral.representante,
                            rfc: event.target.value.toUpperCase().slice(0, 13),
                          },
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>CURP</Label>
                  <Input
                    value={data.personaMoral.representante.curp}
                    maxLength={18}
                    onChange={(event) =>
                      handleUpdate((prev) => ({
                        ...prev,
                        personaMoral: {
                          ...prev.personaMoral,
                          representante: {
                            ...prev.personaMoral.representante,
                            curp: event.target.value.toUpperCase().slice(0, 18),
                          },
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base text-slate-700">Domicilio de la persona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Código postal</Label>
              <Input
                value={data.domicilioNacional.codigoPostal}
                maxLength={5}
                onChange={(event) => handleCodigoPostalNacional(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={data.domicilioNacional.estado} readOnly placeholder="Se completa automáticamente" />
            </div>
            <div className="space-y-2">
              <Label>Municipio o alcaldía</Label>
              <Input value={data.domicilioNacional.municipio} readOnly placeholder="Se completa automáticamente" />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input value={data.domicilioNacional.ciudad} readOnly placeholder="Se completa automáticamente" />
            </div>
            <div className="space-y-2">
              <Label>Colonia</Label>
              <Select
                value={data.domicilioNacional.colonia}
                onValueChange={(value) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    domicilioNacional: { ...prev.domicilioNacional, colonia: value },
                  }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={coloniasDomicilio.length > 0 ? "Selecciona" : "Ingresa código postal"} />
                </SelectTrigger>
                <SelectContent>
                  {coloniasDomicilio.map((colonia) => (
                    <SelectItem key={colonia} value={colonia}>
                      {colonia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Calle, avenida o vía</Label>
              <Input
                value={data.domicilioNacional.calle}
                maxLength={100}
                onChange={(event) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    domicilioNacional: { ...prev.domicilioNacional, calle: event.target.value.slice(0, 100) },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Número exterior</Label>
              <Input
                value={data.domicilioNacional.numeroExterior}
                maxLength={56}
                onChange={(event) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    domicilioNacional: {
                      ...prev.domicilioNacional,
                      numeroExterior: event.target.value.slice(0, 56),
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Número interior</Label>
              <Input
                value={data.domicilioNacional.numeroInterior}
                maxLength={40}
                onChange={(event) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    domicilioNacional: {
                      ...prev.domicilioNacional,
                      numeroInterior: event.target.value.slice(0, 40),
                    },
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base text-slate-700">Medios de contacto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Clave de país</Label>
            <Select
              value={data.telefono.clavePais}
              onValueChange={(value) =>
                handleUpdate((prev) => ({
                  ...prev,
                  telefono: { ...prev.telefono, clavePais: value },
                }))
              }
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {PAISES.map((pais) => (
                  <SelectItem key={pais.value} value={pais.value}>
                    {pais.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Número telefónico</Label>
            <Input
              value={data.telefono.numero}
              maxLength={12}
              onChange={(event) =>
                handleUpdate((prev) => ({
                  ...prev,
                  telefono: {
                    ...prev.telefono,
                    numero: event.target.value.replace(/[^0-9]/g, "").slice(0, 12),
                  },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Correo electrónico</Label>
            <Input
              type="email"
              value={data.telefono.correo}
              maxLength={60}
              onChange={(event) =>
                handleUpdate((prev) => ({
                  ...prev,
                  telefono: { ...prev.telefono, correo: event.target.value.slice(0, 60) },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base text-slate-700">Beneficiario controlador</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="beneficiario-activo"
              checked={data.beneficiarioActivo}
              onCheckedChange={(checked) =>
                handleUpdate((prev) => ({
                  ...prev,
                  beneficiarioActivo: Boolean(checked),
                }))
              }
            />
            <Label htmlFor="beneficiario-activo" className="text-sm text-slate-600">
              Incluir datos del beneficiario controlador o dueño beneficiario
            </Label>
          </div>

          {data.beneficiarioActivo && (
            <div className="space-y-4">
              <div className="space-y-2 md:w-1/2">
                <Label>Tipo de persona</Label>
                <Select
                  value={data.beneficiarioTipo}
                  onValueChange={(value) =>
                    handleUpdate((prev) => ({
                      ...prev,
                      beneficiarioTipo: value as PersonaAvisoTipo,
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSONA_OPCIONES.map((opcion) => (
                      <SelectItem key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {data.beneficiarioTipo === "persona_fisica" && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Nombre(s)</Label>
                    <Input
                      value={data.beneficiarioFisica.nombre}
                      maxLength={200}
                      onChange={(event) =>
                        handleUpdate((prev) => ({
                          ...prev,
                          beneficiarioFisica: {
                            ...prev.beneficiarioFisica,
                            nombre: event.target.value.slice(0, 200),
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido paterno</Label>
                    <Input
                      value={data.beneficiarioFisica.apellidoPaterno}
                      maxLength={200}
                      onChange={(event) =>
                        handleUpdate((prev) => ({
                          ...prev,
                          beneficiarioFisica: {
                            ...prev.beneficiarioFisica,
                            apellidoPaterno: event.target.value.slice(0, 200),
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido materno</Label>
                    <Input
                      value={data.beneficiarioFisica.apellidoMaterno}
                      maxLength={200}
                      onChange={(event) =>
                        handleUpdate((prev) => ({
                          ...prev,
                          beneficiarioFisica: {
                            ...prev.beneficiarioFisica,
                            apellidoMaterno: event.target.value.slice(0, 200),
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de nacimiento</Label>
                    <Input
                      type="date"
                      value={data.beneficiarioFisica.fechaNacimiento}
                      onChange={(event) =>
                        handleUpdate((prev) => ({
                          ...prev,
                          beneficiarioFisica: {
                            ...prev.beneficiarioFisica,
                            fechaNacimiento: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RFC</Label>
                    <Input
                      value={data.beneficiarioFisica.rfc}
                      maxLength={13}
                      onChange={(event) =>
                        handleUpdate((prev) => ({
                          ...prev,
                          beneficiarioFisica: {
                            ...prev.beneficiarioFisica,
                            rfc: event.target.value.toUpperCase().slice(0, 13),
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CURP</Label>
                    <Input
                      value={data.beneficiarioFisica.curp}
                      maxLength={18}
                      onChange={(event) =>
                        handleUpdate((prev) => ({
                          ...prev,
                          beneficiarioFisica: {
                            ...prev.beneficiarioFisica,
                            curp: event.target.value.toUpperCase().slice(0, 18),
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Actividad económica</Label>
                    <Input
                      value={data.beneficiarioFisica.actividadEconomica}
                      maxLength={7}
                      onChange={(event) =>
                        handleUpdate((prev) => ({
                          ...prev,
                          beneficiarioFisica: {
                            ...prev.beneficiarioFisica,
                            actividadEconomica: event.target.value.replace(/[^0-9]/g, "").slice(0, 7),
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              {data.beneficiarioTipo === "persona_moral" && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Denominación o razón social</Label>
                    <Input
                      value={data.beneficiarioMoral.denominacion}
                      maxLength={254}
                      onChange={(event) =>
                        handleUpdate((prev) => ({
                          ...prev,
                          beneficiarioMoral: {
                            ...prev.beneficiarioMoral,
                            denominacion: event.target.value.slice(0, 254),
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de constitución</Label>
                    <Input
                      type="date"
                      value={data.beneficiarioMoral.fechaConstitucion}
                      onChange={(event) =>
                        handleUpdate((prev) => ({
                          ...prev,
                          beneficiarioMoral: {
                            ...prev.beneficiarioMoral,
                            fechaConstitucion: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RFC</Label>
                    <Input
                      value={data.beneficiarioMoral.rfc}
                      maxLength={12}
                      onChange={(event) =>
                        handleUpdate((prev) => ({
                          ...prev,
                          beneficiarioMoral: {
                            ...prev.beneficiarioMoral,
                            rfc: event.target.value.toUpperCase().slice(0, 12),
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>País de nacionalidad</Label>
                    <Select
                      value={data.beneficiarioMoral.paisNacionalidad}
                      onValueChange={(value) =>
                        handleUpdate((prev) => ({
                          ...prev,
                          beneficiarioMoral: {
                            ...prev.beneficiarioMoral,
                            paisNacionalidad: value,
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAISES.map((pais) => (
                          <SelectItem key={pais.value} value={pais.value}>
                            {pais.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Actividad económica</Label>
                    <Input
                      value={data.beneficiarioMoral.giroMercantil}
                      maxLength={7}
                      onChange={(event) =>
                        handleUpdate((prev) => ({
                          ...prev,
                          beneficiarioMoral: {
                            ...prev.beneficiarioMoral,
                            giroMercantil: event.target.value.replace(/[^0-9]/g, "").slice(0, 7),
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              {data.beneficiarioTipo === "fideicomiso" && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Denominación o razón social</Label>
                    <Input
                      value={data.beneficiarioFideicomiso.denominacion}
                      maxLength={254}
                      onChange={(event) =>
                        handleUpdate((prev) => ({
                          ...prev,
                          beneficiarioFideicomiso: {
                            ...prev.beneficiarioFideicomiso,
                            denominacion: event.target.value.slice(0, 254),
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RFC</Label>
                    <Input
                      value={data.beneficiarioFideicomiso.rfc}
                      maxLength={12}
                      onChange={(event) =>
                        handleUpdate((prev) => ({
                          ...prev,
                          beneficiarioFideicomiso: {
                            ...prev.beneficiarioFideicomiso,
                            rfc: event.target.value.toUpperCase().slice(0, 12),
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Identificador</Label>
                    <Input
                      value={data.beneficiarioFideicomiso.identificador}
                      maxLength={40}
                      onChange={(event) =>
                        handleUpdate((prev) => ({
                          ...prev,
                          beneficiarioFideicomiso: {
                            ...prev.beneficiarioFideicomiso,
                            identificador: event.target.value.slice(0, 40),
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base text-slate-700">Detalle de la operación inmobiliaria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Fecha de la operación</Label>
              <Input
                type="date"
                value={data.operacion.fechaOperacion}
                onChange={(event) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: { ...prev.operacion, fechaOperacion: event.target.value },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de operación</Label>
              <Input
                value={data.operacion.tipoOperacion}
                maxLength={4}
                onChange={(event) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: {
                      ...prev.operacion,
                      tipoOperacion: event.target.value.replace(/[^0-9]/g, "").slice(0, 4),
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Medio empleado</Label>
              <Input
                value={data.operacion.medio}
                maxLength={1}
                onChange={(event) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: {
                      ...prev.operacion,
                      medio: event.target.value.replace(/[^0-9]/g, "").slice(0, 1),
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select
                value={data.operacion.moneda}
                onValueChange={(value) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: { ...prev.operacion, moneda: value },
                  }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {MONEDAS_CATALOGO.map((moneda) => (
                    <SelectItem key={moneda.value} value={moneda.value}>
                      {moneda.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto de la operación</Label>
              <Input
                value={data.operacion.monto}
                maxLength={17}
                onChange={(event) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: {
                      ...prev.operacion,
                      monto: event.target.value.replace(/[^0-9.]/g, "").slice(0, 17),
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de liquidación</Label>
              <Select
                value={data.operacion.tipoLiquidacion}
                onValueChange={(value) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: { ...prev.operacion, tipoLiquidacion: value as "numerario" | "especie" },
                  }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numerario">Numerario</SelectItem>
                  <SelectItem value="especie">Especie</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha de pago</Label>
              <Input
                type="date"
                value={data.operacion.fechaPago}
                onChange={(event) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: { ...prev.operacion, fechaPago: event.target.value },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Instrumento monetario</Label>
              <Input
                value={data.operacion.instrumentoMonetario}
                maxLength={2}
                onChange={(event) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: {
                      ...prev.operacion,
                      instrumentoMonetario: event.target.value.replace(/[^0-9]/g, "").slice(0, 2),
                    },
                  }))
                }
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo de inmueble</Label>
              <Input
                value={data.operacion.tipoInmueble}
                maxLength={3}
                onChange={(event) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: {
                      ...prev.operacion,
                      tipoInmueble: event.target.value.replace(/[^0-9]/g, "").slice(0, 3),
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Código postal del inmueble</Label>
              <Input
                value={data.operacion.codigoPostalInmueble}
                maxLength={5}
                onChange={(event) => handleCodigoPostalInmueble(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Colonia</Label>
              <Select
                value={data.operacion.coloniaInmueble}
                onValueChange={(value) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: { ...prev.operacion, coloniaInmueble: value },
                  }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={coloniasInmueble.length > 0 ? "Selecciona" : "Ingresa código postal"} />
                </SelectTrigger>
                <SelectContent>
                  {coloniasInmueble.map((colonia) => (
                    <SelectItem key={colonia} value={colonia}>
                      {colonia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Calle</Label>
              <Input
                value={data.operacion.calleInmueble}
                maxLength={100}
                onChange={(event) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: { ...prev.operacion, calleInmueble: event.target.value.slice(0, 100) },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Número exterior</Label>
              <Input
                value={data.operacion.numeroExteriorInmueble}
                maxLength={56}
                onChange={(event) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: {
                      ...prev.operacion,
                      numeroExteriorInmueble: event.target.value.slice(0, 56),
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Folio real</Label>
              <Input
                value={data.operacion.folioReal}
                maxLength={20}
                onChange={(event) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: { ...prev.operacion, folioReal: event.target.value.slice(0, 20) },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Valor del bien</Label>
              <Input
                value={data.operacion.valorBien}
                maxLength={17}
                onChange={(event) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: {
                      ...prev.operacion,
                      valorBien: event.target.value.replace(/[^0-9.]/g, "").slice(0, 17),
                    },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda del valor del bien</Label>
              <Select
                value={data.operacion.monedaBien}
                onValueChange={(value) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: { ...prev.operacion, monedaBien: value },
                  }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {MONEDAS_CATALOGO.map((moneda) => (
                    <SelectItem key={moneda.value} value={moneda.value}>
                      {moneda.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de bien (catálogo UIF)</Label>
              <Input
                value={data.operacion.tipoBien}
                maxLength={3}
                onChange={(event) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    operacion: {
                      ...prev.operacion,
                      tipoBien: event.target.value.replace(/[^0-9]/g, "").slice(0, 3),
                    },
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base text-slate-700">Notas internas</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={data.notasAdicionales}
            maxLength={3000}
            onChange={(event) =>
              handleUpdate((prev) => ({ ...prev, notasAdicionales: event.target.value.slice(0, 3000) }))
            }
            placeholder="Registra observaciones adicionales, validaciones internas o información que ayudará al momento de generar el aviso definitivo."
          />
        </CardContent>
      </Card>
    </div>
  )
}
