// Animated line art for page headers. Each module gets its own pattern so the app doesn't repeat
// itself, all with the same fine lines and the blue shine of the dashboard.
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import { Shine } from "./line-art";

/** One frame of one line: its path, and optionally its opacity and dash offset. */
type Frame = { d: string; o?: number; dash?: number };
type Pattern = {
  lines: number;
  width?: number;
  /** stroke-dasharray, for patterns that flow along the line. */
  dasharray?: string;
  frame: (i: number, s: number) => Frame;
};

const W = 640,
  H = 160;
const f1 = (n: number) => n.toFixed(1);

/** Polyline through `pts` samples of y(x). */
const curve = (y: (x: number) => number, pts = 28, x0 = 0, x1 = W) => {
  let d = "";
  for (let j = 0; j <= pts; j++) {
    const x = x0 + ((x1 - x0) * j) / pts;
    d += `${j ? "L" : "M"}${f1(x)} ${f1(y(x))}`;
  }
  return d;
};

/** Closed shape through points of an ellipse rotated by `rot` radians. */
const ellipse = (cx: number, cy: number, rx: number, ry: number, rot: number, pts = 44) => {
  const c = Math.cos(rot),
    sn = Math.sin(rot);
  let d = "";
  for (let j = 0; j <= pts; j++) {
    const a = (j / pts) * Math.PI * 2;
    const x = Math.cos(a) * rx,
      y = Math.sin(a) * ry;
    d += `${j ? "L" : "M"}${f1(cx + x * c - y * sn)} ${f1(cy + x * sn + y * c)}`;
  }
  return d;
};

export const PATTERNS = {
  /** A twisted band that slowly turns. */
  ribbon: {
    lines: 34,
    frame: (i, s) => {
      const t = i / 33 - 0.5;
      return {
        d: curve(
          (x) =>
            80 +
            Math.sin(x / 120 + s * 0.45) * 46 * t * 2 +
            Math.cos(x / 210 - s * 0.3) * 14 +
            t * 10,
        ),
      };
    },
  },
  /** Radar: ellipses that grow out from a point and fade, like something calling for you. */
  rings: {
    lines: 16,
    frame: (i, s) => {
      const p = (i / 16 + s * 0.12) % 1;
      const r = 8 + p * 230;
      return { d: ellipse(470, 86, r * 1.5, r * 0.42, -0.08), o: Math.min(1, (1 - p) * 1.6) };
    },
  },
  /** Topographic contours: levels that rise and fall, like a budget being spent. */
  contour: {
    lines: 22,
    frame: (i, s) => {
      const k = i / 21;
      return {
        d: curve(
          (x) =>
            18 +
            i * 6.2 +
            Math.sin(x / 95 + s * 0.35 + k * 1.4) * (8 + k * 12) +
            Math.sin(x / 41 - s * 0.55 + k * 3) * 3,
          32,
        ),
      };
    },
  },
  /** A ledger-like mesh that ripples as if a wave ran under it. */
  mesh: {
    lines: 34,
    frame: (i, s) => {
      const rows = 12;
      const wave = (x: number, y: number) =>
        Math.sin(x / 70 - s * 1.1) * 7 * (y / H) + Math.cos(y / 40 + s * 0.6) * 3;
      if (i < rows) {
        const y0 = 10 + (i / (rows - 1)) * (H - 20);
        return { d: curve((x) => y0 + wave(x, y0), 30, 160, W) };
      }
      const x0 = 160 + ((i - rows) / 21) * (W - 160);
      let d = "";
      for (let j = 0; j <= 14; j++) {
        const y = (j / 14) * H;
        d += `${j ? "L" : "M"}${f1(x0 + Math.cos(y / 50 + s * 0.8 + x0 / 90) * 4)} ${f1(y + wave(x0, y))}`;
      }
      return { d, o: 0.6 };
    },
  },
  /** Orbit: ellipses turning around a center, like rules held in balance. */
  orbit: {
    lines: 22,
    frame: (i, s) => ({
      d: ellipse(480, 80, 150, 34 + Math.sin(s * 0.6 + i) * 4, (i / 22) * Math.PI + s * 0.12),
    }),
  },
  /** Streams: slanted lines with dashes flowing along them, like records going by. */
  streams: {
    lines: 40,
    dasharray: "26 14",
    frame: (i, s) => {
      const x0 = 120 + i * 13;
      return {
        d: `M${f1(x0)} -10 C ${f1(x0 + 30 + Math.sin(s * 0.5 + i * 0.3) * 18)} 50, ${f1(x0 - 40 + Math.cos(s * 0.4 + i * 0.2) * 18)} 110, ${f1(x0 + 10)} 170`,
        dash: -s * (22 + (i % 5) * 4),
        o: 0.35 + ((i * 37) % 10) / 20,
      };
    },
  },
} satisfies Record<string, Pattern>;

export type PatternName = keyof typeof PATTERNS;

export function HeaderArt({ pattern, className }: { pattern: PatternName; className?: string }) {
  const p: Pattern = PATTERNS[pattern];
  const ref = useRef<SVGSVGElement>(null);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    const svg = ref.current;
    if (!svg || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const paths = [...svg.querySelectorAll<SVGPathElement>("path[data-line]")];
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const s = (now - t0) / 1000;
      paths.forEach((el, i) => {
        const f = p.frame(i, s);
        el.setAttribute("d", f.d);
        if (f.o != null) el.setAttribute("stroke-opacity", f1(f.o * 0.55));
        if (f.dash != null) el.setAttribute("stroke-dashoffset", f1(f.dash));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [p]);

  return (
    <svg
      ref={ref}
      className={cn("pointer-events-none absolute", className)}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMaxYMid slice"
      fill="none"
      aria-hidden
    >
      <defs>
        <Shine id={`hart-${id}`} from={-400} to={W} dur="6.5s" />
        <linearGradient id={`hfade-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.35" stopColor="white" stopOpacity="1" />
          <stop offset="0.92" stopColor="white" stopOpacity="1" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={`hmask-${id}`}>
          <rect width={W} height={H} fill={`url(#hfade-${id})`} />
        </mask>
      </defs>
      <g mask={`url(#hmask-${id})`}>
        {Array.from({ length: p.lines }, (_, i) => {
          const f = p.frame(i, 0);
          return (
            <path
              key={i}
              data-line
              d={f.d}
              stroke={`url(#hart-${id})`}
              strokeWidth={p.width ?? 0.8}
              strokeOpacity={(f.o ?? 1) * 0.55}
              strokeDasharray={p.dasharray}
              strokeDashoffset={f.dash}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </g>
    </svg>
  );
}

/** Which pattern each module shows. */
export function patternFor(path: string): PatternName {
  if (path.startsWith("/app/aprobaciones")) return "rings";
  if (path.startsWith("/app/presupuestos")) return "contour";
  if (path.startsWith("/app/auditoria")) return "mesh";
  if (path.startsWith("/app/ajustes")) return "orbit";
  if (path.startsWith("/app/facturas")) return "ribbon";
  return "streams";
}
