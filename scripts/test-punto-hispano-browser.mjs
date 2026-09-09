import path from 'node:path';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
if (!process.argv[2]) throw new Error('Pass the path to playwright/index.mjs; start Vite on port 5188 first.');
const { chromium } = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const outputDir = mkdtempSync(path.join(tmpdir(), 'latido-punto-hispano-'));
const env = readFileSync('.env','utf8');
const projectUrl = env.match(/^VITE_SUPABASE_URL=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const storageKey = `sb-${new URL(projectUrl).hostname.split('.')[0]}-auth-token`;
const browser = await chromium.launch({executablePath:process.env.LATIDO_TEST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,downloadsPath:path.join(outputDir,'downloads')});
const contactRow={id:'contact-1',user_name:'Ana Prueba',user_email:'ana@example.com',category_label:'Idiomas',service_label:'Alemán (A1–C1)',created_at:'2026-09-09T12:30:00Z',placement:'test'};
async function setup(email=null,viewport={width:390,height:844}) {
 const context=await browser.newContext({viewport});
 let rpc=[], outbound=[], fail=false;
 const errors=[];
 const user={id:'11111111-1111-4111-8111-111111111111',email,role:'authenticated',aud:'authenticated',user_metadata:{name:'Ana Prueba',latido_onboarding_completed:true},app_metadata:{provider:'email'},created_at:'2025-01-01T00:00:00Z'};
 await context.addInitScript(({storageKey,user,email})=>{
  if(email) localStorage.setItem(storageKey, JSON.stringify({access_token:'test-access',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}));
  localStorage.setItem('latido_cookie_consent',JSON.stringify({policyVersion:'2026-08-08',expiresAt:new Date(Date.now()+86400000).toISOString(),categories:{necessary:true,analytics:false,externalMedia:false}}));
 },{storageKey,user,email});
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='127.0.0.1' || u.protocol==='blob:') return route.continue();
  if(u.hostname==='wa.me') { outbound.push(u); return route.fulfill({contentType:'text/html',body:'<p>Mock WhatsApp destination</p>'}); }
  if(u.pathname.endsWith('/rpc/record_punto_hispano_contact')) {
   rpc.push(route.request().postDataJSON());
   if(fail) return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Offline test'})});
   return route.fulfill({contentType:'application/json',body:JSON.stringify(contactRow)});
  }
  if(u.pathname.endsWith('/punto_hispano_contacts')) return route.fulfill({contentType:'application/json',headers:{'content-range':'0-0/1','access-control-expose-headers':'content-range'},body:JSON.stringify([contactRow])});
  if(u.pathname.endsWith('/auth/v1/user')) return route.fulfill({contentType:'application/json',body:JSON.stringify(user)});
  if(u.pathname.endsWith('/profiles') && (route.request().headers().accept||'').includes('vnd.pgrst.object')) return route.fulfill({contentType:'application/json',body:JSON.stringify({id:user.id,name:'Ana Prueba',email,banned:false,interests:[]})});
  return route.fulfill({contentType:'application/json',headers:{'content-range':'*/0'},body:'[]'});
 });
 const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
 return {page,context,rpc,outbound,errors,setFail:v=>{fail=v}};
}
try {
 const anon=await setup();
 await anon.page.goto('http://127.0.0.1:5188/servicios-suiza');
 await anon.page.getByLabel('Categoría',{exact:true}).selectOption('idiomas');
 await anon.page.getByLabel(/Subcategoría/).selectOption('aleman');
 const login=anon.page.getByRole('link',{name:'Inicia sesión para contactar'});
 const href=await login.getAttribute('href');
 assert.match(decodeURIComponent(href),/category=idiomas/); assert.match(decodeURIComponent(href),/subcategory=aleman/);
 assert.equal(anon.rpc.length,0);
 assert.ok(await anon.page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await anon.page.screenshot({path:path.join(outputDir,'selector-mobile.png'),fullPage:true});
 await anon.page.goto('http://127.0.0.1:5188/');
 await anon.page.locator('article[aria-labelledby^="partner-card-punto-hispano"] .partner-card-cta').first().click();
 await anon.page.getByRole('dialog',{name:'Contactar con Punto Hispano'}).waitFor();
 assert.equal(new URL(anon.page.url()).pathname,'/');
 await anon.page.getByRole('button',{name:'Cerrar'}).click();
 assert.equal(await anon.page.getByRole('dialog',{name:'Contactar con Punto Hispano'}).count(),0);
 assert.deepEqual(anon.errors,[]);
 await anon.context.close();
 const member=await setup('ana@example.com');
 await member.page.goto('http://127.0.0.1:5188/servicios-suiza?from=test');
 const button=member.page.getByRole('button',{name:'Contactar por WhatsApp'});
 await button.waitFor(); assert.equal(await button.isDisabled(),true);
 await member.page.getByLabel('Categoría',{exact:true}).selectOption('gestoria');
 await member.page.getByLabel(/Subcategoría/).selectOption('rav');
 await member.page.getByLabel('Categoría',{exact:true}).selectOption('idiomas');
 assert.equal(await member.page.getByLabel(/Subcategoría/).inputValue(),'');
 assert.equal(await button.isEnabled(),true);
 await member.page.getByLabel(/Subcategoría/).selectOption('aleman');
 member.setFail(true); await button.click(); await member.page.getByRole('alert').filter({hasText:'No pudimos'}).waitFor();
 assert.equal(member.outbound.length,0); assert.equal(member.rpc.length,1);
 member.setFail(false); await button.click(); await member.page.waitForURL('https://wa.me/**');
 assert.equal(member.rpc.length,2); assert.equal(member.rpc[0].p_request_id,member.rpc[1].p_request_id);
 assert.deepEqual(Object.keys(member.rpc[1]).sort(),['p_category','p_placement','p_request_id','p_service']);
 assert.match(member.outbound[0].searchParams.get('text'),/^Hola soy Ana Prueba y vengo de Latido.ch\./);
 assert.equal(member.outbound[0].pathname,'/41766232664');
 assert.deepEqual(member.errors,[]); await member.context.close();
 const admin=await setup('jose13hue@gmail.com',{width:1440,height:1050});
 await admin.page.goto('http://127.0.0.1:5188/admin-latido');
 await admin.page.getByRole('button',{name:/Colaboraciones/}).first().click();
 await admin.page.getByRole('heading',{name:'Contactos de Punto Hispano'}).waitFor();
 await admin.page.getByRole('cell',{name:'ana@example.com',exact:true}).waitFor();
 const download=admin.page.waitForEvent('download',{timeout:10000}).catch(async e=>{console.log('Export state',await admin.page.locator('.ph-admin').innerText(),admin.errors);throw e});
 await admin.page.getByRole('button',{name:'Exportar para Excel (CSV)'}).click();
 const file=await download; await file.saveAs(path.join(outputDir,'export.csv'));
 assert.match(readFileSync(path.join(outputDir,'export.csv'),'utf8'),/Ana Prueba/);
 await admin.page.getByLabel('Desde (UTC)').fill('2026-09-10');
 await admin.page.getByLabel('Hasta (UTC)').fill('2026-09-09');
 await admin.page.getByRole('alert').filter({hasText:'La fecha de inicio'}).waitFor();
 await admin.page.getByLabel('Desde (UTC)').fill('2026-09-01');
 await admin.page.screenshot({path:path.join(outputDir,'admin-desktop.png'),fullPage:false});
 assert.deepEqual(admin.errors,[]); await admin.context.close();
 console.log('Browser passed: inline contact modal, mobile selector, login return path, category reset, no premature record, failure/retry, WhatsApp URL, admin table and CSV download. All remote APIs mocked.');
 console.log('Test artifacts:', outputDir);
} finally {await browser.close();}
