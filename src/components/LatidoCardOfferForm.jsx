import { useEffect, useRef, useState } from 'react'
import { Eye, Info } from 'lucide-react'
import { cardErrorMessage } from '../lib/latidoCardCore'
import LatidoOfferPreview from './LatidoOfferVisual'
import './LatidoCardOfferForm.css'

const initial = {
  title: '',
  description: '',
  benefit_type: 'percent',
  benefit_value: '10',
  minimum_spend: '0',
  requires_claim: false,
  activation_mode: 'manual',
  stock_total: '',
  claim_days: 7,
  usage_period: 'month',
  usage_limit: 1,
  ends_at: ''
}
const types = [
  ['percent', 'Porcentaje %'],
  ['fixed', 'Importe CHF'],
  ['gift', '🎁 Regalo'],
  ['service', '🤝 Servicio'],
  ['two_for_one', '✨ 2 × 1']
]

function defaultTitle(offer, detail) {
  const suffix = detail.trim()
  if (offer.benefit_type === 'percent')
    return `${offer.benefit_value || '…'} % ${suffix || 'de descuento'}`
  if (offer.benefit_type === 'fixed')
    return `CHF ${offer.benefit_value || '…'} ${suffix || 'de descuento'}`
  if (offer.benefit_type === 'two_for_one') return `2 × 1${suffix ? ` ${suffix}` : ''}`
  return suffix || (offer.benefit_type === 'gift' ? 'Regalo para socios' : 'Servicio incluido')
}

