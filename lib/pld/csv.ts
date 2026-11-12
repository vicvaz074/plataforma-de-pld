/** RFC 4180 quoting plus spreadsheet-formula neutralization for untrusted text.
 * Numeric values remain numeric; text is never silently stripped or truncated. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value)
  if (typeof value !== "number" && (/^[\s\u0000-\u001f\u007f\u200b\ufeff]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function serializeCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n")
}
