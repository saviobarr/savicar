const SEARCH_STOPWORDS = new Set(['o', 'a', 'os', 'as', 'de', 'da', 'do', 'das', 'dos', 'e', 'um', 'uma', 'uns', 'umas', 'em', 'no', 'na', 'nos', 'nas', 'para', 'com'])

export function normalizeSearchText(str) {
  return String(str ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// Matches when every significant word of the query (articles/prepositions ignored)
// appears somewhere in the text, regardless of order — e.g. "filtro kwid" matches
// "Filtro de Óleo do Kwid".
export function matchesSearchQuery(text, query) {
  const words = normalizeSearchText(query).split(/\s+/).filter(w => w && !SEARCH_STOPWORDS.has(w))
  if (!words.length) return true
  const normText = normalizeSearchText(text)
  return words.every(w => normText.includes(w))
}
