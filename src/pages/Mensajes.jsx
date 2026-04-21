import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useUnreadMessages, markConvRead } from '../hooks/useUnreadMessages'
import { unreadStore } from '../lib/unreadStore'
import { C, PP } from '../lib/theme'
import { Avatar } from '../components/UI'
import { fetchAvatarsByIds } from '../lib/profiles'
import toast from 'react-hot-toast'

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'Ahora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`
  if (diff < 86400000) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function convTitle(conv) {
  return conv.title || 'Anuncio'
}

function cleanParticipantName(value) {
  const name = String(value || '').trim()
  if (!name) return ''

  const genericNames = new Set(['propietario', 'usuario', 'user', 'owner'])
  return genericNames.has(name.toLowerCase()) ? '' : name
}

function pickParticipantName(...values) {
  for (const value of values) {
    const name = cleanParticipantName(value)
    if (name) return name
  }
  return ''
}

function getConversationParticipantName(value, conv) {
  const name = cleanParticipantName(value)
  const title = cleanParticipantName(conv?.title)
  if (!name) return ''
  if (title && name.toLowerCase() === title.toLowerCase()) return ''
  return name
}

async function fetchProfileNamesByIds(ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))]
  if (!uniqueIds.length) return new Map()

  let response = await supabase
    .from('profile_names')
    .select('id, name')
    .in('id', uniqueIds)

  if (response.error) {
    response = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', uniqueIds)
  }

  const names = new Map()
  response.data?.forEach(profile => {
    const resolvedName = cleanParticipantName(profile.name)
    if (resolvedName) names.set(profile.id, resolvedName)
  })

  return names
}

