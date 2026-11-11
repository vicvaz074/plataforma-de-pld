# Candidato para revisión del superadministrador

Fecha: 11/11/2026. Sitio conservado: `https://plataforma-de-pld.pages.dev`.

## Correcciones verificadas

- Aprobaciones y archivo de documentos se autorizan en servidor, incluso dentro de perfiles BC y Gobernanza. El actor/fecha y las versiones revisadas se vinculan a la sesión y al archivo privado recuperable. Editar contenido invalida cierres/revisiones sin borrar historial.
- Las referencias documentales actuales e históricas sólo abren archivos privados de la empresa. Las referencias legacy no autorizadas se conservan, pero no son enlaces ejecutables ni soporte aprobado.
- Las tareas asíncronas conservan empresa y generación de acceso originales. Cambiar A→B→A, recargar o reautenticar invalida tareas anteriores. Los callers reales de Evidencias, Avisos, Gobernanza y BC tienen pruebas con promesas diferidas y cambios concurrentes.
- Importaciones validan estructura ZIP y expansión real antes de SheetJS; CSV y tablas limitan filas, columnas y celdas antes de crear objetos. Campos/celdas SAT se admiten exclusivamente conforme al layout seleccionado, también en borradores.
- Las vistas EBR, PDF, Avisos, CSV, distribución y tablero no convierten una aprobación histórica en riesgo vigente cuando cambia su base PEP/identidad. Los CSV neutralizan fórmulas sin perder comillas, acentos ni saltos de línea.
- El proxy Pages conserva origen/cookies y comunica `/api/*` mediante service binding. Preview usa un alias estable separado y cuentas ficticias; producción reserva la activación para `vvazquez@davara.com.mx`.

## Verificación ejecutada

- `pnpm install --frozen-lockfile`: aprobado.
- `pnpm typecheck` y comprobación adicional sin caché: aprobados.
- `pnpm lint`: sin errores; permanecen advertencias de dependencias de hooks, documentadas como deuda.
- `pnpm test:pld`: primera ejecución **362/362**; ejecución final tras QA y aislamiento entre usuarios **368/368**, cero fallos, cancelaciones o saltos.
- Regresiones adicionales ejecutan los callers/JSX reales con snapshots diferidos, invalidación de sesión y cambio de usuario. Una sesión nueva no puede leer, exportar ni reenviar pendientes del usuario anterior; éstos quedan aislados en memoria para recuperación del titular.
- `pnpm build` y `pnpm build:worker`: aprobados. El build incluye `_worker.js`, rutas de API y exclusiones para assets del backend.
- Existe un único ciclo independiente de bypass/regresión del candidato; sus seis hallazgos se corrigieron y añadieron controles negativos y legítimos. Esto no equivale a una auditoría exhaustiva de toda la plataforma ni a aceptación del SAT.
- Comparación adicional `scripts/check-sat-xml-programs.ts --verify-workbooks`: **40 libros, 1,198 celdas sin diferencias, macros conservadas y 39 XML válidos con XSD y xmllint**. XIV conserva su vía separada.

## QA observada y retención de publicación

En escritorio 1440×1000 se comprobó captura/guardado/recarga en Alta, EUI, capacitación, Gobernanza, Evidencias y PEP. BC superó aprobado → nueva declaración → guardado automático → reaprobación → recarga, conservando sus dos folios. El retest corrigió tanto una aprobación obsoleta reenviada por autosave como un bucle por identidad de estado. Los modales de Gobernanza tienen título/descripción accesibles.

En móvil 390×844 se recorrieron los 12 módulos con verificación de ruta y contenido, sin nuevos errores de consola ni desbordamiento horizontal. El Provider ahora desmonta módulos durante una transición; no intenta leer snapshots invalidados ni monta una empresa bajo la generación de otra.

Actos XV se capturó desde EUI con `$10,000,000.01`, se guardó como borrador y luego completo con el mismo ID y se recuperó en Bandeja SAT. NIF sin RFC se conservó para persona moral extranjera; XI-B mostró/ocultó la descripción únicamente con `99,Otro`. Importación CSV: tres filas, asignación explícita de dos grupos con el mismo RFC sin fusionarlos, guardado como borradores y reimportación con tres duplicados y cero altas disponibles. No se documentó una presentación ficticia ante SAT.

Cloudflare preview confirmó login, cookie de sesión, organización/empresa y EUI parcial mediante UI móvil y persistencia remota. Las personas y documentos son exclusivamente ficticios. R2 producción está privado y la base nueva no tiene cuentas; se conserva una exportación de instalación fuera del repositorio.

**Producción todavía no se ha reemplazado al registrar este cambio.** CI detectó dos requisitos ausentes en checkout limpio: la prueba Worker buscaba `out/` antes del build y Ubuntu no traía `xmllint`. El titular confirmó el ajuste: la prueba usa los assets fuente y CI instala `libxml2-utils`, sin omitir comprobaciones. El despliegue y la activación del titular quedan retenidos hasta ejecutar exitosamente esa validación y comprobar el mismo commit en preview. La evidencia final de publicación se registra en el PR.

## Ámbito de apertura

Este candidato habilita el acceso privado del superadministrador para comprobar los módulos. No declara aceptado el piloto completo para clientes reales. Continúan diferenciados en `docs/pilot-validation.md` los recorridos humanos de las 40 plantillas frente a las pruebas sintéticas, los XML contra XSD y la comparación de libros.

La recuperación privada dentro de la cuenta Cloudflare no es DR integral. Antes de recibir documentación real de clientes se requiere respaldo externo administrado y completar la matriz de aceptación. La activación inicial no importa ni elimina información del navegador: la recuperación asistida exige respaldo previo, selección y asignación explícita de empresa.

Las evidencias de navegador, CI y despliegue se registran en el PR; una publicación sólo debe afirmar los recorridos efectivamente observados.
