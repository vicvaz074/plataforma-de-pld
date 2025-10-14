"use client"

import Link from "next/link"
import { useLanguage } from "@/lib/LanguageContext"
import { translations } from "@/lib/translations"

type Law = {
  id: number
  ley: string
  caracteristicas: string
  links?: string[]
  nota?: string
}

const leyesGenerales: Law[] = [
  {
    id: 1,
    ley: "Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita",
    caracteristicas:
      "Ley que establece de manera general las obligaciones para el Sistema Financiero y establece de manera particular las obligaciones para Actividades Vulnerables. Define conceptos clave en la materia.",
    links: ["https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPIORPI.pdf"],
  },
  {
    id: 2,
    ley: "Reglamento de la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita",
    caracteristicas:
      "Ley que reglamenta las obligaciones y las facultades de la autoridad establecidas en la LFPIORPI",
    links: ["https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LFPIORPI.pdf"],
  },
  {
    id: 3,
    ley: "Art 400 Bis y 400 Bis 1 del Código Penal Federal",
    caracteristicas: "Definición de operaciones con recursos de procedencia ilícita.",
    links: ["https://www.pld.hacienda.gob.mx/work/models/PLD/documentos/art400bis_400bis_1.pdf"],
  },
  {
    id: 4,
    ley: "Art 139, 139 Bis y 239 Ter del Código Penal Federal",
    caracteristicas: "Definición de terrorismo",
    links: ["https://www.pld.hacienda.gob.mx/work/models/PLD/documentos/art139_139bis_139ter.pdf"],
  },
  {
    id: 5,
    ley: "Art 139 Quarter y 139 Quinqui del Código Penal Federal",
    caracteristicas: "Definición de financiamiento al terrorismo",
    links: ["https://www.pld.hacienda.gob.mx/work/models/PLD/documentos/art139quater_139quinquies.pdf"],
  },
  {
    id: 6,
    ley: "Art 148 Bis, 148 Ter y 148 Quarter",
    caracteristicas: "Definición de terrorismo internacional",
    links: ["https://www.pld.hacienda.gob.mx/work/models/PLD/documentos/art148bis_148ter_148quater.pdf"],
  },
]

const actividadesVulnerables: Law[] = [
  {
    id: 1,
    ley: "Reglas de Carácter General a que se refiere la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita",
    caracteristicas:
      "Establece las medidas y procedimientos que deben de observar quienes realicen actividades vulnerables.",
    links: ["https://www.pld.hacienda.gob.mx/work/models/PLD/documentos/compilado_rcg_reforma30nov2020.pdf"],
    nota: "Nota: se actualizará en el futuro próximo para que vaya de acuerdo a la reforma a la LFPIORPI",
  },
  {
    id: 2,
    ley: "Resolución por la que se expide el formato para el alta y registro de quienes realicen Actividades Vulnerables",
    caracteristicas:
      "Establece el procedimiento de alta y registro de quienes realicen Actividades Vulnerables",
    links: ["https://www.pld.hacienda.gob.mx/work/models/PLD/documentos/compilado_formatoaltaregistro_reforma2016.pdf"],
  },
  {
    id: 3,
    ley: "Resolución por la que se expiden los formatos oficiales de los avisos e informes que deben presentar quienes realicen Actividades Vulnerables",
    caracteristicas:
      "Establece los formatos que deben de seguir las personas que realicen las actividades vulnerables para dar avisos o informes.",
    links: ["https://www.pld.hacienda.gob.mx/work/models/PLD/documentos/compilado_formatosofic_24mayo2021.pdf"],
  },
  {
    id: 4,
    ley: "Reglamento Interior de SHCP",
    caracteristicas:
      "Establece las obligaciones que tiene esta autoridad en materia de PLD.",
    links: ["https://www.pld.hacienda.gob.mx/work/models/PLD/documentos/compilado_rcg_reforma30nov2020.pdf"],
  },
  {
    id: 5,
    ley: "Atribuciones de la Unidad de Inteligencia Financiera conforme al nuevo Reglamento Interior de la Secretaría de Hacienda y Crédito Público, publicado el 06 de marzo de 2023 en el Diario Oficial de la Federación.",
    caracteristicas: "Establece las atribuciones que la UIF tiene en materia de PLD.",
    links: ["https://www.pld.hacienda.gob.mx/work/models/PLD/documentos/atribucionesuif_art15_rishcp.pdf"],
  },
]

