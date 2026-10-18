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
- App screens live under /app (layout route app.tsx with TokenGateProvider); landing at /, login at /login, monitoring at /app/alertas.
- Persistence is optional: db.functions.ts reads SUPABASE_URL/SUPABASE_SERVICE_KEY and falls back to in-memory mode when unset; schema is supabase/migrations/*.sql.
- Invoice OCR reads ANTHROPIC_API_KEY server-side only (Claude Haiku 4.5); never move the key to the client.
