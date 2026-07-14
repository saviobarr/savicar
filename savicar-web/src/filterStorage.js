// Persists list-page filters (search text, pagination, sort, custom filters) in
// sessionStorage so they survive navigating away to another page and back,
// without surviving a full browser restart.
export function loadFilters(key, fallback) {
  try {
    const raw = sessionStorage.getItem(`filters:${key}`)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export function saveFilters(key, value) {
  try {
    sessionStorage.setItem(`filters:${key}`, JSON.stringify(value))
  } catch {
    // ignore storage errors (private browsing quota, etc.)
  }
}
