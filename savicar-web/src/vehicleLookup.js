import { normalizeSearchText } from './searchUtils'

// Best-effort match against an already-loaded make/model catalog, for a
// /vehicle-lookup/:plate response whose brand/model/sub_model are free text
// (the "external" paid-lookup case — see matchVehicleModel below).
export function findMatchingMake(makes, brand) {
  const target = normalizeSearchText(brand)
  if (!target) return null
  return (
    makes.find(mk => normalizeSearchText(mk.name) === target) ??
    makes.find(mk => {
      const name = normalizeSearchText(mk.name)
      return name && (name.includes(target) || target.includes(name))
    }) ??
    null
  )
}

export function findMatchingModel(models, makeId, modelText, subModel) {
  const candidates = makeId != null ? models.filter(m => String(m.id_make) === String(makeId)) : models
  if (candidates.length === 0) return null
  const targetFull = normalizeSearchText(modelText)
  const targetSub = normalizeSearchText(subModel)
  const modelLabel = m => normalizeSearchText(`${m.name ?? ''}${m.version ? ` ${m.version}` : ''}`)

  const exact = candidates.find(m => modelLabel(m) === targetFull)
  if (exact) return exact

  if (targetSub) {
    const bySubModel = candidates.find(m => normalizeSearchText(m.name) === targetSub)
    if (bySubModel) return bySubModel
  }

  return (
    candidates.find(m => {
      const name = normalizeSearchText(m.name)
      return name && targetFull.includes(name)
    }) ?? null
  )
}

// Resolves a /vehicle-lookup/:plate response to a catalog vehicle model.
// A "local" result already carries the exact catalog id (the vehicle is
// already registered under some customer) — no guessing needed. An
// "external" result (from the paid lookup service) only has free-text
// brand/model/sub_model, so it needs fuzzy matching against the catalog.
export function matchVehicleModel(result, makes, models) {
  if (result.source === 'local' && result.id_model != null) {
    return models.find(m => m.id_model === result.id_model) ?? null
  }
  const make = findMatchingMake(makes, result.brand)
  return findMatchingModel(models, make?.id_make, result.model, result.sub_model)
}
