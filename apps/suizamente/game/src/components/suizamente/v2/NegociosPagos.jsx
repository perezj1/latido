import {useState} from 'react'
import {Button,Card} from './Shared'
import {Icono} from './Icono'
import {useData} from './useData'
import {szApi} from '../../../lib/suizamenteV2'

export function PaymentMethods({method,setMethod,period,setPeriod}){
 return <><fieldset className="sv-neg-payment-methods"><legend>Cómo pagas</legend>{[['tarjeta','Tarjeta','Cada mes o cada año. La guarda Stripe, sin cobrar hoy.','tarjeta'],['twint','TWINT','Solo anual. Recibirás el enlace de pago tras la aprobación.','movil'],['factura','Factura QR','Solo anual. Latido te enviará la factura cuando apruebe tu ficha.','factura']].map(([key,title,text,icon])=><label key={key}><input type="radio" name="metodo" checked={method===key} onChange={()=>{setMethod(key);if(key!=='tarjeta')setPeriod('ano')}}/><Icono nombre={icon} size={28}/><span><b>{title}</b><small>{text}</small></span></label>)}</fieldset>{method!=='tarjeta'&&period!=='ano'&&<p role="alert">Elige el periodo anual para TWINT o factura QR.</p>}<p className="sv-muted">El pago se hace en Stripe. Latido nunca recibe los datos de tu tarjeta.</p></>
}
export function BusinessPaymentAccount({id,admin=false}){
 const {data,error,reload}=useData('negocios/'+id+'/pagos',{refreshMs:15000}),[busy,setBusy]=useState(false),[failure,setFailure]=useState('')
 async function open(operation){
  if(busy)return;setBusy(true);setFailure('')
  try{
   const result=await szApi('negocios/'+id+'/pagos/'+operation,{method:'POST',body:{}})
   if(result.url){const url=new URL(result.url);if(url.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com'].includes(url.hostname)||url.username||url.password)throw new Error('Enlace de pago no válido');window.location.assign(url.href)}
   else{reload();setFailure(result.guardada?'Tu tarjeta ya está guardada.':'Stripe está confirmando la tarjeta. Actualiza en unos segundos.')}
  }catch(e){setFailure(e.message)}finally{setBusy(false)}
 }
 return <Card><h2>Tu forma de pago</h2>{(failure||error)&&<p role="alert" className="sv-error">{failure||error}</p>}{data&&<>{data.metodo==='tarjeta'?<><p>{data.tarjetaGuardada?'Tarjeta guardada en Stripe.':'Guarda tu tarjeta en Stripe, sin cobrar. Latido podrá aprobar después tu ficha.'}</p>{!admin&&<Button disabled={busy} onClick={()=>open(data.tarjetaGuardada?'portal':'tarjeta')}>{data.tarjetaGuardada?'Gestionar tarjeta y facturas':'Guardar tarjeta en Stripe'}</Button>}</>:data.metodo==='twint'?<><p>TWINT · pago anual. El enlace se abre después de la aprobación.</p>{data.pagoPendiente&&!admin&&<Button disabled={busy} onClick={()=>open('twint')}>Pagar el año con TWINT</Button>}</>:<p>Factura QR anual. Latido te enviará la factura cuando apruebe tu ficha.</p>}{data.trabajosPendientes>0&&<p role="status">El pago está pendiente de confirmar con Stripe.</p>}{data.facturas.filter(f=>f.url).map(f=><p key={f.referencia}><a href={f.url} target="_blank" rel="noopener noreferrer">{f.pagada?'Factura pagada':'Revisar factura'} ›</a></p>)}</>}{!data&&!error&&<p role="status">Cargando tu forma de pago…</p>}</Card>
}
