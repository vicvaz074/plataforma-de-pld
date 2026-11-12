# API del piloto PLD

El Worker sirve el export estático y `/api/*` bajo el mismo origen. D1 conserva cuentas, permisos, datos, revisiones y auditoría. R2 conserva archivos/versiones privados; no se guarda base64 dentro de D1. Recursos y secretos de preview/producción se configuran por separado.

## Instalación

1. Crear D1, R2 y las colas principal/de fallos de cada entorno; sustituir los identificadores de configuración de `wrangler.worker.jsonc`.
2. Aplicar `pnpm exec wrangler d1 migrations apply <nombre> -c wrangler.worker.jsonc --env preview --remote` (local: `--local --env=''`).
3. Configurar `BETTER_AUTH_URL` al origen HTTPS real y secretos `BETTER_AUTH_SECRET` (al menos 32 caracteres) y `BOOTSTRAP_TOKEN` (al menos 32 caracteres) por el canal seguro de Wrangler. Nunca publicarlos en Git ni en el frontend.
4. El superadministrador inicial se crea una sola vez con `POST /api/v1/bootstrap`, cabecera `Authorization: Bearer <BOOTSTRAP_TOKEN>` y `{email,name,password}`. La contraseña debe tener entre 11 y 128 caracteres, sin recorte ni normalización adicional de la aplicación; se conserva el hashing existente de Better Auth. Cuando existe `BOOTSTRAP_EMAIL`, el correo debe coincidir con ese titular. El endpoint se cierra cuando existe cualquier cuenta; retirar el secreto de instalación después. La contraseña la elige el titular durante la activación; no hay contraseña inicial publicada ni cuenta creada automáticamente.
5. Compilar frontend, verificar Worker mediante `pnpm exec wrangler deploy -c wrangler.worker.jsonc --dry-run --env preview` y validar preview antes de promover. Pages usa el `wrangler.jsonc` raíz y `out/_worker.js`: reenvía `/api` y `/api/*` por el service binding `API`, sin cambiar origen, cookies ni encabezados. El resto permanece estático. El backend conserva los layouts SAT mediante su binding `ASSETS`. El acceso de preview utiliza exclusivamente el alias real asignado por Pages `https://codex-piloto-real-multiempre.plataforma-de-pld.pages.dev`, que coincide con `BETTER_AUTH_URL`; Pages trunca el nombre de la rama. Los URLs únicos de cada despliegue no son orígenes de sesión autorizados.

`GET /api/v1/health` devuelve `{mode:'cloud',configured,environment}`. No afirma aceptación normativa ni disponibilidad de recursos remotos no comprobados.

## Sesión y cuentas

- Better Auth 1.7.20, Kysely/D1; `POST /api/auth/sign-in/email {email,password}` y `/sign-out`. Sesión HttpOnly, revocable, sin caché cliente de autorizaciones.
- `GET /api/v1/session`: `{user,organizations,companies,memberships,grants,mfaRequired}`. `user` contiene sólo `id,name,email,platformRole,status,requiresPasswordChange,twoFactorEnabled`.
- `/api/auth/change-password {currentPassword,newPassword,revokeOtherSessions}` elimina la exigencia de contraseña temporal sólo después de una respuesta exitosa del servicio de identidad.
- Cuentas suspendidas y usuarios con cambio pendiente no pueden operar con datos. Todos los guards consultan el estado y permisos vigentes.
- MFA empieza apagado. Sólo el supremo modifica la política de organización; al activarla se revocan sesiones del resto de sus miembros. El superadministrador también debe enrolarse cuando cualquier organización requiere MFA. Los usuarios configuran TOTP mediante Better Auth; mientras falte enrolamiento el API de datos devuelve `MFA_ENROLLMENT_REQUIRED`. Al verificar la configuración se conserva la sesión verificada rotada y se revocan las anteriores. No hay envío de correo ni SMS.
- Registro público y recuperación pública están cerrados: las cuentas y restablecimientos se administran en plataforma. No se anuncian correos enviados.
- `GET /api/v1/profile` devuelve `{user,preferences:{language,theme,notifications}}`. `PATCH {name?,preferences?}` modifica únicamente nombre y preferencias propios; rechaza claves o valores ajenos a ese contrato.
- `GET /api/v1/profile/sessions` lista `{sessions:[{id,createdAt,updatedAt,expiresAt,userAgent,current}]}`, nunca tokens. `DELETE {sessionId?}` revoca una sesión o, sin ID, las demás sesiones del usuario.

