import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"
import { z } from "zod"

// Only labels/field names are reported. Do not log the configuration, vars or parser input.
const vars = z.record(z.string(), z.unknown()).optional()
const service = z.object({ binding: z.string(), service: z.string().min(1) })
const site = z.object({ services: z.array(service).optional(), vars })
const sites = site.extend({ env: z.object({ preview: site, production: site.optional() }) })
const database = z.object({ binding: z.string(), database_id: z.string().min(1) })
const bucket = z.object({ binding: z.string(), bucket_name: z.string().min(1) })
const producer = z.object({ binding: z.string(), queue: z.string().min(1) })
const consumer = z.object({ queue: z.string().min(1), dead_letter_queue: z.string().min(1) })
const backend = z.object({
  name: z.string().min(1), vars, d1_databases: z.array(database), r2_buckets: z.array(bucket),
  queues: z.object({ producers: z.array(producer), consumers: z.array(consumer) }),
})
const backends = z.object({ vars, env: z.object({ preview: backend, production: backend }) })
const environments = ["preview", "production"] as const

function oneBinding<T extends {binding: string}>(bindings: T[] | undefined, name: string, label: string) {
  const matches = bindings?.filter(item => item.binding === name) ?? []
  assert.equal(matches.length, 1, `${label}: se requiere un único binding ${name}`)
  return matches[0]
}

function checkVars(values: z.infer<typeof vars>, label: string) {
  assert.notEqual(values?.NEXT_PUBLIC_PLD_MODE, "demo", `${label}: modo demo en liberación`)
  for (const key of ["BETTER_AUTH_SECRET", "BOOTSTRAP_TOKEN"]) {
    assert.ok(!Object.hasOwn(values ?? {}, key), `${label}: ${key} no debe declararse en vars`)
  }
}

function checkRelease(pagesInput: unknown, workerInput: unknown, buildMode?: string) {
  const pages = sites.safeParse(pagesInput)
  const worker = backends.safeParse(workerInput)
  assert.ok(pages.success && worker.success, "Configuración de liberación incompleta")
  assert.notEqual(buildMode, "demo", "Build: modo demo en liberación")
  checkVars(pages.data.vars, "Pages")
  checkVars(worker.data.vars, "Worker")
  const scopes = environments.map(name => {
    const api = worker.data.env[name]
    const front = pages.data.env[name]
    checkVars(front?.vars, `Pages ${name}`)
    checkVars(api.vars, `Worker ${name}`)
    assert.ok(api.vars?.ENVIRONMENT === name, `${name}: etiqueta de entorno incorrecta`)
    const services = name === "production" ? front?.services ?? pages.data.services : front?.services
    assert.ok(oneBinding(services, "API", name).service === api.name, `${name}: destino de API incorrecto`)
    const auth = api.vars?.BETTER_AUTH_URL
    assert.ok(typeof auth === "string", `${name}: origen de sesión inválido`)
    let origin: URL
    try { origin = new URL(auth) } catch { assert.fail(`${name}: origen de sesión inválido`) }
    assert.ok(origin.protocol === "https:" && origin.origin === auth, `${name}: se requiere origen HTTPS sin ruta`)
    oneBinding(api.d1_databases, "DB", name)
    oneBinding(api.r2_buckets, "EVIDENCE_BUCKET", name)
    const inbox = oneBinding(api.queues.producers, "IMPORT_QUEUE", name).queue
    const workers = api.queues.consumers.filter(item => item.queue === inbox)
    assert.ok(workers.length === 1 && workers[0].dead_letter_queue !== inbox, `${name}: colas de importación incoherentes`)
    return {
      Worker: [api.name], sesión: [origin.origin],
      D1: api.d1_databases.map(item => item.database_id.toLowerCase()), R2: api.r2_buckets.map(item => item.bucket_name),
      colas: [...api.queues.producers.map(item => item.queue), ...api.queues.consumers.flatMap(item => [item.queue, item.dead_letter_queue])],
    }
  })
  for (const kind of ["Worker", "sesión", "D1", "R2", "colas"] as const) {
    assert.ok(!scopes[0][kind].some(id => scopes[1][kind].includes(id)), `preview/production comparten ${kind}`)
  }
}

function readConfig(file: string): unknown {
  const result = ts.parseConfigFileTextToJson(file, readFileSync(file, "utf8"))
  assert.ok(!result.error, `JSONC inválido: ${file}`)
  return result.config
}

test("liberación: Pages y Worker declaran recursos separados y modo conectado", () => {
  checkRelease(readConfig("wrangler.jsonc"), readConfig("wrangler.worker.jsonc"), process.env.NEXT_PUBLIC_PLD_MODE)
})

function fixture() {
  function api(name: string) {
    return {
      name, vars: { ENVIRONMENT: name, BETTER_AUTH_URL: `https://${name}.example.test` } as Record<string,string>,
      d1_databases: [{ binding: "DB", database_id: `db-${name}` }],
      r2_buckets: [{ binding: "EVIDENCE_BUCKET", bucket_name: `files-${name}` }],
      queues: { producers: [{ binding: "IMPORT_QUEUE", queue: name }], consumers: [{ queue: name, dead_letter_queue: `${name}-dead` }] },
    }
  }
  const site = (name: string) => ({ services: [{ binding: "API", service: name }], vars: {} as Record<string,string> })
  const pages = { ...site("production"), env: { preview: site("preview") } }
  const worker = { env: { preview: api("preview"), production: api("production") } }
  return { pages, worker }
}

test("liberación: acepta una configuración aislada y rechaza cruces y variables inseguras", () => {
  const { pages, worker } = fixture()
  checkRelease(pages, worker, "cloud")
  const negative = (change: (f: ReturnType<typeof fixture>) => void, expected: RegExp) => {
    const f = fixture()
    change(f)
    assert.throws(() => checkRelease(f.pages, f.worker), expected)
  }
  negative(f => { f.pages.env.preview.services[0].service = "production" }, /destino de API/)
  negative(f => { f.worker.env.preview.d1_databases[0].database_id = "db-production" }, /comparten D1/)
  negative(f => { f.worker.env.preview.r2_buckets[0].bucket_name = "files-production" }, /comparten R2/)
  negative(f => { f.worker.env.preview.queues.consumers[0].dead_letter_queue = "production" }, /comparten colas/)
  negative(f => { f.worker.env.preview.queues.consumers[0].queue = "other" }, /colas de importación incoherentes/)
  negative(f => { f.worker.env.preview.vars.BETTER_AUTH_URL = "https://production.example.test" }, /comparten sesión/)
  negative(f => { f.worker.env.preview.vars.BETTER_AUTH_URL = "http://preview.example.test" }, /se requiere origen HTTPS/)
  negative(f => { f.pages.env.preview.vars.NEXT_PUBLIC_PLD_MODE = "demo" }, /modo demo/)
  negative(f => { f.worker.env.production.vars.BETTER_AUTH_SECRET = "test-only" }, /no debe declararse en vars/)
  negative(f => { f.pages.vars.BOOTSTRAP_TOKEN = "test-only" }, /no debe declararse en vars/)
  assert.throws(() => checkRelease(pages, worker, "demo"), /modo demo/)
})
