// Only files published with Latido may be offered as direct PDF downloads.
export function offerDownload(offer) {
  const path = offer?.download_path
  if (typeof path !== 'string' || path.length > 300 || !path.endsWith('.pdf') ||
      !/^\/downloads\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.pdf$/.test(path)) return null
  return { url: path, filename: path.split('/').at(-1) }
}
