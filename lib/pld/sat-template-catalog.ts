import { SAT_FORMATOS_ACTIVIDADES, resolveSatFormatoForActividad } from "./sat-formatos"
import type { SatFormatoManifestItem, SatTemplateCatalogItem, SatTemplateVariant } from "./types"

const VERIFIED_AT = "2026-05-12"

function templatePath(templateId: string, fileName: string) {
  return `/sat-templates/${templateId}/${fileName}`
}

function variant(input: Omit<SatTemplateVariant, "localPath"> & { templateId: string }): SatTemplateVariant {
  return {
    ...input,
    localPath: templatePath(input.templateId, input.officialXlsmName),
  }
}

const XI_VARIANTS: SatTemplateVariant[] = [
  variant({
    templateId: "sat-fraccion-xi-a-inmuebles",
    variantId: "spr-01-compraventa-inmuebles",
    label: "Compraventa de inmuebles",
    actividadKeys: ["fraccion-xi-a-inmuebles"],
    officialXlsmName: "SPR01_CompraventaInmuebles_v5_0.xlsm",
    sourceZipUrl: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Formatos/Fraccion_XI/avisos.zip",
    nestedZipName: "sprinmuebles2 (2).zip",
  }),
  variant({
    templateId: "sat-fraccion-xi-a-inmuebles-cesion",
    variantId: "spr-02-cesion-derechos-inmuebles",
    label: "Cesión de derechos sobre inmuebles",
    actividadKeys: ["fraccion-xi-a-inmuebles"],
    officialXlsmName: "SPR02_CesionDerechosInmuebles_v5_0.xlsm",
    sourceZipUrl: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Formatos/Fraccion_XI/avisos.zip",
    nestedZipName: "sprcesion2 (3).zip",
  }),
  variant({
    templateId: "sat-fraccion-xi-b-administracion",
    variantId: "spr-03-administracion-recursos",
    label: "Administración y manejo de recursos",
    actividadKeys: ["fraccion-xi-b-administracion"],
    officialXlsmName: "SPR03_AdministracionDeRecursos_v5_0.xlsm",
    sourceZipUrl: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Formatos/Fraccion_XI/avisos.zip",
    nestedZipName: "spradmonrecursos2 (12).zip",
  }),
  variant({
    templateId: "sat-fraccion-xi-c-cuentas",
    variantId: "spr-04-constitucion-personas-morales",
    label: "Constitución de personas morales",
    actividadKeys: ["fraccion-xi-c-cuentas", "fraccion-xi-e-corporativo"],
    officialXlsmName: "SPR04_ConstitucionDePersonasMorales_v5_0.xlsm",
    sourceZipUrl: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Formatos/Fraccion_XI/avisos.zip",
    nestedZipName: "sprconstitucionpm2 (1).zip",
  }),
  variant({
    templateId: "sat-fraccion-xi-d-aportaciones",
    variantId: "spr-05-organizacion-aportaciones",
    label: "Organización de aportaciones de capital",
    actividadKeys: ["fraccion-xi-d-aportaciones"],
    officialXlsmName: "SPR05_OrganizacionDeAportaciones_v5_0.xlsm",
    sourceZipUrl: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Formatos/Fraccion_XI/avisos.zip",
    nestedZipName: "spraportacion2 (2).zip",
  }),
  variant({
    templateId: "sat-fraccion-xi-e-fusion",
    variantId: "spr-06-fusion",
    label: "Fusión de personas morales",
    actividadKeys: ["fraccion-xi-e-corporativo"],
    officialXlsmName: "SPR06_Fusion_v5_0.xlsm",
    sourceZipUrl: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Formatos/Fraccion_XI/avisos.zip",
    nestedZipName: "sprfusion2 (1).zip",
  }),
  variant({
    templateId: "sat-fraccion-xi-e-escision",
    variantId: "spr-07-escision",
    label: "Escisión de personas morales",
    actividadKeys: ["fraccion-xi-e-corporativo"],
    officialXlsmName: "SPR07_Escision_v5_0.xlsm",
    sourceZipUrl: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Formatos/Fraccion_XI/avisos.zip",
    nestedZipName: "sprescision2 (1).zip",
  }),
  variant({
    templateId: "sat-fraccion-xi-e-administracion-pm",
    variantId: "spr-08-administracion-personas-morales",
    label: "Administración de personas morales",
    actividadKeys: ["fraccion-xi-e-corporativo"],
    officialXlsmName: "SPR08_AdministracionDePersonasMorales_v5_0.xlsm",
    sourceZipUrl: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Formatos/Fraccion_XI/avisos.zip",
    nestedZipName: "sproperacion2 (4).zip",
  }),
  variant({
    templateId: "sat-fraccion-xi-e-fideicomisos",
    variantId: "spr-09-constitucion-fideicomisos",
    label: "Constitución de fideicomisos",
    actividadKeys: ["fraccion-xi-e-corporativo"],
    officialXlsmName: "SPR09_ConstitucionDeFideicomisos_v5_0.xlsm",
    sourceZipUrl: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Formatos/Fraccion_XI/avisos.zip",
    nestedZipName: "sprconstitucionfid2.zip",
  }),
  variant({
    templateId: "sat-fraccion-xi-e-compraventa-entidades",
    variantId: "spr-10-compraventa-entidades",
    label: "Compraventa de entidades mercantiles",
    actividadKeys: ["fraccion-xi-e-corporativo"],
    officialXlsmName: "SPR10_ComparaventaDeEntidadesMercantiles_v5_0.xlsm",
    sourceZipUrl: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Formatos/Fraccion_XI/avisos.zip",
    nestedZipName: "sprcompraventa2.zip",
  }),
]

