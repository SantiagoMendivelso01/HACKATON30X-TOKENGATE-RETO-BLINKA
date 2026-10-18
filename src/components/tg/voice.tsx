// Voice dictation: records the microphone in the browser and transcribes it on the server
// (/api/transcribe). Works in any browser with microphone access; otherwise the mic button hides.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Mic, Square, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MAX_MS = 120_000;

async function readTranscript(res: Response, onDelta: (t: string) => void): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let live = "";
  let final: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";
    for (const line of parts) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data) as { type?: string; delta?: string; text?: string };
        if (ev.type === "transcript.text.delta" && ev.delta) onDelta((live += ev.delta));
        else if (ev.type === "transcript.text.done") final = ev.text ?? live;
      } catch {
        /* ignore partial line */
      }
    }
  }
  return (final ?? live).trim();
}

/** Dictation in Spanish. `onFinal` gets the finished text; `interim` is the live preview. */
export function useDictation(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(
    () =>
      setSupported(
        typeof window !== "undefined" &&
          !!navigator.mediaDevices?.getUserMedia &&
          typeof MediaRecorder !== "undefined",
      ),
    [],
  );
  useEffect(
    () => () => {
      if (rec.current?.state === "recording") rec.current.stop();
    },
    [],
  );

  const fail = (msg: string) => {
    setError(msg);
    toast.error(msg);
  };

  const start = useCallback(async () => {
    if (busy || listening) return;
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as DOMException)?.name;
      return fail(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Permite el micrófono en el navegador para dictar (icono del candado en la barra de direcciones). Si estás en la vista previa, ábrela en una pestaña nueva."
          : name === "NotFoundError"
            ? "No se encontró un micrófono conectado."
            : "No se pudo usar el micrófono. Puedes escribir o pegar el texto.",
      );
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) =>
      MediaRecorder.isTypeSupported?.(m),
    );
    const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    r.onstop = async () => {
      if (timer.current) clearTimeout(timer.current);
      stream.getTracks().forEach((t) => t.stop());
      setListening(false);
      const type = (r.mimeType || "audio/webm").split(";")[0]!.replace("video/", "audio/");
      const blob = new Blob(chunks, { type });
      if (blob.size < 1000) return fail("No te escuché. Pulsa el micrófono e intenta de nuevo.");
      setBusy(true);
      try {
        const form = new FormData();
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        form.append("file", new File([blob], `dictado.${ext}`, { type }));
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          return fail(j?.error ?? "No se pudo transcribir el audio.");
        }
        const text = await readTranscript(res, setInterim);
        if (text) cb.current(text);
        else fail("No se entendió el audio. Intenta hablar más cerca del micrófono.");
      } catch {
        fail("No hay conexión para transcribir. Puedes escribir o pegar el texto.");
      } finally {
        setBusy(false);
        setInterim("");
      }
    };
    rec.current = r;
    r.start();
    setListening(true);
    timer.current = setTimeout(() => r.state === "recording" && r.stop(), MAX_MS);
  }, [busy, listening]);

  const stop = useCallback(() => {
    if (rec.current?.state === "recording") rec.current.stop();
  }, []);
  return { supported, listening, busy, interim, error, start, stop };
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
      disabled={d.busy}
      onClick={d.listening ? d.stop : d.start}
      aria-label={d.listening ? "Detener dictado" : "Dictar con la voz"}
      title={d.error ?? (d.listening ? "Escuchando… pulsa para terminar" : "Dictar con la voz")}
      className={cn(d.listening && "animate-pulse", className)}
    >
      {d.busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : d.listening ? (
        <Square className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      {size === "sm" && (d.busy ? "Transcribiendo…" : d.listening ? "Detener" : "Dictar")}
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
            disabled={d.busy}
            onClick={d.listening ? d.stop : d.start}
            aria-label={d.listening ? "Detener dictado" : "Dictar con la voz"}
            className={cn(
              "absolute right-2 top-2 h-9 w-9 rounded-full",
              d.listening && "animate-pulse",
            )}
          >
            {d.busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : d.listening ? (
              <Square className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      {(d.listening || d.busy || d.error || hint) && (
        <p className={cn("text-xs", d.error ? "text-destructive" : "text-muted-foreground")}>
          {d.error ??
            (d.busy
              ? "Transcribiendo tu voz…"
              : d.listening
                ? "Te escucho… habla con naturalidad y pulsa ■ al terminar."
                : hint)}
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
