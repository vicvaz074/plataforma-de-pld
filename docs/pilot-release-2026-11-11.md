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
- `pnpm test:pld`: **362/362**, cero fallos, cancelaciones o saltos.
- Regresión adicional de callers reales y EBR después de integrar la revisión independiente: **9/9**.
- `pnpm build` y `pnpm build:worker`: aprobados. El build incluye `_worker.js`, rutas de API y exclusiones para assets del backend.
- Existe un único ciclo independiente de bypass/regresión del candidato; sus seis hallazgos se corrigieron y añadieron controles negativos y legítimos. Esto no equivale a una auditoría exhaustiva de toda la plataforma ni a aceptación del SAT.

## Ámbito de apertura

Este candidato habilita el acceso privado del superadministrador para comprobar los módulos. No declara aceptado el piloto completo para clientes reales. Continúan diferenciados en `docs/pilot-validation.md` los recorridos humanos de las 40 plantillas frente a las pruebas sintéticas, los XML contra XSD y la comparación de libros.

La recuperación privada dentro de la cuenta Cloudflare no es DR integral. Antes de recibir documentación real de clientes se requiere respaldo externo administrado y completar la matriz de aceptación. La activación inicial no importa ni elimina información del navegador: la recuperación asistida exige respaldo previo, selección y asignación explícita de empresa.

Las evidencias de navegador, CI y despliegue se registran en el PR; una publicación sólo debe afirmar los recorridos efectivamente observados.
