export interface NormativaReferenciaInternacional {
  nombre: string
  url: string
  descripcion: string
}

export interface NormativaOperativa {
  id: string
  autoridad: string
  descripcion: string
  criteriosClave: string[]
  repositorio: {
    nombre: string
    url: string
  }
  referenciasInternacionales: NormativaReferenciaInternacional[]
}

export const normativasMonitoreo: NormativaOperativa[] = [
  {
    id: "uif-monitoreo",
    autoridad: "Unidad de Inteligencia Financiera (UIF) - SHCP",
    descripcion:
      "Lineamientos de monitoreo continuo para sujetos obligados conforme a la LFPIORPI y Reglas de Carácter General.",
    criteriosClave: [
      "Documentar la metodología de acumulación semestral y conservación por un mínimo de cinco años.",
      "Integrar expedientes con evidencia de validaciones contra listas nacionales e internacionales.",
      "Sincronizar alertas con el módulo de actividades vulnerables para asegurar trazabilidad regulatoria.",
    ],
    repositorio: {
      nombre: "Portal de la UIF - Sujetos Obligados",
      url: "https://www.gob.mx/uif/documentos",
    },
    referenciasInternacionales: [
      {
        nombre: "40 Recomendaciones del GAFI",
        url: "https://www.fatf-gafi.org/es/recomendaciones.html",
        descripcion: "Estándares internacionales para prevenir el lavado de dinero y financiamiento al terrorismo.",
      },
      {
        nombre: "Principios de Debida Diligencia de la OCDE",
        url: "https://www.oecd.org/corporate/mne/due-diligence-guidance.htm",
        descripcion: "Guía de debida diligencia para cadenas de valor responsables y gestión de riesgos.",
      },
      {
        nombre: "Listas del Consejo de Seguridad de la ONU",
        url: "https://www.un.org/securitycouncil/es/sanctions/un-sc-consolidated-list",
        descripcion: "Listado consolidado de personas y entidades sujetas a sanciones internacionales.",
      },
    ],
  },
  {
    id: "sat-repositorio",
    autoridad: "Servicio de Administración Tributaria (SAT)",
    descripcion:
      "Criterios de envío de avisos y repositorio electrónico para actividades vulnerables bajo la regla 2.7 de las RCG.",
    criteriosClave: [
      "Mantener evidencia digital y bitácoras sincronizadas con monitoreo operativo.",
      "Validar la clasificación de operaciones relevantes, inusuales e internas preocupantes antes de cada aviso.",
      "Coordinar los módulos de actividades, monitoreo y reportes UIF para garantizar consistencia documental.",
    ],
    repositorio: {
      nombre: "Portal SAT - Actividades Vulnerables",
      url: "https://www.sat.gob.mx/personas/actividades-vulnerables",
    },
    referenciasInternacionales: [
      {
        nombre: "40 Recomendaciones del GAFI",
        url: "https://www.fatf-gafi.org/es/recomendaciones.html",
        descripcion: "Fundamento internacional para la alineación de reportes y avisos.",
      },
      {
        nombre: "Principios de Gobierno Corporativo de la OCDE",
        url: "https://www.oecd.org/corporate/principles-corporate-governance/",
        descripcion: "Buenas prácticas de gobernanza aplicables al control interno de reportes.",
      },
      {
        nombre: "Listas del Consejo de Seguridad de la ONU",
        url: "https://www.un.org/securitycouncil/es/sanctions/un-sc-consolidated-list",
        descripcion: "Referencia obligada para screening de contrapartes antes de enviar avisos.",
      },
    ],
  },
]
