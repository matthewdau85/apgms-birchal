import http from "node:http";

const port = Number(process.env.PORT ?? 5173);
const host = "0.0.0.0";
const apiUrl = process.env.VITE_API_URL ?? "http://127.0.0.1:3000";

const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>APGMS Demo Webapp</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
      main { max-width: 720px; margin: 3rem auto; background: white; border-radius: 1rem; padding: 2.5rem; box-shadow: 0 20px 40px -24px rgba(15, 23, 42, 0.4); }
      h1 { margin-top: 0; font-size: 2.25rem; }
      code { background: #0f172a; color: white; padding: 0.25rem 0.5rem; border-radius: 0.5rem; font-size: 0.9rem; }
      ul { padding-left: 1.25rem; }
      .status { margin-top: 1.5rem; padding: 1rem; border-radius: 0.75rem; background: #f1f5f9; }
      .status[data-state="error"] { background: #fee2e2; color: #991b1b; }
    </style>
  </head>
  <body>
    <main>
      <h1>APGMS Demo Webapp</h1>
      <p>This lightweight dev server renders a static page and checks the API health endpoint.</p>
      <p>Currently configured API URL: <code>${apiUrl}</code></p>
      <section class="status" id="status" data-state="pending">
        <strong>API health status:</strong>
        <span id="health-result">Loading...</span>
      </section>
      <section>
        <h2>Manual smoke tests</h2>
        <ul>
          <li><a href="${apiUrl}/health" target="_blank" rel="noreferrer">GET /health</a></li>
          <li><a href="${apiUrl}/users" target="_blank" rel="noreferrer">GET /users</a></li>
          <li><a href="${apiUrl}/bank-lines" target="_blank" rel="noreferrer">GET /bank-lines</a></li>
        </ul>
      </section>
    </main>
    <script>
      const statusEl = document.getElementById('status');
      const resultEl = document.getElementById('health-result');
      fetch('${apiUrl}/health')
        .then(async (res) => {
          const text = await res.text();
          try {
            const body = JSON.parse(text);
            resultEl.textContent = body.ok ? 'OK' : text;
            statusEl.dataset.state = body.ok ? 'ok' : 'error';
          } catch (error) {
            resultEl.textContent = text;
            statusEl.dataset.state = res.ok ? 'ok' : 'error';
          }
        })
        .catch((error) => {
          statusEl.dataset.state = 'error';
          resultEl.textContent = error.message;
        });
    </script>
  </body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url && req.url !== "/" && req.url !== "/index.html") {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(indexHtml);
});

server.listen(port, host, () => {
  console.log(`Webapp listening on http://${host}:${port}`);
});