export default function Mensajes() {
  const { user, isLoggedIn, displayName } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const adId  = searchParams.get('adId')
  const jobId = searchParams.get('jobId')
  const recipientName = cleanParticipantName(searchParams.get('recipientName'))

  const { unreadConvIds } = useUnreadMessages()
  const [conversations, setConversations] = useState([])
  const [lastMsgAt, setLastMsgAt] = useState(new Map()) // convId → ISO string
  const [convAvatars, setConvAvatars] = useState(new Map())
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showList, setShowList] = useState(true)
  const messagesEndRef = useRef(null)
  const channelRef = useRef(null)
  const inboxChannelRef = useRef(null)
  const inputRef = useRef(null)
  const creatingRef = useRef(false)
  const selectedConvRef = useRef(null)
  const channelScopeRef = useRef(Math.random().toString(36).slice(2, 10))
  const participantNameCacheRef = useRef(new Map())
  const selfNameRef = useRef(pickParticipantName(displayName, user?.email?.split('@')[0]) || 'Usuario')
  const selfNameLoadedRef = useRef(false)
  const [selfName, setSelfName] = useState(selfNameRef.current)

  useEffect(() => {
    if (!isLoggedIn) { navigate('/auth'); return }
    loadConversations()
  }, [adId, isLoggedIn, jobId, recipientName, user?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (inboxChannelRef.current) supabase.removeChannel(inboxChannelRef.current)
    }
  }, [])

  async function resolveOwnDisplayName() {
    if (selfNameLoadedRef.current) return selfNameRef.current

    const fallbackName = pickParticipantName(displayName, user?.email?.split('@')[0]) || 'Usuario'
    let resolvedName = fallbackName

    if (user?.id) {
      const ownNames = await fetchProfileNamesByIds([user.id])
      resolvedName = pickParticipantName(ownNames.get(user.id), fallbackName) || 'Usuario'
    }

    selfNameLoadedRef.current = true
    selfNameRef.current = resolvedName
    setSelfName(prev => prev === resolvedName ? prev : resolvedName)
    return resolvedName
  }

  async function hydrateConversationNames(convList, ownName = selfName) {
    if (!convList?.length) return convList || []

    const targetId = adId || jobId
    const participantIdsToFetch = [...new Set(
      convList.flatMap(conv => ([
        conv.sender_id && conv.sender_id !== user.id && !participantNameCacheRef.current.has(conv.sender_id) ? conv.sender_id : null,
        conv.owner_id && conv.owner_id !== user.id && !participantNameCacheRef.current.has(conv.owner_id) ? conv.owner_id : null,
      ])).filter(Boolean)
    )]
    const ownerItemIdsToFetch = [...new Set(
      convList
        .filter(conv => !cleanParticipantName(conv.owner_name) && conv.ad_id && conv.owner_id !== user.id)
        .map(conv => conv.ad_id)
    )]

    const adNameById = new Map()

    if (participantIdsToFetch.length) {
      const participantNames = await fetchProfileNamesByIds(participantIdsToFetch)
      participantNames.forEach((name, id) => {
        if (name) participantNameCacheRef.current.set(id, name)
      })
    }

    if (ownerItemIdsToFetch.length) {
      const { data: adsData } = await supabase
        .from('listings')
        .select('id, user_name')
        .in('id', ownerItemIdsToFetch)

      adsData?.forEach(ad => {
        const resolvedName = cleanParticipantName(ad.user_name)
        if (resolvedName) adNameById.set(ad.id, resolvedName)
      })
    }

    return convList.map(conv => ({
      ...conv,
      sender_name: pickParticipantName(
        conv.sender_id === user.id ? ownName : participantNameCacheRef.current.get(conv.sender_id),
        getConversationParticipantName(conv.sender_name, conv)
      )
        || 'Usuario',
      owner_name: pickParticipantName(
        conv.owner_id === user.id ? ownName : participantNameCacheRef.current.get(conv.owner_id),
        recipientName && String(conv.ad_id) === String(targetId) ? getConversationParticipantName(recipientName, conv) : null,
        getConversationParticipantName(conv.owner_name, conv),
        adNameById.get(conv.ad_id),
      )
        || 'Usuario',
    }))
  }

  async function loadConversations() {
    setLoading(true)
    const ownName = await resolveOwnDisplayName()

    let res = await supabase
      .from('conversations')
      .select('id, ad_id, sender_id, owner_id, sender_name, owner_name, title, deleted_by_sender, deleted_by_owner, created_at')
      .or(`and(sender_id.eq.${user.id},deleted_by_sender.eq.false),and(owner_id.eq.${user.id},deleted_by_owner.eq.false)`)
      .order('created_at', { ascending: false })

    if (res.error) {
      // Fallback: try without soft-delete filter
      res = await supabase
        .from('conversations')
        .select('id, ad_id, sender_id, owner_id, sender_name, owner_name, title, created_at')
        .or(`sender_id.eq.${user.id},owner_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
    }

    if (res.error) {
      // Fallback: only base columns (before any migrations ran)
      res = await supabase
        .from('conversations')
        .select('id, ad_id, sender_id, owner_id, created_at')
        .or(`sender_id.eq.${user.id},owner_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
    }

    const data = await hydrateConversationNames(res.data || [], ownName)

    // Seed lastMsgAt from conversation created_at (best available without last_message_at column)
    const initLastMsg = new Map(data.map(c => [c.id, c.created_at]))
    setLastMsgAt(initLastMsg)
    setConversations(data)

    // Fetch avatars for all other participants
    const otherIds = data.map(c => c.sender_id === user.id ? c.owner_id : c.sender_id).filter(Boolean)
    fetchAvatarsByIds(otherIds).then(setConvAvatars)

    // Subscribe to all incoming messages in this inbox for sorting + per-conv unread
    if (inboxChannelRef.current) supabase.removeChannel(inboxChannelRef.current)
    const convIdSet = new Set(data.map(c => c.id))
    inboxChannelRef.current = supabase
      .channel(`inbox-${user.id}-${channelScopeRef.current}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new
        if (!convIdSet.has(msg.conversation_id)) return
        // Update last message time and bubble conv to top
        setLastMsgAt(prev => new Map(prev).set(msg.conversation_id, msg.created_at))
        // If not from self and not currently open → mark unread
        if (msg.sender_id !== user.id && selectedConvRef.current?.id !== msg.conversation_id) {
          unreadStore.add(msg.conversation_id)
        }
      })
      .subscribe()

    const targetId = adId || jobId
    if (targetId) {
      const existing = data.find(c => c.ad_id === targetId)
      if (existing) {
        setSelectedConv(existing)
        selectedConvRef.current = existing
        setShowList(false)
        loadMessages(existing)
        setLoading(false)
        return
      }
      await openOrCreate({ adId, jobId, convList: data })
    } else if (data.length > 0) {
      // On desktop auto-select first; on mobile leave list visible
      if (window.innerWidth >= 768) openConversation(data[0])
    }

    setLoading(false)
  }

  async function openOrCreate({ adId: aId, jobId: jId, convList = conversations }) {
    if (creatingRef.current) return
    creatingRef.current = true
    let item = null
    const ownName = await resolveOwnDisplayName()
    let insertData = { sender_id: user.id, sender_name: ownName }

    if (jId) {
      const { data } = await supabase.from('jobs').select('id, title, company, user_id').eq('id', jId).maybeSingle()
      if (!data) { toast.error('Oferta no encontrada'); setLoading(false); creatingRef.current = false; return }
      if (data.user_id === user.id) { toast.error('Es tu propia oferta'); setLoading(false); creatingRef.current = false; return }
      const ownerNames = await fetchProfileNamesByIds([data.user_id])
      item = data
      insertData.ad_id = jId
      insertData.owner_id = data.user_id
      insertData.title = data.company || data.title
      insertData.owner_name = pickParticipantName(ownerNames.get(data.user_id), recipientName) || 'Usuario'
    } else if (aId) {
      const { data } = await supabase.from('listings').select('id, title, user_id, user_name').eq('id', aId).maybeSingle()
      if (!data) { toast.error('Anuncio no encontrado'); setLoading(false); creatingRef.current = false; return }
      if (data.user_id === user.id) { toast.error('Es tu propio anuncio'); setLoading(false); creatingRef.current = false; return }
      const ownerNames = await fetchProfileNamesByIds([data.user_id])
      item = data
      insertData.ad_id = aId
      insertData.owner_id = data.user_id
      insertData.title = data.title
      insertData.owner_name = pickParticipantName(ownerNames.get(data.user_id), recipientName, data.user_name) || 'Usuario'
    }

    if (!item) { creatingRef.current = false; return }

    // Try insert with extra columns; fallback to base columns only
    let convRes = await supabase
      .from('conversations')
      .insert(insertData)
      .select('id, ad_id, sender_id, owner_id, sender_name, owner_name, title, created_at')
      .single()

    if (convRes.error && convRes.error.message?.includes('column')) {
      const { ad_id, sender_id, owner_id } = insertData
      convRes = await supabase
        .from('conversations')
        .insert({ ad_id, sender_id, owner_id })
        .select('id, ad_id, sender_id, owner_id, created_at')
        .single()
    }

    const { data: conv, error } = convRes

    if (error) { toast.error('No se pudo iniciar la conversación: ' + error.message); setLoading(false); creatingRef.current = false; return }
    const nextConv = (await hydrateConversationNames([{
      ...conv,
      sender_name: conv?.sender_name || insertData.sender_name,
      owner_name: conv?.owner_name || insertData.owner_name,
      title: conv?.title || insertData.title,
    }], ownName))[0]

    setConversations(prev => [nextConv, ...prev])
    selectedConvRef.current = nextConv
    setSelectedConv(nextConv)
    setShowList(false)
    loadMessages(nextConv)
    setLoading(false)
    creatingRef.current = false
  }

  function openConversation(conv) {
    markConvRead(conv.id)
    selectedConvRef.current = conv
    setSelectedConv(conv)
    setShowList(false)
    loadMessages(conv)
  }

  async function loadMessages(conv) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })

    setMessages(data || [])
    supabase.from('messages').update({ read: true })
      .eq('conversation_id', conv.id).neq('sender_id', user.id).then(() => {})

    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase
      .channel(`conv-${conv.id}-${channelScopeRef.current}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conv.id}`
      }, payload => {
        setMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
      })
      .subscribe()

    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function sendMessage() {
    const body = newMessage.trim()
    if (!body || !selectedConv || sending) return
    setSending(true)
    setNewMessage('')

    const tempId = `temp-${Date.now()}`
    const tempMsg = { id: tempId, conversation_id: selectedConv.id, sender_id: user.id, body, created_at: new Date().toISOString(), read: false }
    setMessages(prev => [...prev, tempMsg])

    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: selectedConv.id, sender_id: user.id, body })
      .select()
      .single()

    if (error) {
      toast.error('No se pudo enviar')
      setNewMessage(body)
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } else if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? data : m))
    }

    setSending(false)
    inputRef.current?.focus()
  }

  async function deleteConversation(e, conv) {
    e.stopPropagation()
    if (!window.confirm('¿Eliminar esta conversación?')) return
    const isSender = conv.sender_id === user.id
    const updateField = isSender ? { deleted_by_sender: true } : { deleted_by_owner: true }
    await supabase.from('conversations').update(updateField).eq('id', conv.id)
    setConversations(prev => prev.filter(c => c.id !== conv.id))
    if (selectedConv?.id === conv.id) { setSelectedConv(null); setMessages([]); setShowList(true) }
  }

  function otherName(conv) {
    if (!conv) return 'Usuario'
    if (conv.sender_id === user.id) return cleanParticipantName(conv.owner_name) || 'Usuario'
    return cleanParticipantName(conv.sender_name) || 'Usuario'
  }

  if (!isLoggedIn) return null

  const isMobile = window.innerWidth < 700
  const showListPanel = !selectedConv || showList
  const showChatPanel = !!selectedConv && (!isMobile || !showList)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 0 0', height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0 16px 16px' }}>
        <h1 style={{ fontFamily: PP, fontWeight: 800, fontSize: 22, color: C.text, margin: 0, letterSpacing: -0.5 }}>
          💬 Mensajes
        </h1>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', border: `1px solid ${C.border}`, borderRadius: 18, margin: '0 16px 16px', background: '#fff' }}>

        {/* Conversation list */}
        {(showListPanel || !isMobile) && (
          <div style={{ width: isMobile ? '100%' : 280, flexShrink: 0, borderRight: isMobile ? 'none' : `1px solid ${C.border}`, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${C.border}` }}>
              <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 12, color: C.light, margin: 0, letterSpacing: 0.5 }}>CONVERSACIONES</p>
            </div>

            {loading ? (
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 12 }} />)}
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
                <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 6 }}>Sin mensajes aún</p>
                <p style={{ fontFamily: PP, fontSize: 12, color: C.light, lineHeight: 1.6, marginBottom: 16 }}>
                  Para escribir a alguien, abre un anuncio o empleo y pulsa "💬 Enviar mensaje".
                </p>
                <button onClick={() => navigate('/tablon')}
                  style={{ fontFamily: PP, fontWeight: 700, fontSize: 13, background: C.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '11px 18px', cursor: 'pointer', width: '100%' }}>
                  Ir al Tablón
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[...conversations].sort((a, b) => {
                  const ta = lastMsgAt.get(a.id) || a.created_at || ''
                  const tb = lastMsgAt.get(b.id) || b.created_at || ''
                  return tb.localeCompare(ta)
                }).map(conv => {
                  const isUnread = unreadConvIds.has(conv.id)
                  return (
                  <div key={conv.id} style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${C.border}`, background: selectedConv?.id === conv.id ? C.primaryLight : isUnread ? 'rgba(37,99,235,0.04)' : 'transparent' }}>
                    <button onClick={() => openConversation(conv)}
                      style={{ flex: 1, background: 'transparent', border: 'none', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', minWidth: 0 }}>
                      <span style={{ position: 'relative', flexShrink: 0 }}>
                        <Avatar name={otherName(conv)} size={40} src={convAvatars.get(conv.sender_id === user.id ? conv.owner_id : conv.sender_id)} />
                        {isUnread && (
                          <span style={{ position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: '#EF4444', border: '2px solid #fff' }} />
                        )}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: PP, fontWeight: isUnread ? 800 : 700, fontSize: 13, color: selectedConv?.id === conv.id ? C.primary : C.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {convTitle(conv)}
                        </p>
                        <p style={{ fontFamily: PP, fontSize: 11, color: isUnread ? C.text : C.light, fontWeight: isUnread ? 600 : 400, margin: 0 }}>{otherName(conv)}</p>
                      </div>
                      <span style={{ fontFamily: PP, fontSize: 10, color: isUnread ? C.primary : C.light, fontWeight: isUnread ? 700 : 400, flexShrink: 0 }}>{formatTime(lastMsgAt.get(conv.id) || conv.created_at)}</span>
                    </button>
                    <button onClick={e => deleteConversation(e, conv)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 14px 0 4px', color: '#EF4444', fontSize: 16, flexShrink: 0, opacity: 0.6 }}
                      title="Eliminar conversación">
                      🗑
                    </button>
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Chat panel */}
        {(showChatPanel || (!isMobile && !showListPanel)) && (
          selectedConv ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                {isMobile && (
                  <button onClick={() => setShowList(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px 4px 0', fontSize: 18, color: C.mid }}>←</button>
                )}
                <Avatar name={otherName(selectedConv)} size={36} src={convAvatars.get(selectedConv.sender_id === user.id ? selectedConv.owner_id : selectedConv.sender_id)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 14, color: C.text, margin: 0 }}>{otherName(selectedConv)}</p>
                  <p style={{ fontFamily: PP, fontSize: 11, color: C.light, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Re: {convTitle(selectedConv)}
                  </p>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, background: C.bg }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <p style={{ fontFamily: PP, fontSize: 13, color: C.light }}>Empieza la conversación 👋</p>
                  </div>
                )}
                {messages.map(msg => {
                  const mine = msg.sender_id === user.id
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '78%', background: mine ? C.primary : '#fff', color: mine ? '#fff' : C.text, borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                        <p style={{ fontFamily: PP, fontSize: 13, margin: 0, lineHeight: 1.55 }}>{msg.body}</p>
                        <p style={{ fontFamily: PP, fontSize: 10, color: mine ? 'rgba(255,255,255,0.6)' : C.light, margin: '4px 0 0', textAlign: 'right' }}>{formatTime(msg.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, alignItems: 'flex-end', background: '#fff' }}>
                <textarea
                  ref={inputRef}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Escribe un mensaje..."
                  rows={1}
                  style={{ flex: 1, fontFamily: PP, fontSize: 13, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: '10px 14px', resize: 'none', outline: 'none', maxHeight: 120, lineHeight: 1.5, background: C.bg }}
                />
                <button onClick={sendMessage} disabled={sending || !newMessage.trim()}
                  style={{ background: newMessage.trim() ? C.primary : C.border, color: '#fff', border: 'none', borderRadius: 14, width: 44, height: 44, cursor: newMessage.trim() ? 'pointer' : 'default', fontSize: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}>
                  ↑
                </button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 48 }}>💬</div>
              <p style={{ fontFamily: PP, fontWeight: 700, fontSize: 15, color: C.text, margin: 0 }}>Selecciona una conversación</p>
              <p style={{ fontFamily: PP, fontSize: 12, color: C.light, margin: 0 }}>O pulsa "Enviar mensaje" en cualquier anuncio</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
