// Animated line art: fine strands that sway like silk, with a band of brand blue sliding across.
// Paths are updated straight on the DOM each frame (no React re-render). Still when the person
// prefers reduced motion.
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

type PathFn = (i: number, s: number) => string;

function useSway(ref: React.RefObject<SVGSVGElement | null>, path: PathFn) {
  useEffect(() => {
    const svg = ref.current;
    if (!svg || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const paths = [...svg.querySelectorAll<SVGPathElement>("path[data-line]")];
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const s = (now - t0) / 1000;
      paths.forEach((p, i) => p.setAttribute("d", path(i, s)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref, path]);
}

/** Gradient whose bright band travels from (x1→x2) over `dur`. */
export function Shine({
  id,
  from,
  to,
  dur,
  vertical = false,
}: {
  id: string;
  from: number;
  to: number;
  dur: string;
  vertical?: boolean;
}) {
  const span = vertical ? 420 : 400;
  return (
    <linearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      x1={from}
      y1="0"
      x2={from + span}
      y2={vertical ? 420 : 0}
    >
      <stop offset="0" stopColor="var(--line-art, #5f6f93)" />
      <stop offset="0.42" stopColor="var(--line-art, #5f6f93)" />
      <stop offset="0.5" style={{ stopColor: "var(--color-primary)" }} />
      <stop offset="0.58" stopColor="var(--line-art, #5f6f93)" />
      <stop offset="1" stopColor="var(--line-art, #5f6f93)" />
      <animate attributeName="x1" values={`${from};${to}`} dur={dur} repeatCount="indefinite" />
      <animate
        attributeName="x2"
        values={`${from + span};${to + span}`}
        dur={dur}
        repeatCount="indefinite"
      />
    </linearGradient>
  );
}

// ---- Hero fan ----

const FAN = 90;
const fanPath: PathFn = (i, s) => {
  const t = i / (FAN - 1),
    e = t * t * (3 - 2 * t);
  const a = Math.sin(s * 0.55 + t * 3.2),
    b = Math.cos(s * 0.4 + t * 2.3),
    c = Math.sin(s * 0.3 + t * 1.6);
  return `M${(250 + t * 70).toFixed(1)} -20 C ${(420 - e * 210 + a * 26).toFixed(1)} ${(150 + b * 16).toFixed(1)}, ${(150 + e * 260 + b * 30).toFixed(1)} ${(210 + a * 18).toFixed(1)}, ${(40 + e * 640 + c * 14).toFixed(1)} ${(460 - e * 120 + a * 6).toFixed(1)}`;
};

export function Waves() {
  const ref = useRef<SVGSVGElement>(null);
  const id = useId().replace(/:/g, "");
  useSway(ref, fanPath);
  return (
    <svg
      ref={ref}
      className="pointer-events-none absolute -right-10 -top-8 hidden h-[calc(100%+64px)] w-[52%] sm:block"
      viewBox="0 0 600 420"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden
    >
      <defs>
        <Shine id={`fan-${id}`} from={-300} to={600} dur="7s" vertical />
      </defs>
      {Array.from({ length: FAN }, (_, i) => (
        <path
          key={i}
          data-line
          d={fanPath(i, 0)}
          stroke={`url(#fan-${id})`}
          strokeWidth={0.7}
          strokeOpacity={0.55}
        />
      ))}
    </svg>
  );
}

// ---- Flow strands: spread out on the left, squeezed through the middle (the rules), and spread
// again on the right — every invoice passes through the same narrow gate. ----

const STRANDS = 56;
const strandPath: PathFn = (i, s) => {
  const t = i / (STRANDS - 1);
  const k = t - 0.5;
  const a = Math.sin(s * 0.5 + t * 4.1),
    b = Math.cos(s * 0.38 + t * 3.3);
  const yIn = 150 + k * 300 + a * 10;
  const yOut = 150 + k * 260 + b * 12;
  const pinch = 150 + k * 26 + Math.sin(s * 0.7 + t * 6) * 4;
  return `M-20 ${yIn.toFixed(1)} C 260 ${yIn.toFixed(1)}, 380 ${(pinch + a * 6).toFixed(1)}, 600 ${pinch.toFixed(1)} S 940 ${(yOut - b * 8).toFixed(1)}, 1220 ${yOut.toFixed(1)}`;
};

export function Strands({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const id = useId().replace(/:/g, "");
  useSway(ref, strandPath);
  return (
    <svg
      ref={ref}
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      viewBox="0 0 1200 300"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
    >
      <defs>
        <Shine id={`strand-${id}`} from={-400} to={1200} dur="6s" />
        <linearGradient id={`fade-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.12" stopColor="white" stopOpacity="1" />
          <stop offset="0.88" stopColor="white" stopOpacity="1" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={`mask-${id}`}>
          <rect width="1200" height="300" fill={`url(#fade-${id})`} />
        </mask>
      </defs>
      <g mask={`url(#mask-${id})`}>
        {Array.from({ length: STRANDS }, (_, i) => (
          <path
            key={i}
            data-line
            d={strandPath(i, 0)}
            stroke={`url(#strand-${id})`}
            strokeWidth={0.8}
            strokeOpacity={0.42}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </svg>
  );
}
