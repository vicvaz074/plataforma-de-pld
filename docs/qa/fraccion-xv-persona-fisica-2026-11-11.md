# Fracción XV: persona física y cierre de modales

## Alcance y fuente

Corrección del bloque de persona objeto del aviso en la plantilla vigente de
arrendamiento, no modificación de umbrales ni de obligaciones.

- Consulta: **11 de noviembre de 2026**.
- [SAT/SPPLD: arrendamiento](https://sppld.sat.gob.mx/pld/interiores/arrendamiento.html).
- Plantilla oficial conservada: `Arrendamiento_v4_5.xlsm`.
- Hoja `Persona Objeto del aviso`: PF en `B19:I28`; PM en `B33:F42`;
  el encabezado `B44` limita el representante a personas morales/fideicomisos.
- El portal distingue el formato actual del que entrará en vigor el 1 de junio
  de 2027; esta corrección no activa anticipadamente ese formato futuro.

## Contratos y compatibilidad

- Interfaz, faltantes, celdas XLSM y XML comparten la condición del tipo de persona.
- PF no activa denominación/giro PM ni el bloque de representante de XV.
- Nombres, apellidos, nacionalidad y actividad PF respetan los asteriscos del Excel.
- Se normaliza la etiqueta histórica `Persona Física Mexicana` a `pf_residente`
  para seleccionar los documentos PF; no se eliminan requisitos documentales.
- Se migran únicamente los 80 identificadores PF antiguos conocidos y sus nueve
  controles de filas adicionales. No se admite cualquier destino por sufijo.
  Los conflictos entre valores/celdas se siguen rechazando.
- La migración precede a la combinación de datos guardados con la precarga EUI,
  para conservar correcciones y filas independientes.
- Sin cambios de llaves de almacenamiento, IDs, esquema D1 o credenciales.

## Regresiones independientes

- Fixture explícito PF + beneficiario distinto: no usa el rellenador sintético.
- Monto `1000000001` centavos (`$10,000,000.01`), con pago por transferencia.
- Domicilio cliente e inmueble diferentes; referencia no asociada al monto.
- Ramas PM/representante obsoletas excluidas de celdas y XML.
- XML generado por el programa de la plantilla, validado contra XSD con `xmllint`.
- XLSM preserva macros, estilos y estructura del libro.
- Cambio negativo PF → PM mantiene faltantes PM/representante aplicables.
- Reconciliación repetida produce una sola operación en Bandeja SAT.
- Alias antiguos, filas 2–10, conflictos y destinos falsos cubiertos.

## Modales

- `Dialog` incorpora cierre X accesible por defecto; `AlertDialog` usa **Cancelar**,
  nunca la acción de confirmación destructiva.
- Cierre de tipo `button`, nombre `Cerrar`, foco visible y permitido en consulta.
- Cabeceras reservan espacio y el cierre permanece accesible al desplazar contenido.
- Se conserva la variante del visor de evidencias sin alterar su altura.
- Los cierres personalizados de Gobernanza reciben nombre accesible y ámbito
  de navegación para no bloquear la salida de usuarios de consulta.

## Límites

Los registros y justificaciones QA son ficticios, no evidencia de cumplimiento.
La validación XML local no implica presentación ni aceptación por SAT.
La etiqueta genérica de PF extranjera no permite inferir residencia/visitante;
ese subtipo debe precisarse. No se cambian reglas documentales para inferirlo.
