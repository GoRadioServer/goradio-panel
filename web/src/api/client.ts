import { clearSession, getToken } from '../auth/authStore'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// apiFetch attaches the session bearer token to every call and, on any
// 401, clears the stored session and hard-redirects to /login -- the
// panel has no refresh-token flow (session_ttl is 24h; re-login after
// expiry is an accepted v1 simplicity trade-off).
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const resp = await fetch(path, { ...init, headers })

  if (resp.status === 401 && path !== '/api/auth/login') {
    clearSession()
    window.location.href = '/login'
  }

  return resp
}

export async function apiJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const resp = await apiFetch(path, init)
  if (!resp.ok) {
    const text = await resp.text()
    throw new ApiError(resp.status, (text || resp.statusText).trim())
  }
  // Any success can carry an empty body (204 from deletes, 201 from
  // creates) -- parsing that as JSON would throw and surface a created
  // resource as a failed mutation.
  const body = await resp.text()
  if (!body) return undefined as T
  return JSON.parse(body) as T
}
