import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, Repeat2, ShoppingBag, Sparkles, Tag } from 'lucide-react'
import { cardErrorMessage, offerUsageLabel } from '../lib/latidoCardCore'
import {
  createOfferPayload,
  draftOfferName,
  draftOfferScope,
  initialOfferDraft,
  zurichEndOfDay,
  offerCombos
} from '../lib/latidoCardOfferDraft'
import LatidoOfferPreview, { OfferBenefitIcon } from './LatidoOfferVisual'
import './LatidoCardOfferForm.css'

const types = [
  ['percent', '%', 'Descuento %', 'Ej.: 10 % menos', 'blue'],
  ['fixed', 'CHF', 'Cantidad fija', 'Ej.: 5 CHF menos', 'amber'],
  ['combo', '2x1', '2x1 o similar', 'Ej.: 2x1, 3x2', 'pink'],
  ['gift', <OfferBenefitIcon type="gift" />, 'Regalo', 'Ej.: un café gratis', 'green'],
  [
    'other',
    <OfferBenefitIcon type="service" />,
    'Otro beneficio',
    'Lo describes tú: envío gratis, primera consulta gratis…',
    'blue'
  ]
]
const stepNames = { 1: 'Tu oferta', 2: 'Dónde se aplica', 3: 'Usos por socio', 4: 'Revisar' }

function Choice({ name, value, checked, onChange, icon, title, description, tone, recommended }) {
  return (
    <label className="lc-create-choice">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      <span className="lc-create-choice-box">
        <span className={`lc-create-choice-icon lc-create-tone-${tone}`} aria-hidden="true">
          {icon}
        </span>
        <span className="lc-create-choice-copy">
          <strong>
            {title}
            {recommended && <small className="lc-create-recommended">Recomendado</small>}
          </strong>
          <span>{description}</span>
        </span>
        {name !== 'offer-type' && <span className="lc-create-choice-dot" aria-hidden="true" />}
      </span>
    </label>
  )
}