export default function LatidoCardOfferForm({ business, onPublish }) {
  const [offer, setOffer] = useState(initial)
  const [detail, setDetail] = useState(''),
    [customValue, setCustomValue] = useState(false)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const formRef = useRef(null),
    dateRef = useRef(null),
    valueRef = useRef(null)
  const monetary = ['percent', 'fixed'].includes(offer.benefit_type)
  const preview = { ...offer, title: offer.title.trim() || defaultTitle(offer, detail) }
  const values = offer.benefit_type === 'percent' ? ['5', '10', '15', '20'] : ['5', '10', '20']
  const set = (key, value) => {
    setError('')
    setOffer((previous) => ({ ...previous, [key]: value }))
  }
  useEffect(() => {
    if (customValue) valueRef.current?.focus()
  }, [customValue])
  const submit = async (event) => {
    event.preventDefault()
    if (busy || !formRef.current.reportValidity()) return
    if (preview.title.length < 3) {
      setError('Escribe un título de al menos tres caracteres.')
      return
    }
    if (!offer.ends_at || Date.parse(offer.ends_at) <= Date.now()) {
      dateRef.current.setCustomValidity('Elige una fecha futura para tu descuento.')
      dateRef.current.reportValidity()
      return
    }
    setBusy(true)
    setError('')
    try {
      await onPublish({
        ...offer,
        title: preview.title,
        benefit_value: monetary ? Number(offer.benefit_value) : null,
        minimum_spend: Number(offer.minimum_spend || 0),
        stock_total: offer.requires_claim ? Number(offer.stock_total) : null,
        usage_limit: Number(offer.usage_limit),
        ends_at: new Date(offer.ends_at).toISOString()
      })
      setOffer(initial)
      setDetail('')
      setCustomValue(false)
    } catch (err) {
      setError(cardErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="lc-form lc-create-form" ref={formRef} onSubmit={submit}>
      <section className="lc-create-preview" aria-label="Vista previa">
        <p>
          <Eye size={14} aria-hidden="true" />
          Así lo verán los socios
        </p>
        <LatidoOfferPreview offer={preview} business={business} />
      </section>
      <fieldset className="lc-create-group" disabled={busy}>
        <legend>Tipo de descuento</legend>
        <div className="lc-create-segments lc-create-types">
          {types.map(([type, label]) => (
            <label key={type}>
              <input
                type="radio"
                name="benefit-type"
                value={type}
                checked={offer.benefit_type === type}
                onChange={() => {
                  setOffer((previous) => ({ ...previous, benefit_type: type, benefit_value: '10' }))
                  setCustomValue(false)
                  setError('')
                }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {monetary && (
        <fieldset className="lc-create-group" disabled={busy}>
          <legend>¿Cuánto descuento?</legend>
          <div className="lc-create-segments lc-create-values">
            {values.map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="benefit-value"
                  checked={!customValue && offer.benefit_value === value}
                  onChange={() => {
                    set('benefit_value', value)
                    setCustomValue(false)
                  }}
                />
                <span>{offer.benefit_type === 'percent' ? `${value} %` : `CHF ${value}`}</span>
              </label>
            ))}
            <label>
              <input
                type="radio"
                name="benefit-value"
                checked={customValue}
                onChange={() => setCustomValue(true)}
              />
              <span>Otro</span>
            </label>
          </div>
          {customValue && (
            <label className="lc-create-value-input">
              Valor del descuento
              <span>
                <input
                  ref={valueRef}
                  type="number"
                  required
                  min="0.01"
                  max={offer.benefit_type === 'percent' ? 100 : undefined}
                  step="0.01"
                  value={offer.benefit_value}
                  onChange={(event) => set('benefit_value', event.target.value)}
                />
                {offer.benefit_type === 'percent' ? '%' : 'CHF'}
              </span>
            </label>
          )}
        </fieldset>
      )}
      <label>
        ¿En qué se aplica? <small>Opcional</small>
        <input
          disabled={busy}
          value={detail}
          maxLength={60}
          placeholder="Ej.: en tu corte, en la primera consulta"
          onChange={(event) => setDetail(event.target.value)}
        />
      </label>
      {!offer.requires_claim && (
        <fieldset className="lc-create-group" disabled={busy}>
          <legend>¿Cada cuánto puede usarlo un socio?</legend>
          <div className="lc-create-segments">
            {[
              ['unlimited', 'Sin límite'],
              ['month', '1 al mes'],
              ['lifetime', 'Solo 1 vez']
            ].map(([period, label]) => (
              <label key={period}>
                <input
                  type="radio"
                  name="usage-period"
                  checked={
                    offer.usage_period === period &&
                    (period === 'unlimited' || Number(offer.usage_limit) === 1)
                  }
                  onChange={() => {
                    setOffer((previous) => ({ ...previous, usage_period: period, usage_limit: 1 }))
                    setError('')
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <label>
        Válido hasta (hora local)
        <input
          ref={dateRef}
          disabled={busy}
          type="datetime-local"
          required
          value={offer.ends_at}
          onChange={(event) => {
            event.target.setCustomValidity('')
            set('ends_at', event.target.value)
          }}
        />
      </label>
      <details className="lc-create-options">
        <summary>
          <strong>Más opciones</strong>
          <span>
            {Number(offer.minimum_spend) > 0
              ? `Mínimo CHF ${offer.minimum_spend}`
              : 'Sin compra mínima'}
            {offer.requires_claim ? ' · Promoción limitada' : ''}
          </span>
        </summary>
        <fieldset className="lc-create-advanced" disabled={busy}>
          <label>
            Título
            <input
              minLength={3}
              maxLength={120}
              value={offer.title}
              placeholder={defaultTitle(offer, detail)}
              onChange={(event) => set('title', event.target.value)}
            />
          </label>
          <label>
            Condiciones
            <textarea
              maxLength={2000}
              value={offer.description}
              placeholder="Ej.: válido con cita previa."
              onChange={(event) => set('description', event.target.value)}
            />
          </label>
          <label>
            Compra mínima CHF
            <input
              type="number"
              min="0"
              step="0.01"
              value={offer.minimum_spend}
              onChange={(event) => set('minimum_spend', event.target.value)}
            />
          </label>
          <label className="lc-create-stock-toggle">
            <input
              type="checkbox"
              checked={offer.requires_claim}
              onChange={(event) => {
                setError('')
                setOffer((previous) => ({
                  ...previous,
                  requires_claim: event.target.checked,
                  usage_period: event.target.checked ? 'lifetime' : 'month',
                  usage_limit: 1,
                  stock_total: ''
                }))
              }}
            />
            <span>Promoción especial con unidades limitadas</span>
          </label>
          {offer.requires_claim ? (
            <label>
              Unidades disponibles
              <input
                required
                type="number"
                min="1"
                step="1"
                value={offer.stock_total}
                onChange={(event) => set('stock_total', event.target.value)}
              />
              <small>Una unidad por socio. Se descuenta al confirmar el uso.</small>
            </label>
          ) : (
            <>
              <label>
                Frecuencia
                <select
                  value={offer.usage_period}
                  onChange={(event) => set('usage_period', event.target.value)}
                >
                  <option value="day">Por día</option>
                  <option value="week">Por semana (lunes a domingo)</option>
                  <option value="month">Por mes natural</option>
                  <option value="lifetime">En total</option>
                  <option value="unlimited">Sin límite</option>
                </select>
              </label>
              {offer.usage_period !== 'unlimited' && (
                <label>
                  Usos permitidos
                  <input
                    required
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    value={offer.usage_limit}
                    onChange={(event) => set('usage_limit', event.target.value)}
                  />
                </label>
              )}
            </>
          )}
        </fieldset>
      </details>
      <p className="lc-create-notice">
        <Info size={18} aria-hidden="true" />
        <span>El socio activa el descuento y lo confirma al pagar en tu negocio.</span>
      </p>
      <footer className="lc-create-footer">
        {error && (
          <p className="lc-alert" role="alert">
            {error}
          </p>
        )}
        <button className="lc-button" disabled={busy}>
          {busy ? 'Publicando…' : 'Publicar descuento'}
        </button>
        <p>No acumulable con otros descuentos Latido.</p>
      </footer>
    </form>
  )
}
