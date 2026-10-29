# Diagnóstico de Adif en producción

La consulta a Adif se realiza en el servidor (`/api/network`), no directamente desde el navegador. Localhost y Vercel salen a Internet desde redes diferentes y mantienen cachés en memoria independientes. Una descarga correcta en local no demuestra que la misma descarga funcione desde Vercel. No es un problema de CORS del navegador cuando la API responde y solo falla esta fuente.

El 29/10/2026 se contrastaron ambas APIs: producción devolvía `adif-traffic` y `adif-works` como `unavailable`, sin descarga válida conservada (`fetchedAt: null`) y sin comunicados de Adif. Localhost recuperaba ambos boletines; tráfico seguía marcado `stale` por el aviso de mantenimiento publicado por Adif. No se identificó la causa concreta de la descarga en Vercel porque el código desplegado solo devolvía un mensaje genérico.

Tras desplegar el diagnóstico, el campo `sources[].error`, el bloque de accidentes y los logs de la función muestran por separado HTTP, tiempo máximo de espera, errores conocidos de DNS/TLS/conexión o HTML no interpretable. No se publican cuerpos HTML, credenciales ni trazas. En Vercel → Logs, filtrar por `/api/network` y `[Safel] adif-`. La caché de consultas y la CDN pueden retrasar la aparición del nuevo diagnóstico.

- HTTP 403/429: revisar acceso permitido y límites con Adif. No eludir controles ni añadir reintentos agresivos.
- Tiempo de espera/conexión/DNS: revisar los logs y la conectividad de la región donde se ejecuta la función. Cambiar región solo después de comprobar el origen del fallo.
- TLS: revisar certificados y compatibilidad del entorno. No desactivar la validación TLS.
- HTML no interpretable: contrastar la respuesta real y adaptar la extracción con pruebas; no convertirla en cero incidencias.

No se ha alterado la política de cobertura ni insertado una copia de avisos de localhost en producción. Una caché persistente podría conservar la última descarga válida entre instancias, pero no arreglaría por sí sola un bloqueo de acceso ni haría actuales los avisos guardados.
