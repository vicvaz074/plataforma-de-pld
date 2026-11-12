# Validación del piloto multiempresa

Consulta y ejecución: 11 de noviembre de 2026. Rama: `codex/piloto-real-multiempresa`.

## Alcance y límites

El modo conectado usa permisos y persistencia de servidor; la demo local es un modo explícito, no un respaldo automático cuando falla la API. Una revisión local de XML no acredita presentación ni aceptación del SAT.

Esta bitácora distingue pruebas automáticas de contratos, ejemplos sintéticos, comparación de libros oficiales y recorridos humanos. **No constituye aceptación completa del piloto.** Los escenarios sintéticos no prueban la captura manual, la usabilidad ni la corrección normativa de todos los datos.

## Contratos y llaves conservadas

- `actividades_vulnerables_operaciones`: V3, IDs y centavos canónicos preservados. La lectura no reescribe una colección que contenga filas descartables o IDs duplicados. Identificadores RFC/CURP/NIF permanecen separados; el vínculo de expediente tiene prioridad sobre coincidencias de RFC.
- `actividades_vulnerables_clientes`: selección e índice por ID opaco estable, con RFC/NIF/CURP separados. Una nueva captura manual crea un UUID explícito; reutilizar exige seleccionar el ID, y dos clientes con el mismo RFC no se fusionan. Las operaciones sin vínculo antiguo quedan aisladas hasta revisión/asignación explícita. Los snapshots operativos sólo completan IDs ausentes del índice visible, nunca sobrescriben un cliente existente al abrir la página; usuarios de Operaciones pueden reutilizar sus snapshots mínimos sin leer documentos adicionales de Expediente. La decisión explícita de cliente/EUI también se conserva al completar un borrador importado.
- `pld-submissions-workflow`: colección compatible con v1 y nuevos snapshots v2 por operación/revisión (`submission-{operationId}-r{preparedOperationRevision}`). La preparación no marca presentación. Al documentar el acuse aumenta la revisión de operación y se conserva la revisión de captura preparada. Un presentado es inmutable; una corrección crea otro borrador enlazado mediante `correctionOf`, sin folio, sello, fechas ni adjuntos heredados. Se rechaza reutilizar el acuse anterior por URL, ID o hash y se exige un folio nuevo. Actos dirige a este flujo, sin marcar presentación por sí solo.
- `pld-evidences-documents`, `pld-evidences-logs`, `evidencias-trazabilidad-data`: una versión conserva su archivo/URL inmutable, nombre, tamaño, tipo, autor, fecha y hash. Restaurar crea una nueva revisión y reinicia la aprobación. Archivar no elimina archivos ni versiones.
- `beneficiario-controlador-data`: sobre versionado con perfiles por ID de expediente; los datos antiguos no vinculados se conservan en `legacyUnassigned`, sin asignación automática por RFC. Las decisiones PEP incorporan `expedienteId`.
- `pld-training-module`, `gobernanza-control-data` y `auditoria-verificacion-*`: llaves conservadas. Los archivos usan referencias privadas en modo conectado. Los lectores no deben sustituir JSON ilegible por un estado vacío guardado.
- `data-pld-action` y `data-pld-context="browse"`: ayudas semánticas del guard visual de controles. No son autorización; la API vuelve a comprobar los permisos.

## Fuentes normativas consultadas