export default function LatidoCardOfferForm({
  business,
  onPublish,
  initialSelection,
  onStepChange
}) {
  const [draft, setDraft] = useState(initialOfferDraft)
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const bodyRef = useRef(null),
    headingRef = useRef(null),
    optionsRef = useRef(null)
  const titleId = useId()
  const steps = draft.type === 'other' ? [1, 3, 4] : [1, 2, 3, 4]
  const position = steps.indexOf(step)
  const monetary = ['percent', 'fixed'].includes(draft.type)
  const values = draft.type === 'fixed' ? ['5', '10', '20'] : ['5', '10', '15', '20']
  const preview = createOfferPayload(draft)
  useEffect(() => {
    if (!initialSelection) return
    setDraft((previous) => ({
      ...previous,
      ...initialSelection,
      type: initialSelection.type || previous.type,
      value: initialSelection.value || '10',
      combo: initialSelection.combo || '2x1',
      customValue: Boolean(initialSelection.customValue)
    }))
    setStep(1)
    setError('')
  }, [initialSelection])
  useEffect(() => {
    onStepChange?.(step)
  }, [step, onStepChange])
  useEffect(() => {
    bodyRef.current.scrollTop = 0
    headingRef.current?.focus({ preventScroll: true })
  }, [step])
  const set = (key, value) => {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
      ...(['type', 'value', 'combo', 'gift', 'benefit', 'scope', 'detail'].includes(key)
        ? { legacy_title: '' }
        : {})
    }))
    setError('')
  }
  const go = (next) => {
    setError('')
    setStep(next)
  }
  const validateStep = () => {
    if (step === 1) {
      if (
        monetary &&
        (!Number.isFinite(Number(draft.value)) ||
          Number(draft.value) <= 0 ||
          Number(draft.value) > (draft.type === 'percent' ? 100 : 99999999.99))
      )
        return 'Escribe una cantidad válida para la oferta.'
      if (draft.type === 'gift' && !draft.gift.trim()) return 'Escribe qué regalas.'
      if (draft.type === 'other' && draft.benefit.trim().length < 3)
        return 'Describe el beneficio con al menos tres caracteres.'
    }
    if (step === 2 && draft.scope === 'specific' && !draft.detail.trim())
      return 'Escribe el producto o servicio.'
    if (step === 4 && draft.ends_at && Date.parse(zurichEndOfDay(draft.ends_at)) <= Date.now())
      return 'Elige una fecha futura o déjala vacía si la oferta no tiene fecha de fin.'
    return ''
  }
  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    const message = validateStep()
    if (message) {
      setError(message)
      return
    }
    for (const input of bodyRef.current.querySelectorAll('input,textarea,select')) {
      if (!input.checkValidity()) {
        if (optionsRef.current?.contains(input)) optionsRef.current.open = true
        input.reportValidity()
        return
      }
    }
    if (step !== 4) {
      go(steps[position + 1])
      return
    }
    setBusy(true)
    setError('')
    try {
      await onPublish(createOfferPayload(draft))
      setDraft(initialOfferDraft())
      setStep(1)
    } catch (err) {
      setError(cardErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const reviewRow = (label, value, destination, accessibleName) => (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
      <button type="button" onClick={() => go(destination)} aria-label={accessibleName}>
        Cambiar
      </button>
    </div>
  )
  return (
    <form className="lc-form lc-create-form" onSubmit={submit} noValidate>
      <div className="lc-create-progress" aria-live="polite">
        <p>
          <strong>
            Paso {position + 1} de {steps.length}
          </strong>{' '}
          · {stepNames[step]}
        </p>
        <div aria-hidden="true">
          {steps.map((item, index) => (
            <span key={item} data-done={index <= position} />
          ))}
        </div>
      </div>
      <div className="lc-create-body" ref={bodyRef}>
        <fieldset className="lc-create-step" disabled={busy} aria-labelledby={titleId}>
          <h2 id={titleId} ref={headingRef} tabIndex={-1}>
            {step === 1
              ? '¿Qué quieres ofrecer?'
              : step === 2
                ? '¿En qué se aplica la oferta?'
                : step === 3
                  ? '¿Cuántas veces puede usarlo cada socio?'
                  : 'Revisa y publica'}
          </h2>
          <p className="lc-create-intro">
            {step === 1
              ? 'Elige el tipo de oferta para los socios.'
              : step === 2
                ? draft.type === 'gift'
                  ? 'Elige con qué compra recibirá el regalo.'
                  : 'Puede ser en todo o solo en algo concreto.'
                : step === 3
                  ? 'Tú decides. Podrás revisarlo antes de publicar.'
                  : 'Así verán tu oferta los socios:'}
          </p>
          {step === 1 && (
            <>
              {draft.legacy_title && (
                <p className="lc-create-help">
                  Esta oferta es anterior al editor. Conservamos su título; revisa el alcance si
                  cambias la oferta.
                </p>
              )}
              <div className="lc-create-type-grid" role="group" aria-label="Tipo de oferta">
                {types.map(([type, icon, title, description, tone]) => (
                  <Choice
                    key={type}
                    name="offer-type"
                    value={type}
                    checked={draft.type === type}
                    onChange={() => {
                      set('type', type)
                      if (['percent', 'fixed'].includes(type))
                        setDraft((previous) => ({ ...previous, value: '10', customValue: false }))
                    }}
                    {...{ icon, title, description, tone }}
                  />
                ))}
              </div>
              {monetary && (
                <fieldset className="lc-create-group">
                  <legend>¿Cuánto?</legend>
                  <div className="lc-create-segments lc-create-values">
                    {values.map((value) => (
                      <label key={value}>
                        <input
                          type="radio"
                          name="offer-value"
                          checked={!draft.customValue && draft.value === value}
                          onChange={() => {
                            set('value', value)
                            setDraft((previous) => ({ ...previous, customValue: false }))
                          }}
                        />
                        <span>{draft.type === 'percent' ? `${value} %` : `CHF ${value}`}</span>
                      </label>
                    ))}
                    <label>
                      <input
                        type="radio"
                        name="offer-value"
                        checked={draft.customValue}
                        onChange={() => set('customValue', true)}
                      />
                      <span>Otro</span>
                    </label>
                  </div>
                  {draft.customValue && (
                    <label className="lc-create-value-input">
                      Cantidad de la oferta
                      <span>
                        <input
                          type="number"
                          required
                          min="0.01"
                          max={draft.type === 'percent' ? 100 : 99999999.99}
                          step="0.01"
                          value={draft.value}
                          onChange={(event) => set('value', event.target.value)}
                          autoFocus
                        />
                        {draft.type === 'percent' ? '%' : 'CHF'}
                      </span>
                    </label>
                  )}
                </fieldset>
              )}
              {draft.type === 'combo' && (
                <fieldset className="lc-create-group">
                  <legend>¿Qué oferta?</legend>
                  <div className="lc-create-segments">
                    {Object.entries(offerCombos).map(([value, combo]) => (
                      <label key={value}>
                        <input
                          type="radio"
                          name="offer-combo"
                          checked={draft.combo === value}
                          onChange={() => set('combo', value)}
                        />
                        <span>{value === 'second_half' ? '2.ª a mitad' : combo.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="lc-create-help">{offerCombos[draft.combo].help}</p>
                </fieldset>
              )}
              {draft.type === 'fixed' && (
                <fieldset className="lc-create-group">
                  <legend>¿Desde qué compra?</legend>
                  <div className="lc-create-segments">
                    {['0', '20', '50', 'other'].map((value) => (
                      <label key={value}>
                        <input
                          type="radio"
                          name="minimum-spend"
                          checked={
                            value === 'other'
                              ? Boolean(draft.customMinimum)
                              : !draft.customMinimum && String(draft.minimum_spend) === value
                          }
                          onChange={() => {
                            set('customMinimum', value === 'other')
                            if (value !== 'other') set('minimum_spend', value)
                          }}
                        />
                        <span>
                          {value === '0'
                            ? 'Sin mínimo'
                            : value === 'other'
                              ? 'Otro'
                              : `CHF ${value}`}
                        </span>
                      </label>
                    ))}
                  </div>
                  {(draft.customMinimum ||
                    !['0', '20', '50'].includes(String(draft.minimum_spend))) && (
                    <label>
                      Compra mínima CHF
                      <input
                        type="number"
                        min="0"
                        max="99999999.99"
                        step="0.01"
                        required
                        value={draft.minimum_spend}
                        onChange={(e) => set('minimum_spend', e.target.value)}
                      />
                    </label>
                  )}
                  <p className="lc-create-help">Recomendado: al menos el doble del descuento.</p>
                </fieldset>
              )}
              {draft.type === 'gift' && (
                <label>
                  ¿Qué regalas?
                  <input
                    required
                    maxLength={40}
                    value={draft.gift}
                    placeholder="Ej.: un café, un postre, una muestra"
                    onChange={(event) => set('gift', event.target.value)}
                  />
                </label>
              )}
              {draft.type === 'other' && (
                <label>
                  Describe el beneficio
                  <input
                    required
                    minLength={3}
                    maxLength={50}
                    value={draft.benefit}
                    placeholder="Ej.: primera consulta gratis"
                    onChange={(event) => set('benefit', event.target.value)}
                  />
                  <small>Será el título de tu oferta. Escríbelo corto y claro.</small>
                </label>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <div className="lc-create-choice-list" role="group" aria-label="Dónde se aplica">
                <Choice
                  name="offer-scope"
                  value="all"
                  checked={draft.scope === 'all'}
                  onChange={() => set('scope', 'all')}
                  icon={<ShoppingBag size={20} />}
                  tone="green"
                  title={draft.type === 'gift' ? 'Con cualquier compra' : 'En todo'}
                  description="En cualquier compra en tu negocio."
                />
                <Choice
                  name="offer-scope"
                  value="specific"
                  checked={draft.scope === 'specific'}
                  onChange={() => set('scope', 'specific')}
                  icon={<Tag size={20} />}
                  tone="pink"
                  title={draft.type === 'gift' ? 'Con algo concreto' : 'En algo concreto'}
                  description="Un producto o un servicio."
                />
              </div>
              {draft.scope === 'specific' && (
                <label>
                  ¿Qué producto o servicio?
                  <input
                    required
                    maxLength={60}
                    value={draft.detail}
                    placeholder="Ej.: el corte de pelo, el menú del día"
                    onChange={(event) => set('detail', event.target.value)}
                    autoFocus
                  />
                  <small>Aparecerá en el título: «{preview.title}».</small>
                </label>
              )}
            </>
          )}
          {step === 3 && draft.requires_claim && (
            <div className="lc-create-group">
              <p>Promoción limitada: cada socio puede usar una unidad en total.</p>
              <label>
                Unidades disponibles
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={draft.stock_total}
                  onChange={(event) => set('stock_total', event.target.value)}
                />
              </label>
            </div>
          )}
          {step === 3 && !draft.requires_claim && (
            <div className="lc-create-choice-list" role="group" aria-label="Usos por socio">
              <Choice
                name="offer-usage"
                value="month"
                checked={
                  !draft.requires_claim &&
                  draft.usage_period === 'month' &&
                  Number(draft.usage_limit) === 1
                }
                onChange={() => {
                  set('usage_period', 'month')
                  setDraft((previous) => ({
                    ...previous,
                    usage_limit: 1,
                    requires_claim: false
                  }))
                }}
                icon={<CalendarDays size={20} />}
                tone="blue"
                title="Una vez al mes"
                description="Puede volver a usarlo cada mes."
                recommended
              />
              <Choice
                name="offer-usage"
                value="unlimited"
                checked={!draft.requires_claim && draft.usage_period === 'unlimited'}
                onChange={() => {
                  set('usage_period', 'unlimited')
                  setDraft((previous) => ({
                    ...previous,
                    usage_limit: 1,
                    requires_claim: false
                  }))
                }}
                icon={<Repeat2 size={20} />}
                tone="green"
                title="Siempre que venga"
                description="Sin límite de usos."
              />
              <Choice
                name="offer-usage"
                value="lifetime"
                checked={draft.usage_period === 'lifetime' && Number(draft.usage_limit) === 1}
                onChange={() => {
                  set('usage_period', 'lifetime')
                  setDraft((previous) => ({ ...previous, usage_limit: 1 }))
                }}
                icon={<Sparkles size={20} />}
                tone="amber"
                title="Solo una vez"
                description="Perfecto para atraer clientes nuevos."
              />
              {!['month', 'unlimited', 'lifetime'].includes(draft.usage_period) ||
              Number(draft.usage_limit) > 1 ? (
                <p className="lc-create-help">
                  Configuración personalizada: {offerUsageLabel(preview)}. Puedes cambiarla en las
                  opciones avanzadas.
                </p>
              ) : null}
            </div>
          )}
          {step === 4 && (
            <>
              <section className="lc-create-preview" aria-label="Vista previa">
                <LatidoOfferPreview offer={preview} business={business} />
              </section>
              <dl className="lc-create-review">
                {reviewRow('Oferta', draftOfferName(draft), 1, 'Cambiar la oferta')}
                {draft.type !== 'other' &&
                  reviewRow('Se aplica', draftOfferScope(draft), 2, 'Cambiar dónde se aplica')}
                {reviewRow('Usos', offerUsageLabel(preview), 3, 'Cambiar los usos')}
              </dl>
              <details className="lc-create-options" ref={optionsRef}>
                <summary>
                  <strong>Opciones avanzadas (opcional)</strong>
                  <span>
                    {Number(draft.minimum_spend) > 0
                      ? `Mínimo CHF ${draft.minimum_spend}`
                      : 'Sin compra mínima'}{' '}
                    · {draft.ends_at ? 'Con fecha de fin' : 'Sin fecha de fin'}
                    {draft.requires_claim ? ' · Unidades limitadas' : ''}
                  </span>
                </summary>
                <div className="lc-create-advanced">
                  {draft.type !== 'fixed' && (
                    <label>
                      Compra mínima CHF
                      <input
                        type="number"
                        min="0"
                        max="99999999.99"
                        step="0.01"
                        value={draft.minimum_spend}
                        onChange={(event) => set('minimum_spend', event.target.value)}
                      />
                    </label>
                  )}
                  <label>
                    Válido hasta
                    <input
                      type="date"
                      aria-label="Válido hasta"
                      value={draft.ends_at}
                      onChange={(event) => set('ends_at', event.target.value)}
                    />
                    <small>
                      Hasta las 23:59:59 en Zúrich. Déjalo vacío si no tiene fecha de fin.
                    </small>
                  </label>
                  <label>
                    Condiciones
                    <textarea
                      maxLength={2000}
                      value={draft.description}
                      placeholder="Ej.: válido con cita previa."
                      onChange={(event) => set('description', event.target.value)}
                    />
                  </label>
                  <label className="lc-create-stock-toggle">
                    <input
                      type="checkbox"
                      checked={draft.requires_claim}
                      onChange={(event) => {
                        set('requires_claim', event.target.checked)
                        setDraft((previous) => ({
                          ...previous,
                          usage_period: event.target.checked ? 'lifetime' : 'month',
                          usage_limit: 1,
                          stock_total: ''
                        }))
                      }}
                    />
                    <span>Promoción especial con unidades limitadas</span>
                  </label>
                  {draft.requires_claim ? (
                    <label>
                      Unidades disponibles
                      <input
                        required
                        type="number"
                        min="1"
                        step="1"
                        value={draft.stock_total}
                        onChange={(event) => set('stock_total', event.target.value)}
                      />
                      <small>Una unidad por socio. Se descuenta al confirmar el uso.</small>
                    </label>
                  ) : (
                    <>
                      <label>
                        Frecuencia
                        <select
                          value={draft.usage_period}
                          onChange={(event) => set('usage_period', event.target.value)}
                        >
                          <option value="day">Por día</option>
                          <option value="week">Por semana (lunes a domingo)</option>
                          <option value="month">Por mes natural</option>
                          <option value="lifetime">En total</option>
                          <option value="unlimited">Sin límite</option>
                        </select>
                      </label>
                      {draft.usage_period !== 'unlimited' && (
                        <label>
                          Usos permitidos
                          <input
                            required
                            type="number"
                            min="1"
                            max="1000"
                            step="1"
                            value={draft.usage_limit}
                            onChange={(event) => set('usage_limit', event.target.value)}
                          />
                        </label>
                      )}
                    </>
                  )}
                </div>
              </details>
              <div className="lc-create-how">
                <strong>¿Cómo funciona?</strong>
                <ol>
                  <li>Los socios ven tu oferta en Latido.</li>
                  <li>En caja te enseñan la pantalla del descuento.</li>
                  <li>Tú aplicas el descuento.</li>
                </ol>
              </div>
              <p className="lc-create-fine">No acumulable con otras ofertas Latido.</p>
            </>
          )}
        </fieldset>
      </div>
      <footer className="lc-create-footer">
        {error && (
          <p className="lc-alert" role="alert">
            {error}
          </p>
        )}
        <div>
          {position > 0 && (
            <button
              type="button"
              className="lc-button lc-button--secondary"
              disabled={busy}
              onClick={() => go(steps[position - 1])}
            >
              Atrás
            </button>
          )}
          <button type="submit" className="lc-button" disabled={busy}>
            {busy ? 'Publicando…' : step === 4 ? 'Publicar oferta' : 'Siguiente'}
          </button>
        </div>
      </footer>
    </form>
  )
}
