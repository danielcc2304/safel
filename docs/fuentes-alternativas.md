# Fuentes oficiales alternativas a Adif

Comprobación inicial realizada el 29/10/2026 mediante búsqueda en catálogos oficiales y peticiones HTTPS. Actualización: el RSS oficial de Rodalies ya está integrado como `rodalies-alerts`; 112 Castilla-La Mancha y RadarDeTrenes permanecen como candidatos. Adif dispone de un recolector independiente y copia persistente; ver [diagnóstico y operación](adif-produccion.md).

## 112 Castilla-La Mancha: candidato para comunicados de accidentes

- [Servicio de emergencias](https://112.castillalamancha.es/112).
- [Emergencias activas](https://112.castillalamancha.es/112/emergencias-activas).
- [Buscador de incidentes](https://112.castillalamancha.es/112/emergencias-e-incidencias/buscador-de-incidentes).
- [Ficha ferroviaria comprobada](https://112.castillalamancha.es/112/incidentes/urda-accidente-ferroviario).

Las páginas consultadas respondieron HTTP 200. La ficha comprobada publica tipo de incidente ferroviario, descripción, municipio, localización, coordenadas, observaciones y recursos movilizados. Las observaciones pueden contener actualizaciones sucesivas: no sumar cifras de versiones diferentes ni asumir que todo el contenido se refiere a la última actualización. No se reproducen aquí cifras de víctimas.

Es información de emergencias de Castilla-La Mancha, no de toda España. La ficha HTML no es una API contractual. La presencia en el buscador o en la portada no basta para afirmar que un suceso sigue activo: contrastar con emergencias activas y conservar las fechas que publique cada ficha. Comprobar condiciones de reutilización, estructura y acceso desde producción antes de incorporarlo.

## Rodalies / Generalitat: candidato para incidencias de servicio

- [Catálogo oficial en datos.gob.es](https://datos.gob.es/es/catalogo/a09002970-estado-del-servicio-de-cercanias-de-catalunya).
- [Página oficial de canales RSS por línea](https://rodalies.gencat.cat/ca/rss/).
- [RSS agregado en español](https://www.gencat.cat/rodalies/incidencies_rodalies_rss_es_ES.xml).

El RSS agregado respondió HTTP 200, `application/xml`, con 11 elementos `item`. Hay título, descripción y fecha `pubDate` con desplazamiento horario; algunos avisos se publicaron el día de comprobación y otros en días anteriores. El canal R4 comprobado también respondió HTTP 200. El formato RSS permite una integración más estable que extraer tarjetas HTML.

La cobertura comprende servicios de Rodalies y regionales de Cataluña. Los avisos incluyen alteraciones de circulación, obras o huelgas; no todos son accidentes. El catálogo indica que muestra incidencias existentes en ese momento, sin histórico acumulado. Conservar la antigüedad y no usar el éxito de este canal para afirmar cobertura nacional de accidentes. Revisar las condiciones enlazadas por el catálogo.

## Renfe: fuente existente, no sustitución de Adif

[Incidencias y avisos de Renfe](https://data.renfe.com/dataset/incidencias-avisos) publica GTFS-RT/JSON para Cercanías y declara licencia CC BY 4.0 y actualización cada 20 segundos. Safel ya la integra. Esa cadencia declarada no demuestra que cada descarga contenga datos recientes: se debe seguir comprobando la fecha del feed y de cada aviso. No aporta por sí sola cobertura de accidentes de toda la red.

## Resultado

### Proveedor adicional señalado por el usuario: RadarDeTrenes

Se revisaron su [documentación](https://radardetrenes.com/docs) y [OpenAPI](https://radardetrenes.com/openapi.json), y se probaron tres consultas públicas con un User-Agent identificando Safel. Se presenta expresamente como proyecto independiente y no oficial que agrega fuentes públicas de Renfe y Adif. Ofrece posiciones, tableros, itinerarios, geometrías y avisos de estación, sin clave, con atribución requerida a sus fuentes y al intermediario.

Las consultas de avisos de las estaciones 60000 y 03100 respondieron HTTP 200 con `observations: []`. La ruta `/api/v1/alerts?corridor=madrid-andalucia` respondió HTTP 200 con `alerts: []`. Según OpenAPI, esta última filtra el feed abierto GTFS-RT de Renfe por estaciones del corredor; no constituye una fuente independiente de todos los comunicados de accidentes de Adif. La fecha `fetchedAt` indica cuándo se leyó la fuente, no necesariamente la antigüedad de sus observaciones.

Es un candidato útil como proveedor técnico complementario, pero estas pruebas no demuestran que resuelva la ausencia de los comunicados de Adif ni verifican su acceso desde Vercel. No se ha integrado en Safel.

Se han localizado complementos oficiales concretos, pero no una API pública nacional exhaustiva y verificada que sustituya todos los comunicados de Adif. El siguiente paso técnico sería probar los candidatos desde producción, revisar reutilización y normalizar incidentes con procedencia, fecha, ámbito y ubicación verificados. La cobertura de Adif debe seguir marcada como no disponible mientras continúe el rechazo HTTP 403.
