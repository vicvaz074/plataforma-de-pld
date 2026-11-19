import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { version } from "xlsx"

// SheetJS publishes patched releases on its own CDN, not the npm registry.
// pnpm 10 may omit integrity when it regenerates the lock for a remote tarball.
// On upgrade, review the vendor release and recompute SHA-512 from the official bytes.
test("SheetJS procede del tarball oficial revisado y pnpm congela su integridad", () => {
  const release = "0.20.3"
  const tarball = `https://cdn.sheetjs.com/xlsx-${release}/xlsx-${release}.tgz`
  const integrity = "sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA=="
  assert.equal(version, release)
  assert.equal(JSON.parse(readFileSync("package.json", "utf8")).dependencies.xlsx, tarball)
  const entry = readFileSync("pnpm-lock.yaml", "utf8").split(`\n  xlsx@${tarball}:\n`)[1]?.split("\n\n", 1)[0]
  assert.ok(entry?.includes(`integrity: ${integrity}`) && entry.includes(`tarball: ${tarball}`),
    "Falta la integridad esperada en la resolución de SheetJS")
})
