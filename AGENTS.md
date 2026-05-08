# AGENTS.md - Plataforma PLD Mexico

Guia operativa para Codex y otros agentes que trabajen en este repositorio.
Aplica a todo el proyecto salvo que una subcarpeta tenga instrucciones mas
especificas.

## Identidad del Proyecto

Esta es una plataforma de Prevencion de Lavado de Dinero y Financiamiento al
Terrorismo para Mexico. El foco inicial es consultoria PLD para sujetos que
realizan Actividades Vulnerables conforme a la LFPIORPI, con capacidad futura
multi-cliente.

La plataforma debe ayudar a documentar, revisar y conservar evidencia de:

- alta y registro ante SAT/SPPLD;
- identificacion de clientes, usuarios y beneficiarios finales/controladores;
- actos u operaciones vulnerables y umbrales en UMA;
- Evaluacion Basada en Riesgo (EBR);
- avisos, informes en ceros, acuses y trazabilidad;
- capacitacion, auditoria, gobernanza y control interno.

No trates el producto como una plataforma generica de IA, privacidad o gestion
documental. Si encuentras textos heredados de v0, Davaraboard, gobernanza de IA
o privacidad que contradigan PLD Mexico, consideralos deuda a limpiar en una
tarea separada.

## Stack, Flujo y Comandos

- Framework: Next.js 14 con App Router en `app/`.
- Lenguaje: TypeScript estricto en `tsconfig.json`, aunque el build actualmente
  ignora errores de TypeScript y ESLint en `next.config.js`.
- UI: Tailwind CSS, shadcn/Radix en `components/ui`, iconos de `lucide-react`.
- Estado actual: componentes cliente con `localStorage`; no hay backend real.
- Paquetes: usar `pnpm` y respetar `pnpm-lock.yaml`.
- Despliegue: Vercel/static export (`output: "export"`).
- Flujo fuente: GitHub/Codex manda. v0 puede servir para prototipos visuales,
  pero no debe sobrescribir reglas criticas de PLD ni criterios normativos.

