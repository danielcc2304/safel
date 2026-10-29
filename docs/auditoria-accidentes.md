# Auditoría de vigilancia de accidentes · Safel

Fecha: 29 de octubre de 2026. Alcance: ingestión de avisos, priorización, conservación de datos ante fallos y comunicación de cobertura. Revisión de código, pruebas de regresión y contraste de la API local con la página pública de Adif. No es una certificación de seguridad ferroviaria ni una auditoría de los sistemas de los operadores.

## Hallazgos corregidos

| Prioridad | Problema                                                                                                                          | Corrección                                                                                                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta      | Los avisos destacados de Adif están fuera del listado de tráfico y no se extraían. Un comunicado importante podía quedar omitido. | Extracción del bloque destacado, conservando procedencia, texto y fecha desconocida. Duplicados idénticos eliminados.                                                                                         |
| Alta      | El panel resumido mostraba cuatro avisos sin priorizar accidentes. Avisos rutinarios podían ocultarlos.                           | Ordenación en servidor y cliente; bloque prioritario con todos los comunicados con mención de accidente, en todas las vistas e independiente de filtros o coordenadas.                                        |
| Alta      | Un fallo de la consulta del navegador podía dejar las fuentes conservadas con estado actualizado.                                 | Se marcan como desactualizadas/no disponibles, con las fechas originales. Tiempo máximo de espera y validación de la estructura básica de respuesta.                                                          |
| Alta      | Una página en mantenimiento con un texto de lista vacía podía parecer una consulta correcta sin incidencias.                      | La respuesta vacía en mantenimiento falla; si hay comunicados recuperables se conservan con cobertura parcial/no verificada. Los cambios de estructura desconocidos tampoco equivalen a cero avisos.          |
| Media     | La clasificación limitada podía perder términos como alcance, colisión o salida de vía.                                           | Vocabulario ampliado, con comprobaciones de simulacros, aniversarios, ausencia explícita y negaciones que no deben ocultar un accidente.                                                                      |
| Media     | La consulta de tráfico cada cinco minutos retrasaba la recuperación de novedades.                                                 | Consulta cada minuto para tráfico; obras mantienen cinco minutos. La caché de la API y la publicación del proveedor añaden demora.                                                                            |
| Media     | No se destacaban cambios de comunicados durante la sesión.                                                                        | Aviso dentro de Safel y centro de actualizaciones cuando cambia o aparece un comunicado después de la primera lectura. Se describe como cambio de publicación, sin afirmar que el accidente acabe de ocurrir. |

## Verificación

- 34 pruebas automatizadas: extracción fuera de listado, duplicación, HTML desconocido, mantenimiento, fuente caída, recuperación posterior sin avisos fantasma, prioridad sobre más de cuatro avisos, cobertura antigua y clasificación de términos. Se mantienen pruebas de integridad GTFS, fechas, posiciones, asociaciones y velocidad.
- Compilación TypeScript y producción Vite.
- Lint sin errores; permanecen advertencias de hooks, actualización de estado en efectos y organización de exportaciones. No equivale a ausencia de defectos.
- API local contrastada con [Estado de la red de Adif](https://www.adif.es/viajeros/estado-de-la-red): se recuperan tanto el comunicado destacado como el del listado relacionado con el mismo suceso. La indicación de mantenimiento se transmite como cobertura no verificada. Es una comprobación puntual, no una garantía futura.

## Riesgos y límites pendientes

1. **Cobertura y latencia de origen.** No existe una conexión integrada a un canal exhaustivo de accidentes ni a los partes internos de maquinistas. Un accidente no publicado, publicado tarde, con otra redacción o en otro canal puede no aparecer. No se puede prometer detectar todos los accidentes importantes con estas fuentes.
2. **HTML sin contrato.** Los selectores pueden cambiar. Se detectan varios fallos de estructura, pero una extracción aparentemente válida también podría omitir contenido. No hay una segunda fuente independiente que verifique todos los sucesos.
3. **Clasificación textual.** Identifica menciones en publicaciones, no confirma el suceso, su gravedad actual ni su resolución. Las referencias históricas o las formulaciones ambiguas requieren consultar el original. No se deduce un accidente de una parada, ausencia de GPS, retraso o velocidad estimada.
4. **Vigencia, ubicación y asociación.** Adif puede no publicar fecha individual, coordenadas, número de tren o fin del aviso. Se conservan como desconocidos; no se asigna un accidente a un tren por proximidad supuesta. Varios comunicados pueden referirse al mismo accidente.
5. **Sin vigilancia permanente.** Las consultas dependen de la pestaña visible y de la actualización activada. No hay monitor de servidor continuo, cola de avisos, historial persistente ni notificaciones con la aplicación cerrada. La caché de Vercel es por instancia y puede perderse en arranques en frío.

Para convertir Safel en un servicio de alertas permanente harían falta un proceso de ingestión independiente del navegador, almacenamiento de publicaciones y cambios con sus fechas, monitorización de fuentes, entregas de notificaciones verificables y fuentes adicionales con cobertura y condiciones de uso contrastadas. Esa infraestructura no se ha desplegado en esta revisión.
