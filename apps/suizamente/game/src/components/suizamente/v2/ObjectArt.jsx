import {Icono} from './Icono'
export function ObjectArt({kind='gift',className=''}){return <Icono nombre={kind==='chest'?'cofre':kind==='pack'?'sobre':'regalo'} size="100%" className={'sv-object-art '+className}/>}
