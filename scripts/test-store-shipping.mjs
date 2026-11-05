import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import {webcrypto} from 'node:crypto'
import {build} from 'esbuild'
import {fileURLToPath} from 'node:url'

const source=(await readFile(new URL('../supabase/functions/create_club_checkout/index.ts',import.meta.url),'utf8'))
  .replace(/^import Stripe .*$/m,'const Stripe=globalThis.MockStripe')
  .replace(/^import \{ createClient \} .*$/m,'const createClient=globalThis.mockClient')
const bundle=await build({stdin:{contents:source,loader:'ts',resolveDir:fileURLToPath(new URL('../supabase/functions/create_club_checkout/',import.meta.url))},bundle:true,write:false,platform:'node',format:'iife'})
async function checkout(quantity,existing=null){
  let handler,inserted,session
  const service={from(){
    const q={select(){return q},eq(){return q},gte(){return q},
      async maybeSingle(){return{data:existing}},insert(data){inserted=data;return q},
      async single(){return{data:{id:'order-id',reference:'LC-test'}}},
      update(){return q},then(resolve,reject){return Promise.resolve({count:0,error:null}).then(resolve,reject)}}
    return q
  }}
  class MockStripe {
    static createFetchHttpClient(){}
    checkout={sessions:{async create(data){session=data;return{id:'cs_test',url:'https://checkout.stripe.test/session'}},async expire(){}}}
  }
  vm.runInNewContext(bundle.outputFiles[0].text,{
    MockStripe,mockClient:()=>service,Request,Response,Map,Set,TextEncoder,crypto:webcrypto,console,
    fetch:async()=>Response.json({products:[{id:'test-product',name:'Camiseta',price:24.9,purchaseType:'base',optionLabel:'Color / Talla',variants:[{sku:'sku-test',label:'Negro / M',available:true}]}]}),
    Deno:{env:{get:k=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test',STRIPE_CLUB_SECRET_KEY:'test'})[k]},serve:h=>handler=h}
  })
  const response=await handler(new Request('https://test.supabase.co',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({checkoutRequestId:'11111111-1111-4111-8111-111111111111',items:[{sku:'sku-test',quantity,unit_amount:1}],shipping_amount:0})}))
  return{response,inserted,session}
}
for(const quantity of [1,2,3]){
  const {response,inserted,session}=await checkout(quantity)
  assert.equal(response.status,200)
  assert.equal(inserted.subtotal_amount,2490*quantity,'Product prices stay unchanged and come from the catalog')
  assert.equal(inserted.shipping_amount,900,'One flat shipping fee per order')
  assert.equal(inserted.total_amount,2490*quantity+900)
  assert.equal(session.line_items[0].price_data.unit_amount,2490)
  assert.equal(session.shipping_options.length,1)
  assert.equal(session.shipping_options[0].shipping_rate_data.fixed_amount.amount,900)
  assert.equal(session.shipping_options[0].shipping_rate_data.fixed_amount.currency,'chf')
}
const stale=await checkout(1,{reference:'old',status:'checkout_open',stripe_checkout_url:'https://old.test',shipping_amount:0})
assert.equal(stale.response.status,409,'An old checkout without shipping cannot be reused')
const current=await checkout(1,{reference:'current',status:'checkout_open',stripe_checkout_url:'https://current.test',shipping_amount:900})
assert.equal(current.response.status,200)
assert.equal(current.session,undefined,'A retry reuses the same checkout without charging shipping twice')
console.log('Store shipping: CHF 9 once per order, trusted prices, totals, Stripe shipping, tamper resistance and checkout reuse passed; no real payments created.')
