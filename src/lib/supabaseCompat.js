import { supabase } from './supabase'

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getMissingColumnName(error, table) {
  const message = String(error?.message || '')
  if (!message) return null

  const tableName = table ? escapeRegex(table) : "[^']+"
  const schemaCacheMatch = message.match(
    new RegExp(`Could not find the '([^']+)' column of '${tableName}' in the schema cache`, 'i')
  )
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1]

  const relationMatch = message.match(/column "([^"]+)" of relation "[^"]+" does not exist/i)
  if (relationMatch?.[1]) return relationMatch[1]

  return null
}

export function isLikelySchemaMismatchError(error, table) {
  const message = String(error?.message || '').toLowerCase()
  if (!message) return false
  if (message.includes('schema cache')) return true
  if (message.includes('does not exist')) return true
  return !!getMissingColumnName(error, table)
}

export async function insertWithOptionalColumnsFallback({ table, payload, optionalColumns = [] }) {
  const nextPayload = { ...payload }
  const removable = new Set(optionalColumns)
  const strippedColumns = []

  while (true) {
    const result = await supabase.from(table).insert(nextPayload)
    if (!result.error) return { ...result, strippedColumns }

    const missingColumn = getMissingColumnName(result.error, table)
    if (!missingColumn || !removable.has(missingColumn) || !(missingColumn in nextPayload)) {
      return { ...result, strippedColumns }
    }

    delete nextPayload[missingColumn]
    strippedColumns.push(missingColumn)
  }
}
