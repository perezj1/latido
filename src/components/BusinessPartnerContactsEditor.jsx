import { Input, Select } from './UI'
import { C, PP } from '../lib/theme'
import {
  BUSINESS_PARTNER_CONTACT_TYPES,
  MAX_PARTNER_CONTACT_OPTIONS,
  getPartnerContactType,
} from '../lib/businessPartnerContacts'

function createContactOption() {
  return {
    id:`contact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type:'address',
    label:'',
    value:'',
  }
}

export default function BusinessPartnerContactsEditor({ options = [], onChange }) {
  const contacts = Array.isArray(options) ? options.slice(0, MAX_PARTNER_CONTACT_OPTIONS) : []

  const updateContact = (index, field, value) => {
    onChange?.(contacts.map((contact, contactIndex) => (
      contactIndex === index ? { ...contact, [field]:value } : contact
    )))
  }

  return (
    <div style={{ borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`, padding:'12px 0', margin:'0 0 14px' }}>
      <p style={{ fontFamily:PP, fontWeight:800, fontSize:12, color:C.text, margin:'0 0 4px' }}>
        Contactos adicionales
      </p>
      <p style={{ fontFamily:PP, fontSize:10.5, color:C.light, lineHeight:1.5, margin:'0 0 10px' }}>
        Añade aquí otras sedes, teléfonos, emails o redes. Si hay varias opciones del mismo tipo, se mostrarán en un desplegable.
      </p>

      {contacts.map((contact, index) => {
        const type = getPartnerContactType(contact.type)
        return (
          <section key={contact.id || index} style={{ padding:'11px 11px 1px', marginBottom:10, background:'#fff', border:`1px solid ${C.border}`, borderRadius:13 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:8 }}>
              <strong style={{ fontFamily:PP, fontSize:11, color:C.text }}>Contacto {index + 1}</strong>
              <button
                type="button"
                onClick={() => onChange?.(contacts.filter((_, contactIndex) => contactIndex !== index))}
                style={{ border:0, background:'transparent', color:'#DC2626', fontFamily:PP, fontWeight:700, fontSize:10.5, cursor:'pointer' }}
              >
                Eliminar
              </button>
            </div>
            <Select label="Tipo" value={contact.type || 'address'} onChange={event => updateContact(index, 'type', event.target.value)}>
              {BUSINESS_PARTNER_CONTACT_TYPES.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </Select>
            <Input
              label="Nombre o sede (opcional)"
              placeholder="Ej: Sede Zürich"
              value={contact.label || ''}
              onChange={event => updateContact(index, 'label', event.target.value)}
            />
            <Input
              label={`${type.label} *`}
              type={contact.type === 'email' ? 'email' : contact.type === 'website' ? 'url' : ['phone', 'whatsapp'].includes(contact.type) ? 'tel' : 'text'}
              placeholder={type.placeholder}
              value={contact.value || ''}
              onChange={event => updateContact(index, 'value', event.target.value)}
            />
          </section>
        )
      })}

      <button
        type="button"
        disabled={contacts.length >= MAX_PARTNER_CONTACT_OPTIONS}
        onClick={() => onChange?.([...contacts, createContactOption()])}
        style={{ width:'100%', border:`1.5px dashed ${C.primary}`, borderRadius:12, padding:'10px 12px', background:C.primaryLight, color:C.primary, fontFamily:PP, fontWeight:800, fontSize:11, cursor:contacts.length >= MAX_PARTNER_CONTACT_OPTIONS ? 'not-allowed' : 'pointer', opacity:contacts.length >= MAX_PARTNER_CONTACT_OPTIONS ? .55 : 1 }}
      >
        + Añadir otra forma de contacto
      </button>
    </div>
  )
}
