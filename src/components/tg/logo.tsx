export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground ${className}`} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M5 6h14" />
        <path d="M12 6v13" />
        <path d="M8 13l4 4 4-4" />
      </svg>
    </span>
  );
}
