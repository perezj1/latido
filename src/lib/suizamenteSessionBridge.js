// Used by both hosts. A session is handed only to the game's same-origin frame;
// no tokens are put in URLs or sent between Latido and the standalone domain.
export function connectSuizamenteSession({ getFrame, getSession, api, standalone=false, target=window }) {
  async function identify(event) {
    const frame = getFrame()
    if (!frame || event.origin !== target.location.origin || event.source !== frame
      || event.data?.type !== 'suizamente:identity'
      || typeof event.data.requestId !== 'string' || event.data.requestId.length > 100) return
    let session = null
    try { session = (await getSession()).data?.session || null } catch { /* Game remains playable as a guest. */ }
    if (event.source !== getFrame()) return
    event.source.postMessage({
      type:'suizamente:session', requestId:event.data.requestId,
      token:session?.access_token || null, userId:session?.user?.id || null,
      api, ...(standalone ? { app:'standalone' } : {}),
    }, target.location.origin)
  }
  target.addEventListener('message', identify)
  return () => target.removeEventListener('message', identify)
}
