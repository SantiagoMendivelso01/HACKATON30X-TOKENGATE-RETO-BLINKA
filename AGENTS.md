<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Agente pagador architecture (synced with repo main)

- Domain logic lives in src/lib/tokengate (types, decision-engine, org/org-state, jev, db.functions, store); UI consumes engine results and never re-implements policy rules — keeps decisions consistent and testable.
- Money is integer minor units everywhere; parse user input with parseToMinor — avoids floating-point errors in limit checks.
- Normalize legacy checkout COP purchases (identified by nested opcion_elegida.precio_cop) from pesos to minor units in the server-side public projection; leave native subjects unchanged so display and policy evaluation use consistent amounts without altering originals.
- App screens live under /app (layout route app.tsx with TokenGateProvider); landing at /, login at /login, monitoring at /app/alertas.
- External data uses server-only TOKENGATE_DATABASE_URL/TOKENGATE_DATABASE_SECRET_KEY and public-records.ts allowlist projection; public views load all organizations read-only, with local simulated actions and no writes to originals, to avoid exposing privileged access or personal data.
- Invoice OCR reads ANTHROPIC_API_KEY server-side only (Claude Haiku 4.5); never move the key to the client.

- Preserve Lovable runtime/bootstrap configuration when importing repository source — upstream deployment configuration targets a different host.
- Decision explanations use pipeline.ts and the shared DecisionPipeline component; text and voice input use ai-read.functions with text-parse fallback — keeps all screens aligned with engine results.
- Voice dictation records audio in the browser and transcribes via /api/transcribe (Lovable AI Gateway, LOVABLE_API_KEY server-only) — browser SpeechRecognition was unreliable, especially in iframes.
- Do not register the Supabase bearer attacher in src/start.ts while no server function requires real auth — sign-in is simulated and the attacher crashed the published client.