const XII_SOURCE = "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Formatos/Fraccion_XII/avisos.zip"
const XII_VARIANTS: SatTemplateVariant[] = [
  variant({
    templateId: "sat-fraccion-xii-notarios-a",
    variantId: "fep-inmuebles",
    label: "Transmisión o constitución de derechos reales sobre inmuebles",
    actividadKeys: ["fraccion-xii-notarios-a"],
    officialXlsmName: "FedatariosSP_Inmuebles_v4_4.xlsm",
    sourceZipUrl: XII_SOURCE,
  }),
  variant({
    templateId: "sat-fraccion-xii-notarios-b",
    variantId: "fep-poder",
    label: "Otorgamiento de poder irrevocable",
    actividadKeys: ["fraccion-xii-notarios-b"],
    officialXlsmName: "FedatarioPoder_v4_3.xlsm",
    sourceZipUrl: XII_SOURCE,
  }),
  variant({
    templateId: "sat-fraccion-xii-notarios-c",
    variantId: "fep-constitucion-pm",
    label: "Constitución de personas morales",
    actividadKeys: ["fraccion-xii-notarios-c", "fraccion-xii-corredores-b"],
    officialXlsmName: "FedatarioConstitucionPM_v4_4.xlsm",
    sourceZipUrl: XII_SOURCE,
  }),
  variant({
    templateId: "sat-fraccion-xii-notarios-d",
    variantId: "fep-fideicomiso",
    label: "Constitución o modificación de fideicomiso traslativo de dominio o garantía sobre inmuebles",
    actividadKeys: ["fraccion-xii-notarios-d", "fraccion-xii-corredores-d"],
    officialXlsmName: "FedatarioConstitucionFid_v4_6.xlsm",
    sourceZipUrl: XII_SOURCE,
  }),
  variant({
    templateId: "sat-fraccion-xii-notarios-e",
    variantId: "fep-mutuo",
    label: "Otorgamiento de contratos de mutuo o crédito",
    actividadKeys: ["fraccion-xii-notarios-e"],
    officialXlsmName: "FedatarioMutuo_v4_4.xlsm",
    sourceZipUrl: XII_SOURCE,
  }),
  variant({
    templateId: "sat-fraccion-xii-corredores-a",
    variantId: "fep-avaluos",
    label: "Realización de avalúos",
    actividadKeys: ["fraccion-xii-corredores-a"],
    officialXlsmName: "FedatarioAvaluo_v4_3.xlsm",
    sourceZipUrl: XII_SOURCE,
  }),
  variant({
    templateId: "sat-fraccion-xii-corredores-c-compra-venta",
    variantId: "fep-compra-venta-acciones",
    label: "Compra o venta de acciones o partes sociales",
    actividadKeys: ["fraccion-xii-corredores-c"],
    officialXlsmName: "FedatarioCompraVenta_v4_3.xlsm",
    sourceZipUrl: XII_SOURCE,
  }),
  variant({
    templateId: "sat-fraccion-xii-corredores-c-fusion",
    variantId: "fep-fusion",
    label: "Fusión",
    actividadKeys: ["fraccion-xii-corredores-c"],
    officialXlsmName: "FedatarioFusion_v4_3.xlsm",
    sourceZipUrl: XII_SOURCE,
  }),
  variant({
    templateId: "sat-fraccion-xii-corredores-c-escision",
    variantId: "fep-escision",
    label: "Escisión",
    actividadKeys: ["fraccion-xii-corredores-c"],
    officialXlsmName: "FedatarioEscision_v4_3.xlsm",
    sourceZipUrl: XII_SOURCE,
  }),
  variant({
    templateId: "sat-fraccion-xii-corredores-c-modif-patrimonial",
    variantId: "fep-modificacion-patrimonial",
    label: "Modificación patrimonial por aumento o disminución de capital",
    actividadKeys: ["fraccion-xii-corredores-c"],
    officialXlsmName: "FedatarioModifPatrimonial_v4_4.xlsm",
    sourceZipUrl: XII_SOURCE,
  }),
  variant({
    templateId: "sat-fraccion-xii-sp-poder",
    variantId: "fep-sp-poder",
    label: "Poder irrevocable ante servidor público",
    actividadKeys: ["fraccion-xii-notarios-b"],
    officialXlsmName: "FedatariosSP_Poder_v4_3.xlsm",
    sourceZipUrl: XII_SOURCE,
  }),
  variant({
    templateId: "sat-fraccion-xii-sp-modif-patrimonial",
    variantId: "fep-sp-modificacion-patrimonial",
    label: "Modificación patrimonial ante servidor público",
    actividadKeys: ["fraccion-xii-corredores-c"],
    officialXlsmName: "FedatariosSP_ModifPatrimonial_v4_3.xlsm",
    sourceZipUrl: XII_SOURCE,
  }),
  variant({
    templateId: "sat-fraccion-xii-cesion-fideicomiso",
    variantId: "fep-cesion-fideicomiso",
    label: "Cesión de derechos de fideicomitente o fideicomisario",
    actividadKeys: ["fraccion-xii-notarios-d", "fraccion-xii-corredores-d"],
    officialXlsmName: "FedatarioCesion_v4_3.xlsm",
    sourceZipUrl: XII_SOURCE,
  }),
]