const sistemaFinanciero = {
  general: [
    {
      id: 1,
      ley: "GUÍA PARA LA ELABORACIÓN DE UNA METODOLOGÍA DE EVALUACIÓN DE RIESGOS EN MATERIA DE PREVENCIÓN DE OPERACIONES CON RECURSOS DE PROCEDENCIA ILÍCITA Y FINANCIAMIENTO AL TERRORISMO",
      caracteristicas:
        "Guía que las instituciones financieras deben de seguir para evaluar el riesgo en materia de PLD",
      links: [
        "https://www.gob.mx/cms/uploads/attachment/file/491487/Guia_para_la_Metodologia_de_Evaluacion_2019.pdf",
      ],
    },
  ],
  institucionesCredito: [
    {
      id: 1,
      ley: "Art 115, 115 Bis, 116, 116 bis y 116 Bis 1 de la Ley de Instituciones de Crédito",
      caracteristicas:
        "Establece las obligaciones que las Instituciones de crédito deben de hacer en materia de PLD y consecuencias.",
      nota: "Disponible en Carpeta LIC 135-139",
    },
    {
      id: 2,
      ley: "DISPOSICIONES DE CARÁCTER GENERAL APLICABLES A LAS INSTITUCIONES DE CRÉDITO",
      caracteristicas:
        "Establece las medidas y procedimientos mínimos que las IC tienen que seguir en materia de PLD.",
      links: [
        "https://www.cnbv.gob.mx/Normatividad/Disposiciones%20de%20car%C3%A1cter%20general%20aplicables%20a%20las%20instituciones%20de%20cr%C3%A9dito.pdf",
      ],
    },
  ],
  institucionesTecnologia: [
    {
      id: 1,
      ley: "Artículo 58 de la Ley para Regular las Instituciones de Tecnología Financiera",
      caracteristicas:
        "Artículo que establece las obligaciones en materia de PLD que las ITF deben de seguir",
      nota: "Disponible en Carpeta como LRITF 27-30",
    },
    {
      id: 2,
      ley: "DISPOSICIONES DE CARÁCTER GENERAL A QUE SE REFIERE EL ARTÍCULO 58 DE LA LEY PARA REGULAR LAS INSTITUCIONES DE TECNOLOGÍA FINANCIERA",
      caracteristicas:
        "Establece las medidas y procedimientos mínimos que las IFT tienen que seguir en materia de PLD.",
      links: [
        "https://www.gob.mx/cms/uploads/attachment/file/909810/DCG_Instituciones_de_Tecnolog_a_Financiera__2018.pdf",
      ],
    },
  ],
  segurosFianza: [
    {
      id: 1,
      ley: "Artículo 492 y 493 de la Ley de Instituciones de Seguros y Fianza",
      caracteristicas:
        "Artículo que establece las obligaciones en materia de PLD que las instituciones de seguro y fianza deben de seguir",
      nota: "Disponible en Carpeta como LISF 243- 244.",
    },
    {
      id: 2,
      ley: "Circular única de Seguros y Fianza y anexos 27",
      caracteristicas:
        "Establece los procedimientos que las instituciones de seguros y fianza deben de seguir en materia de PLD",
      links: ["https://www.gob.mx/cnsf/documentos/circular-unica-de-seguros-y-fianzas"],
    },
  ],
  afores: [
    {
      id: 1,
      ley: "Artículo 108 Bis de la Ley de los Sistemas para el Retiro",
      caracteristicas:
        "Artículo que establece las obligaciones en materia de PLD que las instituciones de seguro y fianza deben de seguir",
      nota: "Disponible en Carpeta como LSAR 63-65",
    },
    {
      id: 2,
      ley: "DISPOSICIONES DE CARACTER GENERAL A QUE SE REFIEREN LOS ARTICULOS 108 BIS DE LA LEY DE LOS SISTEMAS DE AHORRO PARA EL RETIRO Y 91 DE LA LEY DE SOCIEDADES DE INVERSION",
      caracteristicas:
        "Establece los procedimientos que las AFORES deben de seguir en materia de PLD",
      nota: "Disponible en Carpeta como AFORES Disposiciones",
    },
  ],
  casasBolsas: [
    {
      id: 1,
      ley: "Artículos 212 y 226 Bis de la Ley de Mercado de Valores",
      caracteristicas:
        "Artículos que refieren a las obligaciones que las casas de bolsas en materia de prevención de lavado de dinero",
      nota: "Disponible en Carpeta como LMV 114-116 y LMV 125-126",
    },
    {
      id: 2,
      ley: "DISPOSICIONES DE CARÁCTER GENERAL A QUE SE REFIERE EL ARTÍCULO 212 DE LA LEY DEL MERCADO DE VALORES",
      caracteristicas:
        "Establece los procedimientos que las Casas de Bolsas deben de seguir en materia de PLD",
      links: [
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5158508&fecha=09/09/2010#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5377881&fecha=31/12/2014#gsc.tab=0",
      ],
    },
  ],
  auxiliaresCredito: [
    {
      id: 1,
      ley: "Artículos 95 y 95 Bis Ley General de Organizaciones y Actividades Auxiliares del Crédito",
      caracteristicas:
        "Establece los obligaciones que las auxiliares de crédito (SOFOMES, Centros cambiarias y transmisores de dinero) deben de realizar en materia de PLD",
      nota: "Disponible en Carpeta como LGOAAC 88-94",
    },
    {
      id: 2,
      ley: "DISPOSICIONES DE CARACTER GENERAL A QUE SE REFIERE EL ARTICULO 95 BIS DE LA LEY GENERAL DE ORGANIZACIONES Y ACTIVIDADES AUXILIARES DEL CREDITO, APLICABLES A LOS TRANSMISORES DE DINERO A QUE SE REFIERE EL ARTICULO 81-A BIS DEL MISMO ORDENAMIENTO",
      caracteristicas:
        "Establece los procedimientos que los transmisores de dinero deben de realizar en materia de PLD.",
      links: [
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5554685&fecha=20/03/2019#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5475646&fecha=09/03/2017#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5377884&fecha=31/12/2014#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5242565&fecha=10/04/2012#gsc.tab=0",
      ],
    },
    {
      id: 3,
      ley: "DISPOSICIONES DE CARÁCTER GENERAL A QUE SE REFIERE EL ARTÍCULO 95 BIS DE LA LEY GENERAL DE ORGANIZACIONES Y ACTIVIDADES AUXILIARES DEL CRÉDITO APLICABLES A LOS CENTROS CAMBIARIOS A QUE SE REFIERE EL ARTÍCULO 81-A DEL MISMO ORDENAMIENTO.",
      caracteristicas:
        "Establece los procedimientos que los Centros cambiaros deben de realizar en materia de PLD.",
      links: [
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5242564&fecha=10/04/2012#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5377889&fecha=31/12/2014#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5421590&fecha=29/12/2015#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5475643&fecha=09/03/2017#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5554684&fecha=20/03/2019#gsc.tab=0",
      ],
    },
    {
      id: 4,
      ley: "DISPOSICIONES DE CARÁCTER GENERAL A QUE SE REFIEREN LOS ARTÍCULOS 115 DE LA LEY DE INSTITUCIONES DE CRÉDITO EN RELACIÓN CON EL 87-D DE LA LEY GENERAL DE ORGANIZACIONES Y ACTIVIDADES AUXILIARES DEL CRÉDITO Y 95-BIS DE ESTE ÚLTIMO ORDENAMIENTO, APLICABLES A LAS SOCIEDADES FINANCIERAS DE OBJETO MÚLTIPLE",
      caracteristicas:
        "Establece los procedimientos que las SOFOM deben de realizar en materia de PLD.",
      links: [
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5182183&fecha=17/03/2011#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5226549&fecha=23/12/2011#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5377883&fecha=31/12/2014#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5475644&fecha=09/03/2017#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5554779&fecha=21/03/2019#gsc.tab=0",
      ],
    },
  ],
  unionesCredito: [
    {
      id: 1,
      ley: "Artículo 129 de la Ley de Uniones de Crédito",
      caracteristicas: "Establece las obligaciones en materia de PLD de las uniones de crédito.",
      nota: "Disponible en Carpeta como LUC 56-58",
    },
    {
      id: 2,
      ley: "DISPOSICIONES DE CARÁCTER GENERAL A QUE SE REFIERE EL ARTÍCULO 129 DE LA LEY DE UNIONES DE CRÉDITO",
      caracteristicas:
        "Establece los procedimientos que las uniones de crédito deben de realizar en materia de PLD.",
      links: [
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5275522&fecha=26/10/2012#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5478021&fecha=30/03/2017#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5554906&fecha=22/03/2019#gsc.tab=0",
      ],
    },
  ],
  sociedadesFinancierasPopulares: [
    {
      id: 1,
      ley: "Artículo 124 de la Ley de Ahorro y Crédito Popular",
      caracteristicas:
        "Establece las obligaciones en materia de PLD de las sociedades financieras populares.",
      nota: "Disponible en Carpeta como LACP 80-83",
    },
  ],
  fondosInversion: [
    {
      id: 1,
      ley: "Artículo 91 de la Ley de Fondos de Inversión",
      caracteristicas:
        "Establece las obligaciones en materia de PLD de los fondos de inversión.",
      nota: "Esta en Carpeta como LFI 93-95",
    },
    {
      id: 2,
      ley: "DISPOSICIONES DE CARÁCTER GENERAL A QUE SE REFIERE EL ARTÍCULO 91 DE LA LEY DE FONDOS DE INVERSIÓN",
      caracteristicas:
        "Establece los procedimientos que los fondos de inversión deben de realizar en materia de PLD.",
      links: [
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5377886&fecha=31/12/2014#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5477324&fecha=23/03/2017#gsc.tab=0",
        "https://www.dof.gob.mx/nota_detalle.php?codigo=5566218&fecha=22/07/2019#gsc.tab=0",
      ],
    },
  ],
}

