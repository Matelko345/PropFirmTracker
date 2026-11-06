import { SEED } from './seed.js'

/** Keep this key forever — updates must migrate, never wipe. */
const KEY = 'propfirm-tracker-v1'
export const SCHEMA_VERSION = 3

const DEFAULTS = {
  schemaVersion: SCHEMA_VERSION,
  lang: 'pl',
  entryCurrency: 'USD',
  displayCurrency: 'PLN',
  rate: 3.94,
  rateDate: null,
  goals: [],
  nextGoalId: 1,
}

function migrateEntry(e) {
  if (!e || typeof e !== 'object') return e
  const amount = e.amount ?? e.usd ?? 0
  return {
    ...e,
    amount,
    usd: e.usd ?? amount,
    converted: e.converted ?? e.pln ?? null,
    pln: e.pln ?? e.converted ?? null,
    linkedEvalId: e.linkedEvalId ?? null,
  }
}

/**
 * In-place upgrades only.
 * Never replaces a non-empty entries list with [].
 */
export function migrateState(raw) {
  const incoming = Array.isArray(raw?.entries) ? raw.entries : null
  const entries = incoming ? incoming.map(migrateEntry) : []

  const goals = Array.isArray(raw?.goals)
    ? raw.goals
        .filter((g) => g && typeof g.text === 'string')
        .map((g) => ({
          id: g.id,
          text: g.text,
          done: !!g.done,
        }))
    : []

  const state = {
    ...DEFAULTS,
    ...raw,
    rate: raw?.rate ?? raw?.usdPln ?? DEFAULTS.rate,
    entries,
    nextId: raw?.nextId || (entries.reduce((m, e) => Math.max(m, e?.id || 0), 0) + 1),
    goals,
    nextGoalId:
      raw?.nextGoalId || (goals.reduce((m, g) => Math.max(m, g?.id || 0), 0) + 1),
    schemaVersion: SCHEMA_VERSION,
  }
  return state
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Any saved blob with an entries array (even empty on purpose) wins over SEED
      if (parsed && Array.isArray(parsed.entries)) {
        return migrateState(parsed)
      }
    }
  } catch (err) {
    console.error('[PropFirm Tracker] Failed to read saved data — leaving storage untouched', err)
    // Do NOT overwrite localStorage with SEED on read errors
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed?.entries)) return migrateState(parsed)
      }
    } catch {
      /* give up → seed */
    }
  }
  return migrateState({
    ...structuredClone(SEED),
    ...DEFAULTS,
    rate: SEED.usdPln ?? DEFAULTS.rate,
  })
}

export function saveState(state) {
  try {
    const prevRaw = localStorage.getItem(KEY)
    if (prevRaw) {
      const prev = JSON.parse(prevRaw)
      const prevCount = Array.isArray(prev.entries) ? prev.entries.length : 0
      const nextCount = Array.isArray(state.entries) ? state.entries.length : 0
      // Safety: never silently wipe a non-empty DB to empty on schema migrate/save glitch
      if (prevCount > 0 && nextCount === 0 && !state.__allowEmptySave) {
        console.error('[PropFirm Tracker] Blocked save that would wipe', prevCount, 'entries')
        return false
      }
    }
  } catch {
    /* continue with save */
  }

  localStorage.setItem(
    KEY,
    JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      entries: state.entries,
      nextId: state.nextId,
      goals: state.goals || [],
      nextGoalId: state.nextGoalId || 1,
      lang: state.lang,
      entryCurrency: state.entryCurrency,
      displayCurrency: state.displayCurrency,
      rate: state.rate,
      rateDate: state.rateDate || null,
      usdPln: state.rate,
    }),
  )
  return true
}

export function exportJson(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `propfirm-tracker-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (!Array.isArray(data.entries)) throw new Error('Invalid file')
        resolve(migrateState(data))
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
