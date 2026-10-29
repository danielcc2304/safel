import { useEffect, useRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowUpRight, SearchX, X } from "lucide-react";
import { cn } from "../lib/utils";

export function Button({
  children,
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
}) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-xs font-semibold transition-all duration-200 active:scale-[.98]",
        variant === "primary"
          ? "bg-brand-700 text-white hover:bg-brand-800"
          : variant === "ghost"
            ? "text-muted hover:bg-brand-50 hover:text-brand-700"
            : "border border-line bg-white text-ink shadow-xs hover:border-brand-200 hover:bg-brand-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
export function IconButton({
  children,
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-brand-50 hover:text-brand-700",
        className,
      )}
    >
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "green",
  className,
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "red" | "gray" | "blue";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-medium leading-none",
        {
          green: "bg-brand-50 text-brand-600",
          amber: "bg-amber-50 text-amber-700",
          red: "bg-red-50 text-red-600",
          gray: "bg-zinc-100 text-zinc-500",
          blue: "bg-sky-50 text-sky-700",
        }[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
export function Dot({ className }: { className?: string }) {
  return (
    <span
      className={cn("size-1.5 shrink-0 rounded-full bg-current", className)}
    />
  );
}
export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-canvas text-muted">
        <SearchX size={21} strokeWidth={1.5} />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline",
        className,
      )}
    >
      {children}
      <ArrowUpRight size={13} />
    </a>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "fixed inset-0 m-auto max-h-[88svh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-brand-900/30 backdrop:backdrop-blur-xs",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-6 py-4">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <IconButton label="Cerrar" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}