const seccionesFinancieras = [
  { key: "general", titulo: "General", leyes: sistemaFinanciero.general },
  {
    key: "institucionesCredito",
    titulo: "Instituciones de Crédito",
    leyes: sistemaFinanciero.institucionesCredito,
  },
  {
    key: "institucionesTecnologia",
    titulo: "Instituciones de Tecnología Financiera",
    leyes: sistemaFinanciero.institucionesTecnologia,
  },
  { key: "segurosFianza", titulo: "Seguros y Fianzas", leyes: sistemaFinanciero.segurosFianza },
  { key: "afores", titulo: "Afores", leyes: sistemaFinanciero.afores },
  { key: "casasBolsas", titulo: "Casas de Bolsa", leyes: sistemaFinanciero.casasBolsas },
  { key: "auxiliaresCredito", titulo: "Auxiliares de Crédito", leyes: sistemaFinanciero.auxiliaresCredito },
  { key: "unionesCredito", titulo: "Uniones de Crédito", leyes: sistemaFinanciero.unionesCredito },
  {
    key: "sociedadesFinancierasPopulares",
    titulo: "Sociedades Financieras Populares",
    leyes: sistemaFinanciero.sociedadesFinancierasPopulares,
  },
  { key: "fondosInversion", titulo: "Fondos de Inversión", leyes: sistemaFinanciero.fondosInversion },
]

