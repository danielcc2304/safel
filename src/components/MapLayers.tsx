import { ChevronDown, Layers2, RefreshCw, X } from "lucide-react";
import { TileLayer, WMSTileLayer } from "react-leaflet";
import { cn } from "../lib/utils";

export type BaseMap = "street" | "imagery" | "simple";
export type RailLayer =
  "none" | "standard" | "maxspeed" | "electrification" | "signals";
export interface MapVisibility {
  trains: boolean;
  routes: boolean;
  stations: boolean;
  incidents: boolean;
}
export const railNames: Record<RailLayer, string> = {
  none: "Sin capa ferroviaria",
  standard: "Vías y estaciones",
  maxspeed: "Velocidades de vía",
  electrification: "Electrificación",
  signals: "Señalización",
};
export function RasterLayers({
  base,
  rail,
  baseError,
  railError,
  attempt,
  onBaseError,
  onRailError,
}: {
  base: BaseMap;
  rail: RailLayer;
  baseError: boolean;
  railError: boolean;
  attempt: number;
  onBaseError: () => void;
  onRailError: () => void;
}) {
  return (
    <>
      {base === "street" && !baseError && (
        <TileLayer
          key={`street-${attempt}`}
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={19}
          maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          eventHandlers={{ tileerror: onBaseError }}
        />
      )}
      {base === "imagery" && !baseError && (
        <WMSTileLayer
          key={`imagery-${attempt}`}
          url="https://www.ign.es/wms-inspire/pnoa-ma"
          layers="OI.OrthoimageCoverage"
          format="image/jpeg"
          version="1.1.1"
          maxZoom={19}
          attribution='<a href="https://pnoa.ign.es/">IGN · PNOA</a> · imágenes de archivo, no en directo'
          eventHandlers={{ tileerror: onBaseError }}
        />
      )}
      {rail !== "none" && !railError && (
        <TileLayer
          key={`${rail}-${attempt}`}
          url={`https://tiles.openrailwaymap.org/${rail}/{z}/{x}/{y}.png`}
          maxNativeZoom={19}
          maxZoom={19}
          zIndex={300}
          attribution='<a href="https://www.openstreetmap.org/copyright">© OSM</a> · <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> · <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC BY-SA 2.0</a>'
          eventHandlers={{ tileerror: onRailError }}
        />
      )}
    </>
  );
}
export function MapLayersControl({
  open,
  setOpen,
  base,
  setBase,
  rail,
  setRail,
  visible,
  setVisible,
  baseError,
  railError,
  retry,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  base: BaseMap;
  setBase: (v: BaseMap) => void;
  rail: RailLayer;
  setRail: (v: RailLayer) => void;
  visible: MapVisibility;
  setVisible: (v: MapVisibility) => void;
  baseError: boolean;
  railError: boolean;
  retry: () => void;
}) {
  return (
    <div className="absolute right-4 top-4 z-20">
      <button
        aria-label="Capas del mapa"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[11px] shadow-sm"
      >
        <Layers2 size={15} />
        <span className="hidden sm:inline">Capas</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-12 max-h-[355px] w-64 overflow-y-auto rounded-xl border border-line bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold">Personaliza el mapa</span>
            <button aria-label="Cerrar capas" onClick={() => setOpen(false)}>
              <X size={14} />
            </button>
          </div>
          <fieldset>
            <legend className="mb-2 text-[9px] font-semibold tracking-wide text-muted">
              MAPA BASE
            </legend>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: "street", label: "Callejero" },
                  { id: "imagery", label: "Ortofoto" },
                  { id: "simple", label: "Sin conexión" },
                ] as const
              ).map((b) => (
                <button
                  key={b.id}
                  aria-pressed={base === b.id}
                  onClick={() => setBase(b.id)}
                  className={cn(
                    "rounded-lg border px-1 py-2.5 text-[10px]",
                    base === b.id
                      ? "border-brand-200 bg-brand-50 font-semibold text-brand-700"
                      : "border-line text-muted hover:bg-canvas",
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="mt-4 block text-[9px] font-semibold tracking-wide text-muted">
            CAPA FERROVIARIA
            <select
              aria-label="Capa ferroviaria"
              value={rail}
              onChange={(e) => setRail(e.target.value as RailLayer)}
              className="mt-2 h-9 w-full rounded-lg border border-line bg-white px-2 text-[11px] font-normal tracking-normal text-ink"
            >
              {Object.entries(railNames).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-[9px] leading-4 text-muted">
            Cartografía comunitaria estática. Sus límites y señales no indican
            restricciones operativas actuales ni el estado de seguridad.
          </p>
          <div className="mt-3 border-t border-line pt-2">
            {Object.entries({
              trains: "Trenes localizados",
              stations: "Estaciones de referencia",
              incidents: "Avisos con coordenadas",
              routes: "Corredores esquemáticos",
            }).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 py-2 text-[10px]"
              >
                <input
                  type="checkbox"
                  className="accent-brand-600"
                  checked={visible[key as keyof MapVisibility]}
                  onChange={(e) =>
                    setVisible({ ...visible, [key]: e.target.checked })
                  }
                />
                {label}
              </label>
            ))}
          </div>
          {(baseError || railError) && (
            <button
              onClick={retry}
              className="mt-2 flex items-center gap-2 text-[10px] font-medium text-amber-700"
            >
              <RefreshCw size={12} />
              Reintentar capas no disponibles
            </button>
          )}
          <p className="mt-3 border-t border-line pt-3 text-[9px] leading-4 text-muted">
            Callejero: OSM · Ortofoto: IGN/PNOA · Ferrocarril: OpenRailwayMap.
            Disponibilidad sujeta a sus proveedores.
          </p>
        </div>
      )}
    </div>
  );
}
