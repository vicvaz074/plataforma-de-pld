import test from "node:test"
import assert from "node:assert/strict"
import { getPrivateDocumentReference, resolveSafeDocumentHref } from "../lib/pld/document-links"

const options = { mode: "cloud" as const, companyId: "company-a", origin: "https://pld.example" }
test("document links permit only exact company-private objects in connected mode", () => {
  assert.equal(resolveSafeDocumentHref("/api/v1/companies/company-a/files/file-1", options), "/api/v1/companies/company-a/files/file-1")
  assert.equal(resolveSafeDocumentHref("https://pld.example/api/v1/companies/company-a/files/file-1", options), "/api/v1/companies/company-a/files/file-1")
  for (const value of ["javascript:alert(1)", "JaVa\nScript:alert(1)", "\tjavascript:alert(1)", "vbscript:msgbox(1)", "data:text/html,<script>x</script>", "//evil.example/a", "https://evil.example/api/v1/companies/company-a/files/file-1", "/api/v1/companies/company-b/files/file-1", "/api/v1/companies/company-a/files/file-1?x=1", "/api/v1/companies/company-a/files/file-1#x", "/api/v1/companies/company-a/files/file%2f1", "/api/v1/companies/company-a/files/%252e%252e", "blob:https://pld.example/fake"]) assert.equal(resolveSafeDocumentHref(value, options), null, value)
  assert.equal(getPrivateDocumentReference("/api/v1/companies/inbox:org:user/files/file-1", "inbox:org:user")?.href, "/api/v1/companies/inbox%3Aorg%3Auser/files/file-1")
})

test("demo and generated downloads are explicit exceptions, never a cloud fallback", () => {
  const pdf = "data:application/pdf;base64,JVBERi0xLgo="
  assert.equal(resolveSafeDocumentHref(pdf, options), null)
  assert.equal(resolveSafeDocumentHref(pdf, { mode: "demo" }), pdf)
  assert.equal(resolveSafeDocumentHref("data:image/svg+xml,<svg/>", { mode: "demo" }), null)
  const json = "data:application/json;charset=utf-8,%7B%22a%22%3A1%7D"
  assert.equal(resolveSafeDocumentHref(json, options), null)
  assert.equal(resolveSafeDocumentHref(json, { ...options, generated: true, purpose: "download" }), json)
  assert.equal(resolveSafeDocumentHref(json, { ...options, generated: true, purpose: "preview" }), null)
})
