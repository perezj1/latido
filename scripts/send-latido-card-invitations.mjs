// Explicit operator command. A normal invocation previews counts and sends nothing.
const args = process.argv.slice(2)
const allowed = ['--queue', '--send']
if (args.some((arg) => !allowed.includes(arg) && !arg.startsWith('--test=')) || args.length > 1) {
  throw new Error(
    'Usa una sola opción: --queue, --send o --test=tu@email.com. Sin opciones: vista previa.'
  )
}
const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const secret = process.env.LATIDO_CARD_INVITATION_SECRET
if (!url || !secret)
  throw new Error('Configura SUPABASE_URL y LATIDO_CARD_INVITATION_SECRET en el entorno.')
const body = args[0]?.startsWith('--test=')
  ? { test_email: args[0].slice(7) }
  : { action: args.includes('--queue') ? 'queue' : args.includes('--send') ? 'send' : 'preview' }
const response = await fetch(`${url}/functions/v1/latido_card_business_invitation_email`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-latido-cron-secret': secret },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(120000)
})
const result = await response.json()
console.log(JSON.stringify(result, null, 2))
if (!response.ok || result.ok === false || result.failed > 0) process.exitCode = 1
