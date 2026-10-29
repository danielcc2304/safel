# Safel

Seguimiento de la red ferroviaria española con React 19, TypeScript, Tailwind CSS 4, Vite y Leaflet. Proyecto independiente, sin afiliación con Renfe o Adif.

## Desarrollo y comprobaciones

Node.js 24 y npm. No se necesitan claves para las fuentes actualmente integradas.

```sh
npm ci
npm run dev
npm run test
npm run build
npm run preview
```

Abrir la URL de Vite, normalmente `http://localhost:5173`. Desarrollo y preview incluyen `/api/network`; no hace falta otro proceso. El modo Demostración siempre está identificado y separado del modo público. Los fallos de las fuentes nunca activan una demostración silenciosamente.

## Qué incluye

- Mapa callejero real por defecto, ortofoto IGN/PNOA y contornos locales como alternativa sin conexión.
- Capas OpenRailwayMap de vías, velocidad cartográfica, electrificación y señalización, disponibles al seleccionarlas.
- Posiciones publicadas, agrupación de marcadores, vista nacional/regional, zoom y pantalla completa.
- Al seleccionar un tren se centra el mapa y aparece una tarjeta resumida, sin abrir paneles. El botón «Ver detalles» abre un modal centrado; al cerrarlo se conserva la selección. Incluye seguimiento opcional de cámara, búsqueda y filtros de servicio.
- Velocidad y rumbo publicados si el feed los proporciona; media rectilínea estimada cuando hay dos observaciones recientes válidas.
- Fecha y antigüedad de cada posición; lectura antigua diferenciada visualmente.
- Itinerarios y horarios del visor Renfe, próxima parada y llegada prevista, parada anterior, material, accesibilidad y andén cuando se comunican.
- Boletines de estado de la red y obras de Adif; avisos GTFS de Cercanías. Categorías, fuente, fechas y enlaces originales.
- Listado de servicios sin coordenadas y contador de avisos sin ubicación verificada.
- Guardados locales, enlaces compartibles, exportación CSV con telemetría y centro de cambios de demora durante la sesión.
- Catálogo de estaciones de Renfe independiente de los trenes localizados, panel de cobertura, preferencias, navegación móvil y diálogos accesibles.

## Fuentes integradas

| Fuente                              | Dirección                                                                           | Consulta / cadencia                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Visor público Renfe · posiciones LD | https://tiempo-real.largorecorrido.renfe.com/renfe-visor/flotaLD.json               | Safel consulta cada 20 s; cadencia del publicador no garantizada |
| Visor Renfe · itinerarios           | https://tiempo-real.largorecorrido.renfe.com/renfe-visor/trenesConEstacionesLD.json | Consulta cada minuto                                             |
| Visor Renfe · estaciones            | https://tiempo-real.largorecorrido.renfe.com/data/estaciones.geojson                | Consulta cada 12 h                                               |
| GTFS posiciones AV/LD/MD            | https://gtfsrt.renfe.com/vehicle_positions_LD.json                                  | Alternativa; cadencia publicada 15 min                           |
| GTFS posiciones Cercanías           | https://gtfsrt.renfe.com/vehicle_positions.json                                     | Cadencia publicada 20 s                                          |
| Actualizaciones AV/LD/MD            | https://gtfsrt.renfe.com/trip_updates_LD.json                                       | Cadencia publicada 30 s                                          |
| Actualizaciones Cercanías           | https://gtfsrt.renfe.com/trip_updates.json                                          | Cadencia publicada 30 s                                          |
| Avisos Cercanías                    | https://gtfsrt.renfe.com/alerts.json                                                | Cadencia publicada 20 s                                          |
| Horarios GTFS AV/LD/MD              | https://ssl.renfe.com/gtransit/Fichero_AV_LD/google_transit.zip                     | Consulta cada 12 h                                               |
| Adif · estado de la red             | https://www.adif.es/viajeros/estado-de-la-red                                       | Boletines HTML, consulta cada 5 min                              |
| Adif · avisos y obras               | https://www.adif.es/viajeros/avisos                                                 | Resúmenes HTML y enlace al boletín, consulta cada 5 min          |

