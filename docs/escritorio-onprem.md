# Plataforma PLD · Instalación en la infraestructura de la organización

Elija **un solo equipo servidor** que permanecerá encendido y se respaldará. Si se necesita acceso desde varios equipos, TI habilita una dirección HTTPS interna en ese servidor. En las demás computadoras se instala el mismo aplicativo y se elige **estación**. No se comparte el archivo de base de datos por red, no se instala una base por operador y no se envían expedientes a Cloudflare ni a Davara para operar esta edición.

| Equipo | Qué contiene | Qué solicita el asistente |
| --- | --- | --- |
| Servidor | Plataforma, API de autenticación y permisos, base SQLite y almacén privado de documentos. | Ubicación de datos; cuenta principal sólo si es una instalación nueva. Opcional: puerto y dominio corporativo. |
| Estación | Interfaz instalada; acceso al servidor y copia local limitada de trabajo autorizado. | Dirección HTTPS de la organización y autenticación individual. No solicita claves de base de datos. |

## 1. Recibir e instalar

TI debe obtener los artefactos por un canal autorizado y comprobar sus huellas contra una referencia de confianza independiente. `SHA256SUMS.txt` acompañado en el mismo paquete ayuda a detectar alteraciones o transferencias incompletas, pero por sí solo **no autentica al editor**.

- **macOS 13 o posterior:** abrir el archivo `Davara-PLD-…-mac-universal.pkg`, seguir el instalador de macOS y abrir **Davara PLD** en Aplicaciones. El paquete contiene los ejecutables Intel x86_64 y Apple Silicon arm64.
- **Windows x64:** ejecutar `Davara-PLD-…-windows-x64.exe` y seguir el asistente. Se instala para el usuario actual y crea una entrada en Inicio. No necesita un motor SQL preinstalado; no es un instalador nativo para Windows ARM.
- Esta entrega **no tiene certificado de publicación**: el PKG no tiene firma Developer ID Installer ni notarización; la app interna usa firma ad hoc. El EXE no tiene Authenticode de Davara. Si la política del equipo bloquea el paquete, TI debe gestionar la aprobación corporativa o solicitar una versión firmada. No se recomienda deshabilitar protecciones. Una firma comercial futura requiere certificados y un proceso de custodia aparte; no equivale a un SLA.

## 2. Primer inicio: servidor y cuenta principal

1. Abrir **Davara PLD** con la cuenta de sistema que custodiará el servicio y su llavero. Elegir la opción de servidor.
2. Conservar la ubicación recomendada o seleccionar **nueva base** en un volumen local protegido. El nombre predeterminado es `Datos PLD/plataforma.sqlite`, dentro del perfil de datos de la app. Si TI creó una base SQLite **vacía**, puede seleccionarla con la opción de enlazar existente. No se admiten DSN, PostgreSQL, SQL Server, MySQL ni carpetas compartidas SMB/NFS como motor de esta versión.
3. Para usar sólo ese equipo, conservar el puerto predeterminado **6731** y dejar vacío el dominio corporativo. Para habilitar estaciones, coordinar primero el DNS, el certificado y el proxy de la sección siguiente.
4. Escribir nombre, correo (será el usuario), contraseña de **11 a 128 caracteres** y confirmación. Guardar y abrir la plataforma. El primer administrador se crea localmente, sin una credencial de fábrica ni claves compartidas entre clientes.
5. Iniciar sesión, crear la organización y razones sociales, y asignar a cada usuario únicamente las empresas, módulos y acciones que le correspondan. Los permisos se verifican en el servidor. El superadministrador de esta instalación **no es** el administrador de una instalación web de Davara.

Al enlazar una base PLD **con cuentas**, se conservan esas identidades: no se crea ni se restablece el administrador mediante el asistente. Se necesitan su almacén documental y sus claves originales. Si la base seleccionada tiene un esquema incompatible o faltan el archivo o las claves esperadas, detenerse y revisar la selección. No sustituirla por una vacía para eludir el error.

## 3. Conectar estaciones de la organización

El servidor escucha sólo en `127.0.0.1:<puerto>`, no en toda la red. Para ofrecer `https://pld.empresa.mx` a las estaciones:

1. TI configura un nombre DNS y un certificado HTTPS válido y confiable en los equipos gestionados. Define quién accede por LAN/VPN, cortafuegos, permisos de disco y políticas de estación.
2. Instala un proxy inverso **en el equipo servidor**. Configura ese origen HTTPS exacto en las opciones avanzadas del asistente. El proxy reenvía **todas las rutas** a `http://127.0.0.1:6731` (o al puerto elegido), conservando el encabezado `Host` del dominio autorizado, incluido el puerto si no es el estándar. El servicio no confía en `X-Forwarded-Host` ni en `X-Forwarded-Proto` para elegir la identidad del servidor. No reescribir el origen del navegador ni desactivar la validación TLS. No registrar contenido de expedientes, cuerpos de solicitudes, cookies ni tokens.
3. Antes del alta de estaciones, comprobar desde una estación autorizada que `GET https://pld.empresa.mx/api/v1/health` responde JSON con `configured: true` y `distribution: "pld-onprem"`, sin redirecciones. El dominio no debe apuntar al piloto web.
4. En cada estación elegir conexión a la organización, escribir sólo el **origen HTTPS**, verificar conexión e iniciar sesión. No introducir una ruta, usuario o contraseña en la URL. Para revisar el vínculo más tarde: menú **Plataforma → Configurar conexión…**.

