import { useEffect, useState } from "react";
import { Compass, Gauge, MapPin, Radio, TrainFront } from "lucide-react";
import type { Train, UnlocatedTrain } from "../types";
import { cn, formatTime } from "../lib/utils";
import { Badge, Modal } from "./ui";

export function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function ageSeconds(timestamp: number | null, now: number) {
  return timestamp ? Math.max(0, Math.floor(now / 1000 - timestamp)) : null;
}
export function ageText(timestamp: number | null, now: number) {
  if (timestamp && timestamp - now / 1000 > 30)
    return "con fecha futura incoherente";
  const age = ageSeconds(timestamp, now);
  return age === null
    ? "Sin fecha"
    : age < 60
      ? `hace ${age} s`
      : age < 3600
        ? `hace ${Math.floor(age / 60)} min`
        : age < 86400
          ? `hace ${Math.floor(age / 3600)} h`
          : `hace ${Math.floor(age / 86400)} días`;
}
export function SpeedValue({
  train,
  compact = false,
}: {
  train: Train;
  compact?: boolean;
}) {
  const value = train.speedKmh;
  return (
    <span
      title={
        train.speedKind === "estimated"
          ? `Media rectilínea entre dos posiciones publicadas, separadas ${train.speedWindowSeconds} segundos. No es velocidad instantánea ni sirve para detectar excesos de velocidad.`
          : "Velocidad comunicada por el vehículo en GTFS; si falta, no se considera cero."
      }
      className={cn(
        "inline-flex flex-col",
        compact ? "text-[10px]" : "text-sm",
      )}
    >
      <span
        className={cn(
          "font-semibold tabular-nums",
          train.positionStale && "text-muted",
        )}
      >
        {value == null ? "—" : Math.round(value)}
        <span className="ml-1 text-[10px] font-normal text-muted">km/h</span>
      </span>
      <span className="mt-0.5 text-[8px] font-normal text-muted">
        {value == null
          ? "No publicada"
          : train.speedKind === "estimated"
            ? `Media estimada · ${train.speedWindowSeconds} s`
            : train.positionStale
              ? "Lectura antigua"
              : "Publicada"}
      </span>
    </span>
  );
}
export function TelemetryPanel({
  train,
  demo,
}: {
  train: Train;
  demo: boolean;
}) {
  const now = useNow();
  const old =
    train.positionStale ||
    (train.timestamp
      ? now / 1000 - train.timestamp >
        (train.sourceId === "positions-ld" ? 1200 : 120)
      : true);
  return (
    <section className="mt-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-canvas/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] text-muted">
            <Gauge size={14} />
            Velocidad
          </div>
          <SpeedValue train={train} />
        </div>
        <div className="rounded-xl border border-line bg-canvas/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] text-muted">
            <Compass size={14} />
            Dirección
          </div>
          <p className="text-sm font-semibold">
            {train.bearing == null ? "—" : `${Math.round(train.bearing)}°`}
            <span className="ml-2 text-[10px] font-normal text-muted">
              {train.bearing == null
                ? "No publicada"
                : ["N", "NE", "E", "SE", "S", "SO", "O", "NO"][
                    Math.round(train.bearing / 45) % 8
                  ]}
            </span>
          </p>
          <p className="mt-1 text-[8px] text-muted">
            {train.bearing == null
              ? "Sin dato verificable"
              : train.bearingKind === "estimated"
                ? "Entre posiciones"
                : "Rumbo publicado"}
          </p>
        </div>
      </div>
      <div
        className={cn(
          "mt-3 flex items-start gap-2 rounded-lg p-3 text-[10px] leading-5",
          old ? "bg-amber-50 text-amber-800" : "bg-brand-50 text-brand-700",
        )}
      >
        <Radio size={14} className="mt-0.5 shrink-0" />
        <p>
          {demo
            ? "Simulación"
            : train.positionTimestampKind === "feed"
              ? "Fecha del feed; no consta la hora de medición individual"
              : "Posición publicada"}{" "}
          ·{" "}
          <strong className="font-semibold">
            {ageText(train.timestamp, now)}
          </strong>
          {old && ". La posición puede haber cambiado."}
        </p>
      </div>
      <p className="mt-2 text-[9px] leading-5 text-muted">
        {train.speedKind === "estimated"
          ? "La velocidad media usa distancia en línea recta entre lecturas: puede infravalorar el recorrido y tener error GPS. No es una medición instantánea."
          : train.speedKmh == null
            ? "Renfe no publica velocidad en esta lectura. La media requiere dos posiciones propias recientes y válidas; no se extrapola el movimiento."
            : "La velocidad se conserva con la fecha y unidad originales, convertida a km/h."}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-[10px]">
        {train.platform && (
          <div>
            <dt className="text-muted">Andén comunicado</dt>
            <dd className="mt-1 font-semibold">{train.platform}</dd>
          </div>
        )}
        {train.nextArrival && (
          <div>
            <dt className="text-muted">Llegada a próxima parada</dt>
            <dd className="mt-1 font-semibold">
              {formatTime(train.nextArrival)}
            </dd>
          </div>
        )}
        {train.rollingStock && (
          <div>
            <dt className="text-muted">Material publicado</dt>
            <dd className="mt-1 font-semibold">{train.rollingStock}</dd>
          </div>
        )}
        {train.accessible != null && (
          <div>
            <dt className="text-muted">Indicador de accesibilidad</dt>
            <dd className="mt-1 font-semibold">
              {train.accessible ? "Sí, según fuente" : "No, según fuente"}
            </dd>
          </div>
        )}
        {train.previousStop && (
          <div className="col-span-2">
            <dt className="text-muted">Parada anterior publicada</dt>
            <dd className="mt-1 font-medium">{train.previousStop}</dd>
          </div>
        )}
        {train.occupancy && (
          <div>
            <dt className="text-muted">Ocupación comunicada</dt>
            <dd className="mt-1">{train.occupancy}</dd>
          </div>
        )}
        {train.odometerKm != null && (
          <div>
            <dt className="text-muted">Odómetro comunicado</dt>
            <dd className="mt-1">{train.odometerKm.toFixed(1)} km</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
export function UnlocatedModal({
  trains,
  onClose,
}: {
  trains: UnlocatedTrain[];
  onClose: () => void;
}) {
  return (
    <Modal title="Servicios sin posición publicada" onClose={onClose}>
      <p className="mb-5 text-xs leading-6 text-muted">
        Las fuentes de Renfe incluyen estos {trains.length} servicios sin
        coordenadas. No se colocan en un punto supuesto del mapa. La lista
        tampoco incluye todos los operadores de España.
      </p>
      <div className="max-h-96 divide-y divide-line overflow-y-auto">
        {trains.map((t) => (
          <div
            key={`${t.sourceId}-${t.number}`}
            className="flex items-start gap-3 py-4"
          >
            <TrainFront size={17} className="mt-1 shrink-0 text-muted" />
            <div>
              <p className="text-xs font-semibold">
                {t.name} {t.number}
              </p>
              <p className="mt-1 text-[10px] text-muted">
                {t.origin || "Origen no publicado"} →{" "}
                {t.destination || "Destino no publicado"}
              </p>
              <Badge tone="gray" className="mt-2">
                <MapPin size={10} />
                Sin coordenadas
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
