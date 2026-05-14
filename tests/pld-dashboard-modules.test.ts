import assert from "node:assert/strict"
import { existsSync, readdirSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import { APP_NAVIGATION_ITEMS, PLD_DASHBOARD_MODULES } from "../lib/pld/navigation"

const appRoot = path.join(process.cwd(), "app")

function appRouteExists(href: string): boolean {
  const routePath = href.slice(1)
  if (existsSync(path.join(appRoot, routePath, "page.tsx"))) return true

  return readdirSync(appRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("(") && entry.name.endsWith(")"))
    .some((entry) => existsSync(path.join(appRoot, entry.name, routePath, "page.tsx")))
}

test("PLD dashboard modules mirror the sidebar workflow modules", () => {
  const sidebarWorkflowModules = APP_NAVIGATION_ITEMS.filter((item) => item.key !== "dashboard")

  assert.deepEqual(
    PLD_DASHBOARD_MODULES.map((item) => item.key),
    sidebarWorkflowModules.map((item) => item.key),
  )
  assert.deepEqual(
    PLD_DASHBOARD_MODULES.map((item) => item.href),
    sidebarWorkflowModules.map((item) => item.href),
  )
})

test("PLD dashboard modules only point to existing routes and contain operational tasks", () => {
  for (const module of PLD_DASHBOARD_MODULES) {
    assert.match(module.href, /^\/[a-z0-9-]+$/)
    assert.ok(appRouteExists(module.href), `${module.href} should exist in the app router`)
    assert.ok(module.title.es.length > 0)
    assert.ok(module.description.es.length > 0)
    assert.ok(module.tasks.length >= 2, `${module.key} should have dashboard tasks`)
    assert.ok(
      module.tasks.every((task) => task.title.es.length > 0),
      `${module.key} should not contain empty task labels`,
    )
  }
})
