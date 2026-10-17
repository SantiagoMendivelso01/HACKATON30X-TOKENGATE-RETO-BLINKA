/** Marca: figura simple + "blinka" en minúsculas, con el producto al lado. */
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg bg-foreground ${className}`}
      aria-hidden
    >
      <span className="block h-[52%] w-[34%] rounded-[2px_8px_8px_2px] bg-background" />
    </span>
  );
}

export function Wordmark({
  product = true,
  className = "",
}: {
  product?: boolean;
  className?: string;
}) {
  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      <span className="flex items-center gap-1.5 text-[19px] font-semibold tracking-[-0.04em] text-foreground">
        <span
          className="inline-block h-5 w-3.5 rounded-[3px_10px_10px_3px] bg-foreground"
          aria-hidden
        />
        blinka
      </span>
      {product && (
        <>
          <span className="h-5 w-px bg-border" aria-hidden />
          <span className="truncate text-sm font-medium text-foreground">Agente pagador</span>
        </>
      )}
    </span>
  );
}
