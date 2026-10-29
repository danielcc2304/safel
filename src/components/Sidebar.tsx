import {
  Bookmark,
  ChevronRight,
  CircleHelp,
  Database,
  Map,
  MapPinned,
  Menu,
  Newspaper,
  Radio,
  Settings2,
  ShieldCheck,
  TrainFront,
  TriangleAlert,
  X,
} from "lucide-react";
import type { Page } from "../types";
import { cn } from "../lib/utils";
import { IconButton } from "./ui";
import { BrandMark } from "./BrandMark";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-brand-800">
      <BrandMark className={small ? "size-8" : "size-10"} />
      <span
        className={cn(
          "font-display font-extrabold tracking-[-1.8px]",
          small ? "text-3xl" : "text-[38px]",
        )}
      >
        safel<span className="text-brand-400">.</span>
      </span>
    </div>
  );
}
const items = [
  { id: "map", label: "Mapa en vivo", icon: Map },
  { id: "trains", label: "Trenes", icon: TrainFront },
  { id: "incidents", label: "Incidencias", icon: TriangleAlert },
  { id: "saved", label: "Mis trayectos", icon: Bookmark },
] as const;
export function Sidebar({
  page,
  setPage,
  incidentCount,
  savedCount,
  open,
  setOpen,
  onHelp,
  onSettings,
}: {
  page: Page;
  setPage: (p: Page) => void;
  incidentCount: number;
  savedCount: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  onHelp: () => void;
  onSettings: () => void;
}) {
  const navigate = (p: Page) => {
    setPage(p);
    setOpen(false);
  };
  return (
    <>
      {open && (
        <button
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-40 bg-brand-900/20 backdrop-blur-xs lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[218px] flex-col border-r border-line bg-white transition-transform duration-300 lg:translate-x-0",
          !open && "-translate-x-full",
        )}
      >
        <div className="flex h-[92px] items-center justify-between px-7">
          <button onClick={() => navigate("map")} aria-label="Safel, inicio">
            <Logo />
          </button>
          <IconButton
            label="Cerrar menú"
            className="lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X size={17} />
          </IconButton>
        </div>
        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[9px] font-semibold tracking-[1.6px] text-muted">
            CENTRO DE CONTROL
          </p>
          <nav aria-label="Navegación principal" className="space-y-1.5">
            {items.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => navigate(id)}
                className={cn(
                  "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-[12px] transition-colors",
                  page === id
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-zinc-500 hover:bg-canvas hover:text-ink",
                )}
              >
                <Icon size={17} strokeWidth={1.65} />
                {label}
                {id === "map" && (
                  <span className="ml-auto size-1.5 rounded-full bg-brand-500" />
                )}
                {id === "incidents" && incidentCount > 0 && (
                  <span className="ml-auto rounded bg-amber-50 px-1.5 py-.5 text-[10px] text-amber-700">
                    {incidentCount}
                  </span>
                )}
                {id === "saved" && savedCount > 0 && (
                  <span className="ml-auto text-[10px]">{savedCount}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="mx-7 my-7 border-t border-line" />
        <div className="px-4">
          <p className="mb-3 px-3 text-[9px] font-semibold tracking-[1.6px] text-muted">
            EXPLORAR
          </p>
          {(
            [
              { id: "stations", label: "Estaciones", icon: MapPinned },
              { id: "news", label: "Noticias ferroviarias", icon: Newspaper },
              { id: "sources", label: "Fuentes y cobertura", icon: Database },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={cn(
                "mb-1.5 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-[12px] transition-colors",
                page === id
                  ? "bg-brand-50 font-semibold text-brand-700"
                  : "text-zinc-500 hover:bg-canvas",
              )}
            >
              <Icon size={17} strokeWidth={1.65} />
              {label}
            </button>
          ))}
        </div>
        <div className="mt-auto px-5 pb-5 pt-10">
          <div className="rounded-xl bg-brand-900 p-4 text-white">
            <div className="mb-4 flex items-center justify-between">
              <ShieldCheck
                size={24}
                className="text-brand-200"
                strokeWidth={1.5}
              />
              <Radio size={16} className="text-brand-400" />
            </div>
            <p className="font-display text-sm font-semibold leading-relaxed">
              La información te
              <br />
              acompaña.
            </p>
            <p className="mt-2 text-[10px] leading-relaxed text-brand-200/80">
              Datos públicos para seguir
              <br />
              cada trayecto más de cerca.
            </p>
            <button
              onClick={() => navigate("sources")}
              className="mt-4 flex items-center gap-2 text-[10px] font-medium text-brand-200"
            >
              Conoce el proyecto
              <ChevronRight size={12} />
            </button>
          </div>
          <div className="mt-5 space-y-1">
            <button
              onClick={onHelp}
              className="flex h-9 w-full items-center gap-3 px-2 text-[11px] text-muted hover:text-brand-700"
            >
              <CircleHelp size={16} />
              Ayuda y preguntas
            </button>
            <button
              onClick={onSettings}
              className="flex h-9 w-full items-center gap-3 px-2 text-[11px] text-muted hover:text-brand-700"
            >
              <Settings2 size={16} />
              Preferencias
            </button>
          </div>
          <div className="mt-5 border-t border-line pt-4 text-[9px] tracking-wide text-muted">
            SAFE + TRAVEL <span className="float-right">HECHO EN ESPAÑA</span>
          </div>
        </div>
      </aside>
    </>
  );
}
export function MobileMenu({ onClick }: { onClick: () => void }) {
  return (
    <IconButton label="Abrir menú" className="lg:hidden" onClick={onClick}>
      <Menu size={20} />
    </IconButton>
  );
}
