import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"
import { moduleControlAction } from "../lib/pilot/control-permissions"

interface Node { type: unknown; props: Record<string, any>; children: unknown[] }
type ForwardRef = { render: (props: Record<string, unknown>, ref: unknown) => Node }

/** Execute the checked-in JSX, replacing only the renderer/primitive runtime.
 * The primitive identity matters: dismissing an alert must never use Action. */
function actualComponents(file: "dialog" | "alert-dialog") {
  const source = readFileSync(new URL(`../components/ui/${file}.tsx`, import.meta.url), "utf8")
  const javascript = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const primitives = Object.fromEntries(["Root", "Trigger", "Portal", "Overlay", "Content", "Close", "Cancel", "Action", "Title", "Description"].map(key => [key, `${file}.${key}`]))
  const react = { createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): Node => ({ type, props: props || {}, children }), forwardRef: (render: ForwardRef["render"]) => ({ render }) }
  const exports: Record<string, any> = {}
  const require = (name: string) => {
    if (name === "react") return react
    if (name.startsWith("@radix-ui/")) return primitives
    if (name === "lucide-react") return { X: "X" }
    if (name === "@/lib/utils") return { cn: (...classes: unknown[]) => classes.filter(Boolean).join(" ") }
    if (name === "@/components/ui/button") return { buttonVariants: () => "button-variant" }
    throw new Error(`Unexpected dependency ${name}`)
  }
  new Function("require", "exports", javascript)(require, exports)
  return { exports, primitives }
}

function descendants(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(descendants)
  if (!value || typeof value !== "object" || !("children" in value)) return []
  const node = value as Node
  return [node, ...node.children.flatMap(descendants)]
}

test("ordinary Dialog renders a default accessible close, not a form submission or privileged action", () => {
  const { exports, primitives } = actualComponents("dialog")
  const child = { type: "form", props: {}, children: ["Existing form"] }
  const tree = exports.DialogContent.render({ children: child }, null)
  const closes = descendants(tree).filter(node => node.type === primitives.Close)
  assert.equal(closes.length, 1)
  const close = closes[0]
  assert.equal(close.props.type, "button")
  assert.equal(close.props["aria-label"], "Cerrar")
  assert.equal(close.props.title, "Cerrar")
  assert.equal(close.props["data-pld-context"], "browse")
  assert.equal(moduleControlAction({ tag: "button", type: close.props.type, text: "Cerrar", context: close.props["data-pld-context"] }), null)
  assert.equal(close.props.onClick, undefined, "Radix must delegate to the existing controlled root, including its busy guard")
  assert.match(close.props.className, /focus-visible:ring-2/)
  assert.match(close.props.className, /sticky/)
  assert.equal(close.children[0] && (close.children[0] as Node).props["aria-hidden"], "true")
  assert.ok(descendants(tree).includes(child))
  assert.equal(exports.DialogClose, primitives.Close)
})

test("Dialog preserves caller handlers and supports disabled/custom dismiss controls without leaking props", () => {
  const { exports, primitives } = actualComponents("dialog")
  const onEscapeKeyDown = () => undefined, onCloseAutoFocus = () => undefined, ref = {}
  const tree = exports.DialogContent.render({ children: "Body", closeButtonDisabled: true, onEscapeKeyDown, onCloseAutoFocus }, ref)
  const nodes = descendants(tree), content = nodes.find(node => node.type === primitives.Content)!, close = nodes.find(node => node.type === primitives.Close)!
  assert.equal(content.props.ref, ref)
  assert.equal(content.props.onEscapeKeyDown, onEscapeKeyDown)
  assert.equal(content.props.onCloseAutoFocus, onCloseAutoFocus)
  assert.equal(close.props.disabled, true)
  assert.equal(content.props.closeButtonDisabled, undefined)
  assert.equal(content.props.showCloseButton, undefined)
  assert.equal(descendants(exports.DialogContent.render({ showCloseButton: false }, null)).some(node => node.type === primitives.Close), false)
  assert.equal(exports.Dialog, primitives.Root, "No replacement root may bypass controlled onOpenChange")
})

test("scrollable modal headers reserve a shared top row while the flex evidence viewer keeps its existing height", () => {
  for (const [file, name] of [["dialog", "Dialog"], ["alert-dialog", "AlertDialog"]] as const) {
    const { exports } = actualComponents(file)
    const header = exports[`${name}Header`]({})
    assert.match(header.props.className, /col-start-1 row-start-1/)
    assert.match(header.props.className, /pr-12/)
    const tree = exports[`${name}Content`].render({ className: "flex h-[90vh] flex-col overflow-hidden p-0", children: "Evidence viewer" }, null)
    const close = descendants(tree).find(node => node.props["aria-label"] === "Cerrar")!
    assert.match(close.props.className, /absolute right-4 top-4/)
    assert.doesNotMatch(close.props.className, /sticky/)
  }
})

test("AlertDialog X always cancels and cannot invoke the destructive confirmation action", () => {
  const { exports, primitives } = actualComponents("alert-dialog")
  const confirm = { type: primitives.Action, props: { onClick: () => { throw new Error("Confirmation must stay explicit") } }, children: ["Archivar"] }
  const cancel = { type: primitives.Cancel, props: {}, children: ["Cancelar"] }
  const tree = exports.AlertDialogContent.render({ children: [cancel, confirm] }, null)
  const nodes = descendants(tree), close = nodes.find(node => node.props["aria-label"] === "Cerrar")!
  assert.equal(close.type, primitives.Cancel)
  assert.equal(close.props.type, "button")
  assert.equal(close.props["data-pld-context"], "browse")
  assert.equal(close.props.onClick, undefined)
  assert.equal(nodes.filter(node => node.type === primitives.Action).length, 1)
  assert.ok(nodes.includes(confirm))
  const content = nodes.find(node => node.type === primitives.Content)!
  assert.equal(content.children[0], close, "Keep the existing footer Cancel mounted later as the preferred Radix cancel focus target")
  assert.equal(descendants(exports.AlertDialogContent.render({ showCloseButton: false }, null)).some(node => node.props["aria-label"] === "Cerrar"), false)
})

test("custom Governance dismiss controls stay accessible for read-only users", () => {
  const source = readFileSync(new URL("../app/gobernanza-control/page.tsx", import.meta.url), "utf8")
  const controls = [...source.matchAll(/<DialogPrimitive\.Close asChild>\s*(<Button[^>]*>)/g)]
    .filter(([, button]) => button.includes('size="icon"'))
  assert.equal(controls.length, 3)
  for (const [, button] of controls) {
    assert.match(button, /type="button"/)
    assert.match(button, /aria-label="Cerrar"/)
    assert.match(button, /data-pld-context="browse"/)
  }
})
