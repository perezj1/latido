// Quoting CSV delimiters alone does not prevent spreadsheet formula execution.
export function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  const formula = typeof value === 'string'
    && /^(?:[\s\u0000-\u001f\uFEFF]*[=+\-@＝＋－＠]|[\t\r\n])/.test(text)
  const safeText = formula ? `'${text}` : text
  return /[";\n\r]/.test(safeText) ? `"${safeText.replace(/"/g, '""')}"` : safeText
}
