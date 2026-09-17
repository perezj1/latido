import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useMyList } from '../hooks/useMyList'
import { getMyListTitle } from '../lib/myList'
import './MyListPanel.css'

const PENDING_KEY = 'latido_my_list_pending'
const EMPTY_LIST_EXAMPLES = ['Piso en Zürich', 'Trabajo en construcción', 'Alquilar coche', 'Aprender alemán']

function ResultRow({ result, onOpen }) {
  return (
    <button type="button" className="my-list-result" onClick={() => onOpen(result)}>
      <span className="my-list-result__emoji" aria-hidden="true">{result.emoji}</span>
      <span className="my-list-result__copy">
        <strong>{result.title}</strong>
        <small>{result.subtitle || result.typeLabel}</small>
      </span>
      <span className="my-list-result__arrow" aria-hidden="true">›</span>
    </button>
  )
}

export default function MyListPanel({ active=true, onSummaryChange, surface=true }) {
  const navigate = useNavigate()
  const {
    activeItems,
    completedItems,
    unreadCount,
    resultsById,
    loadingResults,
    loading,
    error,
    add,
    complete,
    remove,
    rename,
    open,
    isLoggedIn,
  } = useMyList({ loadResults:active })
  const [phrase, setPhrase] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState('')
  const [completedOpen, setCompletedOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [editingValue, setEditingValue] = useState('')
  const [openMenuId, setOpenMenuId] = useState('')

  useEffect(() => {
    onSummaryChange?.({ activeCount:activeItems.length, unreadCount })
  }, [activeItems.length, onSummaryChange, unreadCount])

  useEffect(() => {
    if (!openMenuId) return undefined
    const closeMenu = event => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && event.target.closest('.my-list-item__menu-wrap')) return
      setOpenMenuId('')
    }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeMenu)
    return () => {
      document.removeEventListener('pointerdown', closeMenu)
      document.removeEventListener('keydown', closeMenu)
    }
  }, [openMenuId])

  useEffect(() => {
    if (!active || !isLoggedIn || saving) return
    const pending = sessionStorage.getItem(PENDING_KEY)
    if (!pending) return
    sessionStorage.removeItem(PENDING_KEY)
    setPhrase(pending)
    setSaving(true)
    add(pending)
      .then(item => {
        setPhrase('')
        setExpandedId(item.id)
        toast.success('Añadido a Mi lista')
      })
      .catch(nextError => toast.error(nextError?.message || 'No se pudo añadir a Mi lista'))
      .finally(() => setSaving(false))
  }, [active, add, isLoggedIn, saving])

  async function addPhrase(value) {
    const nextPhrase = String(value || '').trim()
    if (nextPhrase.length < 2 || saving) return
    if (!isLoggedIn) {
      sessionStorage.setItem(PENDING_KEY, nextPhrase)
      navigate('/auth', { state:{ from:'/?miLista=1' } })
      return
    }

    setSaving(true)
    try {
      const item = await add(nextPhrase)
      setPhrase('')
      setExpandedId(item.id)
      toast.success('Añadido a Mi lista')
    } catch (nextError) {
      toast.error(nextError?.message || 'No se pudo añadir a Mi lista')
    } finally {
      setSaving(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    await addPhrase(phrase)
  }

  async function toggleExpanded(item) {
    setOpenMenuId('')
    if (expandedId === item.id) {
      setExpandedId('')
      return
    }
    setExpandedId(item.id)
    await open(item)
  }

  async function markCompleted(item) {
    try {
      await complete(item, true)
      setExpandedId(current => current === item.id ? '' : current)
      toast(t => (
        <span className="my-list-undo-toast">
          <span>Marcado como conseguido</span>
          <button type="button" onClick={() => {
            toast.dismiss(t.id)
            void restore(item)
          }}>Deshacer</button>
        </span>
      ), { duration:5000, icon:'✓' })
    } catch (nextError) {
      toast.error(nextError?.message || 'No se pudo actualizar')
    }
  }

  async function restore(item) {
    try {
      await complete(item, false)
      toast.success('Latido vuelve a buscarlo')
    } catch (nextError) {
      toast.error(nextError?.message || 'No se pudo restaurar')
    }
  }

  async function saveEdit(item) {
    const nextPhrase = editingValue.trim()
    if (nextPhrase.length < 2) return
    try {
      await rename(item, nextPhrase)
      setEditingId('')
      setEditingValue('')
      toast.success('Anotación actualizada')
    } catch (nextError) {
      toast.error(nextError?.message || 'No se pudo editar')
    }
  }

  async function deleteItem(item) {
    if (!window.confirm(`¿Eliminar “${getMyListTitle(item)}” de Mi lista?`)) return
    try {
      await remove(item)
      toast.success('Eliminado de Mi lista')
    } catch (nextError) {
      toast.error(nextError?.message || 'No se pudo eliminar')
    }
  }

  function openResult(result) {
    navigate(result.path)
  }

  const contentClassName = useMemo(
    () => `my-list-panel${surface ? ' my-list-panel--surface' : ''}`,
    [surface],
  )

  return (
    <div className={contentClassName} aria-label="Mi lista">
      <div className="my-list-intro">
        <strong>¿Qué necesitas?</strong>
        <span>Anótalo y Latido buscará resultados para ti.</span>
      </div>

      <form className="my-list-compose" onSubmit={submit}>
        <input
          value={phrase}
          onChange={event => setPhrase(event.target.value)}
          placeholder="Ej.: piso en Zürich por 2.000 CHF"
          maxLength={120}
          aria-label="Añadir algo a Mi lista"
        />
        <button type="submit" disabled={saving || phrase.trim().length < 2} aria-label="Añadir a Mi lista">
          {saving ? '…' : '+'}
        </button>
      </form>

      {!isLoggedIn && (
        <p className="my-list-session-note">Puedes escribir primero. Te pediremos iniciar sesión solo al guardarlo.</p>
      )}

      {loading ? (
        <div className="my-list-loading">Cargando Mi lista…</div>
      ) : error ? (
        <div className="my-list-empty">{error}</div>
      ) : activeItems.length === 0 ? (
        <div className="my-list-empty">
          <span aria-hidden="true">📝</span>
          <strong>Tu lista está vacía</strong>
          <div className="my-list-empty__examples">
            <span>Empieza por algo como:</span>
            <ul>
              {EMPTY_LIST_EXAMPLES.map(example => (
                <li key={example}>
                  <button type="button" disabled={saving} onClick={() => void addPhrase(example)}>
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="my-list-items">
          {activeItems.map(item => {
            const results = resultsById[item.id]
            const isExpanded = expandedId === item.id
            const isLoadingResults = Boolean(loadingResults[item.id])
            const resultCount = results?.length
            const isEditing = editingId === item.id
            const editFormId = `my-list-edit-${item.id}`

            return (
              <article key={item.id} className={`my-list-item${item.unread_count ? ' has-new' : ''}`}>
                <div className="my-list-item__main">
                  <span className="my-list-checkbox-slot">
                    <button
                      type="button"
                      className="my-list-checkbox"
                      onClick={() => markCompleted(item)}
                      aria-label={`Marcar ${getMyListTitle(item)} como conseguido`}
                    />
                  </span>

                  <div className="my-list-item__body">
                    {isEditing ? (
                      <form id={editFormId} className="my-list-edit" onSubmit={event => { event.preventDefault(); void saveEdit(item) }}>
                        <input
                          value={editingValue}
                          onChange={event => setEditingValue(event.target.value)}
                          autoFocus
                          maxLength={120}
                        />
                      </form>
                    ) : (
                      <button type="button" className="my-list-item__toggle" onClick={() => toggleExpanded(item)}>
                        <strong>{getMyListTitle(item)}</strong>
                        <span className={`my-list-item__result-count${item.unread_count ? ' has-unread' : ''}`}>
                          {resultCount == null
                            ? 'Buscando…'
                            : resultCount > 0
                              ? `${resultCount} ${resultCount === 1 ? 'resultado' : 'resultados'}${item.unread_count ? ` · ${item.unread_count} nuevos` : ''}`
                              : 'Sin resultados todavía'}
                        </span>
                      </button>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="my-list-item__menu-wrap">
                      <button
                        type="button"
                        className="my-list-menu-trigger"
                        onClick={() => setOpenMenuId(current => current === item.id ? '' : item.id)}
                        aria-label={`Opciones de ${getMyListTitle(item)}`}
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === item.id}
                      >
                        <span aria-hidden="true">⋮</span>
                      </button>
                      {openMenuId === item.id && (
                        <div className="my-list-item__menu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuId('')
                              setEditingId(item.id)
                              setEditingValue(getMyListTitle(item))
                            }}
                          >Editar</button>
                          <button
                            type="button"
                            role="menuitem"
                            className="is-danger"
                            onClick={() => { setOpenMenuId(''); void deleteItem(item) }}
                          >Eliminar</button>
                        </div>
                      )}
                    </div>
                  )}

                  <button type="button" className={`my-list-chevron${isExpanded ? ' is-expanded' : ''}`} onClick={() => toggleExpanded(item)} aria-label={isExpanded ? 'Ocultar resultados' : 'Mostrar resultados'}>
                    <span aria-hidden="true" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="my-list-item__results">
                    {isLoadingResults ? (
                      <div className="my-list-results-status">Buscando en Latido…</div>
                    ) : results?.length ? (
                      <>
                        {results.slice(0, 3).map(result => <ResultRow key={result.id} result={result} onOpen={openResult} />)}
                        <button type="button" className="my-list-view-all" onClick={() => navigate(item.result_path || `/?search=results&q=${encodeURIComponent(getMyListTitle(item))}`)}>
                          Ver todos los resultados
                        </button>
                      </>
                    ) : (
                      <div className="my-list-results-status">
                        <strong>Aún no hay coincidencias.</strong>
                        <span>La frase queda guardada y aquí aparecerán los resultados nuevos.</span>
                      </div>
                    )}
                  </div>
                )}

                {isEditing && (
                  <div className="my-list-item__actions is-editing">
                    <>
                      <button type="button" onClick={() => { setEditingId(''); setEditingValue('') }}>Cancelar</button>
                      <button type="submit" form={editFormId} className="my-list-item__save" disabled={editingValue.trim().length < 2}>Guardar</button>
                    </>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {completedItems.length > 0 && (
        <div className="my-list-completed">
          <button type="button" className="my-list-completed__toggle" onClick={() => setCompletedOpen(opened => !opened)}>
            <span>Conseguido ({completedItems.length})</span>
            <span aria-hidden="true">{completedOpen ? '⌃' : '⌄'}</span>
          </button>
          {completedOpen && (
            <div className="my-list-completed__items">
              {completedItems.map(item => (
                <div key={item.id} className="my-list-completed__item">
                  <div className="my-list-completed__main">
                    <span aria-hidden="true">✓</span>
                    <strong>{getMyListTitle(item)}</strong>
                  </div>
                  <div className="my-list-completed__actions">
                    <button type="button" onClick={() => restore(item)}>Volver a buscar</button>
                    <button type="button" onClick={() => deleteItem(item)} aria-label="Eliminar definitivamente">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoggedIn && activeItems.length >= 10 && (
        <p className="my-list-limit">Puedes tener hasta 10 necesidades activas. Marca alguna como conseguida para añadir otra.</p>
      )}

    </div>
  )
}
