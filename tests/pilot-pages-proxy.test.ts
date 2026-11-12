import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

test("Pages proxy preserves request origin, session cookies, bodies and private response headers", async () => {
  const source = readFileSync("workers/pages-proxy.js", "utf8")
  const proxy = (await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)).default
  const calls: string[] = []
  const env = {
    API: { fetch: async (request: Request) => {
      calls.push("api")
      assert.equal(new URL(request.url).origin, "https://plataforma-de-pld.pages.dev")
      assert.equal(request.headers.get("Origin"), "https://plataforma-de-pld.pages.dev")
      assert.equal(request.headers.get("Cookie"), "session=private")
      if (request.method === "POST") assert.equal(await request.text(), "payload")
      return new Response("private", { headers: { "Set-Cookie": "session=new; Secure; HttpOnly", "Cache-Control": "no-store" } })
    } },
    ASSETS: { fetch: async () => { calls.push("assets"); return new Response("static") } },
  }
  for (const path of ["/api", "/api/auth/sign-in/email", "/api/v1/companies/a/files/version-1"]) {
    const response = await proxy.fetch(new Request(`https://plataforma-de-pld.pages.dev${path}`, { method: "POST", headers: { Cookie: "session=private", Origin: "https://plataforma-de-pld.pages.dev" }, body: "payload" }), env)
    assert.match(response.headers.get("Set-Cookie")!, /HttpOnly/)
    assert.equal(response.headers.get("Cache-Control"), "no-store")
  }
  assert.equal(await (await proxy.fetch(new Request("https://plataforma-de-pld.pages.dev/dashboard"), env)).text(), "static")
  assert.equal(await (await proxy.fetch(new Request("https://plataforma-de-pld.pages.dev/apix"), env)).text(), "static")
  assert.deepEqual(calls, ["api", "api", "api", "assets", "assets"])
  assert.equal((await proxy.fetch(new Request("https://plataforma-de-pld.pages.dev/api/v1/session"), {})).status, 503)
})