La cuenta del sistema que ejecuta el servidor debe tener acceso al volumen y su llavero. El proceso de escritorio **no se instala como un servicio del sistema**: al salir de la aplicación servidor o cerrar su sesión se pierde la conexión de las estaciones. Para continuidad operativa, TI debe acordar supervisión, mantenimiento y horarios antes de usar expedientes reales.

## 4. Trabajar sin conexión

**Servidor local:** conserva la base oficial y aplica las validaciones incluso sin Internet. **Estación desconectada del servidor:** conserva una copia de trabajo cifrada, no otra base oficial. Ninguno de los dos modos presenta avisos ante el SAT ni sustituye consultas externas.

Para usar una estación sin red, la persona debe haber iniciado sesión y abierto la empresa en línea. La autorización dura **hasta ocho horas desde su última verificación en el servidor**, sin superar la expiración conocida de la sesión. No permite el primer acceso ni cambiar de identidad sin red. Si se suspende una cuenta mientras está desconectada, la estación sólo puede conocer la suspensión al volver a verificar con el servidor o al vencer su autorización temporal. Al cerrar sesión sin red se elimina el acceso local; eso no confirma la revocación en otros equipos.

| Módulo o flujo | Al guardar sin conexión |
| --- | --- |
| Expedientes y clientes | Se ponen en cola las altas y ediciones ordinarias en la empresa sincronizada. Un adjunto embebido en un expediente identificable (por ejemplo, un PDF de identificación) puede viajar con el registro. La bandeja privada sin empresa no tiene esta función. |
| Actos y operaciones | Sólo borradores de captura, con identidad e importe válidos. Completar, presentar, corregir una presentación o cancelar exige al servidor. |
| EBR | Borradores individuales de metodología compatible e institucionales; no se sincronizan aprobaciones ni se sustituyen evaluaciones históricas aprobadas. |
| Capacitación | Cambios admitidos de planes, participantes, sesiones y seguimiento antes del cierre. No se autoaprueba el plan ni se actualiza su documentación aprobada. |
| Mapeos de importación | Se pueden conservar y sincronizar mapeos válidos de columnas en los módulos admitidos (Alta, Expediente, Actos y Evidencias). Importar archivos o ejecutar trabajos en lote requiere conexión. |
| Alta SAT | Captura ordinaria de identificación, contactos, actividades, representante o notas del mismo registro. Cambiar el sujeto, documentos o acuses no se confirma sin el servidor. |
| Auditoría y Gobernanza | Auditoría admite planes pendientes o en seguimiento, no cierres ni reaperturas. En un cuestionario de Gobernanza abierto se admiten notas y planes de acción; no respuestas aprobatorias, firmas ni cierre. |
| Avisos, Beneficiario, WhoIs PEP y Evidencias | Consulta de los registros previamente sincronizados y permitidos. En estos módulos, una **copia de recuperación** confirmada permite revisar o reintentar una captura en línea; no equivale a una presentación, aprobación, acuse, consulta de fuentes ni evidencia aceptada. |
| Administración | Crear cuentas o empresas, cambiar privilegios y acceder a sesiones requiere conexión. Los cambios de rol se verifican de nuevo al reconectar. |

**Pendiente de sincronizar** significa que el equipo conserva el borrador, no que el servidor lo aceptó. Mientras la estación está abierta reintenta automáticamente; también se puede pulsar **Sincronizar ahora**. Revalida el usuario, empresa, permisos y revisión inicial. Con un adjunto embebido compatible, la referencia del expediente se transforma en una versión privada en el servidor; se comprueban identidad del archivo, tamaño y huella. Un reintento después de perder la confirmación no crea otra versión para el mismo destino y contenido. Una copia local no marca un documento como revisado ni aprobado. Si hay **Cambios por revisar**, comparar las dos versiones en Sincronización; no se sobrescribe el registro central.

**Copia de recuperación** significa otra cosa: es trabajo protegido para revisión manual. Por ejemplo, si un archivo se subió por separado y se perdió la conexión, la estación no puede saber a qué versión debe vincularlo. En **Sincronización → Copias de recuperación de esta empresa**, recuperar o descargar el original en un destino corporativo autorizado, comparar con el historial del servidor y adjuntarlo manualmente sólo si falta. Para lotes admitidos se ofrece **Revalidar y enviar**; para las demás decisiones se regresa al flujo correspondiente en línea. No archivar ni borrar una copia hasta verificar el resultado y su asociación.

Límites por archivo: hasta 20 MB y formatos admitidos por el servidor (PDF, imágenes compatibles, Office, CSV, TXT, JSON o XML). El paquete completo debe caber en el almacén local; los adjuntos embebidos para autoenvío deben estar codificados en base64 y tener un tipo reconocido. Si se agota la capacidad, la aplicación no debe dar el borrador por guardado: conservar el original y recuperar la conexión. El respaldo central **no contiene los pendientes locales**: no borrar el perfil, reinstalar ni cambiar de equipo con pendientes.

