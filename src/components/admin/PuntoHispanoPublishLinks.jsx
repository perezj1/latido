import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import './PuntoHispanoPublishLinks.css'

function formatDate(value) {
  if (!value) return 'Nunca'
  return new Intl.DateTimeFormat('es-CH', {
    dateStyle:'medium',
    timeStyle:'short',
    timeZone:'Europe/Zurich',
  }).format(new Date(value))
}

function buildPublishUrl(linkId) {
  if (!linkId || typeof window === 'undefined') return ''
  return `${window.location.origin}/publicar/punto-hispano/${linkId}`
}

export default function PuntoHispanoPublishLinks() {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')

  const loadLinks = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error:loadError } = await supabase.rpc('list_punto_hispano_publish_links')
    if (loadError) {
      console.error('Punto Hispano publish links load failed:', loadError)
      setError('No se pudieron cargar las URLs. Comprueba que se haya aplicado punto_hispano_publish_links.sql en Supabase.')
      setLinks([])
    } else {
      setLinks(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadLinks() }, [loadLinks])

  const createLink = async () => {
    if (creating) return
    setCreating(true)
    const { data, error:createError } = await supabase.rpc('create_punto_hispano_publish_link')
    if (createError) {
      console.error('Punto Hispano publish link creation failed:', createError)
      toast.error(createError.message || 'No se pudo generar la URL')
    } else {
      const linkId = typeof data === 'string' ? data : data?.id
      await loadLinks()
      if (linkId) {
        const url = buildPublishUrl(linkId)
        try {
          await navigator.clipboard.writeText(url)
          toast.success('URL generada y copiada')
        } catch {
          toast.success('URL generada')
        }
      }
    }
    setCreating(false)
  }

  const copyLink = async linkId => {
    try {
      await navigator.clipboard.writeText(buildPublishUrl(linkId))
      toast.success('URL copiada')
    } catch {
      toast.error('No se pudo copiar. Selecciona la URL manualmente.')
    }
  }

  const deleteLink = async linkId => {
    const confirmed = window.confirm('¿Eliminar esta URL? Dejará de funcionar inmediatamente, pero los anuncios ya publicados seguirán visibles.')
    if (!confirmed) return

    setDeletingId(linkId)
    const { data, error:deleteError } = await supabase.rpc('delete_punto_hispano_publish_link', {
      p_link_id:linkId,
    })
    if (deleteError || data !== true) {
      console.error('Punto Hispano publish link deletion failed:', deleteError)
      toast.error(deleteError?.message || 'No se pudo eliminar la URL')
    } else {
      setLinks(current => current.filter(item => item.link_id !== linkId))
      toast.success('URL eliminada')
    }
    setDeletingId('')
  }

  return (
    <section className="ph-publish-admin" aria-labelledby="ph-publish-admin-title">
      <div className="ph-publish-admin__header">
        <div>
          <span className="ph-publish-admin__eyebrow">Punto Hispano · Publicación delegada</span>
          <h2 id="ph-publish-admin-title">URLs para publicar anuncios</h2>
          <p>
            Cualquier persona que tenga una de estas URLs puede publicar anuncios y subir fotos como Punto Hispano, sin iniciar sesión.
          </p>
        </div>
        <button type="button" onClick={createLink} disabled={creating} className="ph-publish-admin__create">
          {creating ? 'Generando…' : '＋ Generar nueva URL'}
        </button>
      </div>

      <div className="ph-publish-admin__warning">
        <span aria-hidden="true">🔐</span>
        <p><strong>La URL funciona como una contraseña.</strong> Compártela solamente con la persona autorizada y elimínala si deja de trabajar contigo.</p>
      </div>

      {error && <p className="ph-publish-admin__error" role="alert">{error}</p>}
      {loading ? (
        <p className="ph-publish-admin__status">Cargando URLs…</p>
      ) : links.length === 0 && !error ? (
        <div className="ph-publish-admin__empty">
          <span aria-hidden="true">🔗</span>
          <div><strong>No hay URLs activas</strong><p>Genera una para probar el formulario público de Punto Hispano.</p></div>
        </div>
      ) : (
        <div className="ph-publish-admin__list">
          {links.map(link => {
            const url = buildPublishUrl(link.link_id)
            return (
              <article key={link.link_id} className="ph-publish-admin__link">
                <div className="ph-publish-admin__link-meta">
                  <span className="ph-publish-admin__active"><i /> Activa</span>
                  <span>Creada: {formatDate(link.created_at)}</span>
                  <span>Usos: {link.use_count || 0}</span>
                  <span>Último uso: {formatDate(link.last_used_at)}</span>
                </div>
                <div className="ph-publish-admin__url-row">
                  <input value={url} readOnly aria-label="URL compartible para publicar como Punto Hispano" onFocus={event => event.target.select()} />
                  <button type="button" onClick={() => copyLink(link.link_id)}>Copiar</button>
                  <a href={url} target="_blank" rel="noreferrer">Probar</a>
                  <button
                    type="button"
                    className="ph-publish-admin__delete"
                    disabled={deletingId === link.link_id}
                    onClick={() => deleteLink(link.link_id)}
                  >
                    {deletingId === link.link_id ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
