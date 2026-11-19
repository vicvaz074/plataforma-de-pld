# Recuperación local de una copia independiente por empresa

**Alcance:** ensayo técnico reproducible de recuperación de datos del piloto, no autorización para recibir expedientes reales. El respaldo privado de la interfaz conserva su manifiesto y binarios dentro de la misma cuenta. El archivo portable de este procedimiento contiene **ambos**; una vez bajo custodia independiente, su lectura no depende de D1, R2 ni de una sesión en el Worker de origen. No existe un nuevo endpoint, conexión remota ni función de importación a producción.

## Procedimiento del operador

1. Con autorización para **una empresa**, un superadministrador crea el respaldo privado y conserva el comprobante de creación (empresa, ID de respaldo, SHA-256 del manifiesto) en un canal confiable independiente del archivo. Descarga los bytes exactos del manifiesto mediante la interfaz/API autorizada, sin reserializar el JSON.
2. El custodio autorizado lee del bucket privado **sólo las copias del respaldo**, no las versiones activas: para cada entrada de `files`, materializa el objeto `backups/<empresa>/<respaldo>/files/<id>` en un directorio privado de staging como `<id>`. Sin permisos de lectura sobre esos objetos, detenerse; la descarga del manifiesto por sí sola no basta. No abrir un bucket público, usar URLs públicas ni exportar una base completa para este paso.
3. En un host POSIX controlado con Node/pnpm y dependencias del repositorio instaladas, usar un volumen de trabajo cifrado, directorios privados y `umask 077`. El custodio de claves proporciona un archivo binario privado de 32 bytes aleatorios (modo 0600 o más restrictivo). No pasar la clave literal por argumentos, guardarla con la copia o incluirla en el repositorio.
4. Preparar el archivo en un sistema de archivos local con enlaces físicos y una **ruta de salida inexistente**. Los siguientes son nombres simbólicos que debe sustituir el operador:

   ```text
   node scripts/pilot-offline-recovery.mjs pack EMPRESA RESPALDO SHA_MANIFIESTO MANIFIESTO DIR_VERSIONES ARCHIVO_CLAVE SALIDA.pldoff
   ```

   El operador valida la empresa en cada fila, la pertenencia de cada versión, el tamaño y SHA-256 de cada binario y el digest del manifiesto. Cifra el conjunto con AES-256-GCM vinculando empresa, respaldo y digest como datos autenticados. La salida se publica sin sobrescribir. Registrar su SHA-256 y transferir la copia cifrada a custodia separada del entorno de servicio. Confirmar el digest en destino y capacidad de acceder a la clave desde el procedimiento de recuperación. Custodiar o retirar el staging de acuerdo con el procedimiento aprobado.

5. Para verificar una copia, en un host aislado con espacio libre y volumen cifrado, preparar **un directorio padre privado existente**; el directorio de destino final no debe existir. No montar producción ni proporcionar credenciales del proveedor.

   ```text
   node scripts/pilot-offline-recovery.mjs restore EMPRESA RESPALDO SHA_MANIFIESTO COPIA.pldoff ARCHIVO_CLAVE DESTINO_NUEVO
   ```

   El operador autentica/valida todo el archivo antes de crear el destino. Reconstruye D1 y R2 locales persistentes, verifica recuentos, claves foráneas y relectura de cada binario. Sólo después de cerrar el destino escribe `COMPLETE.json`. Si hay error, **no usar un destino sin ese comprobante**: tratarlo como cuarentena, investigar y reintentar en otro destino vacío. Conserva el original; no mezclar datos con una empresa viva.
6. Comparar los dos digests, conteos y una muestra representativa de expedientes, historial, referencias y contenido contra el comprobante y los criterios de aceptación. Registrar operador/revisor, fecha y resultado. Ningún log debe incluir la clave, datos del expediente ni binarios.

## Qué se recupera y qué no

Se conservan registros (incluidas revisiones y marcas de baja), historial, metadatos documentales, IDs/versiones y bytes; los objetos se remapean a claves locales nuevas. El esquema v1 admite únicamente empresas ordinarias (no bandejas personales), hasta 50 versiones/100 MiB totales y 20 MiB de manifiesto. Se crea una organización de cuarentena y una empresa **archivada** con el ID original. Los actores se representan por su ID histórico con identidades locales suspendidas, sin credenciales o permisos. El directorio restaurado contiene datos descifrados y no debe salir del volumen protegido.

No se restauran la identidad organizacional original, cuentas, MFA, membresías, grants, sesiones, secretos, jobs/colas ni el log global de auditoría. No se reenvían avisos ni se revierten aprobaciones en producción. El mecanismo tampoco implementa calendario de copias, bóveda externa, retención, inmutabilidad, custodia/rotación de claves, RPO/RTO contractual, conmutación de servicio o recuperación de toda la plataforma.

## Evidencia reproducible — 19/11/2026

```sh
pnpm exec tsx --test tests/pilot-offline-recovery.test.ts
```

Ejecución local con datos exclusivamente ficticios: **1 prueba aprobada**. Dos empresas compartían el identificador de expediente. El manejador de respaldos del Worker generó una copia de A en D1/R2 locales de Miniflare; rechazó la petición de un usuario no superadministrador. Se empaquetaron el manifiesto descargado y los bytes de las **versiones de respaldo**. Después se apagó el origen efímero, se eliminó el staging de la prueba y se ejecutó la restauración en otro proceso sin bindings ni ruta al origen. Se volvió a abrir el destino persistente para comprobarlo.

| Verificación | Resultado observado |
| --- | --- |
| Datos recuperados tras reabrir | 1 empresa archivada, 1 expediente, 2 revisiones con contenidos distintos y autor original, 1 documento, 1 versión de 11 bytes idénticos. |
| SHA-256 del binario ficticio | `380b6cf7c563dc23b7b4198b040217d614c891ecfa701899c8995c3bb7ec5c0b` |
| Aislamiento | Sin filas ni objetos de B, sin cuentas/sesiones/grants restaurados; el control de descarga del servidor devuelve 404 al usuario sin permiso. |
| Fallos controlados | Empaquetado rechazado ante archivo ausente/corrupto. Recuperación rechazada con empresa, clave o SHA incorrectos, copia alterada o destino existente. |

Comprobantes de la ejecución final local (9.29 s del ensayo completo, no RTO): SHA-256 del manifiesto `17fab23c794e0f2e30f110728b9b148fb6ed5412e00ba54565bbb83bd0136d7e`, SHA-256 del archivo cifrado completo `ec55076b7bd57a23bca0c35dac7ad4af5afe5be3120023f14c9ba6e19299835a`. Cada ejecución imprime sus propios comprobantes, sin exponer claves. Cambian entre ensayos por el ID/fecha del respaldo y el cifrado aleatorio. Los directorios temporales del ensayo se retiran al finalizar.

El ensayo comprueba independencia **del servicio de origen** en el mismo equipo: no demuestra separación física/geográfica, custodia en otra cuenta ni recuperación tras perder ese equipo. Antes de admitir datos reales se requiere provisionar custodia independiente, definir responsables y ensayar desde esa custodia sobre infraestructura autorizada, con registro de tiempos y aprobación.