### Matriz de comprobación de permisos

El recorrido reproducible `pnpm --dir desktop exec electron qa/station-offline.cjs` usa una instalación y cuentas ficticias: verifica los **11 módulos** del contrato (Alta, Expedientes, Actos, Avisos, EBR, PEP, Beneficiario, Evidencias, Capacitación, Auditoría y Gobernanza) contra las **seis acciones** de la API: consultar, editar, cargar, descargar, aprobar y archivar. El superadministrador está autorizado para las seis en su instalación. La capturista de prueba tiene sólo consulta/edición/carga/descarga en Expedientes y consulta en Actos; todas las demás combinaciones se deniegan, incluida la consulta de una empresa no asignada. Es una prueba de autorización, no una afirmación de que las seis acciones se puedan ejecutar sin conexión. El mismo recorrido corta la red realmente, prueba la reapertura de un expediente, el conflicto entre dos ediciones y la descarga del PDF privado después de perder el primer acuse de subida.

## 5. Protección y recuperación

La base SQLite **central** y los objetos documentales **no incorporan cifrado transparente propio en reposo**. Proteja el volumen y sus copias con FileVault/BitLocker o el control corporativo equivalente, restrinja permisos de archivos al custodio y gestione las claves con TI. La clave del servidor sí utiliza el almacén seguro del sistema (Llavero de macOS o DPAPI en Windows). La bóveda de borradores en la estación es un mecanismo independiente y cifra su contenido local.

**Copia en frío, sin expedientes en tránsito:**

1. Coordinar una ventana, confirmar que las estaciones sincronizaron sus pendientes y cerrar limpiamente la aplicación del servidor. No copiar únicamente un SQLite abierto; los archivos auxiliares `-wal` y `-shm` pueden formar parte de su estado. Cuando existan, conservar el conjunto con el mismo punto temporal.
2. Copiar la **base** y el directorio hermano completo **`<nombre-de-base>.pld/`**: contiene `archivos/` con las evidencias y su marcador de identidad (incluidos archivos ocultos), y `host-key.json` con la clave protegida. Respaldar el perfil de la aplicación (incluido `installation.json`) y, con las herramientas de TI, el perfil/llavero de la cuenta del SO capaz de descifrar la clave. Proteger la copia y su mecanismo de recuperación con custodia autorizada y separada. Una copia de `host-key.json` **no convierte la clave en portable**.
3. Conservar la versión del instalador, ambos SBOM, el manifiesto y las huellas. Comprobar integridad y ensayar la recuperación **antes** de dar por aprobada una política de respaldo.
4. Restaurar en un entorno aislado, con la aplicación apagada, misma versión compatible y acceso acreditado al material de claves. Reponer el conjunto sin mezclar archivos de otras instalaciones; ajustar la ruta con **enlazar existente** si procede. Un cambio de equipo o cuenta puede impedir el descifrado aunque se conserven todos los archivos; no se promete portabilidad del llavero.
5. Verificar acceso con una cuenta existente, recuentos por empresa, descarga y huella de un documento de muestra, y que otra empresa no pueda acceder a él. Registrar sólo identificadores técnicos y resultados; no incluir documentos ni contraseñas. Si falla cualquier control, preservar la copia original y no sustituir el servidor activo.

## 6. Construcción y trazabilidad del instalador

En `codex/app-electron-onprem`, el flujo **Instaladores PLD** construye por separado en runners nativos de macOS y Windows; también se puede invocar manualmente cuando GitHub habilite esa modalidad para la rama. No despliega a Cloudflare ni publica un Release. Cada artefacto se identifica por destino y SHA de Git. La retención de Actions es de 14 días: TI debe custodiar fuera de GitHub la entrega aceptada.

Desde un checkout del commit deseado, con Node 24 y pnpm 10.11.0:

```sh
pnpm install --frozen-lockfile
pnpm --dir desktop install --frozen-lockfile
pnpm --dir desktop run prepare:resources
# macOS con las herramientas de desarrollo de Apple
pnpm --dir desktop run package:mac
# Windows x64 con NSIS disponible
pnpm --dir desktop run package:win
```

Las salidas de cada destino se encuentran en `desktop/release/mac/` y `desktop/release/win/`. Entregar **únicamente** el instalador, los dos `SBOM-*.cdx.json`, `MANIFIESTO-compilacion.json` y `SHA256SUMS.txt`, nunca perfiles de usuario, llaveros, bases ni las carpetas de trabajo de compilación. El SBOM de servidor/interfaz identifica las dependencias empaquetadas en los bundles; el de escritorio enumera Electron y runtimes embebidos. No son certificaciones de cumplimiento ni un inventario del sistema operativo del cliente.

CI prueba el adaptador y el asistente, verifica huellas y ejecuta el flujo del primer administrador sobre el programa extraído del PKG o instalado desde el EXE. Un resultado válido para un destino no sustituye el del otro ni la aceptación por TI en su infraestructura.
