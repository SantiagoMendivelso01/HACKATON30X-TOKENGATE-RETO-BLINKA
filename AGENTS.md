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

## TokenGate architecture
- Domain logic lives in src/lib/tokengate (types, pure decision-engine, mock-data, store); UI consumes engine results and never re-implements policy rules — keeps decisions consistent and testable.
- Money is integer minor units everywhere; parse user input with parseToMinor — avoids floating-point errors in limit checks.
- App screens live under /app (layout route app.tsx with TokenGateProvider); landing at /, demo login at /login.
