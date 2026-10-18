import { createFileRoute } from "@tanstack/react-router";

// Dictation: receives a short audio recording and streams back its transcript (SSE).
const MAX_BYTES = 10 * 1024 * 1024;

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey)
          return Response.json({ error: "El dictado no está configurado." }, { status: 500 });
        const len = Number(request.headers.get("content-length") ?? 0);
        if (len > MAX_BYTES + 64 * 1024)
          return Response.json({ error: "La grabación es demasiado larga." }, { status: 413 });
        let file: File | null = null;
        try {
          const form = await request.formData();
          const f = form.get("file");
          file = f instanceof File ? f : null;
        } catch {
          return Response.json({ error: "No se recibió el audio." }, { status: 400 });
        }
        if (!file || !file.size || file.size > MAX_BYTES || !file.type.startsWith("audio/"))
          return Response.json({ error: "Audio no válido." }, { status: 400 });

        const out = new FormData();
        out.append("model", "openai/gpt-transcribe");
        out.append("file", file, file.name || "dictado.webm");
        out.append("response_format", "json");
        out.append("stream", "true");
        out.append("languages", "es");
        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: out,
          signal: request.signal,
        });
        if (!res.ok) {
          const msg =
            res.status === 429
              ? "Demasiadas solicitudes de dictado. Espera un momento."
              : res.status === 402
                ? "Se agotaron los créditos de IA del espacio de trabajo."
                : "No se pudo transcribir el audio.";
          return Response.json({ error: msg }, { status: res.status });
        }
        return new Response(res.body, {
          status: res.status,
          headers: { "content-type": res.headers.get("content-type") ?? "text/event-stream" },
        });
      },
    },
  },
});
