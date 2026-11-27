export { default } from '../server/suizamente/http.mjs'
// Signed webhooks require the original request bytes.
export const config={api:{bodyParser:false}}
