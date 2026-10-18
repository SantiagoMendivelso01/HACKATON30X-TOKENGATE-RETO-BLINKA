// Voice dictation with the browser's speech recognition (Chrome, Edge, Safari). Where it is not
// available the mic button simply doesn't show and people type or paste instead.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Mic, Square, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    ((w["SpeechRecognition"] ?? w["webkitSpeechRecognition"]) as new () => Recognition) ?? null
  );
}

/** Dictation in Spanish. `onFinal` gets each finished phrase; `interim` is the live preview. */
export function useDictation(onFinal: (text: string) => void, lang = "es-CO") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => setSupported(!!recognitionCtor()), []);
  useEffect(() => () => rec.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) cb.current(res[0].transcript.trim());
        else live += res[0].transcript;
      }
      setInterim(live);
    };
    r.onerror = (e) =>
      setError(
        e.error === "not-allowed"
          ? "Permite el micrófono en el navegador para dictar."
          : "No se pudo usar el micrófono. Puedes escribir o pegar el texto.",
      );
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    setError(null);
    rec.current = r;
    r.start();
    setListening(true);
  }, [lang]);

  const stop = useCallback(() => rec.current?.stop(), []);
  return { supported, listening, interim, error, start, stop };
}

export function MicButton({
  onText,
  className,
  size = "icon",
}: {
  onText: (text: string) => void;
  className?: string;
  size?: "icon" | "sm";
}) {
  const d = useDictation(onText);
  if (!d.supported) return null;
  return (
    <Button
      type="button"
      variant={d.listening ? "default" : "outline"}
      size={size}
      onClick={d.listening ? d.stop : d.start}
      aria-label={d.listening ? "Detener dictado" : "Dictar con la voz"}
      title={d.error ?? (d.listening ? "Escuchando… pulsa para terminar" : "Dictar con la voz")}
      className={cn(d.listening && "animate-pulse", className)}
    >
      {d.listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      {size === "sm" && (d.listening ? "Escuchando…" : "Dictar")}
    </Button>
  );
}

/**
 * A text box people can type, paste or dictate into, with example phrases and one action button.
 * Used wherever a sentence is easier than filling field by field.
 */
export function SayItBox({
  value,
  onChange,
  onSubmit,
  submitLabel,
  placeholder,
  examples,
  busy = false,
  hint,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  placeholder: string;
  examples?: string[];
  busy?: boolean;
  hint?: ReactNode;
  rows?: number;
}) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const d = useDictation((t) => {
    const next = valueRef.current ? `${valueRef.current.trimEnd()} ${t}` : t;
    valueRef.current = next;
    onChange(next);
  });
  const shown = d.interim ? `${value}${value ? " " : ""}${d.interim}` : value;

  return (
    <div className="grid gap-2">
      <div className={cn("relative rounded-xl", busy && "tg-scan")}>
        <Textarea
          value={shown}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (value.trim()) onSubmit();
            }
          }}
          placeholder={placeholder}
          rows={rows}
          className={cn(
            "rounded-xl bg-background pr-14 text-[15px] leading-relaxed",
            d.listening && "border-primary ring-2 ring-primary/20",
          )}
        />
        {d.supported && (
          <Button
            type="button"
            size="icon"
            variant={d.listening ? "default" : "outline"}
            onClick={d.listening ? d.stop : d.start}
            aria-label={d.listening ? "Detener dictado" : "Dictar con la voz"}
            className={cn(
              "absolute right-2 top-2 h-9 w-9 rounded-full",
              d.listening && "animate-pulse",
            )}
          >
            {d.listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
      </div>
      {(d.listening || d.error || hint) && (
        <p className={cn("text-xs", d.error ? "text-destructive" : "text-muted-foreground")}>
          {d.error ??
            (d.listening ? "Te escucho… habla con naturalidad y pulsa ■ al terminar." : hint)}
        </p>
      )}
      {examples && examples.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => onChange(ex)}
              className="rounded-full border border-border bg-card px-3 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
      <div>
        <Button type="button" onClick={onSubmit} disabled={busy || !value.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
