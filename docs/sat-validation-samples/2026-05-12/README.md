# Validación manual SPPLD - muestra Fracción V Inmuebles

## Objetivo

Validar manualmente en SPPLD que el archivo generado por la plataforma puede ser procesado por el flujo oficial del SAT para Actividades Vulnerables.

## Archivos

- `muestra-sppld-fraccion-v-inmuebles-202605-DLV190624M32.xlsm`: plantilla oficial `Inmuebles_v4_5.xlsm` rellenada por la plataforma.
- `muestra-sppld-fraccion-v-inmuebles-202605-DLV190624M32.xml`: XML generado desde el mismo paquete operativo.
- `muestra-sppld-fraccion-v-inmuebles-202605-DLV190624M32-ficha.csv`: ficha de revisión interna.
- `muestra-sppld-fraccion-v-inmuebles-202605-DLV190624M32-validacion.json`: bitácora técnica de celdas escritas y validaciones locales.

## Ruta de prueba

1. Ingresar al portal oficial SPPLD: https://sppld.sat.gob.mx/pld/interiores/sppld.html
2. Entrar con el RFC/e.firma del sujeto obligado real de prueba. No subir e.firma ni contraseñas a la plataforma.
3. Buscar la opción de presentación de Avisos e Informes para Actividades Vulnerables.
4. Usar la opción oficial de plantillas Excel / envío masivo cuando el portal lo solicite.
5. Cargar primero el `.xlsm` generado y registrar el resultado que muestre SPPLD.
6. Si el portal genera/solicita XML a partir de la plantilla, comparar contra el XML generado por la plataforma.
7. Guardar captura o texto exacto del resultado:
   - aceptado;
   - rechazado por estructura;
   - rechazado por catálogo;
   - rechazado por campo obligatorio;
   - error técnico del portal.

## Resultado esperado

El archivo debe abrir como XLSM oficial con macros preservadas y datos prellenados en la hoja `Acto u operación`. La validación definitiva depende del SPPLD y debe documentarse con el mensaje exacto del portal.

## Notas

- Esta muestra usa datos demo, no debe presentarse como aviso real.
- Si SPPLD permite ambiente productivo únicamente, detenerse antes de enviar definitivamente y usar solo la validación previa que el portal ofrezca.
- Si el portal rechaza el archivo, copiar el mensaje exacto para ajustar el mapeo de celdas/catálogos.
