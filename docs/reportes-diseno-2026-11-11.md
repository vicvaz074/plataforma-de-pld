# Contrato visual: reportes profesionales PLD

Dirección aprobada por el usuario el 11/11/2026: PDF A4 ejecutivo y lectura móvil.
Tras revisar el PDF real se aprobó el contenido de `propuesta-reportes-pld-v1.pdf`
y se pidió únicamente reemplazar su logo. La versión 2 usa el logo actual
`public/logo-davara-governance/logo-davara-governance-black.png`, confirmado por
el usuario. Los PDF de propuesta son ilustrativos, no datos productivos.

## Elementos conservados

- Logo oficial sin recrearlo ni deformarlo; blanco, azul marino y naranja.
- Empresa, RFC, alcance/filtros, periodo, fecha de generación y fuentes visibles.
- Resumen ejecutivo antes de indicadores y gráficas; detalle completo después.
- Gráficas vectoriales de barras con cifras y unidades directas, base cero y
  escalas explícitas. No depender del color ni de hover para comprenderlas.
- Tablas con ajuste de texto, cabeceras repetidas y paginación; no truncar filas.
- Pie confidencial, versión y número de página; límites del análisis visibles.
- No confundir obligación, preparación, validación XML local y presentación.
- Desconocido/sin evaluar no equivale a cero, riesgo bajo o cumplimiento.

## Inventario y responsabilidades

| Familia | Comparación | Datos/denominador | Salida y comprobación |
| --- | --- | --- | --- |
| Avisos | Pendientes vs preparación/presentación | Operaciones y revisiones del ámbito seleccionado | Barras por estado y detalle completo con vínculo a origen |
| EBR | Factores e inherente/residual | Misma metodología/escala que pantalla; estados no aprobados separados | Valores directos, fuentes y cuestionarios completos |
| Capacitación | Sesiones, participantes e inducción pendiente | Registros de la empresa activa | Conteos y tablas sin límites 20/25 |
| Auditoría | Hallazgos, estado y avance documentado | Registros y respuestas reales | Todos los cuestionarios, observaciones y planes |
| Evidencias | Revisión/vigencia y documentos | Metadatos reales; archivo disponible separado de aprobación | Versiones y referencias completas |
| Gobernanza | Respuestas y documentación vs pendientes | Respuestas reales, sin asumir cumplimiento por plan | Detalle sin solapamiento ni respuestas descartadas |

Los agentes de cada dominio protegen agregación y alcance; el renderizador
compartido protege marca, escala, paginación, notas y tablas. Revisión final
independiente del PDF renderizado y invariantes de datos antes de publicar.

## Contrato técnico

- `ProfessionalReport`: título, subtítulo/alcance, periodo, resumen, métricas,
  secciones de párrafos/barras/tablas, fuentes, límites y nombre de archivo.
- Barras con `value: number | null`, máximo y etiqueta de unidad; `null` muestra
  “Sin dato” sin dibujar una barra cero. Tablas conservan todos los registros.
- Renderizador jsPDF reutilizable; sin nuevas dependencias. Generación local,
  sin enviar datos a terceros ni alterar XML/XLSM regulatorios.
- Descarga asíncrona captura empresa y permisos al inicio; revalida ámbito y
  permiso de descarga antes de guardar, incluyendo autorización final contra
  el servidor. Cambiar empresa o revocar el acceso cancela esa salida.
- Fallos de carga/generación se muestran como error, no como descarga exitosa.
- Conservar CSV/Excel como anexos; distinguirlos del PDF en la interfaz.
- Fuente de datos: lectores existentes autorizados por empresa. No migraciones
  de almacenamiento ni nuevas reglas normativas en esta entrega.

## Adaptación y QA

El PDF usa A4 y textos seleccionables, apto para impresión y zoom del visor.
Los controles de descarga se ajustan a móvil y teclado; no se introduce una
interfaz de gráficas interactivas nueva ni permisos de sensores.

Probar vacío, desconocidos, textos largos, cientos de filas, centavos exactos,
cancelaciones, historial y cambio de empresa durante la exportación. Renderizar
PDF por familia y revisar primera página, continuaciones y última página.
Las fuentes/versiones internas no se presentan como validación de autoridad.

La tipografía PDF estándar cubre el español y caracteres latinos. No se afirma
soporte tipográfico para CJK o emoji; requeriría una fuente embebida adicional.
