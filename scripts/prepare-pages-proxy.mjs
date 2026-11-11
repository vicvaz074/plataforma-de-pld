import { copyFile, writeFile } from "node:fs/promises"

await copyFile(new URL("../workers/pages-proxy.js", import.meta.url), new URL("../out/_worker.js", import.meta.url))
await writeFile(new URL("../out/_routes.json", import.meta.url), JSON.stringify({ version: 1, include: ["/api", "/api/*"], exclude: [] }) + "\n")
// Worker assets retain SAT layouts but must never publish the Pages function as an asset.
await writeFile(new URL("../out/.assetsignore", import.meta.url), "_worker.js\n_routes.json\n")