## Administración

`GET /api/v1/admin` devuelve `{organizations,companies,users,memberships,grants,audit}`. Un administrador ve sólo sus organizaciones. Las cuentas no incluyen hashes ni tokens de sesión.

| Ruta | Método y entrada | Resultado |
|---|---|---|
| `/organizations` | POST `{name}` (supremo) | Organización con MFA apagado |
| `/organizations/:id` | PATCH `{name?,mfaEnabled?}` | Sólo supremo cambia MFA |
| `/companies` | POST `{organizationId,name,rfc}` | Empresa activa |
| `/companies/:id` | PATCH `{name?,rfc?,status:'active'\|'archived'}` | RFC inicial validado; no cambio de identidad con historial. Archivo reversible, no borrado en cascada |
| `/users` | POST `{organizationId,name,email,role,companyIds,initialPassword?}` | Omitida: `{user,temporaryPassword}` aleatoria, mostrada una sola vez. Elegida: `{user,initialPasswordSet:true}`, sin devolver la contraseña. Siempre exige cambio al primer ingreso |
| `/users/:id` | PATCH `{organizationId,name?,status?,role?}` | Actualiza cuenta y revoca sesiones |
| `/users/:id/reset-password` | POST `{organizationId}` | Contraseña temporal nueva, cambio obligatorio y sesiones revocadas |
| `/users/:id/sessions` | GET `?organizationId=...` | Metadatos de sesiones, sin tokens |
| `/users/:id/sessions` | DELETE `{organizationId,sessionId?}` | Revoca una o todas las sesiones del usuario administrable |
| `/grants` | PUT `{organizationId,userId,companyId,role?,permissions}` | Permisos por módulo y acción |
| `/grants` | DELETE `{organizationId,userId,companyId}` | Revocación inmediata |

Roles organizativos: `admin`, `compliance`, `capture`, `viewer`. Sólo el supremo crea/modifica administradores. Un administrador no puede resetear cuentas con alcances administrativos o ajenos a su ámbito. Al crear una cuenta se materializan los permisos del perfil; en un grant existente, omitir un módulo o asignarle `[]` lo niega. `{}` revoca el acceso a todos los módulos.

`initialPassword`, cuando se proporciona, debe ser una cadena de entre 11 y 128 caracteres. La aplicación no añade recorte ni normalización antes del hashing existente de Better Auth (que conserva su tratamiento Unicode); no la devuelve ni la incluye en auditoría. El formulario sólo la mantiene durante la captura y la descarta al cerrar o completar la solicitud. La misma política de longitud se aplica a activación y cambio propio de contraseña; omitir la contraseña inicial mantiene el flujo temporal aleatorio.

## Datos e inbox

`GET /api/v1/companies/:id/snapshot` devuelve `{company,records}`. Sólo incluye colecciones cuya lectura está concedida. `GET /companies/:id/records?collection=...` aplica el mismo guard.

`POST /companies/:id/records/batch` recibe:

```json
{"mutations":[{"collection":"kyc_expedientes_detalle","id":"eui-id","expectedRevision":0,"payload":{"expedienteId":"eui-id"},"deleted":false}]}
```

Entre 1 y 100 cambios de entrada. Revisión cero crea; el resto debe coincidir. El servidor comprueba revisiones dentro de la transacción D1: un conflicto devuelve `409 REVISION_CONFLICT` y revierte todo el lote. Cada cambio genera una revisión histórica inmutable y auditoría. Datos financieros usan centavos; el sujeto de la operación se impone desde la empresa autenticada. EBR aprobado y presentación/revisión documental exigen permiso de aprobación; el resultado EBR se recalcula en servidor.

