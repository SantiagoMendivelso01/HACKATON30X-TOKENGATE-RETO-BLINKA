/** Standalone HTML for SSR failures, when React can't render the normal error component. */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Esta página no cargó · Agente pagador</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 Inter, system-ui, -apple-system, sans-serif; background: #f7f7f4; color: #1c253a; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.75rem; font-weight: 450; letter-spacing: -0.04em; margin: 0 0 0.5rem; }
      p { color: #656975; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.55rem 1.25rem; border-radius: 999px; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #2a4bd0; color: #fff; }
      .secondary { background: #fff; color: #1c253a; border-color: #dedfdc; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Esta página no cargó</h1>
      <p>Algo falló de nuestro lado. Intenta de nuevo o vuelve al inicio.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Reintentar</button>
        <a class="secondary" href="/">Ir al inicio</a>
      </div>
    </div>
  </body>
</html>`;
}
