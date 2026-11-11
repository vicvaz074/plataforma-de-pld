/** Preserve the public Pages origin, including authentication cookies and CSRF. */
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      if (!env.API) return new Response("Servicio no configurado", { status: 503, headers: { "Cache-Control": "no-store" } })
      return env.API.fetch(request)
    }
    return env.ASSETS.fetch(request)
  },
}