Alta valida que los RFC capturados correspondan a la empresa activa, pero conserva IDs legacy de sujetos dentro de su ámbito. `pld-tenants` y la selección activa no permiten introducir una empresa ajena. Una cancelación por edición exige el mismo permiso `archive` que la eliminación, más motivo. Las evidencias mantienen versiones previas en el servidor: una sustitución reinicia revisión, la aprobación exige URL R2/hash del ámbito y actor/fecha auténticos; booleanos de aprobación alternativos no son autoridad. Las diferencias de recálculo de operaciones ya presentadas se auditan y devuelven como advertencia, sin modificar silenciosamente su snapshot histórico.

Los cambios de cierre/reapertura de Gobernanza, Capacitación, registros/observaciones/planes de Auditoría y checklist final requieren `approve`; conservar un cierre previo sin modificarlo no bloquea una edición de datos autorizada. EBR individual e institucional recalculan resultados, historial y plan de revisión mediante el mismo motor compartido, y no pueden aprobarse omitiendo el plan.

En Auditoría, fechas de calendario (`date`, `deadline`, `followUpDue`, recepción/vencimiento/respuesta) se conservan como `YYYY-MM-DD` al guardar. El lector acepta ISO legacy conservando el día escrito, sin convertirlo por UTC; carga, creación y bitácora mantienen sus instantes ISO completos. Captura, recarga, CSV y PDF usan el mismo helper de calendario. No se modifican reglas ni cómputos de plazos.

La migración EBR v1/v2 conserva el payload y metodología originales íntegros en `legacySnapshot`/`historicalRiskSummary`, con contenedor v3 en borrador, `needsMigrationReview` y advertencia; no transforma un resultado histórico en aprobación vigente ni lo usa como riesgo actual. La aprobación exige nueva transición explícita con cuestionario, fuentes, metodología y seguimiento versionados.

Los controles, factores y acciones cerradas EBR usan `evidence:{fileVersionId,documentId?,sha256,downloadUrl,fileName}`. El API consulta D1 por empresa/hash, comprueba permiso de descarga del módulo original y existencia/tamaño de R2, y reconstruye la referencia; no visita URLs externas. Una cita libre queda como referencia manual, no soporte para mitigación/aprobación. Las versiones rechazadas o archivadas no sostienen una revisión vigente. Se sellan actor/fecha reales de revisión y registro de fuentes; `consultedAt` conserva la fecha de consulta manual reportada. La aprobación/rechazo de Evidencias actualiza también el estado de la versión documental en la misma transacción y exige permiso de aprobación de su módulo original.

Un aviso presentado es inmutable (incluido su acuse). La corrección usa workflow schema2 nuevo `submission-<operationId>-r<preparedOperationRevision>`, `correctionOf` al último presentado y `previousOperationRevision` histórico. Al confirmar se verifica un paquete localmente válido cuya revisión de origen sea exactamente la operación previa, sin permitir cambiar datos de captura en ese mismo evento. La operación incrementa su revisión y el workflow conserva `preparedOperationRevision` mientras `sourceOperationRevision` pasa a la posterior. El acuse de la corrección debe ser nuevo (no un hash anterior), y se conserva la referencia a la revisión del paquete preparado. Estos controles documentan una presentación; no verifican autenticidad ante SAT ni transmiten XML.

La operación reportable genera su paquete determinista `satpkg-<operationId>` en la misma transacción. Eliminar una operación retira su paquete vinculado; las presentadas no pueden eliminarse. Los paquetes no admiten un origen ajeno o inexistente. Los paquetes enviados por cliente se reconstruyen desde la operación.

Una referencia nueva de operación a EUI exige ID exacto existente en la empresa y permiso de lectura de Expedientes; se admite crear el EUI en el mismo lote con sus permisos y CAS propios. Un enlace histórico sin cambios conserva su snapshot y no se invalida porque el EUI se archive después. No se resuelven referencias por coincidencias de RFC.

