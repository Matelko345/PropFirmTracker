import { SEED } from './seed.js'

const KEY = 'propfirm-tracker-v1'

const DEFAULTS = {
  lang: 'pl',
  entryCurrency: 'USD',
  displayCurrency: 'PLN',
  rate: 3.94,
  rateDate: null,
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.entries)) {
        return {
          ...DEFAULTS,
          ...parsed,
          // legacy usdPln → rate
          rate: parsed.rate ?? parsed.usdPln ?? DEFAULTS.rate,
        }
      }
    }
  } catch {
    /* ignore */
  }
  return {
    ...structuredClone(SEED),
    ...DEFAULTS,
    rate: SEED.usdPln ?? DEFAULTS.rate,
  }
}

export function saveState(state) {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      entries: state.entries,
      nextId: state.nextId,
      lang: state.lang,
      entryCurrency: state.entryCurrency,
      displayCurrency: state.displayCurrency,
      rate: state.rate,
      rateDate: state.rateDate || null,
      usdPln: state.rate,
    }),
  )
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
        resolve(data)
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
