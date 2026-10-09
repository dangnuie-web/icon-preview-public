// dist/ 를 http://localhost:3000 에 띄우는 작은 정적 서버. 따로 설치할 것 없이 Node 만 있으면 된다.
// 같은 와이파이의 폰에서 보려면 컴퓨터의 내부 IP 로 연다 (예: http://192.168.0.10:3000).
// 포트를 바꾸려면 PORT=4000 npm start

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const PORT = Number(process.env.PORT) || 3000;
const TYPES = { ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

createServer(async (req, res) => {
  try {
    let file = path.join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname));
    // dist/ 밖은 내주지 않는다
    if (file !== DIST && !file.startsWith(DIST + path.sep)) throw new Error("outside");
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("없는 주소예요");
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT} 에 띄웠어요. 끄려면 Ctrl+C`));
