export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="max-w-md">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">404</p>
        <h1 className="mt-3 text-3xl font-semibold">Pagina no encontrada</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          La ruta solicitada no existe en la plataforma PLD o ya no esta disponible.
        </p>
        <a
          href="/dashboard"
          className="mt-8 inline-flex h-10 items-center justify-center rounded-md bg-[#c7662c] px-5 text-sm font-medium text-white transition-colors hover:bg-[#a95322]"
        >
          Volver al panel
        </a>
      </div>
    </main>
  )
}
