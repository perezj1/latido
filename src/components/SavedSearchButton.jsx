import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { C, PP } from '../lib/theme'
import {
  findSavedSearch,
  getSavedSearchFingerprint,
  saveSavedSearch,
  setSavedSearchCompleted,
} from '../lib/savedSearches'

export default function SavedSearchButton({
  draft,
  compact=false,
  idleLabel='',
  prominent=false,
  panel=false,
  onSavedStateChange,
}) {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const fingerprint = useMemo(() => getSavedSearchFingerprint(draft), [draft])
  const [existing, setExisting] = useState(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    setExisting(null)
    if (!isLoggedIn || !user?.id || !fingerprint) return () => { active = false }

    setChecking(true)
    findSavedSearch(user.id, draft)
      .then(value => { if (active) setExisting(value) })
      .catch(error => {
        if (!/saved_searches|schema cache|does not exist/i.test(error?.message || '')) {
          console.warn('Mi lista status could not be loaded:', error)
        }
      })
      .finally(() => { if (active) setChecking(false) })

    return () => { active = false }
  }, [draft, fingerprint, isLoggedIn, user?.id])

  useEffect(() => {
    if (checking) return
    onSavedStateChange?.(Boolean(existing?.active))
  }, [checking, existing?.active, onSavedStateChange])

  if (!fingerprint) return null

  async function handleSave() {
    if (!isLoggedIn || !user?.id) {
      toast('Inicia sesión para añadirlo a Mi lista')
      navigate('/auth', { state:{ from:`${location.pathname}${location.search}` } })
      return
    }
    if (saving || existing?.active) return

    setSaving(true)
    try {
      let saved
      if (existing) {
        await setSavedSearchCompleted(user.id, existing.id, false)
        saved = { id:existing.id }
      } else {
        saved = await saveSavedSearch(user.id, draft)
      }
      setExisting({ id:saved.id, active:true })
      toast.success(existing ? 'Latido vuelve a buscarlo' : 'Añadido a Mi lista')
    } catch (error) {
      toast.error(error?.message || 'No se pudo añadir a Mi lista')
    } finally {
      setSaving(false)
    }
  }

  const isSaved = Boolean(existing?.active)
  const label = saving
    ? 'Añadiendo…'
    : checking
      ? 'Comprobando…'
      : isSaved
        ? 'Añadido a Mi lista'
        : idleLabel || 'Añadir a Mi lista'

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={saving || checking || isSaved}
      aria-label={label}
      style={{
        display:'inline-flex',
        alignItems:'center',
        justifyContent:panel ? 'space-between' : 'center',
        gap:panel ? 14 : 6,
        width:panel || prominent ? '100%' : undefined,
        minHeight:panel ? 56 : prominent ? 44 : 34,
        maxWidth:'100%',
        marginTop:panel ? 18 : undefined,
        padding:panel ? '11px 14px' : compact ? '7px 11px' : '8px 13px',
        borderRadius:panel ? 16 : prominent ? 14 : 12,
        border:`1px solid ${isSaved ? '#86EFAC' : C.primaryMid}`,
        background:isSaved ? '#ECFDF5' : panel ? '#EEF4FF' : prominent ? C.primary : '#fff',
        color:isSaved ? '#047857' : panel ? C.text : prominent ? '#fff' : C.primary,
        fontFamily:PP,
        fontWeight:800,
        fontSize:panel ? 11.5 : prominent ? 12.5 : 11,
        lineHeight:1.2,
        cursor:saving || checking || isSaved ? 'default' : 'pointer',
        opacity:saving || checking ? 0.7 : 1,
        whiteSpace:panel ? 'normal' : 'nowrap',
        textAlign:'left',
        boxShadow:prominent && !panel && !isSaved ? '0 8px 18px rgba(37,99,235,.2)' : 'none',
      }}
    >
      <span aria-hidden="true" style={{ fontSize:panel ? 18 : undefined }}>{isSaved ? '✓' : '+'}</span>
      <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{label}</span>
      {panel && <span aria-hidden="true" style={{ color:C.primary, fontSize:18 }}>›</span>}
    </button>
  )
}
