# Davara Governance · PLD México

Plataforma de prevención de lavado de dinero para actividades vulnerables: alta SAT, expedientes, operaciones, EBR, avisos, evidencias, capacitación, auditoría y gobernanza.

## Modos de ejecución

- **Conectado (predeterminado):** Next.js exportado estáticamente y Cloudflare Worker bajo el mismo origen. Better Auth gestiona sesiones; D1 conserva registros y revisiones; R2 mantiene archivos privados; Queues procesa importaciones. Nunca vuelve a datos demo tras un error de API.
- **Demo local explícita:** `NEXT_PUBLIC_PLD_MODE=demo pnpm dev`. Usa las llaves históricas de `localStorage`; sus usuarios y datos ficticios no constituyen autenticación ni cumplimiento reales.

## Desarrollo conectado

Requiere Node.js 22.12 o posterior, pnpm 10 y una sesión autorizada de Wrangler para desplegar recursos remotos.

```bash
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm build
pnpm dev:pilot
```

El Worker local se abre en `http://127.0.0.1:8787`. Configura `BETTER_AUTH_SECRET` (mínimo 32 caracteres) y `BOOTSTRAP_TOKEN` en `.dev.vars`, que no se rastrea. No utilices los secretos locales en ningún despliegue remoto.

La primera cuenta se activa mediante `/setup` y un token privado de instalación. La API cierra ese acceso atómicamente al existir una cuenta. Las demás cuentas se crean desde Administración, con contraseña temporal y cambio obligatorio. No existe autorregistro ni envío automático de contraseñas por correo.

## Verificaciones

```bash
pnpm typecheck
pnpm lint
pnpm test:pld
pnpm build
pnpm build:worker
```

CI exige estas verificaciones. Un build no sustituye pruebas de permisos, recorridos de navegador, comparación de libros ni validación de XML contra XSD.

## Datos, autorización y publicación

Los IDs de organización y empresa delimitan los registros y archivos. RFC, CURP y NIF no son llaves de autorización. Las escrituras usan revisión esperada y las ediciones concurrentes no se sobrescriben silenciosamente. Las llaves locales antiguas se conservan para una importación explícita con respaldo; nunca se migran usuarios, contraseñas ni privilegios demo.

`wrangler.jsonc` separa local, preview y producción. El entorno de producción permanece sin configurar hasta aprobar la aceptación. No despliegues con IDs u orígenes de ejemplo. Las credenciales, respaldos y archivos personales no deben incluirse en Git ni en logs.

- [Contratos y operación del servidor](docs/pilot-api.md)
- [Evidencia de validación y pendientes de aceptación](docs/pilot-validation.md)
- [Guía del repositorio y fuentes oficiales](AGENTS.md)

La validación local de una salida no acredita aceptación ni presentación ante SAT. Alicia conserva su función comercial; no se anuncia como una integración operativa.
