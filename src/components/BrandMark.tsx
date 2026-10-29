import { cn } from "../lib/utils";

/** Train and padlock mark shared by the wordmark, header and favicon. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/favicon.svg?v=secure-train"
      width={48}
      height={48}
      alt=""
      aria-hidden="true"
      className={cn("shrink-0", className)}
    />
  );
}