export default function MarcoNormativoAplicablePage() {
  const { language } = useLanguage()
  const t = translations[language]

  const renderLaw = (law: Law) => (
    <details key={law.id} className="group border rounded-lg transition-colors hover:border-orange-200">
      <summary className="cursor-pointer flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-semibold text-sm sm:text-base text-gray-800">
          {law.id}. {law.ley}
        </span>
        {law.links && law.links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {law.links.map((link, idx) => (
              <Link
                key={idx}
                href={link}
                target="_blank"
                className="bg-orange-500 text-white text-xs px-3 py-1 rounded-md hover:bg-orange-600"
              >
                Ver documento {idx + 1}
              </Link>
            ))}
          </div>
        )}
      </summary>
      <div className="px-4 pb-3">
        <p className="py-2 text-sm leading-relaxed text-gray-700">{law.caracteristicas}</p>
        {law.nota && <p className="pb-1 text-xs text-gray-500">{law.nota}</p>}
      </div>
    </details>
  )

  return (
    <div className="container mx-auto py-10 space-y-8">
      <h1 className="text-3xl font-bold" style={{ fontFamily: "Futura PT Medium, sans-serif" }}>
        {t.compiladoLeyes}
      </h1>

      <div className="space-y-6">
        <details className="rounded-xl border shadow-sm">
          <summary className="cursor-pointer select-none px-6 py-4 text-lg font-semibold text-gray-800">
            Normativa de aplicación general
          </summary>
          <div className="px-6 pb-6">
            <div className="space-y-4">{leyesGenerales.map(renderLaw)}</div>
          </div>
        </details>

        <details className="rounded-xl border shadow-sm">
          <summary className="cursor-pointer select-none px-6 py-4 text-lg font-semibold text-gray-800">
            Actividades Vulnerables
          </summary>
          <div className="px-6 pb-6">
            <div className="space-y-4">{actividadesVulnerables.map(renderLaw)}</div>
          </div>
        </details>

        <details className="rounded-xl border shadow-sm">
          <summary className="cursor-pointer select-none px-6 py-4 text-lg font-semibold text-gray-800">
            Sistema financiero
          </summary>
          <div className="px-6 pb-6 space-y-6">
            {seccionesFinancieras.map((seccion) => (
              <section key={seccion.key} className="space-y-3">
                <h3 className="text-base font-semibold text-gray-700">
                  {seccion.titulo}
                </h3>
                <div className="space-y-4">{seccion.leyes.map(renderLaw)}</div>
              </section>
            ))}
          </div>
        </details>
      </div>
    </div>
  )
}
