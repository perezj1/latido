export function LoadingScreen(){
 return <section className="standalone-loading" role="status" aria-label="Cargando Suizamente"><div className="sv-loading-brand"><img src="/suizamente-assets/logo-suizamente.svg" width="64" height="64" alt=""/><strong>Cargando Suizamente…</strong></div><div className="sv-loading-preview" aria-hidden="true"><i className="sv-loading-bar"/><div className="sv-skeleton"/><i className="sv-loading-bar short"/><i className="sv-loading-bar"/></div></section>
}
export function LoadingCards({label='Cargando…',count=2}){
 return <div className="sv-loading-cards" role="status" aria-label={label} aria-busy="true">{Array.from({length:count},(_,i)=><div className="sv-loading-card" key={i} aria-hidden="true"><i className="sv-loading-avatar"/><div><i className="sv-loading-bar"/><i className="sv-loading-bar short"/></div></div>)}</div>
}
