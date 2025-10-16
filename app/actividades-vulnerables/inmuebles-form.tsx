"use client"

import { useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { PAISES } from "@/lib/data/paises"
import { findCodigoPostal } from "@/lib/data/codigos-postales"
import type { ExpedienteDetalle, ExpedientePersona } from "@/lib/types/expediente"

export type PersonaTipoAviso = "fisica" | "moral" | "fideicomiso"

export interface InmueblesFormulario {
  mesReportado: string
  claveEntidadColegiada: string
  claveSujetoObligado: string
  claveActividad: string
  referenciaAviso: string
  prioridad: string
  tipoAlerta: string
  descripcionAlerta: string
  personaAviso: {
    tipoPersona: PersonaTipoAviso
    fisica: {
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
    moral: {
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
    domicilio: {
      tipo: "nacional" | "extranjero"
      nacional: {
        codigoPostal: string
        estado: string
        municipio: string
        ciudad: string
        colonia: string
        calle: string
        numeroExterior: string
        numeroInterior: string
      }
      extranjero: {
        pais: string
        estadoProvincia: string
        ciudad: string
        colonia: string
        calle: string
        numeroExterior: string
        numeroInterior: string
        codigoPostal: string
      }
    }
    telefono: {
      clavePais: string
      numero: string
      correo: string
    }
  }
  beneficiario: {
    activo: boolean
    tipoPersona: PersonaTipoAviso
    fisica: {
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
    moral: {
      denominacion: string
      fechaConstitucion: string
      rfc: string
      paisNacionalidad: string
      giroMercantil: string
    }
    fideicomiso: {
      denominacion: string
      rfc: string
      identificador: string
    }
    domicilio: {
      tipo: "nacional" | "extranjero"
      nacional: {
        codigoPostal: string
        estado: string
        municipio: string
        ciudad: string
        colonia: string
        calle: string
        numeroExterior: string
        numeroInterior: string
      }
      extranjero: {
        pais: string
        estadoProvincia: string
        ciudad: string
        colonia: string
        calle: string
        numeroExterior: string
        numeroInterior: string
        codigoPostal: string
      }
    }
    telefono: {
      clavePais: string
      numero: string
      correo: string
    }
  }
  operacion: {
    fechaOperacion: string
    tipoOperacion: string
    lineaNegocio: string
    medioOperacion: string
    tipoSucursal: "propia" | "operador"
    sucursalPropia: {
      codigoPostal: string
      nombre: string
    }
    sucursalOperador: {
      nombreOperador: string
      codigoPostal: string
      nombreEstablecimiento: string
    }
    tipoInmueble: string
    valorPactado: string
    monedaInmueble: string
    codigoPostalInmueble: string
    estadoInmueble: string
    municipioInmueble: string
    ciudadInmueble: string
    coloniaInmueble: string
    calleInmueble: string
    numeroExteriorInmueble: string
    numeroInteriorInmueble: string
    folioReal: string
    dimensionTerreno: string
    dimensionConstruido: string
    liquidacion: {
      tipo: "numerario" | "especie"
      fechaPago: string
      instrumentoMonetario: string
      moneda: string
      montoOperacion: string
      valorBien: string
      tipoBien: string
      monedaValorBien: string
    }
  }
}

export function createInmueblesFormulario(periodo: string): InmueblesFormulario {
  const fechaHoy = new Date().toISOString().substring(0, 10)
  return {
    mesReportado: periodo,
    claveEntidadColegiada: "",
    claveSujetoObligado: "",
    claveActividad: "",
    referenciaAviso: "",
    prioridad: "1",
    tipoAlerta: "",
    descripcionAlerta: "",
    personaAviso: {
      tipoPersona: "moral",
      fisica: {
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
      moral: {
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
      domicilio: {
        tipo: "nacional",
        nacional: {
          codigoPostal: "",
          estado: "",
          municipio: "",
          ciudad: "",
          colonia: "",
          calle: "",
          numeroExterior: "",
          numeroInterior: "",
        },
        extranjero: {
          pais: "",
          estadoProvincia: "",
          ciudad: "",
          colonia: "",
          calle: "",
          numeroExterior: "",
          numeroInterior: "",
          codigoPostal: "",
        },
      },
      telefono: {
        clavePais: "MX",
        numero: "",
        correo: "",
      },
    },
    beneficiario: {
      activo: false,
      tipoPersona: "fisica",
      fisica: {
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
      moral: {
        denominacion: "",
        fechaConstitucion: "",
        rfc: "",
        paisNacionalidad: "MX",
        giroMercantil: "",
      },
      fideicomiso: {
        denominacion: "",
        rfc: "",
        identificador: "",
      },
      domicilio: {
        tipo: "nacional",
        nacional: {
          codigoPostal: "",
          estado: "",
          municipio: "",
          ciudad: "",
          colonia: "",
          calle: "",
          numeroExterior: "",
          numeroInterior: "",
        },
        extranjero: {
          pais: "",
          estadoProvincia: "",
          ciudad: "",
          colonia: "",
          calle: "",
          numeroExterior: "",
          numeroInterior: "",
          codigoPostal: "",
        },
      },
      telefono: {
        clavePais: "MX",
        numero: "",
        correo: "",
      },
    },
    operacion: {
      fechaOperacion: fechaHoy,
      tipoOperacion: "",
      lineaNegocio: "",
      medioOperacion: "",
      tipoSucursal: "propia",
      sucursalPropia: {
        codigoPostal: "",
        nombre: "",
      },
      sucursalOperador: {
        nombreOperador: "",
        codigoPostal: "",
        nombreEstablecimiento: "",
      },
      tipoInmueble: "",
      valorPactado: "",
      monedaInmueble: "MXN",
      codigoPostalInmueble: "",
      estadoInmueble: "",
      municipioInmueble: "",
      ciudadInmueble: "",
      coloniaInmueble: "",
      calleInmueble: "",
      numeroExteriorInmueble: "",
      numeroInteriorInmueble: "",
      folioReal: "",
      dimensionTerreno: "",
      dimensionConstruido: "",
      liquidacion: {
        tipo: "numerario",
        fechaPago: fechaHoy,
        instrumentoMonetario: "",
        moneda: "MXN",
        montoOperacion: "",
        valorBien: "",
        tipoBien: "",
        monedaValorBien: "MXN",
      },
    },
  }
}

export function cloneInmueblesFormulario(form: InmueblesFormulario): InmueblesFormulario {
  return JSON.parse(JSON.stringify(form)) as InmueblesFormulario
}

export function sanitizeInmueblesFormulario(raw: any): InmueblesFormulario | undefined {
  if (!raw || typeof raw !== "object") return undefined
  try {
    const parsed = JSON.parse(JSON.stringify(raw))
    const base = createInmueblesFormulario(
      typeof parsed.mesReportado === "string" ? parsed.mesReportado : "",
    )
    return {
      ...base,
      ...parsed,
      personaAviso: {
        ...base.personaAviso,
        ...parsed.personaAviso,
        fisica: {
          ...base.personaAviso.fisica,
          ...(parsed.personaAviso?.fisica ?? {}),
        },
        moral: {
          ...base.personaAviso.moral,
          ...(parsed.personaAviso?.moral ?? {}),
          representante: {
            ...base.personaAviso.moral.representante,
            ...(parsed.personaAviso?.moral?.representante ?? {}),
          },
        },
        fideicomiso: {
          ...base.personaAviso.fideicomiso,
          ...(parsed.personaAviso?.fideicomiso ?? {}),
          apoderado: {
            ...base.personaAviso.fideicomiso.apoderado,
            ...(parsed.personaAviso?.fideicomiso?.apoderado ?? {}),
          },
        },
        domicilio: {
          ...base.personaAviso.domicilio,
          ...(parsed.personaAviso?.domicilio ?? {}),
          nacional: {
            ...base.personaAviso.domicilio.nacional,
            ...(parsed.personaAviso?.domicilio?.nacional ?? {}),
          },
          extranjero: {
            ...base.personaAviso.domicilio.extranjero,
            ...(parsed.personaAviso?.domicilio?.extranjero ?? {}),
          },
        },
        telefono: {
          ...base.personaAviso.telefono,
          ...(parsed.personaAviso?.telefono ?? {}),
        },
      },
      beneficiario: {
        ...base.beneficiario,
        ...parsed.beneficiario,
        fisica: {
          ...base.beneficiario.fisica,
          ...(parsed.beneficiario?.fisica ?? {}),
        },
        moral: {
          ...base.beneficiario.moral,
          ...(parsed.beneficiario?.moral ?? {}),
        },
        fideicomiso: {
          ...base.beneficiario.fideicomiso,
          ...(parsed.beneficiario?.fideicomiso ?? {}),
        },
        domicilio: {
          ...base.beneficiario.domicilio,
          ...(parsed.beneficiario?.domicilio ?? {}),
          nacional: {
            ...base.beneficiario.domicilio.nacional,
            ...(parsed.beneficiario?.domicilio?.nacional ?? {}),
          },
          extranjero: {
            ...base.beneficiario.domicilio.extranjero,
            ...(parsed.beneficiario?.domicilio?.extranjero ?? {}),
          },
        },
        telefono: {
          ...base.beneficiario.telefono,
          ...(parsed.beneficiario?.telefono ?? {}),
        },
      },
      operacion: {
        ...base.operacion,
        ...parsed.operacion,
        sucursalPropia: {
          ...base.operacion.sucursalPropia,
          ...(parsed.operacion?.sucursalPropia ?? {}),
        },
        sucursalOperador: {
          ...base.operacion.sucursalOperador,
          ...(parsed.operacion?.sucursalOperador ?? {}),
        },
        liquidacion: {
          ...base.operacion.liquidacion,
          ...(parsed.operacion?.liquidacion ?? {}),
        },
      },
    }
  } catch (_error) {
    return undefined
  }
}
      operacion: {
        ...base.operacion,
        ...parsed.operacion,
        sucursalPropia: {
          ...base.operacion.sucursalPropia,
          ...(parsed.operacion?.sucursalPropia ?? {}),
        },
        sucursalOperador: {
          ...base.operacion.sucursalOperador,
          ...(parsed.operacion?.sucursalOperador ?? {}),
        },
        liquidacion: {
          ...base.operacion.liquidacion,
          ...(parsed.operacion?.liquidacion ?? {}),
        },
      },
    }
  } catch (_error) {
    return undefined
  }
}

interface CuestionarioInmueblesProps {
  value: InmueblesFormulario
  onChange: React.Dispatch<React.SetStateAction<InmueblesFormulario>>
  expediente?: ExpedienteDetalle | null
  periodo: string
  monedas: { value: string; label: string }[]
  fechaOperacion?: string
  monedaSeleccionada?: string
}

function obtenerPersonaPorRol(expediente: ExpedienteDetalle | null | undefined, rol: string) {
  if (!expediente?.personas) return undefined
  return expediente.personas.find((persona) =>
    typeof persona.rolRelacion === "string" && persona.rolRelacion.toLowerCase().includes(rol.toLowerCase()),
  )
}

function normalizarTipoPersona(persona?: ExpedientePersona): PersonaTipoAviso {
  if (!persona?.tipo) return "moral"
  if (persona.tipo === "persona_fisica") return "fisica"
  if (persona.tipo === "fideicomiso") return "fideicomiso"
  return "moral"
}
export function CuestionarioInmuebles({
  value,
  onChange,
  expediente,
  periodo,
  monedas,
  fechaOperacion,
  monedaSeleccionada,
}: CuestionarioInmueblesProps) {
  useEffect(() => {
    if (!periodo) return
    onChange((prev) => {
      if (prev.mesReportado === periodo) return prev
      return { ...prev, mesReportado: periodo }
    })
  }, [periodo, onChange])

  useEffect(() => {
    if (!fechaOperacion) return
    onChange((prev) => {
      if (prev.operacion.fechaOperacion === fechaOperacion) return prev
      return { ...prev, operacion: { ...prev.operacion, fechaOperacion } }
    })
  }, [fechaOperacion, onChange])

  useEffect(() => {
    if (!monedaSeleccionada) return
    const codigo = monedaSeleccionada.trim().toUpperCase()
    onChange((prev) => {
      let changed = false
      const operacion = { ...prev.operacion }
      if (!operacion.liquidacion.moneda || operacion.liquidacion.moneda === "MXN") {
        operacion.liquidacion = { ...operacion.liquidacion, moneda: codigo }
        changed = true
      }
      if (!operacion.monedaInmueble || operacion.monedaInmueble === "MXN") {
        operacion.monedaInmueble = codigo
        changed = true
      }
      if (!changed) return prev
      return { ...prev, operacion }
    })
  }, [monedaSeleccionada, onChange])

  useEffect(() => {
    if (!expediente) return
    onChange((prev) => {
      let updated = prev
      let changed = false

      if (!prev.claveSujetoObligado && typeof expediente.claveSujetoObligado === "string") {
        updated = { ...updated, claveSujetoObligado: expediente.claveSujetoObligado }
        changed = true
      }
      if (!prev.claveActividad && typeof expediente.claveActividadVulnerable === "string") {
        updated = { ...updated, claveActividad: expediente.claveActividadVulnerable }
        changed = true
      }

      const personaCliente =
        obtenerPersonaPorRol(expediente, "cliente") ??
        obtenerPersonaPorRol(expediente, "cliente principal") ??
        expediente.personas?.[0]

      if (personaCliente) {
        const tipoPersona = normalizarTipoPersona(personaCliente)
        const personaAviso = {
          ...updated.personaAviso,
          tipoPersona,
          fisica: { ...updated.personaAviso.fisica },
          moral: { ...updated.personaAviso.moral, representante: { ...updated.personaAviso.moral.representante } },
          fideicomiso: {
            ...updated.personaAviso.fideicomiso,
            apoderado: { ...updated.personaAviso.fideicomiso.apoderado },
          },
          domicilio: {
            ...updated.personaAviso.domicilio,
            nacional: { ...updated.personaAviso.domicilio.nacional },
            extranjero: { ...updated.personaAviso.domicilio.extranjero },
          },
          telefono: { ...updated.personaAviso.telefono },
        }

        if (tipoPersona === "fisica") {
          if (!personaAviso.fisica.nombre && personaCliente.nombre) personaAviso.fisica.nombre = personaCliente.nombre
          if (!personaAviso.fisica.apellidoPaterno && personaCliente.apellidoPaterno)
            personaAviso.fisica.apellidoPaterno = personaCliente.apellidoPaterno
          if (!personaAviso.fisica.apellidoMaterno && personaCliente.apellidoMaterno)
            personaAviso.fisica.apellidoMaterno = personaCliente.apellidoMaterno
          if (!personaAviso.fisica.fechaNacimiento && personaCliente.fechaNacimiento)
            personaAviso.fisica.fechaNacimiento = personaCliente.fechaNacimiento
          if (!personaAviso.fisica.rfc && personaCliente.rfc) personaAviso.fisica.rfc = personaCliente.rfc
          if (!personaAviso.fisica.curp && personaCliente.curp) personaAviso.fisica.curp = personaCliente.curp
          if (!personaAviso.fisica.paisNacionalidad && personaCliente.pais)
            personaAviso.fisica.paisNacionalidad = personaCliente.pais
        } else if (tipoPersona === "moral") {
          if (!personaAviso.moral.denominacion && personaCliente.denominacion)
            personaAviso.moral.denominacion = personaCliente.denominacion
          if (!personaAviso.moral.fechaConstitucion && personaCliente.fechaConstitucion)
            personaAviso.moral.fechaConstitucion = personaCliente.fechaConstitucion
          if (!personaAviso.moral.rfc && personaCliente.rfc) personaAviso.moral.rfc = personaCliente.rfc
          if (!personaAviso.moral.paisNacionalidad && personaCliente.pais)
            personaAviso.moral.paisNacionalidad = personaCliente.pais
          if (!personaAviso.moral.giroMercantil && personaCliente.giro)
            personaAviso.moral.giroMercantil = personaCliente.giro

          if (personaCliente.representante) {
            if (!personaAviso.moral.representante.nombre && personaCliente.representante.nombre)
              personaAviso.moral.representante.nombre = personaCliente.representante.nombre
            if (!personaAviso.moral.representante.apellidoPaterno && personaCliente.representante.apellidoPaterno)
              personaAviso.moral.representante.apellidoPaterno = personaCliente.representante.apellidoPaterno
            if (!personaAviso.moral.representante.apellidoMaterno && personaCliente.representante.apellidoMaterno)
              personaAviso.moral.representante.apellidoMaterno = personaCliente.representante.apellidoMaterno
            if (!personaAviso.moral.representante.fechaNacimiento && personaCliente.representante.fechaNacimiento)
              personaAviso.moral.representante.fechaNacimiento = personaCliente.representante.fechaNacimiento
            if (!personaAviso.moral.representante.rfc && personaCliente.representante.rfc)
              personaAviso.moral.representante.rfc = personaCliente.representante.rfc
            if (!personaAviso.moral.representante.curp && personaCliente.representante.curp)
              personaAviso.moral.representante.curp = personaCliente.representante.curp
          }
        } else if (tipoPersona === "fideicomiso") {
          if (!personaAviso.fideicomiso.denominacion && personaCliente.denominacion)
            personaAviso.fideicomiso.denominacion = personaCliente.denominacion
          if (!personaAviso.fideicomiso.rfc && personaCliente.rfc) personaAviso.fideicomiso.rfc = personaCliente.rfc
          if (!personaAviso.fideicomiso.identificador && personaCliente.id)
            personaAviso.fideicomiso.identificador = personaCliente.id

          if (personaCliente.representante) {
            if (!personaAviso.fideicomiso.apoderado.nombre && personaCliente.representante.nombre)
              personaAviso.fideicomiso.apoderado.nombre = personaCliente.representante.nombre
            if (!personaAviso.fideicomiso.apoderado.apellidoPaterno && personaCliente.representante.apellidoPaterno)
              personaAviso.fideicomiso.apoderado.apellidoPaterno = personaCliente.representante.apellidoPaterno
            if (!personaAviso.fideicomiso.apoderado.apellidoMaterno && personaCliente.representante.apellidoMaterno)
              personaAviso.fideicomiso.apoderado.apellidoMaterno = personaCliente.representante.apellidoMaterno
            if (!personaAviso.fideicomiso.apoderado.fechaNacimiento && personaCliente.representante.fechaNacimiento)
              personaAviso.fideicomiso.apoderado.fechaNacimiento = personaCliente.representante.fechaNacimiento
            if (!personaAviso.fideicomiso.apoderado.rfc && personaCliente.representante.rfc)
              personaAviso.fideicomiso.apoderado.rfc = personaCliente.representante.rfc
            if (!personaAviso.fideicomiso.apoderado.curp && personaCliente.representante.curp)
              personaAviso.fideicomiso.apoderado.curp = personaCliente.representante.curp
          }
        }

        if (personaCliente.domicilio) {
          if (personaCliente.domicilio.ambito === "extranjero") {
            personaAviso.domicilio = {
              ...personaAviso.domicilio,
              tipo: "extranjero",
              extranjero: {
                ...personaAviso.domicilio.extranjero,
                pais: personaCliente.domicilio.pais ?? personaAviso.domicilio.extranjero.pais,
                estadoProvincia:
                  personaCliente.domicilio.entidad ?? personaAviso.domicilio.extranjero.estadoProvincia,
                ciudad: personaCliente.domicilio.ciudad ?? personaAviso.domicilio.extranjero.ciudad,
                colonia: personaCliente.domicilio.colonia ?? personaAviso.domicilio.extranjero.colonia,
                calle: personaCliente.domicilio.calle ?? personaAviso.domicilio.extranjero.calle,
                numeroExterior:
                  personaCliente.domicilio.numeroExterior ?? personaAviso.domicilio.extranjero.numeroExterior,
                numeroInterior:
                  personaCliente.domicilio.numeroInterior ?? personaAviso.domicilio.extranjero.numeroInterior,
                codigoPostal:
                  personaCliente.domicilio.codigoPostal ?? personaAviso.domicilio.extranjero.codigoPostal,
              },
            }
          } else {
            personaAviso.domicilio = {
              ...personaAviso.domicilio,
              tipo: "nacional",
              nacional: {
                ...personaAviso.domicilio.nacional,
                codigoPostal:
                  personaCliente.domicilio.codigoPostal ?? personaAviso.domicilio.nacional.codigoPostal,
                estado: personaCliente.domicilio.entidad ?? personaAviso.domicilio.nacional.estado,
                municipio: personaCliente.domicilio.municipio ?? personaAviso.domicilio.nacional.municipio,
                ciudad: personaCliente.domicilio.ciudad ?? personaAviso.domicilio.nacional.ciudad,
                colonia: personaCliente.domicilio.colonia ?? personaAviso.domicilio.nacional.colonia,
                calle: personaCliente.domicilio.calle ?? personaAviso.domicilio.nacional.calle,
                numeroExterior:
                  personaCliente.domicilio.numeroExterior ?? personaAviso.domicilio.nacional.numeroExterior,
                numeroInterior:
                  personaCliente.domicilio.numeroInterior ?? personaAviso.domicilio.nacional.numeroInterior,
              },
            }
          }
        }

        if (personaCliente.contacto) {
          if (!personaAviso.telefono.clavePais && personaCliente.contacto.clavePais)
            personaAviso.telefono.clavePais = personaCliente.contacto.clavePais
          if (!personaAviso.telefono.numero && personaCliente.contacto.telefono)
            personaAviso.telefono.numero = personaCliente.contacto.telefono
          if (!personaAviso.telefono.correo && personaCliente.contacto.correo)
            personaAviso.telefono.correo = personaCliente.contacto.correo
        }

        updated = { ...updated, personaAviso }
        changed = true
      }

      const beneficiario =
        obtenerPersonaPorRol(expediente, "beneficiario") ??
        obtenerPersonaPorRol(expediente, "dueño beneficiario")

      if (beneficiario) {
        const tipoBeneficiario = normalizarTipoPersona(beneficiario)
        const beneficiarioAviso = {
          ...updated.beneficiario,
          activo: true,
          tipoPersona: tipoBeneficiario,
          fisica: { ...updated.beneficiario.fisica },
          moral: { ...updated.beneficiario.moral },
          fideicomiso: { ...updated.beneficiario.fideicomiso },
          domicilio: {
            ...updated.beneficiario.domicilio,
            nacional: { ...updated.beneficiario.domicilio.nacional },
            extranjero: { ...updated.beneficiario.domicilio.extranjero },
          },
          telefono: { ...updated.beneficiario.telefono },
        }

        if (tipoBeneficiario === "fisica") {
          if (!beneficiarioAviso.fisica.nombre && beneficiario.nombre)
            beneficiarioAviso.fisica.nombre = beneficiario.nombre
          if (!beneficiarioAviso.fisica.apellidoPaterno && beneficiario.apellidoPaterno)
            beneficiarioAviso.fisica.apellidoPaterno = beneficiario.apellidoPaterno
          if (!beneficiarioAviso.fisica.apellidoMaterno && beneficiario.apellidoMaterno)
            beneficiarioAviso.fisica.apellidoMaterno = beneficiario.apellidoMaterno
          if (!beneficiarioAviso.fisica.fechaNacimiento && beneficiario.fechaNacimiento)
            beneficiarioAviso.fisica.fechaNacimiento = beneficiario.fechaNacimiento
          if (!beneficiarioAviso.fisica.rfc && beneficiario.rfc)
            beneficiarioAviso.fisica.rfc = beneficiario.rfc
          if (!beneficiarioAviso.fisica.curp && beneficiario.curp)
            beneficiarioAviso.fisica.curp = beneficiario.curp
          if (!beneficiarioAviso.fisica.paisNacionalidad && beneficiario.pais)
            beneficiarioAviso.fisica.paisNacionalidad = beneficiario.pais
        } else if (tipoBeneficiario === "moral") {
          if (!beneficiarioAviso.moral.denominacion && beneficiario.denominacion)
            beneficiarioAviso.moral.denominacion = beneficiario.denominacion
          if (!beneficiarioAviso.moral.fechaConstitucion && beneficiario.fechaConstitucion)
            beneficiarioAviso.moral.fechaConstitucion = beneficiario.fechaConstitucion
          if (!beneficiarioAviso.moral.rfc && beneficiario.rfc)
            beneficiarioAviso.moral.rfc = beneficiario.rfc
          if (!beneficiarioAviso.moral.paisNacionalidad && beneficiario.pais)
            beneficiarioAviso.moral.paisNacionalidad = beneficiario.pais
          if (!beneficiarioAviso.moral.giroMercantil && beneficiario.giro)
            beneficiarioAviso.moral.giroMercantil = beneficiario.giro
        } else if (tipoBeneficiario === "fideicomiso") {
          if (!beneficiarioAviso.fideicomiso.denominacion && beneficiario.denominacion)
            beneficiarioAviso.fideicomiso.denominacion = beneficiario.denominacion
          if (!beneficiarioAviso.fideicomiso.rfc && beneficiario.rfc)
            beneficiarioAviso.fideicomiso.rfc = beneficiario.rfc
          if (!beneficiarioAviso.fideicomiso.identificador && beneficiario.id)
            beneficiarioAviso.fideicomiso.identificador = beneficiario.id
        }

        if (beneficiario.domicilio) {
          if (beneficiario.domicilio.ambito === "extranjero") {
            beneficiarioAviso.domicilio = {
              ...beneficiarioAviso.domicilio,
              tipo: "extranjero",
              extranjero: {
                ...beneficiarioAviso.domicilio.extranjero,
                pais: beneficiario.domicilio.pais ?? beneficiarioAviso.domicilio.extranjero.pais,
                estadoProvincia:
                  beneficiario.domicilio.entidad ?? beneficiarioAviso.domicilio.extranjero.estadoProvincia,
                ciudad: beneficiario.domicilio.ciudad ?? beneficiarioAviso.domicilio.extranjero.ciudad,
                colonia: beneficiario.domicilio.colonia ?? beneficiarioAviso.domicilio.extranjero.colonia,
                calle: beneficiario.domicilio.calle ?? beneficiarioAviso.domicilio.extranjero.calle,
                numeroExterior:
                  beneficiario.domicilio.numeroExterior ?? beneficiarioAviso.domicilio.extranjero.numeroExterior,
                numeroInterior:
                  beneficiario.domicilio.numeroInterior ?? beneficiarioAviso.domicilio.extranjero.numeroInterior,
                codigoPostal:
                  beneficiario.domicilio.codigoPostal ?? beneficiarioAviso.domicilio.extranjero.codigoPostal,
              },
            }
          } else {
            beneficiarioAviso.domicilio = {
              ...beneficiarioAviso.domicilio,
              tipo: "nacional",
              nacional: {
                ...beneficiarioAviso.domicilio.nacional,
                codigoPostal:
                  beneficiario.domicilio.codigoPostal ?? beneficiarioAviso.domicilio.nacional.codigoPostal,
                estado: beneficiario.domicilio.entidad ?? beneficiarioAviso.domicilio.nacional.estado,
                municipio: beneficiario.domicilio.municipio ?? beneficiarioAviso.domicilio.nacional.municipio,
                ciudad: beneficiario.domicilio.ciudad ?? beneficiarioAviso.domicilio.nacional.ciudad,
                colonia: beneficiario.domicilio.colonia ?? beneficiarioAviso.domicilio.nacional.colonia,
                calle: beneficiario.domicilio.calle ?? beneficiarioAviso.domicilio.nacional.calle,
                numeroExterior:
                  beneficiario.domicilio.numeroExterior ?? beneficiarioAviso.domicilio.nacional.numeroExterior,
                numeroInterior:
                  beneficiario.domicilio.numeroInterior ?? beneficiarioAviso.domicilio.nacional.numeroInterior,
              },
            }
          }
        }

        if (beneficiario.contacto) {
          if (!beneficiarioAviso.telefono.clavePais && beneficiario.contacto.clavePais)
            beneficiarioAviso.telefono.clavePais = beneficiario.contacto.clavePais
          if (!beneficiarioAviso.telefono.numero && beneficiario.contacto.telefono)
            beneficiarioAviso.telefono.numero = beneficiario.contacto.telefono
          if (!beneficiarioAviso.telefono.correo && beneficiario.contacto.correo)
            beneficiarioAviso.telefono.correo = beneficiario.contacto.correo
        }

        updated = { ...updated, beneficiario: beneficiarioAviso }
        changed = true
      }

      return changed ? updated : prev
    })
  }, [expediente, onChange])
  const coloniasPersona = useMemo(() => {
    const info = findCodigoPostal(value.personaAviso.domicilio.nacional.codigoPostal)
    return info?.colonias ?? []
  }, [value.personaAviso.domicilio.nacional.codigoPostal])

  const coloniasBeneficiario = useMemo(() => {
    const info = findCodigoPostal(value.beneficiario.domicilio.nacional.codigoPostal)
    return info?.colonias ?? []
  }, [value.beneficiario.domicilio.nacional.codigoPostal])

  const coloniasInmueble = useMemo(() => {
    const info = findCodigoPostal(value.operacion.codigoPostalInmueble)
    return info?.colonias ?? []
  }, [value.operacion.codigoPostalInmueble])

  const actualizarCampoGeneral = (campo: keyof InmueblesFormulario, nuevoValor: string) => {
    onChange((prev) => ({ ...prev, [campo]: nuevoValor }))
  }

  const actualizarPersonaFisica = (
    campo: keyof InmueblesFormulario["personaAviso"]["fisica"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      personaAviso: {
        ...prev.personaAviso,
        fisica: {
          ...prev.personaAviso.fisica,
          [campo]: nuevoValor,
        },
      },
    }))
  }

  const actualizarPersonaMoral = (
    campo: keyof InmueblesFormulario["personaAviso"]["moral"],
    nuevoValor: string,
  ) => {
    if (campo === "representante") return
    onChange((prev) => ({
      ...prev,
      personaAviso: {
        ...prev.personaAviso,
        moral: {
          ...prev.personaAviso.moral,
          [campo]: nuevoValor,
          representante: { ...prev.personaAviso.moral.representante },
        },
      },
    }))
  }

  const actualizarRepresentanteMoral = (
    campo: keyof InmueblesFormulario["personaAviso"]["moral"]["representante"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      personaAviso: {
        ...prev.personaAviso,
        moral: {
          ...prev.personaAviso.moral,
          representante: {
            ...prev.personaAviso.moral.representante,
            [campo]: nuevoValor,
          },
        },
      },
    }))
  }

  const actualizarPersonaFideicomiso = (
    campo: keyof InmueblesFormulario["personaAviso"]["fideicomiso"],
    nuevoValor: string,
  ) => {
    if (campo === "apoderado") return
    onChange((prev) => ({
      ...prev,
      personaAviso: {
        ...prev.personaAviso,
        fideicomiso: {
          ...prev.personaAviso.fideicomiso,
          [campo]: nuevoValor,
          apoderado: { ...prev.personaAviso.fideicomiso.apoderado },
        },
      },
    }))
  }

  const actualizarApoderadoFideicomiso = (
    campo: keyof InmueblesFormulario["personaAviso"]["fideicomiso"]["apoderado"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      personaAviso: {
        ...prev.personaAviso,
        fideicomiso: {
          ...prev.personaAviso.fideicomiso,
          apoderado: {
            ...prev.personaAviso.fideicomiso.apoderado,
            [campo]: nuevoValor,
          },
        },
      },
    }))
  }

  const actualizarDomicilioPersona = (
    campo: keyof InmueblesFormulario["personaAviso"]["domicilio"]["nacional"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      personaAviso: {
        ...prev.personaAviso,
        domicilio: {
          ...prev.personaAviso.domicilio,
          nacional: {
            ...prev.personaAviso.domicilio.nacional,
            [campo]: nuevoValor,
          },
        },
      },
    }))
  }

  const actualizarDomicilioPersonaExtranjero = (
    campo: keyof InmueblesFormulario["personaAviso"]["domicilio"]["extranjero"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      personaAviso: {
        ...prev.personaAviso,
        domicilio: {
          ...prev.personaAviso.domicilio,
          extranjero: {
            ...prev.personaAviso.domicilio.extranjero,
            [campo]: nuevoValor,
          },
        },
      },
    }))
  }

  const actualizarTelefonoPersona = (
    campo: keyof InmueblesFormulario["personaAviso"]["telefono"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      personaAviso: {
        ...prev.personaAviso,
        telefono: {
          ...prev.personaAviso.telefono,
          [campo]: nuevoValor,
        },
      },
    }))
  }

  const actualizarBeneficiarioCampo = (
    campo: keyof InmueblesFormulario["beneficiario"],
    nuevoValor: PersonaTipoAviso | boolean | string,
  ) => {
    onChange((prev) => ({
      ...prev,
      beneficiario: {
        ...prev.beneficiario,
        [campo]: nuevoValor,
      },
    }))
  }

  const actualizarBeneficiarioPersonaFisica = (
    campo: keyof InmueblesFormulario["beneficiario"]["fisica"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      beneficiario: {
        ...prev.beneficiario,
        fisica: {
          ...prev.beneficiario.fisica,
          [campo]: nuevoValor,
        },
      },
    }))
  }

  const actualizarBeneficiarioPersonaMoral = (
    campo: keyof InmueblesFormulario["beneficiario"]["moral"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      beneficiario: {
        ...prev.beneficiario,
        moral: {
          ...prev.beneficiario.moral,
          [campo]: nuevoValor,
        },
      },
    }))
  }

  const actualizarBeneficiarioFideicomiso = (
    campo: keyof InmueblesFormulario["beneficiario"]["fideicomiso"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      beneficiario: {
        ...prev.beneficiario,
        fideicomiso: {
          ...prev.beneficiario.fideicomiso,
          [campo]: nuevoValor,
        },
      },
    }))
  }

  const actualizarBeneficiarioDomicilio = (
    campo: keyof InmueblesFormulario["beneficiario"]["domicilio"]["nacional"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      beneficiario: {
        ...prev.beneficiario,
        domicilio: {
          ...prev.beneficiario.domicilio,
          nacional: {
            ...prev.beneficiario.domicilio.nacional,
            [campo]: nuevoValor,
          },
        },
      },
    }))
  }

  const actualizarBeneficiarioDomicilioExtranjero = (
    campo: keyof InmueblesFormulario["beneficiario"]["domicilio"]["extranjero"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      beneficiario: {
        ...prev.beneficiario,
        domicilio: {
          ...prev.beneficiario.domicilio,
          extranjero: {
            ...prev.beneficiario.domicilio.extranjero,
            [campo]: nuevoValor,
          },
        },
      },
    }))
  }

  const actualizarBeneficiarioTelefono = (
    campo: keyof InmueblesFormulario["beneficiario"]["telefono"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      beneficiario: {
        ...prev.beneficiario,
        telefono: {
          ...prev.beneficiario.telefono,
          [campo]: nuevoValor,
        },
      },
    }))
  }

  const actualizarOperacionCampo = (
    campo: keyof InmueblesFormulario["operacion"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      operacion: {
        ...prev.operacion,
        [campo]: nuevoValor,
      },
    }))
  }

  const actualizarSucursalPropia = (
    campo: keyof InmueblesFormulario["operacion"]["sucursalPropia"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      operacion: {
        ...prev.operacion,
        sucursalPropia: {
          ...prev.operacion.sucursalPropia,
          [campo]: nuevoValor,
        },
      },
    }))
  }

  const actualizarSucursalOperador = (
    campo: keyof InmueblesFormulario["operacion"]["sucursalOperador"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      operacion: {
        ...prev.operacion,
        sucursalOperador: {
          ...prev.operacion.sucursalOperador,
          [campo]: nuevoValor,
        },
      },
    }))
  }

  const actualizarLiquidacion = (
    campo: keyof InmueblesFormulario["operacion"]["liquidacion"],
    nuevoValor: string,
  ) => {
    onChange((prev) => ({
      ...prev,
      operacion: {
        ...prev.operacion,
        liquidacion: {
          ...prev.operacion.liquidacion,
          [campo]: nuevoValor,
        },
      },
    }))
  }

  const manejarCodigoPostalPersona = (codigo: string) => {
    const info = findCodigoPostal(codigo)
    onChange((prev) => ({
      ...prev,
      personaAviso: {
        ...prev.personaAviso,
        domicilio: {
          ...prev.personaAviso.domicilio,
          tipo: "nacional",
          nacional: {
            ...prev.personaAviso.domicilio.nacional,
            codigoPostal: codigo,
            estado: info?.estado ?? "",
            municipio: info?.municipio ?? "",
            ciudad: info?.ciudad ?? "",
            colonia: info?.colonias.includes(prev.personaAviso.domicilio.nacional.colonia)
              ? prev.personaAviso.domicilio.nacional.colonia
              : "",
          },
        },
      },
    }))
  }

  const manejarCodigoPostalBeneficiario = (codigo: string) => {
    const info = findCodigoPostal(codigo)
    onChange((prev) => ({
      ...prev,
      beneficiario: {
        ...prev.beneficiario,
        domicilio: {
          ...prev.beneficiario.domicilio,
          tipo: "nacional",
          nacional: {
            ...prev.beneficiario.domicilio.nacional,
            codigoPostal: codigo,
            estado: info?.estado ?? "",
            municipio: info?.municipio ?? "",
            ciudad: info?.ciudad ?? "",
            colonia: info?.colonias.includes(prev.beneficiario.domicilio.nacional.colonia)
              ? prev.beneficiario.domicilio.nacional.colonia
              : "",
          },
        },
      },
    }))
  }

  const manejarCodigoPostalInmueble = (codigo: string) => {
    const info = findCodigoPostal(codigo)
    onChange((prev) => ({
      ...prev,
      operacion: {
        ...prev.operacion,
        codigoPostalInmueble: codigo,
        estadoInmueble: info?.estado ?? "",
        municipioInmueble: info?.municipio ?? "",
        ciudadInmueble: info?.ciudad ?? "",
        coloniaInmueble: info?.colonias.includes(prev.operacion.coloniaInmueble)
          ? prev.operacion.coloniaInmueble
          : "",
      },
    }))
  }
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-base">Cuestionario específico para comercialización de inmuebles</CardTitle>
        <CardDescription>
          Reutiliza automáticamente la información del expediente único y captura los campos clave del aviso para la
          fracción de inmuebles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Datos generales del aviso</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Mes reportado (AAAAMM)</Label>
              <Input value={value.mesReportado} readOnly className="bg-slate-100" />
            </div>
            <div className="space-y-2">
              <Label>Clave entidad colegiada</Label>
              <Input
                value={value.claveEntidadColegiada}
                onChange={(event) => actualizarCampoGeneral("claveEntidadColegiada", event.target.value.toUpperCase())}
                placeholder="LLLAAMMDDXXX"
              />
            </div>
            <div className="space-y-2">
              <Label>Clave sujeto obligado</Label>
              <Input
                value={value.claveSujetoObligado}
                onChange={(event) => actualizarCampoGeneral("claveSujetoObligado", event.target.value.toUpperCase())}
                placeholder="LLLLAAMMDDXXX"
              />
            </div>
            <div className="space-y-2">
              <Label>Clave actividad vulnerable</Label>
              <Input
                value={value.claveActividad}
                onChange={(event) => actualizarCampoGeneral("claveActividad", event.target.value.toUpperCase())}
                placeholder="INM"
              />
            </div>
            <div className="space-y-2">
              <Label>Referencia del aviso</Label>
              <Input
                value={value.referenciaAviso}
                onChange={(event) => actualizarCampoGeneral("referenciaAviso", event.target.value.toUpperCase())}
                placeholder="Identificador interno"
              />
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={value.prioridad} onValueChange={(val) => actualizarCampoGeneral("prioridad", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 – Normal</SelectItem>
                  <SelectItem value="9">9 – 24 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de alerta</Label>
              <Input
                value={value.tipoAlerta}
                onChange={(event) => actualizarCampoGeneral("tipoAlerta", event.target.value)}
                placeholder="Ej. 521"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descripción de alerta</Label>
              <Textarea
                value={value.descripcionAlerta}
                onChange={(event) => actualizarCampoGeneral("descripcionAlerta", event.target.value)}
                placeholder="Describe la causa de la alerta o bandera interna"
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-700">Persona objeto del aviso</h3>
            <div className="flex flex-wrap items-center gap-2">
              {(["fisica", "moral", "fideicomiso"] as PersonaTipoAviso[]).map((tipo) => (
                <Button
                  key={tipo}
                  type="button"
                  variant={value.personaAviso.tipoPersona === tipo ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      personaAviso: {
                        ...prev.personaAviso,
                        tipoPersona: tipo,
                      },
                    }))
                  }
                >
                  {tipo === "fisica" ? "Persona física" : tipo === "moral" ? "Persona moral" : "Fideicomiso"}
                </Button>
              ))}
            </div>
          </div>

          {value.personaAviso.tipoPersona === "fisica" && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Nombre(s)</Label>
                <Input
                  value={value.personaAviso.fisica.nombre}
                  onChange={(event) => actualizarPersonaFisica("nombre", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido paterno</Label>
                <Input
                  value={value.personaAviso.fisica.apellidoPaterno}
                  onChange={(event) => actualizarPersonaFisica("apellidoPaterno", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido materno</Label>
                <Input
                  value={value.personaAviso.fisica.apellidoMaterno}
                  onChange={(event) => actualizarPersonaFisica("apellidoMaterno", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de nacimiento</Label>
                <Input
                  type="date"
                  value={value.personaAviso.fisica.fechaNacimiento}
                  onChange={(event) => actualizarPersonaFisica("fechaNacimiento", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>RFC</Label>
                <Input
                  value={value.personaAviso.fisica.rfc}
                  onChange={(event) => actualizarPersonaFisica("rfc", event.target.value.toUpperCase())}
                  placeholder="XXXX000000XXX"
                />
              </div>
              <div className="space-y-2">
                <Label>CURP</Label>
                <Input
                  value={value.personaAviso.fisica.curp}
                  onChange={(event) => actualizarPersonaFisica("curp", event.target.value.toUpperCase())}
                  placeholder="XXXX000000XXXXXX00"
                />
              </div>
              <div className="space-y-2">
                <Label>País de nacionalidad</Label>
                <Select
                  value={value.personaAviso.fisica.paisNacionalidad}
                  onValueChange={(val) => actualizarPersonaFisica("paisNacionalidad", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona país" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAISES.map((pais) => (
                      <SelectItem key={pais.code} value={pais.code}>
                        {pais.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>País de nacimiento</Label>
                <Select
                  value={value.personaAviso.fisica.paisNacimiento}
                  onValueChange={(val) => actualizarPersonaFisica("paisNacimiento", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona país" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAISES.map((pais) => (
                      <SelectItem key={pais.code} value={pais.code}>
                        {pais.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Actividad económica</Label>
                <Input
                  value={value.personaAviso.fisica.actividadEconomica}
                  onChange={(event) => actualizarPersonaFisica("actividadEconomica", event.target.value)}
                  placeholder="9999999"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo identificación</Label>
                <Input
                  value={value.personaAviso.fisica.tipoIdentificacion}
                  onChange={(event) => actualizarPersonaFisica("tipoIdentificacion", event.target.value)}
                  placeholder="Catálogo SAT"
                />
              </div>
              <div className="space-y-2">
                <Label>Identificación (otro)</Label>
                <Input
                  value={value.personaAviso.fisica.identificacionOtro}
                  onChange={(event) => actualizarPersonaFisica("identificacionOtro", event.target.value)}
                  placeholder="Descripción"
                />
              </div>
              <div className="space-y-2">
                <Label>Autoridad que la emite</Label>
                <Input
                  value={value.personaAviso.fisica.autoridadIdentificacion}
                  onChange={(event) => actualizarPersonaFisica("autoridadIdentificacion", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Número de identificación</Label>
                <Input
                  value={value.personaAviso.fisica.numeroIdentificacion}
                  onChange={(event) => actualizarPersonaFisica("numeroIdentificacion", event.target.value)}
                />
              </div>
            </div>
          )}

          {value.personaAviso.tipoPersona === "moral" && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Denominación o razón social</Label>
                <Input
                  value={value.personaAviso.moral.denominacion}
                  onChange={(event) => actualizarPersonaMoral("denominacion", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de constitución</Label>
                <Input
                  type="date"
                  value={value.personaAviso.moral.fechaConstitucion}
                  onChange={(event) => actualizarPersonaMoral("fechaConstitucion", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>RFC</Label>
                <Input
                  value={value.personaAviso.moral.rfc}
                  onChange={(event) => actualizarPersonaMoral("rfc", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>País de nacionalidad</Label>
                <Select
                  value={value.personaAviso.moral.paisNacionalidad}
                  onValueChange={(val) => actualizarPersonaMoral("paisNacionalidad", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona país" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAISES.map((pais) => (
                      <SelectItem key={pais.code} value={pais.code}>
                        {pais.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Giro u objeto social</Label>
                <Input
                  value={value.personaAviso.moral.giroMercantil}
                  onChange={(event) => actualizarPersonaMoral("giroMercantil", event.target.value)}
                />
              </div>
              <div className="md:col-span-3">
                <h4 className="text-xs font-semibold uppercase text-slate-600">Representante o apoderado</h4>
              </div>
              <div className="space-y-2">
                <Label>Nombre(s)</Label>
                <Input
                  value={value.personaAviso.moral.representante.nombre}
                  onChange={(event) => actualizarRepresentanteMoral("nombre", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido paterno</Label>
                <Input
                  value={value.personaAviso.moral.representante.apellidoPaterno}
                  onChange={(event) => actualizarRepresentanteMoral("apellidoPaterno", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido materno</Label>
                <Input
                  value={value.personaAviso.moral.representante.apellidoMaterno}
                  onChange={(event) => actualizarRepresentanteMoral("apellidoMaterno", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de nacimiento</Label>
                <Input
                  type="date"
                  value={value.personaAviso.moral.representante.fechaNacimiento}
                  onChange={(event) => actualizarRepresentanteMoral("fechaNacimiento", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>RFC</Label>
                <Input
                  value={value.personaAviso.moral.representante.rfc}
                  onChange={(event) => actualizarRepresentanteMoral("rfc", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>CURP</Label>
                <Input
                  value={value.personaAviso.moral.representante.curp}
                  onChange={(event) => actualizarRepresentanteMoral("curp", event.target.value.toUpperCase())}
                />
              </div>
            </div>
          )}

          {value.personaAviso.tipoPersona === "fideicomiso" && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Denominación del fiduciario</Label>
                <Input
                  value={value.personaAviso.fideicomiso.denominacion}
                  onChange={(event) => actualizarPersonaFideicomiso("denominacion", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>RFC del fideicomiso</Label>
                <Input
                  value={value.personaAviso.fideicomiso.rfc}
                  onChange={(event) => actualizarPersonaFideicomiso("rfc", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>Identificador del fideicomiso</Label>
                <Input
                  value={value.personaAviso.fideicomiso.identificador}
                  onChange={(event) => actualizarPersonaFideicomiso("identificador", event.target.value)}
                />
              </div>
              <div className="md:col-span-3">
                <h4 className="text-xs font-semibold uppercase text-slate-600">Apoderado legal o delegado</h4>
              </div>
              <div className="space-y-2">
                <Label>Nombre(s)</Label>
                <Input
                  value={value.personaAviso.fideicomiso.apoderado.nombre}
                  onChange={(event) => actualizarApoderadoFideicomiso("nombre", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido paterno</Label>
                <Input
                  value={value.personaAviso.fideicomiso.apoderado.apellidoPaterno}
                  onChange={(event) => actualizarApoderadoFideicomiso("apellidoPaterno", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido materno</Label>
                <Input
                  value={value.personaAviso.fideicomiso.apoderado.apellidoMaterno}
                  onChange={(event) => actualizarApoderadoFideicomiso("apellidoMaterno", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de nacimiento</Label>
                <Input
                  type="date"
                  value={value.personaAviso.fideicomiso.apoderado.fechaNacimiento}
                  onChange={(event) => actualizarApoderadoFideicomiso("fechaNacimiento", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>RFC</Label>
                <Input
                  value={value.personaAviso.fideicomiso.apoderado.rfc}
                  onChange={(event) => actualizarApoderadoFideicomiso("rfc", event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>CURP</Label>
                <Input
                  value={value.personaAviso.fideicomiso.apoderado.curp}
                  onChange={(event) => actualizarApoderadoFideicomiso("curp", event.target.value.toUpperCase())}
                />
              </div>
            </div>
          )}
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Domicilio de la persona</h3>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={value.personaAviso.domicilio.tipo === "nacional" ? "default" : "outline"}
              onClick={() =>
                onChange((prev) => ({
                  ...prev,
                  personaAviso: {
                    ...prev.personaAviso,
                    domicilio: { ...prev.personaAviso.domicilio, tipo: "nacional" },
                  },
                }))
              }
            >
              Nacional
            </Button>
            <Button
              type="button"
              size="sm"
              variant={value.personaAviso.domicilio.tipo === "extranjero" ? "default" : "outline"}
              onClick={() =>
                onChange((prev) => ({
                  ...prev,
                  personaAviso: {
                    ...prev.personaAviso,
                    domicilio: { ...prev.personaAviso.domicilio, tipo: "extranjero" },
                  },
                }))
              }
            >
              Extranjero
            </Button>
          </div>

          {value.personaAviso.domicilio.tipo === "nacional" ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Código postal</Label>
                <Input
                  value={value.personaAviso.domicilio.nacional.codigoPostal}
                  onChange={(event) => manejarCodigoPostalPersona(event.target.value)}
                  placeholder="00000"
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input
                  value={value.personaAviso.domicilio.nacional.estado}
                  onChange={(event) => actualizarDomicilioPersona("estado", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Municipio o alcaldía</Label>
                <Input
                  value={value.personaAviso.domicilio.nacional.municipio}
                  onChange={(event) => actualizarDomicilioPersona("municipio", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ciudad</Label>
                <Input
                  value={value.personaAviso.domicilio.nacional.ciudad}
                  onChange={(event) => actualizarDomicilioPersona("ciudad", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Colonia</Label>
                {coloniasPersona.length > 0 ? (
                  <Select
                    value={value.personaAviso.domicilio.nacional.colonia}
                    onValueChange={(val) => actualizarDomicilioPersona("colonia", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona colonia" />
                    </SelectTrigger>
                    <SelectContent>
                      {coloniasPersona.map((colonia) => (
                        <SelectItem key={colonia} value={colonia}>
                          {colonia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={value.personaAviso.domicilio.nacional.colonia}
                    onChange={(event) => actualizarDomicilioPersona("colonia", event.target.value)}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Calle</Label>
                <Input
                  value={value.personaAviso.domicilio.nacional.calle}
                  onChange={(event) => actualizarDomicilioPersona("calle", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Número exterior</Label>
                <Input
                  value={value.personaAviso.domicilio.nacional.numeroExterior}
                  onChange={(event) => actualizarDomicilioPersona("numeroExterior", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Número interior</Label>
                <Input
                  value={value.personaAviso.domicilio.nacional.numeroInterior}
                  onChange={(event) => actualizarDomicilioPersona("numeroInterior", event.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>País</Label>
                <Select
                  value={value.personaAviso.domicilio.extranjero.pais}
                  onValueChange={(val) => actualizarDomicilioPersonaExtranjero("pais", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona país" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAISES.map((pais) => (
                      <SelectItem key={pais.code} value={pais.code}>
                        {pais.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado / provincia</Label>
                <Input
                  value={value.personaAviso.domicilio.extranjero.estadoProvincia}
                  onChange={(event) => actualizarDomicilioPersonaExtranjero("estadoProvincia", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ciudad o población</Label>
                <Input
                  value={value.personaAviso.domicilio.extranjero.ciudad}
                  onChange={(event) => actualizarDomicilioPersonaExtranjero("ciudad", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Colonia</Label>
                <Input
                  value={value.personaAviso.domicilio.extranjero.colonia}
                  onChange={(event) => actualizarDomicilioPersonaExtranjero("colonia", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Calle</Label>
                <Input
                  value={value.personaAviso.domicilio.extranjero.calle}
                  onChange={(event) => actualizarDomicilioPersonaExtranjero("calle", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Número exterior</Label>
                <Input
                  value={value.personaAviso.domicilio.extranjero.numeroExterior}
                  onChange={(event) => actualizarDomicilioPersonaExtranjero("numeroExterior", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Número interior</Label>
                <Input
                  value={value.personaAviso.domicilio.extranjero.numeroInterior}
                  onChange={(event) => actualizarDomicilioPersonaExtranjero("numeroInterior", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Código postal</Label>
                <Input
                  value={value.personaAviso.domicilio.extranjero.codigoPostal}
                  onChange={(event) => actualizarDomicilioPersonaExtranjero("codigoPostal", event.target.value)}
                />
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Contacto de la persona objeto</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Clave país</Label>
              <Select
                value={value.personaAviso.telefono.clavePais}
                onValueChange={(val) => actualizarTelefonoPersona("clavePais", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="País" />
                </SelectTrigger>
                <SelectContent>
                  {PAISES.map((pais) => (
                    <SelectItem key={pais.code} value={pais.code}>
                      {pais.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número telefónico</Label>
              <Input
                value={value.personaAviso.telefono.numero}
                onChange={(event) => actualizarTelefonoPersona("numero", event.target.value)}
                placeholder="Incluye clave de región"
              />
            </div>
            <div className="space-y-2">
              <Label>Correo electrónico</Label>
              <Input
                type="email"
                value={value.personaAviso.telefono.correo}
                onChange={(event) => actualizarTelefonoPersona("correo", event.target.value)}
                placeholder="contacto@cliente.com"
              />
            </div>
          </div>
        </section>
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Beneficiario controlador o dueño beneficiario</h3>
            <div className="flex items-center gap-2">
              <Checkbox
                id="beneficiario-activo"
                checked={value.beneficiario.activo}
                onCheckedChange={(checked) =>
                  actualizarBeneficiarioCampo("activo", Boolean(checked))
                }
              />
              <Label htmlFor="beneficiario-activo" className="text-xs text-slate-600">
                Capturar beneficiario
              </Label>
            </div>
          </div>

          {value.beneficiario.activo && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {(["fisica", "moral", "fideicomiso"] as PersonaTipoAviso[]).map((tipo) => (
                  <Button
                    key={tipo}
                    type="button"
                    size="sm"
                    variant={value.beneficiario.tipoPersona === tipo ? "default" : "outline"}
                    onClick={() => actualizarBeneficiarioCampo("tipoPersona", tipo)}
                  >
                    {tipo === "fisica" ? "Persona física" : tipo === "moral" ? "Persona moral" : "Fideicomiso"}
                  </Button>
                ))}
              </div>

              {value.beneficiario.tipoPersona === "fisica" && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Nombre(s)</Label>
                    <Input
                      value={value.beneficiario.fisica.nombre}
                      onChange={(event) => actualizarBeneficiarioPersonaFisica("nombre", event.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido paterno</Label>
                    <Input
                      value={value.beneficiario.fisica.apellidoPaterno}
                      onChange={(event) =>
                        actualizarBeneficiarioPersonaFisica("apellidoPaterno", event.target.value.toUpperCase())
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido materno</Label>
                    <Input
                      value={value.beneficiario.fisica.apellidoMaterno}
                      onChange={(event) =>
                        actualizarBeneficiarioPersonaFisica("apellidoMaterno", event.target.value.toUpperCase())
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de nacimiento</Label>
                    <Input
                      type="date"
                      value={value.beneficiario.fisica.fechaNacimiento}
                      onChange={(event) => actualizarBeneficiarioPersonaFisica("fechaNacimiento", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RFC</Label>
                    <Input
                      value={value.beneficiario.fisica.rfc}
                      onChange={(event) => actualizarBeneficiarioPersonaFisica("rfc", event.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CURP</Label>
                    <Input
                      value={value.beneficiario.fisica.curp}
                      onChange={(event) => actualizarBeneficiarioPersonaFisica("curp", event.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>País de nacionalidad</Label>
                    <Select
                      value={value.beneficiario.fisica.paisNacionalidad}
                      onValueChange={(val) => actualizarBeneficiarioPersonaFisica("paisNacionalidad", val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="País" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAISES.map((pais) => (
                          <SelectItem key={pais.code} value={pais.code}>
                            {pais.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>País de nacimiento</Label>
                    <Select
                      value={value.beneficiario.fisica.paisNacimiento}
                      onValueChange={(val) => actualizarBeneficiarioPersonaFisica("paisNacimiento", val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="País" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAISES.map((pais) => (
                          <SelectItem key={pais.code} value={pais.code}>
                            {pais.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Actividad económica</Label>
                    <Input
                      value={value.beneficiario.fisica.actividadEconomica}
                      onChange={(event) => actualizarBeneficiarioPersonaFisica("actividadEconomica", event.target.value)}
                    />
                  </div>
                </div>
              )}

              {value.beneficiario.tipoPersona === "moral" && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Denominación</Label>
                    <Input
                      value={value.beneficiario.moral.denominacion}
                      onChange={(event) => actualizarBeneficiarioPersonaMoral("denominacion", event.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de constitución</Label>
                    <Input
                      type="date"
                      value={value.beneficiario.moral.fechaConstitucion}
                      onChange={(event) => actualizarBeneficiarioPersonaMoral("fechaConstitucion", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RFC</Label>
                    <Input
                      value={value.beneficiario.moral.rfc}
                      onChange={(event) => actualizarBeneficiarioPersonaMoral("rfc", event.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>País de nacionalidad</Label>
                    <Select
                      value={value.beneficiario.moral.paisNacionalidad}
                      onValueChange={(val) => actualizarBeneficiarioPersonaMoral("paisNacionalidad", val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="País" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAISES.map((pais) => (
                          <SelectItem key={pais.code} value={pais.code}>
                            {pais.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Giro mercantil</Label>
                    <Input
                      value={value.beneficiario.moral.giroMercantil}
                      onChange={(event) => actualizarBeneficiarioPersonaMoral("giroMercantil", event.target.value)}
                    />
                  </div>
                </div>
              )}

              {value.beneficiario.tipoPersona === "fideicomiso" && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Denominación del fideicomiso</Label>
                    <Input
                      value={value.beneficiario.fideicomiso.denominacion}
                      onChange={(event) =>
                        actualizarBeneficiarioFideicomiso("denominacion", event.target.value.toUpperCase())
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RFC</Label>
                    <Input
                      value={value.beneficiario.fideicomiso.rfc}
                      onChange={(event) => actualizarBeneficiarioFideicomiso("rfc", event.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Identificador</Label>
                    <Input
                      value={value.beneficiario.fideicomiso.identificador}
                      onChange={(event) => actualizarBeneficiarioFideicomiso("identificador", event.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Código postal</Label>
                  <Input
                    value={value.beneficiario.domicilio.nacional.codigoPostal}
                    onChange={(event) => manejarCodigoPostalBeneficiario(event.target.value)}
                    disabled={value.beneficiario.domicilio.tipo !== "nacional"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input
                    value={value.beneficiario.domicilio.nacional.estado}
                    onChange={(event) => actualizarBeneficiarioDomicilio("estado", event.target.value)}
                    disabled={value.beneficiario.domicilio.tipo !== "nacional"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Municipio</Label>
                  <Input
                    value={value.beneficiario.domicilio.nacional.municipio}
                    onChange={(event) => actualizarBeneficiarioDomicilio("municipio", event.target.value)}
                    disabled={value.beneficiario.domicilio.tipo !== "nacional"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input
                    value={value.beneficiario.domicilio.nacional.ciudad}
                    onChange={(event) => actualizarBeneficiarioDomicilio("ciudad", event.target.value)}
                    disabled={value.beneficiario.domicilio.tipo !== "nacional"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Colonia</Label>
                  {value.beneficiario.domicilio.tipo === "nacional" && coloniasBeneficiario.length > 0 ? (
                    <Select
                      value={value.beneficiario.domicilio.nacional.colonia}
                      onValueChange={(val) => actualizarBeneficiarioDomicilio("colonia", val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Colonia" />
                      </SelectTrigger>
                      <SelectContent>
                        {coloniasBeneficiario.map((colonia) => (
                          <SelectItem key={colonia} value={colonia}>
                            {colonia}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={value.beneficiario.domicilio.nacional.colonia}
                      onChange={(event) => actualizarBeneficiarioDomicilio("colonia", event.target.value)}
                      disabled={value.beneficiario.domicilio.tipo !== "nacional"}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Calle</Label>
                  <Input
                    value={value.beneficiario.domicilio.nacional.calle}
                    onChange={(event) => actualizarBeneficiarioDomicilio("calle", event.target.value)}
                    disabled={value.beneficiario.domicilio.tipo !== "nacional"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número exterior</Label>
                  <Input
                    value={value.beneficiario.domicilio.nacional.numeroExterior}
                    onChange={(event) => actualizarBeneficiarioDomicilio("numeroExterior", event.target.value)}
                    disabled={value.beneficiario.domicilio.tipo !== "nacional"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número interior</Label>
                  <Input
                    value={value.beneficiario.domicilio.nacional.numeroInterior}
                    onChange={(event) => actualizarBeneficiarioDomicilio("numeroInterior", event.target.value)}
                    disabled={value.beneficiario.domicilio.tipo !== "nacional"}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Clave país contacto</Label>
                  <Select
                    value={value.beneficiario.telefono.clavePais}
                    onValueChange={(val) => actualizarBeneficiarioTelefono("clavePais", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="País" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAISES.map((pais) => (
                        <SelectItem key={pais.code} value={pais.code}>
                          {pais.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={value.beneficiario.telefono.numero}
                    onChange={(event) => actualizarBeneficiarioTelefono("numero", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Correo</Label>
                  <Input
                    type="email"
                    value={value.beneficiario.telefono.correo}
                    onChange={(event) => actualizarBeneficiarioTelefono("correo", event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Datos de la operación inmobiliaria</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Fecha de la operación</Label>
              <Input
                type="date"
                value={value.operacion.fechaOperacion}
                onChange={(event) => actualizarOperacionCampo("fechaOperacion", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de operación o acto</Label>
              <Input
                value={value.operacion.tipoOperacion}
                onChange={(event) => actualizarOperacionCampo("tipoOperacion", event.target.value)}
                placeholder="Catálogo oficial"
              />
            </div>
            <div className="space-y-2">
              <Label>Línea de negocio</Label>
              <Input
                value={value.operacion.lineaNegocio}
                onChange={(event) => actualizarOperacionCampo("lineaNegocio", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Medio empleado</Label>
              <Input
                value={value.operacion.medioOperacion}
                onChange={(event) => actualizarOperacionCampo("medioOperacion", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de inmueble</Label>
              <Input
                value={value.operacion.tipoInmueble}
                onChange={(event) => actualizarOperacionCampo("tipoInmueble", event.target.value)}
                placeholder="Catálogo 999"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor pactado</Label>
              <Input
                value={value.operacion.valorPactado}
                onChange={(event) => actualizarOperacionCampo("valorPactado", event.target.value)}
                placeholder="Importe con dos decimales"
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda del inmueble</Label>
              <Select
                value={value.operacion.monedaInmueble}
                onValueChange={(val) => actualizarOperacionCampo("monedaInmueble", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Moneda" />
                </SelectTrigger>
                <SelectContent>
                  {monedas.map((moneda) => (
                    <SelectItem key={moneda.value} value={moneda.value}>
                      {moneda.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Código postal del inmueble</Label>
              <Input
                value={value.operacion.codigoPostalInmueble}
                onChange={(event) => manejarCodigoPostalInmueble(event.target.value)}
                placeholder="00000"
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input
                value={value.operacion.estadoInmueble}
                onChange={(event) => actualizarOperacionCampo("estadoInmueble", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Municipio</Label>
              <Input
                value={value.operacion.municipioInmueble}
                onChange={(event) => actualizarOperacionCampo("municipioInmueble", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ciudad o población</Label>
              <Input
                value={value.operacion.ciudadInmueble}
                onChange={(event) => actualizarOperacionCampo("ciudadInmueble", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Colonia</Label>
              {coloniasInmueble.length > 0 ? (
                <Select
                  value={value.operacion.coloniaInmueble}
                  onValueChange={(val) => actualizarOperacionCampo("coloniaInmueble", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Colonia" />
                  </SelectTrigger>
                  <SelectContent>
                    {coloniasInmueble.map((colonia) => (
                      <SelectItem key={colonia} value={colonia}>
                        {colonia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={value.operacion.coloniaInmueble}
                  onChange={(event) => actualizarOperacionCampo("coloniaInmueble", event.target.value)}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Calle</Label>
              <Input
                value={value.operacion.calleInmueble}
                onChange={(event) => actualizarOperacionCampo("calleInmueble", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Número exterior</Label>
              <Input
                value={value.operacion.numeroExteriorInmueble}
                onChange={(event) => actualizarOperacionCampo("numeroExteriorInmueble", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Número interior</Label>
              <Input
                value={value.operacion.numeroInteriorInmueble}
                onChange={(event) => actualizarOperacionCampo("numeroInteriorInmueble", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Folio real</Label>
              <Input
                value={value.operacion.folioReal}
                onChange={(event) => actualizarOperacionCampo("folioReal", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Dimensión terreno (m²)</Label>
              <Input
                value={value.operacion.dimensionTerreno}
                onChange={(event) => actualizarOperacionCampo("dimensionTerreno", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Dimensión construida (m²)</Label>
              <Input
                value={value.operacion.dimensionConstruido}
                onChange={(event) => actualizarOperacionCampo("dimensionConstruido", event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Liquidación de la operación</h3>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Fecha de pago</Label>
              <Input
                type="date"
                value={value.operacion.liquidacion.fechaPago}
                onChange={(event) => actualizarLiquidacion("fechaPago", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Instrumento monetario</Label>
              <Input
                value={value.operacion.liquidacion.instrumentoMonetario}
                onChange={(event) => actualizarLiquidacion("instrumentoMonetario", event.target.value)}
                placeholder="Catálogo"
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select
                value={value.operacion.liquidacion.moneda}
                onValueChange={(val) => actualizarLiquidacion("moneda", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Moneda" />
                </SelectTrigger>
                <SelectContent>
                  {monedas.map((moneda) => (
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
                value={value.operacion.liquidacion.montoOperacion}
                onChange={(event) => actualizarLiquidacion("montoOperacion", event.target.value)}
                placeholder="0000000000.00"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Valor del bien (especie)</Label>
              <Input
                value={value.operacion.liquidacion.valorBien}
                onChange={(event) => actualizarLiquidacion("valorBien", event.target.value)}
                placeholder="0000000000.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda del valor</Label>
              <Select
                value={value.operacion.liquidacion.monedaValorBien}
                onValueChange={(val) => actualizarLiquidacion("monedaValorBien", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Moneda" />
                </SelectTrigger>
                <SelectContent>
                  {monedas.map((moneda) => (
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
                value={value.operacion.liquidacion.tipoBien}
                onChange={(event) => actualizarLiquidacion("tipoBien", event.target.value)}
              />
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
