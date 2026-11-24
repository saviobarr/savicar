// Server clock for date/time defaults, so screens don't trust each machine's own (possibly wrong) clock.
// syncServerClock() asks the API for its wall-clock time once at startup (and periodically) and keeps
// the offset; serverNow() then returns a Date whose *local* getters (getFullYear, getHours, ...) read
// as the server's time in the app timezone.
const BASE = import.meta.env.VITE_API_URL ?? ''
let offsetMs = 0

export async function syncServerClock() {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 3000)
  try {
    const res = await fetch(`${BASE}/auth/server-time`, { signal: ctrl.signal })
    if (!res.ok) return
    const { iso } = await res.json()
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(iso ?? '')
    if (!m) return
    const wall = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
    offsetMs = wall.getTime() - Date.now()
  } catch {
    // unreachable: keep the previous offset (0 = machine clock)
  } finally {
    clearTimeout(timer)
  }
}

export function startServerClockSync() {
  return syncServerClock().finally(() => setInterval(syncServerClock, 10 * 60 * 1000))
}

export function serverNow() {
  return new Date(Date.now() + offsetMs)
}

// yyyy-mm-dd from a Date's local fields (toISOString() would shift to UTC)
export function localISODate(d) {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function serverTodayISO() {
  return localISODate(serverNow())
}