| Tema | Fuente oficial | Aplicación y límite |
|---|---|---|
| Conservación general | [LFPIORPI, artículo 18, fracción IV](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPIORPI.pdf), consulta 11/11/2026 | Plazo general de diez años desde el acto/actividad. XIV se remite a revisión de su régimen aplicable. No se calcula el inicio a partir de la fecha del archivo y no se destruye automáticamente. |
| Informe de auditoría y soporte | [Acuerdo 115/2026, artículo 51 y transitorio octavo](https://dof.gob.mx/nota_detalle_popup.php?codigo=5795797), consulta 11/11/2026 | Regla específica de cinco años desde la entrega del informe; primer ejercicio de revisión: 2028. Se exige el ejercicio aplicable y una entrega posterior para programarlo. Los históricos o datos incompletos quedan en revisión; no se sustituye la conservación general de expedientes por cinco años. |
| Control de personas morales | [LFPIORPI, artículo 3, fracción III, inciso b), numeral ii)](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPIORPI.pdf), consulta 11/11/2026 | Se retiró el criterio obsoleto de 50%: el supuesto de derechos de voto es superior a 25%. No es el único supuesto de control. |
| Capacitación y certificación del REC | [Acuerdo 115/2026, artículos 39 Bis y 39 Bis 1 y transitorio séptimo](https://dof.gob.mx/nota_detalle_popup.php?codigo=5795797), consulta 11/11/2026 | El primer periodo anual de capacitación del régimen nuevo es 2027. El criterio de revisión móvil de 365 días se identifica como política interna y no como vencimiento legal de toda certificación del REC. Se rechazan fechas futuras/imposibles y se exige un archivo real; una carga no acredita la fecha del curso. |
| Plantillas y esquemas SAT | [Portal SAT de Actividades Vulnerables](https://www.sat.gob.mx/minisitio/ActividadesVulnerables/index.html), [esquemas y ejemplos de servicios profesionales](https://sppld.sat.gob.mx/pld/interiores/servicios.html) | Se utilizan las 40 plantillas, layouts, programas XML y fixtures oficiales cacheados del repositorio. Este cambio no implica que el SAT haya aceptado los archivos ni una nueva consulta íntegra de cada ZIP. La procedencia por plantilla se consulta mediante `getSatXmlProgramSource`. |

## Evidencia automática de los 40 formatos

| Grupo | Plantillas | XML contra XSD local y `xmllint` | Captura manual/navegador por plantilla |
|---|---:|---|---|
| I–IV | 6 | Aprobado en ejemplos sintéticos | Pendiente |
| V y V Bis | 2 | Aprobado en ejemplos sintéticos | Pendiente |
| VI–X | 5 | Aprobado en ejemplos sintéticos | Pendiente |
| XI | 10 | Aprobado en ejemplos sintéticos | Pendiente |
| XII | 13 | Aprobado en ejemplos sintéticos | Pendiente |
| XIII–XIV | 2 | XIII aprobado; XIV conserva su vía de pedimento, sin XML de operación fabricado | Pendiente |
| XV | 1 | Aprobado; existe además fixture F4594 independiente | Pendiente de regresión del nuevo modo conectado |
| XVI | 1 | Aprobado en ejemplo sintético | Pendiente |

Ejecución: `PLD_XML_QA_DIR=/tmp/pld-pilot-xml-qa pnpm exec tsx scripts/check-sat-xml-programs.ts`.

Resultado: **40 plantillas, 39 XML generados, 39/39 válidos localmente y con `xmllint`; XIV no genera un XML de transacción.** La matriz contiene `manualCapture: pending` y `browser: pending`; no debe convertirse en una aprobación visual o manual. No se ejecutó `--verify-workbooks` en esta ejecución; la comparación exhaustiva de cada celda sigue siendo una categoría separada.

### Importación

`scripts/check-pilot-import-contracts.ts` construye libros mínimos desde direcciones de layouts cacheados y ejercita el lector independientemente de las macros. No equivale a un libro oficial rellenado y abierto en Excel.

La prueba inicial descubrió pérdida de nombre, fecha, monto e instrumento en IDs extraídos no canónicos y una confusión entre persona moral y representante. Se corrigió el lector para recuperar bloques explícitos, selectores virtuales y filas ocupadas. Se preservan como borradores los datos incompletos, múltiples participantes/importes ambiguos y divisas sin conversión documentada. No se inventan RFC, montos MXN, clientes ni estados de presentación.

Toda fila sin resolución explícita del cliente permanece como borrador; el sondeo siguiente asigna deliberadamente un ID estable del fixture antes de evaluar sus otros faltantes. No se genera un cliente por fila, RFC ni nombre. La tabla informa el estado posterior a esa asignación, no una autorización de importación automática.

Resultado final del sondeo: **40 libros leídos sin excepción, 1 contrato válido y 39 borradores con faltantes explícitos**. Se recuperan nombres en 38; V Bis y XIV no proporcionan un cliente único asignable en este escenario. Se conservan fechas fuente en 38; II tarjetas de servicios y XIV quedan sin fecha, nunca con la fecha de hoy. Hay monto operativo identificable en 24; no se convierten capitales, avalúos ni varios pagos en un importe supuesto. Son datos sintéticos del contrato de importación: **39 borradores no equivalen a 39 recorridos aprobados** y requieren los datos/revisiones indicados.

| Plantilla | XML sintético local | Importación sintética | Faltantes/revisión del contrato |
|---|---|---|---|
| sat-fraccion-i-juegos | Válido | Borrador | Identificador aplicable |
| sat-fraccion-ii-tarjetas-servicios | Válido | Borrador | Identificador; fecha no inferida; moneda original |
| sat-fraccion-ii-tarjetas-prepagadas | Válido | Borrador | Identificador aplicable |
| sat-fraccion-ii-instrumentos-valor | Válido | Borrador | Identificador aplicable |
| sat-fraccion-iii-cheques | Válido | Borrador | Identificador aplicable |
| sat-fraccion-iv-prestamos | Válido | Borrador | Identificador aplicable |
| sat-fraccion-v-inmuebles | Válido | Válido | Sin faltantes en el contrato sintético |
| sat-fraccion-v-bis-desarrollo | Válido | Borrador | Cliente por asignar; identificador |
| sat-fraccion-vi-metales | Válido | Borrador | Identificador aplicable |
| sat-fraccion-vii-arte | Válido | Borrador | Identificador aplicable |
| sat-fraccion-viii-vehiculos | Válido | Borrador | Identificador aplicable |
| sat-fraccion-ix-blindaje | Válido | Borrador | Identificador aplicable |
| sat-fraccion-x-traslado | Válido | Borrador | Identificador aplicable |
| sat-fraccion-xi-a-inmuebles | Válido | Borrador | Identificador aplicable |
| sat-fraccion-xi-a-inmuebles-cesion | Válido | Borrador | Identificador aplicable |
| sat-fraccion-xi-b-administracion | Válido | Borrador | Identificador aplicable |
| sat-fraccion-xi-c-cuentas | Válido | Borrador | Identificador aplicable |
| sat-fraccion-xi-d-aportaciones | Válido | Borrador | Identificador; monto total y pagos por revisar; instrumento |
| sat-fraccion-xi-e-fusion | Válido | Borrador | Identificador aplicable |
| sat-fraccion-xi-e-escision | Válido | Borrador | Identificador aplicable |
| sat-fraccion-xi-e-administracion-pm | Válido | Borrador | Identificador aplicable |
| sat-fraccion-xi-e-fideicomisos | Válido | Borrador | Identificador aplicable |
| sat-fraccion-xi-e-compraventa-entidades | Válido | Borrador | Identificador aplicable |
| sat-fraccion-xii-notarios-a | Válido | Borrador | Identificador; monto operativo no inferido |
| sat-fraccion-xii-notarios-b | Válido | Borrador | Identificador; monto; participantes por confirmar |
| sat-fraccion-xii-notarios-c | Válido | Borrador | Identificador; monto; participantes por confirmar |
| sat-fraccion-xii-notarios-d | Válido | Borrador | Identificador; monto; participantes por confirmar |
| sat-fraccion-xii-notarios-e | Válido | Borrador | Identificador; participantes por confirmar |
| sat-fraccion-xii-corredores-a | Válido | Borrador | Identificador; monto; participantes por confirmar |
| sat-fraccion-xii-corredores-c-compra-venta | Válido | Borrador | Identificador; monto; instrumento; participantes por confirmar |
| sat-fraccion-xii-corredores-c-fusion | Válido | Borrador | Identificador; monto; participantes por confirmar |
| sat-fraccion-xii-corredores-c-escision | Válido | Borrador | Monto; participantes por confirmar |
| sat-fraccion-xii-corredores-c-modif-patrimonial | Válido | Borrador | Identificador; monto; participantes por confirmar |
| sat-fraccion-xii-sp-poder | Válido | Borrador | Identificador; monto; participantes por confirmar |
| sat-fraccion-xii-sp-modif-patrimonial | Válido | Borrador | Identificador; monto operativo no inferido |
| sat-fraccion-xii-cesion-fideicomiso | Válido | Borrador | Identificador; monto; participantes por confirmar |
| sat-fraccion-xiii-donativos | Válido | Borrador | Identificador aplicable |
| sat-fraccion-xiv-comercio-exterior | Pedimento | Borrador | Cliente, identificador, fecha y monto no inferidos |
| sat-fraccion-xv-arrendamiento | Válido | Borrador | Divisa: conversión documentada pendiente |
| sat-fraccion-xvi-activos-virtuales | Válido | Borrador | Identificador; instrumento; participantes por confirmar |

Casos independientes añadidos:

- Persona moral y representante diferentes, fecha manual, transferencia y `$10,000,000.00` exactos.
- XI-B: celdas obsoletas de “Otro” eliminadas con activo distinto de `99`; rama virtual eliminada con instrumento distinto de `16`; `999999` conserva su descripción únicamente en la rama activa. Un monto virtual no se interpreta automáticamente como equivalente MXN.
- Conservación de la URL privada de una versión de evidencia de auditoría al recargar.
- Aviso con acuse, revisión de origen y conflicto de actualización.
- Permisos visuales de edición, carga, descarga, aprobación y archivo; búsqueda y navegación siguen disponibles en consulta.

### Correcciones y capitalización XML

El recorrido conectado XV descubrió que una edición podía conservar cero faltantes y, aun así, regenerar XML inválido por nombres, denominación y correo en minúsculas. La corrección convierte únicamente texto humano cuyo tipo y ruta exactos del XSD oficial lo permiten: sólo se usa el resultado en mayúsculas si satisface todas las restricciones y la entrada original no las satisfacía. No altera las celdas capturadas, no elimina caracteres ni acentos inválidos, y excluye hashes, wallets, cuentas e identificadores/referencias sensibles a mayúsculas. Las filas repetidas se identifican por ocurrencia para no compartir nombres. Regresiones específicas: **4/4**; XML/F4594: **5/5**. Los 39 XML previamente validados permanecen válidos e idénticos después de aplicar el normalizador.

QA local conectado, con organización/empresa y PDFs ficticios aislados: primera presentación documentada desde navegador; edición del asistente conserva ID e importe y cambia a corrección pendiente; el nuevo borrador tiene folio/sello/fechas vacíos y cero adjuntos; subir el acuse anterior se rechaza antes de guardarlo. Retirar un adjunto del borrador sólo retira su referencia. El acuse histórico sigue descargándose desde R2 privado con hash idéntico. Un intento directo de editar el presentado recibe `409 PRESENTED_SUBMISSION_IMMUTABLE`.

La confirmación positiva posterior se realizó desde navegador, después de **reconciliar el paquete mediante la API con el validador canónico del servidor** (no mediante la nueva compilación frontend): operación 3 → 4; nuevo aviso preparado en revisión 3 y origen presentado 4; folio y hash diferentes. El original permanece en su revisión 2, y ambos PDFs privados se descargan con código 200 y su SHA-256 original. Sigue separada la regresión de regeneración automática desde frontend tras la compilación final. Ninguno de estos pasos envía un aviso a SAT.

Ese recorrido también descubrió precarga indebida del RFC del cliente en cabeceras opcionales de Entidad Colegiada. Se retiró la inferencia genérica: RFC de sujeto obligado sólo en cabeceras mapeadas; RFC de cliente/representante/beneficiario sólo en su ámbito explícito. Pruebas independientes **2/2** conservan cuatro identidades distintas, cabecera vacía y un RFC de entidad capturado genuinamente. No se elimina ningún histórico por una coincidencia de RFC; el fixture aislado que expuso el fallo se conserva como evidencia y no como ejemplo aceptado.

### Reconocimiento estructural, independiente del nombre del archivo

`lib/pld/generated/sat-import-fingerprints.json` contiene las 40 entradas del catálogo, el hash del archivo fuente, hojas, rangos nombrados y 1,250 etiquetas fijas; tamaño aproximado 282 KB sin comprimir. Se genera con `pnpm exec tsx scripts/build-sat-import-fingerprints.ts` y admite `--check` para detectar desactualización. No contiene valores de personas ni importes capturados; las coordenadas de captura de los layouts se excluyen de las anclas.

El lector exige coincidencia exacta y única de estructura/rangos/etiquetas. Un nombre de archivo, texto parecido o primer resultado nunca elige una actividad. Devuelve `ambiguous` cuando hay varios candidatos y `unknown` sin evidencia suficiente. No ejecuta macros ni confiere autenticidad al documento.

XIV queda explícitamente en selección manual: el archivo cacheado `0-InformeEnCeros.xlsm` es genérico para múltiples actividades y no identifica la vía de pedimento. Se registra `autoDetect:false`, no una atribución automática a XIV. Hay 39 candidatos de reconocimiento automático.

Pruebas puras **4/4 aprobadas**: cobertura de las 40 entradas sin celdas capturables, archivo renombrado/datos editados, ambiguo/no SAT y rechazo de fórmulas o rangos ausentes. Además se comprobó la identificación de los XLSM originales I y XV mediante el lector real.

## Ejecuciones y pendientes de cierre

- Suite completa previa a actualizar las expectativas antiguas de demo: **295 pruebas, 292 aprobadas y 3 fallidas**. Las tres esperaban la antigua inyección masiva de 40 escenarios, F4594 o cuatro paquetes legacy, incompatibles con la demo guiada de tres operaciones. No eran evidencia de fallo XML de los 40 formatos.
- Las expectativas de demo se actualizan al contrato acordado: tres arrendamientos ficticios y un paquete normal vinculado V2. Los 40 casos sintéticos y el fixture F4594 permanecen como QA independiente, fuera de los datos de demostración.
- Nuevas pruebas de dominio/continuidad/operaciones/importación: **38/38 aprobadas**, incluida la lectura de los 40 layouts y casos de captura independientes. Los tres archivos que fallaban por expectativas antiguas de demo ahora pasan: flujo operativo **10/10**, escenarios SAT **4/4**, XML/F4594 **5/5**; total **19/19**. La suite de escenarios conserva su prueba de llenado de las 40 plantillas y preservación de macros.
- Después de los ajustes de Alta y capacitación se ejecutaron dominio/continuidad/checklist de Alta: **24/24 aprobadas**. Estas ejecuciones se solapan con la anterior; no se suman como pruebas diferentes. El reconocimiento estructural tiene la ejecución separada de **4/4** indicada arriba.
- Alta conectada se ancla a una sola empresa: RFC de solo lectura y precarga sin sustituir otros datos; un sujeto existente conserva su ID. Datos mezclados o corruptos quedan bloqueados para recuperación, sin eliminación en la lectura. Los ejemplos y la captura multi-sujeto permanecen exclusivos de demo. Guardados manuales, cargas y cierres documentales esperan confirmación de persistencia antes de mostrar éxito.
- TypeScript pasó con los últimos ajustes de importación, navegación, evidencias y fechas. Debe repetirse sobre el commit de publicación junto con la suite completa.
- `pnpm build` pasó en el árbol coordinado antes de los últimos ajustes anteriores; debe repetirse sobre el commit de publicación.
- Pendientes de aceptación: recorridos completos manuales de las 40 plantillas, comparación exhaustiva de celdas XLSM, permisos UI/API/archivos y concurrencia con roles y empresas distintas, importación en navegador, recuperación de versiones, preview Cloudflare y respaldo/restauración ensayados.

Los resultados de pruebas finales y de navegador se agregarán a esta bitácora antes de solicitar la aprobación del piloto. Ningún pendiente de esta tabla se considera aprobado por una prueba sintética verde.
