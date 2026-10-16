import { useEffect, useRef, useState } from 'react'
import { cardErrorMessage, offerBenefitLabel, offerUsageLabel } from '../lib/latidoCardCore'

const initialOffer = {
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
const steps = ['Tu oferta', 'Cómo se usa', 'Revisar']

export default function LatidoCardOfferWizard({ businessName, onPublish }) {
  const [offer, setOffer] = useState(initialOffer)
  const [step, setStep] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const formRef = useRef(null),
    headingRef = useRef(null),
    dateRef = useRef(null)
  const set = (key, value) => {
    setError('')
    setOffer((previous) => ({ ...previous, [key]: value }))
  }
  useEffect(() => {
    if (formRef.current && !formRef.current.closest('[hidden]')) headingRef.current?.focus()
  }, [step])
  const submit = async (event) => {
    event.preventDefault()
    if (busy || !formRef.current.reportValidity()) return
    setError('')
    if (step === 2 && Date.parse(offer.ends_at) <= Date.now()) {
      dateRef.current?.setCustomValidity('Elige una fecha futura para tu oferta.')
      dateRef.current?.reportValidity()
      return
    }
    if (step < 3) {
      setStep((current) => current + 1)
      return
    }
    if (!offer.ends_at || Date.parse(offer.ends_at) <= Date.now()) {
      setStep(2)
      setError('Elige una fecha futura para publicar la oferta.')
      return
    }
    setBusy(true)
    try {
      await onPublish({
        ...offer,
        benefit_value: ['percent', 'fixed'].includes(offer.benefit_type)
          ? Number(offer.benefit_value)
          : null,
        minimum_spend: Number(offer.minimum_spend),
        stock_total: offer.requires_claim ? Number(offer.stock_total) : null,
        ends_at: new Date(offer.ends_at).toISOString()
      })
      setOffer(initialOffer)
      setStep(1)
    } catch (err) {
      setError(cardErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="lc-form lc-offer-wizard" ref={formRef} onSubmit={submit}>
      <ol className="lc-wizard-steps" aria-label="Pasos para crear tu oferta">
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={step === index + 1 ? 'step' : undefined}
            data-complete={step > index + 1}
          >
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <h2 ref={headingRef} tabIndex={-1}>
        Paso {step} de 3 · {steps[step - 1]}
      </h2>
      {error && (
        <p className="lc-alert" role="alert">
          {error}
        </p>
      )}
      {step === 1 && (
        <>
          <p className="lc-muted">Elige qué recibe el cliente y dale un título claro.</p>
          <label>
            Tipo de descuento
            <select
              value={offer.benefit_type}
              onChange={(event) => set('benefit_type', event.target.value)}
            >
              <option value="percent">Descuento en porcentaje</option>
              <option value="fixed">Descuento en CHF</option>
              <option value="gift">Regalo</option>
              <option value="service">Servicio</option>
              <option value="two_for_one">2 × 1</option>
            </select>
          </label>
          {['percent', 'fixed'].includes(offer.benefit_type) && (
            <label>
              {offer.benefit_type === 'percent' ? 'Porcentaje' : 'Descuento CHF'}
              <input
                required
                type="number"
                min="0.01"
                max={offer.benefit_type === 'percent' ? 100 : undefined}
                step="0.01"
                value={offer.benefit_value}
                onChange={(event) => set('benefit_value', event.target.value)}
              />
            </label>
          )}
          <label>
            Título
            <input
              required
              minLength={3}
              maxLength={120}
              value={offer.title}
              placeholder="Ej.: 10 % en tu próximo corte"
              onChange={(event) => set('title', event.target.value)}
            />
          </label>
          <label>
            Condiciones
            <textarea
              maxLength={2000}
              value={offer.description}
              placeholder="Ej.: válido en cortes, con cita previa."
              onChange={(event) => set('description', event.target.value)}
            />
          </label>
        </>
      )}
      {step === 2 && (
        <>
          <p className="lc-muted">Elige un descuento habitual o una promoción especial.</p>
          <fieldset className="lc-offer-kind">
            <legend>Tipo de oferta</legend>
            {[
              [false, 'Descuento incluido', 'Un descuento habitual para socios.'],
              [
                true,
                'Promoción especial',
                'Una unidad por socio. Se descuenta al confirmar el uso.'
              ]
            ].map(([value, label, help]) => (
              <label
                key={label}
                className="lc-offer-kind-choice"
                data-selected={offer.requires_claim === value}
              >
                <input
                  type="radio"
                  name="offer-kind"
                  checked={offer.requires_claim === value}
                  onChange={() => {
                    setError('')
                    setOffer((previous) => ({
                      ...previous,
                      requires_claim: value,
                      usage_period: value ? 'lifetime' : 'month',
                      usage_limit: 1,
                      stock_total: ''
                    }))
                  }}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{help}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className="lc-offer-kind">
            <legend>Cómo lo activa el cliente</legend>
            {[
              [
                'automatic',
                'Activación automática',
                'Aparece activada. Solo necesita pulsar Mostrar y enseñar la tarjeta.'
              ],
              ['manual', 'Activación manual', 'Debe activar el descuento cuando realice la compra.']
            ].map(([value, label, help]) => (
              <label
                key={value}
                className="lc-offer-kind-choice"
                data-selected={offer.activation_mode === value}
              >
                <input
                  type="radio"
                  name="activation-mode"
                  checked={offer.activation_mode === value}
                  onChange={() => set('activation_mode', value)}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{help}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <label>
            Compra mínima CHF
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={offer.minimum_spend}
              onChange={(event) => set('minimum_spend', event.target.value)}
            />
          </label>
          {offer.requires_claim ? (
            <>
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
              </label>
              <p className="lc-muted">Cada socio puede usar esta promoción una vez.</p>
            </>
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
                  <option value="lifetime">Una vez en total</option>
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
                    onChange={(event) => set('usage_limit', Number(event.target.value))}
                  />
                </label>
              )}
            </>
          )}
          <label>
            Válido hasta (hora local)
            <input
              ref={dateRef}
              required
              type="datetime-local"
              value={offer.ends_at}
              onChange={(event) => {
                event.target.setCustomValidity('')
                set('ends_at', event.target.value)
              }}
            />
          </label>
        </>
      )}
      {step === 3 && (
        <>
          <p className="lc-muted">
            Así se publicará en {businessName}. Comprueba los datos antes de continuar.
          </p>
          <article className="lc-wizard-preview">
            <span className="lc-badge">
              {offer.requires_claim ? 'Promoción especial' : 'Descuento incluido'}
            </span>
            <h3>{offer.title}</h3>
            <p>{offerBenefitLabel(offer)}</p>
            {offer.description && <p>{offer.description}</p>}
            <dl>
              <div>
                <dt>Activación</dt>
                <dd>
                  {offer.activation_mode === 'automatic'
                    ? 'Automática: mostrar la tarjeta'
                    : 'Manual: activar al comprar'}
                </dd>
              </div>
              <div>
                <dt>Compra mínima</dt>
                <dd>
                  {Number(offer.minimum_spend) > 0
                    ? `CHF ${offer.minimum_spend}`
                    : 'Sin compra mínima'}
                </dd>
              </div>
              <div>
                <dt>Uso</dt>
                <dd>{offerUsageLabel(offer)}</dd>
              </div>
              <div>
                <dt>Vigencia</dt>
                <dd>{new Date(offer.ends_at).toLocaleString('es-CH')}</dd>
              </div>
              {offer.requires_claim && (
                <>
                  <div>
                    <dt>Unidades</dt>
                    <dd>{offer.stock_total}</dd>
                  </div>
                </>
              )}
            </dl>
            <small>No acumulable con otros descuentos Latido.</small>
          </article>
          <p className="lc-muted">Cuando se utilice, sus condiciones quedarán fijadas.</p>
        </>
      )}
      <div className="lc-actions lc-wizard-actions">
        {step > 1 && (
          <button
            type="button"
            className="lc-button lc-button--secondary"
            disabled={busy}
            onClick={() => {
              setError('')
              setStep((current) => current - 1)
            }}
          >
            Anterior
          </button>
        )}
        <button className="lc-button" disabled={busy}>
          {busy ? 'Publicando…' : step === 3 ? 'Publicar oferta' : 'Continuar'}
        </button>
      </div>
      <small className="lc-muted">
        Puedes tener un descuento incluido y dos promociones especiales vigentes.
      </small>
    </form>
  )
}
