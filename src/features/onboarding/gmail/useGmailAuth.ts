import type { FetchJson } from './gmailScan'

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export function makeFetchJson(token: string): FetchJson {
  return async (path: string) => {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(String(res.status))
    return res.json()
  }
}

let gisPromise: Promise<void> | null = null
function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) return resolve()
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('gis_load_failed'))
    document.head.appendChild(s)
  })
  return gisPromise
}

function requestToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp: any) => (resp?.access_token ? resolve(resp.access_token) : reject(new Error('no_token'))),
      error_callback: (err: any) => reject(new Error(err?.type ?? 'popup_error')),
    })
    client.requestAccessToken()
  })
}

export function useGmailAuth() {
  const available = !!clientId

  async function connect(): Promise<{ token: string; account: string }> {
    await loadGis()
    const token = await requestToken()
    const profile = await makeFetchJson(token)('profile')
    return { token, account: profile.emailAddress as string }
  }

  function revoke(token: string) {
    ;(window as any).google?.accounts?.oauth2?.revoke?.(token)
  }

  return { available, connect, makeFetchJson, revoke }
}
