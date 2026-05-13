# Metodologia PLD generalizada para Actividades Vulnerables

Documento operativo para convertir manuales corporativos PLD aplicados a un caso concreto en una pauta reusable para cualquier sujeto obligado de Actividades Vulnerables en Mexico. No replica politicas internas, marcas, formatos ni datos sensibles de terceros; abstrae la logica de cumplimiento, evidencia, riesgo y salidas SAT.

## 1. Principios de generalizacion

- La plataforma debe partir del sujeto obligado, no del cliente aislado: RFC, razon social, actividades dadas de alta, representante encargado de cumplimiento, responsables internos, vigencia de manual PLD, metodologia EBR y politicas de conservacion.
- Cada operacion se documenta como un caso operativo PLD con trazabilidad: sujeto obligado, periodo, actividad, cliente/EUI, beneficiario controlador, PEP, forma de pago, EBR, evidencia, decision SAT, folio o acuse.
- La regla legal comun vive centralizada; las politicas internas son configurables por sujeto obligado.
- No se guarda e.firma, certificados `.cer`, llaves `.key`, contrasenas ni secretos. Solo se guardan metadatos, folios, acuses y evidencia documental.
- El sistema apoya cumplimiento y revision humana; no sustituye interpretacion legal ni validacion oficial en SPPLD.

## 2. Flujo legal-operativo

1. Alta y contexto del sujeto obligado: confirmar actividad vulnerable, alta en SPPLD, representante de cumplimiento, domicilio, responsables y manual vigente.
2. Periodo: definir mes reportado y UMA aplicable para calcular umbrales.
3. Actividad vulnerable: elegir fraccion/subactividad, mostrar umbral, acumulacion, restricciones operativas, formato SAT y responsables.
4. Cliente o usuario: integrar expediente unico de identificacion con tipo de persona, RFC/CSF, domicilio, actividad, poderes y relacion de negocios.
5. Beneficiario controlador y PEP: identificar control efectivo, representante, familiares/asociados cuando aplique y screening PEP/listas con evidencia.
6. Operacion: registrar fecha, monto, moneda, forma de pago, instrumento, objeto, soporte contractual y congruencia con perfil.
7. EBR y alertas: calcular riesgo inherente, controles mitigantes y riesgo residual. Escalar aviso 24 horas cuando existan indicios o sospecha.
8. Evidencias: cubrir requisitos criticos o documentar justificacion. Se permite guardar con faltantes; se bloquea cierre completo si faltan criticos sin justificacion.
9. Salida SAT: decidir entre aviso normal, informe en ceros, informe 27 Bis o aviso de 24 horas. Generar XML local-first y revisar contra plantilla oficial antes de carga manual.
10. Conservacion y auditoria: conservar soporte, bitacoras, decisiones, folios, acuses, capacitacion, revisiones y planes de accion.

## 3. Evidencia minima por bloque

La evidencia se captura junto al requisito, no como una bandeja aislada.

- Identificacion: identificacion oficial, RFC/CSF, CURP si existe, domicilio, contacto y actividad economica.
- Persona moral: acta constitutiva o documento equivalente, inscripcion, poderes notariales, identificacion del representante, estructura accionaria/control y beneficiario controlador.
- Persona extranjera: documento de constitucion, tax ID/RFC si existe, domicilio extranjero, poderes, representante y beneficiario controlador.
- Fideicomiso: contrato, fiduciario, identificador, delegado/apoderado, poderes y beneficiarios/control.
- Operacion: contrato, factura, escritura, instrumento publico, recibo, comprobante de pago, forma de pago, origen de recursos cuando aplique y soporte de valor.
- PLD: declaracion PEP, resultado PEP/listas, EBR, señales de alerta, autorizaciones internas, aviso/informe, folio, acuse y bitacora de cotejo.

## 4. EBR generalizada

La metodologia base usa ponderaciones operativas:

- Clientes y usuarios: 30%.
- Productos o servicios: 30%.
- Canales y transacciones: 20%.
- Geografia y jurisdicciones: 20%.

Indicadores principales:

- Tipo de persona, actividad economica, PEP, beneficiario controlador, listas, congruencia transaccional.
- Alto valor, portabilidad, transferibilidad, anonimato y uso de efectivo.
- Canal presencial/no presencial, intermediarios, representantes y fedatarios.
- Zona de riesgo, frontera, jurisdiccion extranjera o comportamiento no congruente.

Controles mitigantes:

- Gobierno corporativo, representante de cumplimiento, manual PLD, capacitacion anual, monitoreo, auditoria, KYC, beneficiario controlador, resguardo documental y presentacion oportuna de avisos.

La salida debe mostrar riesgo inherente, efectividad del control, riesgo residual y plan de mitigacion por prioridad.

## 5. Salidas SAT

- Aviso normal: operacion objeto de aviso, ordinariamente al dia 17 del mes inmediato siguiente.
- Informe en ceros: periodo sin actos u operaciones objeto de aviso ni supuestos 27 Bis.
- Informe 27 Bis: operaciones exceptuadas por supuestos aplicables, con soporte documental y trazabilidad.
- Aviso de 24 horas: indicios o sospecha, incluso si el acto no se celebro. No debe retrasarse por evidencia incompleta; exige narrativa, fuente del indicio y decision humana.

La plataforma genera un XML de apoyo operativo local-first. Antes de afirmar compatibilidad productiva total, debe validarse contra las plantillas y reglas vigentes del SPPLD para cada actividad.

## 6. Lo especifico de Sanborns que no se debe copiar

- Nombres comerciales, organigrama, responsables, folios, formatos internos, rutas de autorizacion y controles propios.
- Umbrales internos, estilo documental, texto de declaraciones y politicas comerciales.
- Datos personales, expedientes, muestras o evidencia vinculada al caso concreto.

Lo reutilizable es la estructura: gobierno PLD, expediente unico, identificacion, beneficiario controlador, alertas, EBR, conservacion documental, auditoria, capacitacion, seguimiento de hallazgos y presentacion de avisos/informes.

## 7. Implementacion en la plataforma

- `lib/pld/tenants.ts`: sujeto obligado multi-cliente local-first.
- `lib/pld/sat-formatos.ts`: manifiesto SAT por fraccion/subactividad con URLs oficiales de referencia.
- `lib/pld/operational-flow.ts`: caso operativo, evidencia, salida SAT y XML.
- `lib/pld/ebr-methodology.ts`: ponderaciones, controles mitigantes y riesgo residual.
- `app/actividades-vulnerables/page.tsx`: wizard operativo de ocho pasos.

Las llaves actuales de `localStorage` se conservan. Las nuevas son `pld-tenants` y `pld-active-tenant-id`.

## 8. Fuentes normativas y tecnicas

- LFPIORPI vigente.
- Reglamento LFPIORPI y reformas aplicables.
- Reglas de Caracter General.
- SAT/SPPLD Actividades Vulnerables, normateca, obligaciones y formatos.
- Guia CNBV para metodologia EBR.
- ENR 2023 UIF.
- Manuales y EBR proporcionados como insumo metodologico privado, generalizados sin replicar datos sensibles.
