# EBR e importaciones: contratos y validación del piloto

Consulta normativa: 11 de noviembre de 2026. Fuente primaria: [Acuerdo 115/2026, DOF](https://dof.gob.mx/nota_detalle_popup.php?codigo=5795797), capítulos II Quáter, III Bis y III Ter. La metodología interna no presenta sus ponderaciones como porcentajes impuestos por SAT. Su adopción y sus fuentes deben documentarse.

## Contratos

- `ebr_evaluaciones` conserva la llave existente y los IDs de cliente/expediente. El esquema actual registra borrador, revisión o aprobación, metodología, fuentes, perfil transaccional, controles, planes y snapshots de cada revisión.
- `ebr-institutional-assessment` conserva la evaluación institucional independiente de la empresa, sus fuentes, adopción, revisión y plan. Guardarla no modifica la evaluación de un cliente.
- Las evaluaciones históricas conservan su metodología y resultado original; no se convierten en una nueva aprobación vigente por una lectura o migración. Las identidades estables prevalecen sobre RFC/CURP/NIF compartidos.
- Las versiones de evidencia contienen `fileVersionId`, `documentId`, SHA-256 y URL privada canónica. Las referencias externas históricas se conservan, pero no cuentan como soporte recuperable para factores, mitigación ni cierre. La API verifica ámbito, permiso, existencia y hash, y registra al actor autenticado.
- `actividades_vulnerables_operaciones` mantiene V3, centavos canónicos, filas y valores originales de importación. Una fecha inválida queda vacía y pendiente, nunca se sustituye por la fecha técnica de creación.
- Historial y mapeos de importación usan `pld-import-history` / `pld-import-mappings` para operaciones y sufijos `-registro`, `-expedientes` o `-evidencias` para los otros módulos, con permisos del destino.

## EBR

Las respuestas nuevas comienzan sin evaluar. Las verificaciones geográfica y de comportamiento deben ser explícitas; lo desconocido no equivale a riesgo bajo. El perfil esperado se compara con operaciones activas completas por centavos exactos, sin confundir una alerta transaccional con la obligación monetaria de aviso.

Las gráficas y el PDF comparten los puntajes y denominadores efectivos: factores individuales, cuestionarios, riesgo institucional inherente/residual, historial aprobado y distribución por empresa. El resultado preliminar se distingue de la aprobación. Las reducciones requieren controles revisados y soporte recuperable; no anulan condiciones de riesgo obligatorio.

La empresa elige la próxima fecha de revisión. Las acciones conservan responsable, fecha, estado y evidencia de cierre; el producto no inventa un plazo normativo. Cambiar un soporte reinicia la revisión del control o reabre la acción. Volver a seleccionar la misma versión no elimina una revisión existente.

## Importación

Se leen XLSX/XLSM/CSV sin ejecutar macros ni ActiveX. El lector limita tamaño original/expandido y filas; CSV admite UTF-8 y Windows-1252. Se conserva el archivo original privado y la referencia de hoja/fila o página PDF. Las filas vacías no desplazan las referencias.

La huella técnica identifica libros renombrados mediante hojas, rangos nombrados y etiquetas fijas exactas, excluyendo celdas de captura. El manifiesto tiene 40 entradas; 39 son candidatas de autodetección. La entrada de XIV corresponde a un libro genérico de informe en ceros y exige selección explícita: no identifica por sí misma XIV ni fabrica un aviso ordinario o pedimento. Una coincidencia ambigua exige elegir formato. La identificación estructural no acredita autenticidad ni aceptación del SAT.

Las tablas propias permiten mapear encabezados y recuperar el mapeo. Los incompletos sólo se guardan como borradores; reintentos se comparan por IDs deterministas, incluyendo un preview de cola previamente generado. Los PDF digitales generan sugerencias con página y revisión humana. Un PDF sin texto no genera datos: se informa que requiere OCR/captura manual.

Toda operación importada requiere resolver el cliente explícitamente antes de quedar completa. El preview permite elegir EUI/cliente por ID, aplicar el vínculo a las filas seleccionadas o crear intencionalmente un grupo provisional con UUID. Ese grupo se conserva en el índice canónico para reutilizarlo entre archivos. Las columnas `clienteId` y `expedienteId` sólo se aceptan cuando el ID existe en el ámbito autorizado. Los clientes visibles desde operaciones pueden reutilizarse sin obtener por ello acceso adicional al expediente. No se fusionan clientes por RFC ni se asigna un cliente nuevo por cada fila: varias filas del mismo ID acumulan, mientras dos IDs distintos con igual RFC permanecen separados.

## Evidencia de QA local

Todas las personas, empresas y documentos utilizados fueron ficticios y exclusivos de QA local; no se presentaron avisos al SAT.

| Recorrido | Resultado observado |
| --- | --- |
| EBR vacío → guardar borrador → recargar | Pendiente; no `riskSummary` aprobado; datos conservados. |
| EBR con planes, fuentes y controles | Revisión e historial persistentes. Cierre sin evidencia bloqueado. |
| Evidencia desde picker/carga privada | Aprobación por UI; actor del servidor; descarga privada 200; SHA-256 del cuerpo igual al registrado. |
| Evaluación institucional independiente | Cambió su revisión sin cambiar revisión ni plan del cliente. |
| CSV de $10,000,000.00 | `montoCentavos = 1000000000`, sin decrementos; borrador si falta formato SAT. |
| Fecha `2026-02-30` | `fechaOperacion = ''`, `periodo = ''`, pendiente; original conservado. |
| Reimportar el mismo archivo | Preview de duplicados; cero seleccionadas y guardar deshabilitado. |
| PDF digital → expediente | RFC sugerido, nombre corregido manualmente, original conservado; no fusionó dos expedientes con igual RFC. |
| PDF sin texto | Aviso de OCR/captura manual; guardar deshabilitado. |
| XLSM XV renombrado → cola → guardar | Lectura y paquete verificados: 4 hojas, 29 rangos, 32 etiquetas, 54 campos SAT y RFC del sujeto coincidente. La comprobación final del nuevo paso de resolución explícita queda pendiente del siguiente build. |
| Operación importada → Bandeja SAT | Visible al navegar, con paquete listo para revisión; no presentación ficticia. |

Verificaciones dedicadas: `tests/pld-ebr-assessment.test.ts`, `tests/pld-import-operations.test.ts`, `tests/pld-import-client-resolution.test.ts`, `tests/pld-integration-records.test.ts`, `tests/pld-sat-import-fingerprint.test.ts` y regresión de RFC del sujeto incompatible. TypeScript se comprobó adicionalmente. Estas verificaciones no sustituyen la matriz completa del piloto, la validación XSD ni la aceptación de SAT.
