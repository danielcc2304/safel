# Noticias nacionales de accidentes ferroviarios

Safel integra dos fuentes complementarias en `/api/network`, bajo `railNews`. Son publicaciones periodísticas seleccionadas sobre España, no un registro exhaustivo de accidentes ni una conexión a emergencias. El rechazo de acceso a Adif sigue siendo visible y no se considera resuelto por recuperar noticias.

## Fuentes

- **GDELT DOC 2.0**: API JSON sin clave. Busca términos ferroviarios de accidente y referencias a España, Renfe o Adif en los últimos tres días, con un máximo de 75 resultados por consulta. Consulta cada 15 minutos por instancia, peticiones simultáneas agrupadas y respeto de `Retry-After` numérico en respuestas 429. [Documentación](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) y [condiciones](https://www.gdeltproject.org/about.html).
- **RTVE**: descubre hasta ocho candidatos entre los titulares enlazados en la portada nacional de Noticias y consulta sus fichas JSON en `https://api.rtve.es/api/noticias/{id}.json`. Verifica título, URL oficial, fecha original y ámbito español. Consulta cada cinco minutos por instancia. Es un servicio público accesible, sin contrato de estabilidad de esta integración. No es una API de alertas operativas. [Portada](https://www.rtve.es/noticias/).

Las consultas se ejecutan en paralelo con el resto de fuentes y un máximo de diez segundos por proveedor, incluidas las fichas de RTVE. No requieren nuevas variables ni cuentas. La caché es de memoria por instancia, no un almacén persistente ni un limitador global entre instancias de Vercel. Los límites o fallos se comunican sin intentar eludirlos.

## Integridad y presentación

- Solo titulares, medio, enlace y fechas; no se copian artículos completos ni imágenes.
- GDELT `seendate` se conserva como **indexación**, nunca como publicación ni hora del accidente. La publicación queda desconocida. RTVE `publicationDateTimestamp` se conserva como publicación del artículo, no fecha del accidente.
- Se excluyen enlaces inseguros, fechas inválidas/futuras o anteriores a 72 horas, titulares sin contexto ferroviario y español y varias referencias explícitas a simulacros, aniversarios o sucesos extranjeros.
- La selección es heurística: puede excluir sucesos pertinentes, recoger análisis sobre sucesos anteriores u omitir acontecimientos no publicados. RTVE se limita a los candidatos presentes en su portada; no se recorre todo el archivo.
- Deduplicación por URL sin fragmentos ni parámetros habituales de seguimiento. Diferentes artículos pueden describir el mismo accidente y nunca se cuentan como sucesos distintos.
- «Noticias ferroviarias · España» aparece en las vistas públicas, separado de `incidents`, del contador de avisos operativos y de los pines. No se asocian publicaciones a trenes por proximidad supuesta.
- Una respuesta errónea no equivale a cero accidentes. Se conservan publicaciones válidas aún dentro del intervalo con fechas originales y estado desactualizado. Una lectura válida vacía las elimina.

## Comprobaciones

El 29/10/2026 la API local devolvió dos artículos reales de RTVE con fecha verificada. GDELT devolvió un 429 en una prueba directa y no respondió en el plazo de otra consulta. Su integración permanece no disponible cuando falla; no se insertan resultados ficticios. Hace falta comprobar la ejecución del nuevo despliegue en Vercel: el éxito local no certifica acceso desde producción.

Las pruebas cubren publicación/indexación, ámbito ferroviario y nacional, referencias históricas, URLs, deduplicación, estructura desconocida, conservación y recuperación de caché, agrupación de consultas y espera de 429. Las fuentes nuevas no fabrican incidentes operativos.
