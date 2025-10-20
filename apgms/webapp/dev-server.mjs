import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = __dirname;

const port = Number(process.env.WEBAPP_PORT ?? 4173);
const host = process.env.WEBAPP_HOST ?? "127.0.0.1";

const indexHtml = await readFile(path.join(webRoot, "index.html"), "utf8");

const server = http.createServer((req, res) => {
  if (req.method !== "GET" || req.url === undefined) {
    res.writeHead(405);
    res.end();
    return;
  }

  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(indexHtml);
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(port, host, () => {
  console.log(`webapp dev server listening on http://${host}:${port}`);
});
