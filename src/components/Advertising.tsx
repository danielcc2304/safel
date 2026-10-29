import { useEffect, useRef, useState } from "react";
import { advertisingConfig } from "../lib/advertising";
import { openAdConsent, requestAd } from "../lib/adsense";
import { Modal, ExternalLink } from "./ui";

const config = advertisingConfig(import.meta.env, import.meta.env.DEV);

export function Advertising() {
  const slot = useRef<HTMLModElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (config.mode !== "live" || !slot.current) return;
    const element = slot.current;
    let active = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void requestAd(element, config.client, () => active).catch(() => {
          if (active) setFailed(true);
        });
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);

  if (config.mode === "off" || failed) return null;
  return (
    <aside aria-label="Publicidad" className="mt-8 border-y border-line py-5">
      <p className="mb-3 text-center text-[9px] uppercase tracking-[0.16em] text-muted">
        Publicidad
      </p>
      {config.mode === "preview" ? (
        <div className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-white px-5 text-center sm:min-h-24">
          <p className="text-xs font-medium text-zinc-500">
            Espacio publicitario
          </p>
          <p className="text-[10px] text-muted">
            Vista previa · sin anuncios reales ni conexiones publicitarias
          </p>
        </div>
      ) : (
        <ins
          ref={slot}
          className="adsbygoogle block min-h-28 w-full sm:min-h-24"
          data-ad-client={config.client}
          data-ad-slot={config.slot}
          data-ad-format="horizontal"
          data-full-width-responsive="false"
        />
      )}
    </aside>
  );
}

export function AdvertisingPrivacy() {
  const [open, setOpen] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="hover:text-brand-700">
        Privacidad y publicidad
      </button>
      {open && (
        <Modal title="Privacidad y publicidad" onClose={() => setOpen(false)}>
          <div className="space-y-4 text-xs leading-6 text-zinc-600">
            <p>
              Safel guarda tus preferencias y trayectos en este navegador. Las
              consultas del mapa y de las fuentes públicas se realizan a sus
              respectivos proveedores.
            </p>
            <p>
              {config.mode === "live"
                ? "Safel utiliza Google AdSense para mostrar publicidad. Google y sus socios pueden tratar datos de conexión y utilizar cookies o identificadores según tus preferencias y las opciones de consentimiento disponibles en tu región. El panel de Google detalla los proveedores y las finalidades."
                : "La publicidad real está desactivada. Los espacios de vista previa son ilustrativos y no cargan el servicio publicitario de Google."}
            </p>
            <p>
              Los anuncios se identifican como publicidad y se muestran
              separados de los avisos ferroviarios.
            </p>
            {config.mode === "live" && (
              <>
                <button
                  className="rounded-lg border border-line px-4 py-2 font-semibold text-brand-700"
                  onClick={() => setUnavailable(!openAdConsent())}
                >
                  Gestionar consentimiento publicitario
                </button>
                {unavailable && (
                  <p role="status">
                    El panel de Google no está disponible. Puede que todavía no
                    se haya cargado o que esté bloqueado por el navegador. Esta
                    acción no ha cambiado tus preferencias.
                  </p>
                )}
                <ExternalLink href="https://policies.google.com/technologies/partner-sites">
                  Cómo utiliza Google la información
                </ExternalLink>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
