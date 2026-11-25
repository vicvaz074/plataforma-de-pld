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

## 4. Qué se puede guardar sin red

- El equipo servidor puede trabajar en modo local sin Internet. Esto no presenta avisos al SAT ni sustituye consultas o trámites externos.
- En una estación se requiere un inicio de sesión previo y una empresa ya abierta con acceso vigente. Se puede consultar la copia autorizada y poner en cola altas/cambios de clientes y expedientes, **borradores** de operación y EBR, cambios de capacitación sin cierre/aprobación y mapeos de importación admitidos. La autorización desconectada es temporal (hasta ocho horas y nunca después de la expiración conocida de la sesión). No existe inicio de sesión inicial ni alta de usuarios sin conexión.
- **Pendiente** no significa guardado en el servidor. Al reconectar se comprueban la sesión, empresa, permisos y la revisión de cada cambio. Si la versión central difiere, se conserva el conflicto sin sobrescribir automáticamente. Resolverlo y verificar que el contador de pendientes llegue a cero.
- No hay sincronización offline completa de archivos ni de todos los módulos. Una copia recuperable en la estación **no acredita** una carga de evidencia, una importación terminada ni una acción administrativa en el servidor. Conservar el original y revisar los pendientes al reconectar. La copia de la estación no sustituye su respaldo y los borradores aún no sincronizados no estarán en la copia central. Evitar borrar el perfil, reinstalar o cambiar de máquina con pendientes.

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
