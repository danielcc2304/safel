# Publicidad en Safel

Safel integra Google **AdSense para web**. AdMob se utiliza para aplicaciones móviles; sus identificadores `ca-app-pub-…` no sirven para esta integración. No hay anuncios reales activados, cuenta creada ni ingresos en marcha.

El propietario ha facilitado el editor público `ca-pub-9032956068429485`, incorporado a `.env`. La compilación genera su etiqueta de verificación y `ads.txt`. El script oficial proporcionado se cargará con ese mismo editor al activar el bloque. No se ha accedido a la cuenta ni verificado su aprobación. Faltan el identificador del bloque y la configuración del consentimiento; en producción la publicidad permanece apagada.

## Configuración

1. Crear o utilizar una cuenta de AdSense, añadir el dominio definitivo y completar la revisión del sitio. El cobro, la aprobación y los anuncios disponibles dependen de Google.
2. Crear un bloque de anuncios **display adaptable** y copiar su editor `ca-pub-…` y su bloque numérico. Desactivar los anuncios automáticos en AdSense si se quiere conservar la ubicación manual de Safel: los anuncios automáticos se controlan desde la cuenta y podrían añadir formatos o ubicaciones adicionales.
3. En AdSense → Privacidad y mensajes, configurar y publicar el mensaje de normativas europeas de la CMP de Google para ese dominio, en español y con opción de rechazo. Incluir la política de privacidad del titular con identidad, contacto, finalidades, proveedores y derechos correspondientes. El diálogo informativo incluido en Safel no sustituye esa política ni la CMP certificada.
4. Añadir estas variables al proyecto de Vercel, **solo en Production**:

   ```dotenv
   VITE_ADS_MODE=live
   VITE_ADSENSE_CLIENT=ca-pub-TU_ID_DE_16_DIGITOS
   VITE_ADSENSE_SLOT=TU_BLOQUE_DE_10_DIGITOS
   VITE_ADSENSE_CMP_READY=true
   ```

   `VITE_ADSENSE_CMP_READY` es una confirmación de configuración del propietario, no una comprobación automática ni el consentimiento del visitante. El consentimiento lo gestiona Google mediante su CMP y las señales TCF. No activar hasta verificarla en el dominio real. Las variables `VITE_` son públicas; no introducir secretos. Recompilar después de cambiarlas.

5. Al compilar con un editor válido se generan `/ads.txt` y la etiqueta `google-adsense-account` para verificar el sitio, incluso con `VITE_ADS_MODE=off`. Esto permite solicitar la revisión antes de activar anuncios. Comparar el contenido de `ads.txt` con el proporcionado por la cuenta.
6. En el sitio publicado comprobar el mensaje de consentimiento (incluido rechazo y cambio de preferencias), la política de privacidad, `/ads.txt`, los informes de AdSense y el espacio adaptable en móvil. Probar el mensaje con los parámetros oficiales `?fc=alwaysshow&fctype=gdpr`. La vista previa de Safel no valida una cuenta ni simula el consentimiento real.

Para preparar la revisión sin servir anuncios: configurar solo el editor y mantener `VITE_ADS_MODE=off`. Para revisar el diseño: `VITE_ADS_MODE=preview`. En desarrollo la vista previa es el valor predeterminado y el modo `live` se bloquea. No hay identificadores reales ni de pruebas incluidos.

## Comportamiento

- Un único espacio con etiqueta «Publicidad» al final del contenido, separado de controles, mapa, comunicados y modales. La prioridad de accidentes se mantiene.
- Carga al acercarse al espacio publicitario, con el script oficial de AdSense compartido. No se recargan anuncios al consultar trenes cada 20 segundos ni al cambiar de vista.
- Los fallos o bloqueadores publicitarios no interrumpen las consultas ferroviarias. La ausencia de anuncio no genera avisos ficticios ni ingresos simulados.
- El enlace del pie «Privacidad y publicidad» informa del estado de la integración y permite abrir el panel de revocación de Google cuando esté disponible. No hay un banner de consentimiento inventado que sustituya a la CMP.
- Apagar anuncios mediante `VITE_ADS_MODE=off` y recompilar. En despliegues Preview de Vercel, mantener `off` o `preview`.

## Antes de monetizar el despliegue

El proveedor gratuito de teselas OpenRailwayMap usado por las capas de Safel tiene condiciones de uso para su infraestructura. El README ya documenta el límite de uso no comercial de baja demanda. Antes de activar publicidad en producción, acordar un uso comercial o sustituir/alojar esas capas; la licencia de los datos no equivale al permiso de uso ilimitado del servicio. Revisar también las condiciones de las demás fuentes y del proveedor de mapa para el volumen previsto.

La aprobación del sitio, el tráfico válido, el consentimiento y los anunciantes determinan la entrega y los ingresos; esta integración no garantiza una cantidad. No hacer clic en anuncios propios para probarlos.

## Referencias oficiales

- [AdSense, AdMob y Ad Manager](https://support.google.com/admob/answer/9234653)
- [Bloques adaptables](https://support.google.com/adsense/answer/9183460)
- [Mensaje de normativas europeas](https://support.google.com/adsense/answer/10960768)
- [Requisitos de CMP certificada](https://support.google.com/adsense/answer/13554020)
- [Revocación del consentimiento](https://support.google.com/adsense/answer/10959060)
- [Guía ads.txt](https://support.google.com/adsense/answer/12171612)
