import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"

import { APP_NAVIGATION_ITEMS, PLD_DASHBOARD_MODULES } from "../lib/pld/navigation"

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
    assert.ok(existsSync(`app${module.href}/page.tsx`), `${module.href} should exist in the app router`)
    assert.ok(module.title.es.length > 0)
    assert.ok(module.description.es.length > 0)
    assert.ok(module.tasks.length >= 2, `${module.key} should have dashboard tasks`)
    assert.ok(
      module.tasks.every((task) => task.title.es.length > 0),
      `${module.key} should not contain empty task labels`,
    )
  }
})