Las importaciones completas requieren `importClientResolution:{kind:'client'|'expediente'|'provisional',id,client?}`. El cliente existente se resuelve por índice del ámbito o por snapshot de operación accesible con ese clienteId exacto; un usuario sólo de Operaciones no recibe datos adicionales de un índice EUI restringido. El provisional exige UUID y snapshot explícitos y crea un único registro de índice por grupo como cambio derivado, sin conceder edición de Expedientes. Las dependencias se comprueban dentro de la transacción para no vincular una referencia cambiada concurrentemente. Los borradores pueden conservar propuestas no resueltas y los clientes manuales standalone no requieren inventar un EUI.

Al guardar una captura completa se valida el layout aplicable, los identificadores, los catálogos y las ramas activas en el servidor. Un array `satMissingRequiredFields:[]` enviado por el navegador no constituye validación. Las ramas inactivas se excluyen de la salida. El recálculo cronológico puede devolver revisiones adicionales de operaciones y paquetes afectados; el cliente debe incorporarlas al caché. Una presentación nueva exige acuse R2 de esta empresa, hash coincidente, folio, sello, fechas y revisión vinculada; no basta cambiar un booleano.

`POST /companies/:id/authorize {moduleKey,action}` revalida el permiso actual antes de una acción de interfaz, incluidas descargas generadas en cliente, y registra auditoría sin contenidos. Devuelve `{authorized:true,companyId,moduleKey,action}` o deniega por permisos vigentes. No sustituye los guards propios de cada endpoint ni la autorización de archivos.

`GET /companies/:id/records/:collection/:recordId/history` consulta revisiones sin permitir reescribirlas. Las llaves legacy sirven como nombres de colección; no son autorización por RFC.

`GET /organizations/:id/inbox` y `POST /organizations/:id/inbox/records/batch` conservan expedientes sin sujeto en una bandeja privada del usuario (accesible también al administrador de organización). Su ámbito virtual `inbox:<orgId>:<userId>` no aparece entre las empresas. Sólo admite colecciones de expedientes; los archivos usan las mismas rutas privadas de archivo con ese ID codificado.

`POST /companies/:targetId/expedientes/copy {sourceCompanyId,expedienteId,expectedRevision}` reutiliza explícitamente un EUI privado dentro de la misma organización. `expectedRevision` es la revisión del origen; el destino debe no existir (409 si ya existe, sin mezclas por RFC). Requiere lectura del origen/edición del destino y, cuando hay archivos, descarga del origen/carga del destino. Conserva el original y su historial, copia las revisiones históricas al destino y agrega una revisión vinculada a la empresa. Cada documento referenciado conserva todas sus versiones mediante objetos R2 nuevos, URLs privadas del destino y estado de revisión pendiente. La publicación de metadatos, historial y EUI es atómica; objetos provisionales se retiran ante fallos. Devuelve `{company,records,copiedFrom}`. Límite de copia interactiva: 100 revisiones y 50 versiones de archivos; volúmenes mayores requieren migración asistida, no un éxito parcial.

## Archivos y versiones

- `POST /companies/:id/files`: multipart `file,moduleKey,title?,documentId?,expectedRevision?,relatedType?,relatedId?`. Hasta 20 MB. Valida extensión, firmas básicas y permisos. No ejecuta macros. Su estado inicial `pending` requiere revisión humana.
- Respuesta `{id,documentId,version,revision,sha256,fileName,mimeType,size,status,createdAt,downloadUrl,...}`.
- `GET /companies/:id/files`: metadatos de versiones autorizadas (hasta 1000 por consulta).
- `GET /companies/:id/files/:versionId`: archivo privado con guard de descarga, headers privados y evento de auditoría.
- Las descargas conservan nombre Unicode en metadatos y lo expresan en `filename*=UTF-8''...`, con alternativa ASCII segura; no pasan caracteres no Latin-1 crudos a las cabeceras HTTP.
- `PATCH .../:versionId {status:'approved'|'rejected'|'archived',reason?}`. Aprobar/rechazar requiere `approve`; archivar, `archive`.
- `POST .../:versionId/restore {expectedRevision}` crea una nueva versión pendiente. Ninguna sustitución sobrescribe los bytes anteriores.

Se carga el objeto antes de publicar su referencia; si falla la transacción de metadatos se retira únicamente ese objeto provisional. Las aprobaciones identifican versión/hash.

## Importaciones en cola

