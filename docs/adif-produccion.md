# Diagnóstico de Adif en producción

La consulta a Adif se realiza en el servidor (`/api/network`), no directamente desde el navegador. Localhost y Vercel salen a Internet desde redes diferentes y mantienen cachés en memoria independientes. Una descarga correcta en local no demuestra que la misma descarga funcione desde Vercel. No es un problema de CORS del navegador cuando la API responde y solo falla esta fuente.

El 29/10/2026 se contrastaron ambas APIs: producción devolvía `adif-traffic` y `adif-works` como `unavailable`, sin descarga válida conservada (`fetchedAt: null`) y sin comunicados de Adif. Localhost recuperaba ambos boletines; tráfico seguía marcado `stale` por el aviso de mantenimiento publicado por Adif. No se identificó la causa concreta de la descarga en Vercel porque el código desplegado solo devolvía un mensaje genérico.

Tras desplegar el diagnóstico, el campo `sources[].error`, el bloque de accidentes y los logs de la función muestran por separado HTTP, tiempo máximo de espera, errores conocidos de DNS/TLS/conexión o HTML no interpretable. No se publican cuerpos HTML, credenciales ni trazas. En Vercel → Logs, filtrar por `/api/network` y `[Safel] adif-`. La caché de consultas y la CDN pueden retrasar la aparición del nuevo diagnóstico.

- HTTP 403/429: revisar acceso permitido y límites con Adif. No eludir controles ni añadir reintentos agresivos.
- Tiempo de espera/conexión/DNS: revisar los logs y la conectividad de la región donde se ejecuta la función. Cambiar región solo después de comprobar el origen del fallo.
- TLS: revisar certificados y compatibilidad del entorno. No desactivar la validación TLS.
- HTML no interpretable: contrastar la respuesta real y adaptar la extracción con pruebas; no convertirla en cero incidencias.

No se ha alterado la política de cobertura ni insertado una copia de avisos de localhost en producción. Una caché persistente podría conservar la última descarga válida entre instancias, pero no arreglaría por sí sola un bloqueo de acceso ni haría actuales los avisos guardados.

Se prepara una prueba con `User-Agent` de navegador, `Accept` de HTML y `Accept-Language: es-ES,es;q=0.9` en ambas consultas a Adif. No cambia la interfaz ni los estados de error. La cabecera `X-Safel-Revision` permite contrastar el commit del backend desplegado antes de interpretar el resultado: una respuesta de una revisión anterior no valida la prueba. El resultado solo se confirma consultando desde Vercel; el éxito local no basta.

## Pruebas de alternativas gratuitas (29/10/2026)

Las cabeceras de navegador se desplegaron en `c5daf49`: ambas fuentes de Adif continuaron respondiendo HTTP 403 desde Vercel.

Se probaron los endpoints reales de los proxies con la URL pública `https://www.adif.es/viajeros/estado-de-la-red`, sin credenciales:

- AllOrigins: `https://api.allorigins.win/get?url=<URL codificada>`. No respondió dentro de 15 segundos desde el equipo de desarrollo. No se pudo validar contenido de Adif; esto no demuestra que falle desde todas las redes.
- CORS Anywhere: `https://cors-anywhere.herokuapp.com/<URL completa>`. Respondió HTTP 403 con un formulario de activación temporal de la demo. Su propia documentación reserva esa instancia para desarrollo; no se incorpora como dependencia de producción.

Adif sirve HTML, por lo que no corresponde ejecutar `JSON.parse` sobre `contents`. Tampoco basta con recibir un HTTP 200 del proxy: hay que comprobar el estado del origen y validar el boletín antes de considerar disponible la fuente.

Se configura una única región de funciones, París (`cdg1`), compatible con Hobby. Madrid (`mad1`) no aparece en la lista oficial de regiones de cómputo. `X-Safel-Region` permite comprobar la región efectiva del backend, junto con `X-Safel-Revision`; la región de la CDN no demuestra dónde se ejecutó la función. El cambio no garantiza acceso a Adif. No se contrata un proxy ni se añade una dependencia de pago.

Referencias: [regiones de Vercel](https://vercel.com/docs/regions), [configuración y límites por plan](https://vercel.com/docs/functions/configuring-functions/region), [AllOrigins](https://github.com/gnuns/allOrigins), [CORS Anywhere](https://github.com/Rob--W/cors-anywhere).