Los recursos del visor son públicos pero no constituyen una API contractual: pueden cambiar. Los boletines de Adif se extraen de sus páginas públicas, sin acceso a sistemas internos. Si cambia la estructura, la fuente se marca no disponible/desactualizada: no se convierte el error en cero avisos. Se distingue entre fecha individual del aviso, actualización de la página y hora de consulta; nunca se inventa una fecha de publicación.

Los datos GTFS del [catálogo de Renfe](https://data.renfe.com/) se atribuyen bajo CC BY 4.0. El resto de recursos conserva su procedencia y enlace original; revisar las condiciones de sus publicadores para un uso de producción.

## Integridad y límites del seguimiento

Safel consulta posiciones cada 20 segundos mientras la pestaña es visible. El proxy utiliza caché de 20 segundos y agrupa peticiones simultáneas. Las fuentes se consultan en paralelo con límites de 9–10 segundos. Los últimos datos válidos se conservan en la memoria de la instancia con la fecha original si falla una fuente; esa caché no es persistente ni compartida entre instancias de Vercel.

Para AV/LD/MD se elige la posición más reciente entre el visor y GTFS, por número de vehículo en el mismo ámbito. No se duplica la posición por varios identificadores de viaje. Los retrasos GTFS se asocian por `tripId` exacto; los datos del visor usan su propia demora publicada. Los metadatos de un viaje GTFS solo se unen al visor si coinciden fecha de servicio, número y ambos extremos del itinerario, sin ambigüedad. Los itinerarios del visor también requieren la misma fecha de servicio y coincidencia de origen y destino.

Se conserva la diferencia entre hora individual del vehículo y hora del feed. Una cabecera reciente no convierte automáticamente una observación antigua en actual. No se extrapola la posición entre consultas ni se colocan servicios sin coordenadas en un punto supuesto. Los itinerarios de Cercanías que no pueden resolverse con estos catálogos permanecen desconocidos, aunque su posición, línea, andén y siguiente estación puedan estar disponibles.

### Velocidad y rumbo

GTFS expresa velocidad instantánea en m/s: se convierte a km/h, preservando cero y valores ausentes. Los feeds consultados pueden no publicar este campo. El visor utilizado no aporta una velocidad con unidad documentada; no se inventa a partir de otros campos.

Cuando existen dos posiciones con hora individual, del mismo viaje, separadas entre 5 y 180 segundos, y la última tiene menos de 120 segundos, se puede calcular una **media estimada rectilínea**. Se etiqueta como tal y se conserva el intervalo de observación. La distancia recta puede infravalorar el recorrido; el ruido GPS también introduce error. Saltos superiores a 450 km/h se descartan como discontinuidades del dato, no como detecciones de exceso de velocidad. Tiempos invertidos, cambios de viaje, fechas futuras incoherentes, huecos largos y una hora de cabecera sin medición individual no generan estimaciones.

La historia necesaria para esta media reside en la memoria de la instancia. Un arranque en frío, cambio de instancia o falta de una segunda observación deja el dato como no disponible. No es velocidad instantánea, no permite deducir límites operativos ni evaluar una conducción.

### Seguridad y advertencias

Safel no certifica la seguridad de un trayecto. La ausencia de avisos no confirma normalidad. Los datos públicos no abarcan todos los fallos de infraestructura, señalización, trenes u operadores.

Se muestran boletines públicos de Adif sobre tráfico, catenarias, obras o accidentes cuando están publicados, además de los avisos GTFS de Renfe. No se ha integrado un canal público con reportes internos de maquinistas, libros de averías, señalización o telemetría técnica. No se inventan avisos ni se ofrece un formulario que aparente que una advertencia de un usuario es oficial.

La categoría se organiza mediante términos del texto. La afectación alta en Adif indica una suspensión explícitamente comunicada, no una probabilidad de accidente. En GTFS se utilizan efectos de servicio explícitos. Los avisos con fecha de fin vencida se excluyen; un aviso antiguo abierto conserva su antigüedad y no se da por vigente o resuelto automáticamente.

Un boletín sin coordenadas verificadas aparece en la lista y en el contador del mapa, sin pin supuesto. Los avisos asociados a un tren requieren identificadores exactos de ruta o parada. Los boletines generales de Adif se muestran separados en el detalle como contexto, con la advertencia de que no existe una relación confirmada con ese tren.

No se integran posiciones de Iryo, OUIGO u otros operadores autonómicos, AEMET, predicción de accidentes ni restricciones temporales completas. Las investigaciones históricas tampoco equivalen a un estado actual de circulación.

## Cartografía

El mapa base es [OpenStreetMap](https://www.openstreetmap.org/copyright), sujeto a su [política de teselas](https://operations.osmfoundation.org/policies/tiles/). La ortofoto usa el WMS de [IGN/PNOA](https://pnoa.ign.es/): imágenes de archivo, no satélite en directo. Los contornos locales de [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) son de dominio público.

Las capas de [OpenRailwayMap](https://wiki.openstreetmap.org/wiki/OpenRailwayMap/API) son cartografía comunitaria estática (datos ODbL y estilo CC BY-SA 2.0). Las velocidades, señales y electrificación que representan no son restricciones temporales vigentes ni telemetría del estado de la red. Se solicitan solo al seleccionar una capa; ante un error se detiene y se informa, sin reintentos automáticos. Su servicio está permitido para desarrollo de pequeña escala y aplicaciones públicas no comerciales de baja demanda. Para usos comerciales, privados de producción o tráfico elevado, configurar un proveedor/servidor adecuado antes de publicar.

Los corredores esquemáticos están desactivados inicialmente. La línea discontinua de un tren une puntos del itinerario publicados por Renfe, y no representa el trazado exacto de la vía. No se ajusta una posición GPS a una vía elegida sin evidencia. Los contornos locales solo se dibujan en el modo sin conexión o si falla el mapa base, para no tapar el callejero.

## Publicar en GitHub y Vercel

1. Subir el proyecto al repositorio sin `node_modules` ni `dist`.
2. Importar el repositorio en Vercel, con Node.js 24 y preset Vite.
3. `vercel.json` configura `npm run build`, salida `dist` y `/api/network`, con 30 segundos de duración máxima.
4. No hacen falta secretos. El servidor necesita HTTPS hacia `gtfsrt.renfe.com`, `ssl.renfe.com`, `tiempo-real.largorecorrido.renfe.com` y `www.adif.es`.
5. Verificar `/api/network` y Fuentes y cobertura tras desplegar. Revisar las condiciones de los proveedores de mapas para el público/volumen previstos.

No desplegar solamente `dist` en un alojamiento estático si se desean datos públicos: la función API resuelve CORS, descarga catálogos y normaliza las fuentes. Los enlaces `?tren=03113#map` abren seguimiento por número; `?modo=demo&tren=03113#map` preserva la identificación de demostración.

## Organización

- `src/components/`: componentes reutilizables de mapa, capas, telemetría, navegación, tablas y diálogos.
- `src/hooks/`: consultas periódicas y persistencia local.
- `src/data/`: demostración y corredores esquemáticos.
- `server/network.ts`: GTFS, catálogos y agregación.
- `server/visor.ts`: recursos públicos e itinerarios del visor Renfe.
- `server/adif.ts`: extracción y caché de boletines públicos.
- `server/telemetry.ts`: fechas de Madrid y estimación entre observaciones.
- `api/network.ts`: función compatible con Vercel y Vite.
- `tests/`: integridad de fechas, coordenadas, velocidad, asociaciones y fuentes caídas.

Guardados y preferencias permanecen en `localStorage`, separados por modo público/demostración. Los avisos de demora solo funcionan con Safel abierto; no se envían correos ni notificaciones en segundo plano. No se solicita ubicación personal ni se envían datos de familiares. Los proveedores de mapas reciben las peticiones de teselas seleccionadas. Las tipografías se cargan de Google Fonts y pueden alojarse localmente si se requiere evitar esa conexión.