function fromFormato(formato: SatFormatoManifestItem): SatTemplateCatalogItem {
  const variants =
    formato.id === "sat-fraccion-xi-servicios-profesionales"
      ? XI_VARIANTS
      : formato.id === "sat-fraccion-xii-fe-publica"
        ? XII_VARIANTS
        : []
  const firstVariant = variants[0]
  const officialXlsmName = firstVariant?.officialXlsmName || formato.officialXlsmName
  const templateId = firstVariant?.templateId || formato.id
  const sourceZipUrl = firstVariant?.sourceZipUrl || formato.avisoUrl || formato.informeCerosUrl || formato.satPageUrl

  return {
    templateId,
    formatoId: formato.id,
    fraccion: formato.fraccion,
    anexo: formato.anexo,
    actividadKeys: formato.actividadKeys,
    nombre: formato.nombre,
    claveActividad: formato.claveActividad,
    officialXlsmName,
    sourceZipUrl,
    localPath: templatePath(templateId, officialXlsmName),
    outputModes: formato.outputModes,
    variants,
    requiresVariantSelection: variants.length > 1,
    sourceLastVerified: formato.sourceLastVerified || VERIFIED_AT,
  }
}

export const SAT_TEMPLATE_CATALOG: SatTemplateCatalogItem[] = SAT_FORMATOS_ACTIVIDADES.map(fromFormato)

export function resolveSatTemplateForActividad(
  actividadKey: string,
  variantId?: string,
): SatTemplateCatalogItem {
  const formato = resolveSatFormatoForActividad(actividadKey)
  const base = fromFormato(formato)
  const eligibleVariants = base.variants.filter((item) => item.actividadKeys.includes(actividadKey))
  const variant =
    eligibleVariants.find((item) => item.variantId === variantId) ||
    eligibleVariants.find((item) => item.templateId === variantId) ||
    eligibleVariants[0]

  if (!variant) return base

  return {
    ...base,
    templateId: variant.templateId,
    officialXlsmName: variant.officialXlsmName,
    sourceZipUrl: variant.sourceZipUrl,
    localPath: variant.localPath,
    actividadKeys: variant.actividadKeys,
    variants: eligibleVariants,
    requiresVariantSelection: eligibleVariants.length > 1,
  }
}

export function getSatTemplateCachePath(template: SatTemplateCatalogItem | SatTemplateVariant): string {
  return `public${template.localPath}`
}

export function getSatTemplatePublicPath(template: SatTemplateCatalogItem | SatTemplateVariant): string {
  return template.localPath
}
