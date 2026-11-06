// The only file that talks to the back end. Every request goes through `request`, so the session
// header, the time limit and the error handling are the same everywhere.

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const TIMEOUT_MS = 15000

// Must match the back end's MAX_TEXT_CHARS. The front end checks it for usability; the back end enforces it.
export const MAX_TEXT_CHARS = 10000

// One random ID per browser tab. The back end keeps each session's history separate, so this tab
// only ever sees its own checks. sessionStorage keeps it across reloads but not across tabs.
function sessionId() {
  let id = sessionStorage.getItem('guardrail-session')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('guardrail-session', id)
  }
  return id
}

// An error the UI can show as is: `message` is always safe, readable text.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

const FALLBACK_MESSAGES = {
  network: 'Cannot reach the guardrail server. Check that the back end is running, then try again.',
  timeout: 'The server took too long to answer. Please try again.',
  server_busy: 'The server is busy checking other prompts. Please try again in a moment.',
}

async function request(path, { method = 'GET', body } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response
  try {
    response = await fetch(API_URL + path, {
      method,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId() },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (e) {
    const code = e.name === 'AbortError' ? 'timeout' : 'network'
    throw new ApiError(0, code, FALLBACK_MESSAGES[code])
  } finally {
    clearTimeout(timer)
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    // The back end always answers errors as {"error": {"code", "message"}}; fall back if something in between did not.
    const code = data?.error?.code ?? 'http_error'
    const message = data?.error?.message ?? FALLBACK_MESSAGES[code] ?? `Request failed (${response.status}).`
    throw new ApiError(response.status, code, message)
  }
  return data
}

export const api = {
  health: () => request('/api/health'),
  check: (text) => request('/api/check', { method: 'POST', body: { text } }),
  history: ({ decision, search } = {}) => {
    const params = new URLSearchParams({ limit: '200' })
    if (decision) params.set('decision', decision)
    if (search) params.set('search', search)
    return request(`/api/history?${params}`)
  },
  historyItem: (id) => request(`/api/history/${encodeURIComponent(id)}`),
  clearHistory: () => request('/api/history', { method: 'DELETE' }),
}
