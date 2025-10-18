import http from "node:http";
import { URL } from "node:url";

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>APGMS Control Center</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; }
      h1 { margin-bottom: 1rem; }
      button { margin-bottom: 1rem; padding: 0.5rem 1rem; }
      ul { list-style: none; padding: 0; }
      li { padding: 0.25rem 0; }
    </style>
  </head>
  <body>
    <h1>APGMS Control Center</h1>
    <button id="refresh">Refresh users</button>
    <ul id="users"></ul>
    <script type="module">
      async function loadUsers() {
        const response = await fetch('/api/users');
        const data = await response.json();
        const list = document.querySelector('#users');
        list.innerHTML = '';
        for (const user of data.users ?? []) {
          const item = document.createElement('li');
          item.dataset.testid = 'user-item';
          item.textContent = user.email + ' (' + user.orgId + ')';
          list.appendChild(item);
        }
      }
      document.querySelector('#refresh').addEventListener('click', loadUsers);
      loadUsers();
    </script>
  </body>
</html>`;

function resolvePort(defaultPort: number): number {
  const portFlag = process.argv.findIndex((arg) => arg === "--port");
  if (portFlag !== -1) {
    const next = process.argv[portFlag + 1];
    if (next) {
      const parsed = Number(next);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return Number(process.env.PORT ?? defaultPort);
}

const host = "127.0.0.1";
const port = resolvePort(4173);

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end("Bad request");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(html);
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

server.listen(port, host, () => {
  console.log(`webapp listening on http://${host}:${port}`);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