Comandos habituales:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
```

Antes de afirmar que algo esta listo, ejecuta la verificacion mas cercana al
cambio. Si no puedes correrla, dilo claramente en el cierre.

## Fuentes Regulatorias Obligatorias

Antes de cambiar reglas de cumplimiento, umbrales, plazos, catalogos legales,
XML/formatos o textos normativos, verifica fuentes oficiales y documenta fecha
de consulta en el PR o comentario tecnico.

Fuentes base:

- LFPIORPI vigente:
  https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPIORPI.pdf
- Reglamento de la LFPIORPI:
  https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LFPIORPI.pdf
- Reglas de Caracter General de la LFPIORPI:
  https://www.pld.hacienda.gob.mx/work/models/PLD/documentos/compilado_rcg_reforma30nov2020.pdf
- SAT/SPPLD:
  https://sppld.sat.gob.mx/pld/interiores/sppld.html
- SAT Actividades Vulnerables:
  https://www.sat.gob.mx/minisitio/ActividadesVulnerables/index.html
- INEGI UMA 2026:
  https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2026/uma/uma2026.pdf

Reglas de trabajo normativo:

- No inventes umbrales, plazos, listas, campos XML ni obligaciones.
- No dupliques reglas legales en varios archivos si pueden centralizarse.
- Conserva terminos PLD en espanol; usa ingles solo donde ya sea API tecnica.
- Distingue "beneficiario controlador", "dueno beneficiario" y "beneficiario
  final" segun el contexto legal o de formato oficial.
- Para cambios de alto impacto, cita articulos, fuente y fecha de consulta.
- Si una fuente oficial cambia, actualiza reglas compartidas y textos visibles
  en la misma rama, no solo el componente afectado.

## Mapa de Modulos

Rutas principales:

- `/` (`app/page.tsx`): tablero inicial de acceso a modulos.
- `/dashboard` (`app/dashboard/page.tsx`): panel administrativo, usuarios y
  metricas basicas del prototipo.
- `/registro-sat` (`app/registro-sat/page.tsx`): alta y registro ante SAT,
  identificacion del sujeto obligado, actividades declaradas, REC/encargado,
  carga o captura de acuses y persistencia en `registro-sat-data`.
- `/kyc-expediente` (`app/kyc-expediente/page.tsx`): expediente unico de
  identificacion para persona fisica, moral, extranjera, fideicomiso y datos
  relacionados; persiste en `kyc_expedientes_detalle`.
- `/actividades-vulnerables` (`app/actividades-vulnerables/page.tsx`): actos y
  operaciones, seleccion de fracciones, captura guiada, calculo de umbrales UMA,
  XML/demo de aviso y calendario; usa `lib/data/actividades.ts`,
  `lib/data/uma.ts` y `actividades_vulnerables_operaciones`.
- `/ebr` (`app/ebr/page.tsx`): Evaluacion Basada en Riesgo con puntajes,
  factores, recomendaciones y reportes; integra expedientes y operaciones;
  persiste en `ebr_evaluaciones`.
- `/avisos-informes` (`app/avisos-informes/page.tsx`): integraciones,
  preparacion de avisos/informes, plazos, acuses, folios y trazabilidad; lee
  registro SAT, expedientes, operaciones y EBR.
- `/beneficiario-controlador` (`app/beneficiario-controlador/page.tsx`):
  declaracion, documentacion, screening, actualizacion anual y trazabilidad del
  beneficiario controlador; usa `beneficiario-controlador-data`.
- `/capacitacion-control` (`app/capacitacion-control/page.tsx`): plan anual,
  sesiones, constancias, colaboradores, oficial/representante de cumplimiento y
  cierre del modulo; usa `pld-training-module`.
- `/auditoria-verificacion` (`app/auditoria-verificacion/page.tsx`):
  metodologia de auditoria, lineamientos internos, auditorias, observaciones
  SAT/UIF y planes de accion.
- `/evidencias-trazabilidad` (`app/evidencias-trazabilidad/page.tsx`):
  repositorio de evidencias, versiones, logs, retencion y snapshot de otros
  modulos; usa `pld-evidences-documents`, `pld-evidences-logs` y
  `evidencias-trazabilidad-data`.
- `/gobernanza-control` (`app/gobernanza-control/page.tsx`): oficial de
  cumplimiento, politicas, manuales, comite, alertas, firmas internas y cierre
  del expediente; usa `gobernanza-control-data`.
- `/marco-normativo-aplicable` (`app/marco-normativo-aplicable/page.tsx`):
  biblioteca normativa PLD. Debe mantenerse como referencia, no como fuente
  unica de verdad para reglas ejecutables.
- `/alicia` (`app/alicia/page.tsx`): pagina comercial/informativa del asistente
  legal Alicia.
- `/login`, `/profile`, `/settings`, `/user-progress`: autenticacion demo,
  perfil, configuracion y seguimiento heredado.

Navegacion:

- `components/sidebar.tsx` define la navegacion lateral.
- `app/page.tsx` define las tarjetas del tablero inicial.
- Si agregas, renombras o retiras un modulo, actualiza ambos puntos y las
  traducciones en `lib/translations.ts`.

## Datos y Persistencia

`localStorage` es persistencia demo temporal. Mantener compatibilidad con las
llaves existentes hasta que exista un plan explicito de backend/migracion.

Al crear funcionalidad nueva:

- Disena modelos y transformadores compartidos antes de acoplar datos a la UI.
- Evita leer/escribir la misma estructura de `localStorage` con formas distintas
  desde varios modulos.
- Sanitiza datos recuperados de `localStorage`; no asumas que el JSON es valido.
- Mantiene IDs, fechas ISO, RFC, CURP, montos, moneda y periodos en formatos
  consistentes.
- Los documentos cargados en base64 son aceptables para demo, pero no para
  produccion. Cualquier plan de backend debe separar metadatos, archivo,
  versionado, auditoria y permisos.
- No rompas las llaves actuales sin una migracion: `registro-sat-data`,
  `kyc_expedientes_detalle`, `actividades_vulnerables_operaciones`,
  `actividades_vulnerables_clientes`, `ebr_evaluaciones`,
  `beneficiario-controlador-data`, `pld-training-module`,
  `auditoria-verificacion-*`, `pld-evidences-*`,
  `evidencias-trazabilidad-data`, `gobernanza-control-data`, `users`.

## Guardrails de Implementacion

- Mantener cambios pequenos y verificables. Las paginas mas grandes deben
  refactorizarse por dominio, no con reescrituras masivas.
- Centralizar reglas PLD, catalogos, umbrales y calculos UMA en `lib/` antes de
  reutilizarlos entre pantallas.
- Los componentes de UI deben seguir el estilo existente, pero mejorar densidad,
  legibilidad y ergonomia de herramienta profesional.
- No agregues dependencias nuevas para resolver algo que el stack ya cubre.
- No uses datos ficticios como si fueran cumplimiento real; etiqueta demos y
  semillas claramente.
- Para PDF, XML o Excel regulatorios, prefiere generadores validados y pruebas
  con fixtures oficiales o ejemplos de SAT/SPPLD.
- Para seguridad, no conviertas la autenticacion demo en "real" parcialmente.
  Planear autenticacion, roles, permisos, sesiones y auditoria como un bloque.
- Antes de tocar cumplimiento, revisa si el cambio afecta avisos, expedientes,
  EBR, evidencias o auditoria. Si afecta mas de un modulo, actualiza flujo y
  pruebas de integracion manual.

## Riesgos Conocidos

Tratalos como deuda prioritaria, no como errores a arreglar dentro de tareas no
relacionadas:

- `README.md`, `package.json`, metadata y algunas traducciones conservan textos
  de Davaraboard, v0, IA o privacidad que no corresponden al foco PLD.
- `next.config.js` tiene `eslint.ignoreDuringBuilds` y
  `typescript.ignoreBuildErrors` en `true`; un build exitoso puede ocultar
  errores reales.
- `lib/AppContext.tsx` importa tipos desde archivos no presentes
  (`third-party`, `external-recipients`, `data`, `documents`).
- `components/document-upload-form.tsx` importa `@/lib/documents`, que no esta
  presente en el checkout actual.
- `lib/data/uma.ts` debe revisarse contra INEGI: el valor anual 2026 en codigo
  no coincide con el comunicado oficial de INEGI (42,794.64 MXN).
- Varias paginas mezclan reglas, UI, parsing, persistencia y exportacion en un
  solo archivo. Las mas grandes son `actividades-vulnerables`, `kyc-expediente`,
  `registro-sat`, `auditoria-verificacion`, `capacitacion-control` y
  `avisos-informes`.
- Hay componentes heredados de privacidad/IA en `components/` que pueden no
  pertenecer al producto PLD actual.

## Ruta Recomendada de Mejora

1. Base tecnica:
   - actualizar identidad del repo y metadata a PLD Mexico;
   - reinstalar dependencias y medir errores reales;
   - corregir imports faltantes o retirar componentes muertos;
   - activar verificacion TypeScript/ESLint en build cuando sea viable;
   - corregir UMA 2026 y documentar fuente.
2. Modelo compartido:
   - extraer catalogos PLD, actividades, UMA, clientes, expedientes, operaciones,
     EBR, avisos, evidencias y trazabilidad a `lib/`;
   - crear adaptadores de `localStorage` compatibles con el estado actual;
   - definir contratos preparados para backend futuro.
3. Mejora por modulo:
   - empezar por `registro-sat`, `kyc-expediente`, `actividades-vulnerables`,
     `ebr` y `avisos-informes` porque forman el flujo regulatorio principal;
   - despues fortalecer `beneficiario-controlador`, `evidencias-trazabilidad`,
     `capacitacion-control`, `auditoria-verificacion` y `gobernanza-control`.
4. Backend futuro:
   - plan separado para autenticacion real, multi-cliente, roles, almacenamiento
     documental, auditoria inmutable, permisos y migracion desde `localStorage`.

## Criterios de Cierre para PRs

Todo PR debe explicar:

- que modulo o regla cambia;
- que fuente normativa se consulto, si aplica;
- que llaves de datos o contratos se tocaron;
- como se verifico el cambio;
- que deuda queda fuera de alcance.

No mezcles correcciones normativas, refactors masivos y redisenos visuales en un
solo PR salvo que el usuario lo haya pedido expresamente.