- `POST /companies/:id/imports {fileVersionId,idempotencyKey,activityKey?}` registra job y outbox en D1. La actividad se valida y conserva para resolver formatos ambiguos. Repetir la clave devuelve el mismo job.
- `GET /companies/:id/imports` lista trabajos; `GET .../:jobId` muestra estado y resumen; `GET .../:jobId/preview` devuelve candidatos sólo cuando el trabajo está listo.
- La cola procesa XLSX/XLSM/CSV sin ejecutar macros; conserva original y resultados. Se verifica nuevamente acceso al procesar. Un XLSM reconocido utiliza su layout publicado como recurso estático.
- Los candidatos no son operaciones guardadas ni avisos presentados. La selección explícita de filas se guarda mediante el mismo lote de registros validado. Los PDF digitales se extraen en el cliente y pasan a revisión; el backend no afirma disponer de OCR para imágenes.
- Outbox con redistribución programada, trabajos idempotentes y reintentos acotados; un fallo queda visible. D1 guarda resúmenes; la vista previa completa se conserva en R2 privado para evitar límites por fila SQL.

## Verificación y límites

### Respaldo privado y recuperación no destructiva

Sólo el superadministrador puede usar `/companies/:id/backups`. `POST {}` crea un manifiesto privado, con snapshot transaccional de registros/historial/documentos y una copia independiente de cada versión R2, verificando hashes. No incluye tablas de usuarios, cuentas, sesiones, contraseñas ni hashes de credenciales. `GET` lista metadatos; `GET /:backupId` descarga el manifiesto bajo sesión autorizada. Los objetos no son públicos. Límites interactivos: 50 versiones, 100 MB de archivos y 20 MB de manifiesto.

`POST /:backupId/restore {confirmCompanyId,expectedRevisions:[{collection,id,revision}],fileVersionIds:[]}` recupera sólo registros seleccionados ausentes o con tombstone, usando CAS y los mismos validadores del módulo. Los registros activos no se sobrescriben. Las operaciones alguna vez presentadas, paquetes y presentaciones requieren revisión manual; no se restauran fuera de su revisión. Una versión R2 faltante se recupera en un objeto nuevo conservando URL privada/ID/hash; no se sustituye un objeto existente con contenido distinto.

Devuelve `{scope:'non-destructive-recovery',records,filesRecovered,skipped,fullDisasterRecovery:false}`. La recuperación de archivos y el lote de registros son etapas separadas: si la segunda falla, la respuesta de error informa los archivos ya recuperados y no anuncia éxito de los registros. El ensayo de integración elimina únicamente un PDF ficticio de su R2 local y un EUI ficticio, comprueba conflicto de revisión, recupera ambos y prueba que una segunda ejecución no sobrescriba registros activos. Este mecanismo **no es DR integral**, no revierte en bloque una empresa productiva y no protege contra pérdida simultánea de toda la cuenta/bucket. Se requiere un respaldo externo administrado antes de una liberación productiva.

`tests/pilot-server.integration.test.ts` ejecuta el Worker compilado en Miniflare con D1, R2 y cola reales locales: aislamiento entre organizaciones/empresas, credenciales temporales, carrera de dos escritores, rollback de lote, historial, inbox privado, versiones, grants parciales/vacíos, descargas, job de importación, SAT autoritativo, operación/paquete atómicos, EBR incompleto, MFA TOTP/recuperación y revocación de sesiones. No sustituye los recorridos de 40 plantillas ni una aceptación SAT. Los límites pendientes del piloto deben conservarse en la matriz de aceptación: estas pruebas no acreditan toda la normativa ni todos los recorridos.

Fuentes técnicas consultadas 11/11/2026: [Better Auth / D1](https://better-auth.com/docs/adapters/other-relational-databases), [Better Auth TOTP](https://better-auth.com/docs/plugins/2fa), [Cloudflare D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Worker y assets](https://developers.cloudflare.com/workers/static-assets/binding/). Autenticación Kysely/D1 usa `transaction:false` porque el dialecto no admite BEGIN; las escrituras de negocio y administración usan transacciones D1 `batch` con guards.
