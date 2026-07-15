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

  // PostgREST SELECT errors use: "column providers.address does not exist".
  const qualifiedColumnMatch = message.match(/column\s+(?:[a-z_][\w$]*\.)?([a-z_][\w$]*)\s+does not exist/i)
  if (qualifiedColumnMatch?.[1]) return qualifiedColumnMatch[1]

  return null
}

export function isLikelySchemaMismatchError(error, table) {
  const message = String(error?.message || '').toLowerCase()
  if (!message) return false
  if (message.includes('schema cache')) return true
  if (message.includes('does not exist')) return true
  return !!getMissingColumnName(error, table)
}

export async function insertWithOptionalColumnsFallback({ table, payload, optionalColumns = [], select = '', single = false }) {
  const nextPayload = { ...payload }
  const removable = new Set(optionalColumns)
  const strippedColumns = []

  while (true) {
    let query = supabase.from(table).insert(nextPayload)
    if (select) query = query.select(select)
    if (single) query = query.single()
    const result = await query
    if (!result.error) return { ...result, strippedColumns }

    const missingColumn = getMissingColumnName(result.error, table)
    if (!missingColumn || !removable.has(missingColumn) || !(missingColumn in nextPayload)) {
      return { ...result, strippedColumns }
    }

    delete nextPayload[missingColumn]
    strippedColumns.push(missingColumn)
  }
}
