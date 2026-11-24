export function FirstGameHint({kind}){
 return <aside className="sv-first-hint" role="note"><span aria-hidden="true">💡</span><div><b>{kind==='giro'?'Tu primera partida':'¿Dudas? Usa un comodín'}</b><p>{kind==='giro'?'La ruleta elige la categoría. Con 3 aciertos seguidos llenas la barra 🛂 de arriba y juegas por un sello.':'Están aquí abajo: ✂️ quita una respuesta incorrecta y ⏱️ te da 15 segundos más.'}</p></div></aside>
}
