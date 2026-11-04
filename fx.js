const cache = new Map()

function formatDate(d) {
  return d.toISOString().slice(0, 10)
}

function shiftDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

function cacheKey(from, to, date) {
  return `${from}:${to}:${date || 'latest'}`
}

async function fetchCurrencyApi(from, to, dateStr) {
  const base = from.toLowerCase()
  const quote = to.toLowerCase()
  const tag = dateStr || 'latest'
  const urls = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${tag}/v1/currencies/${base}.min.json`,
    `https://${tag}.currency-api.pages.dev/v1/currencies/${base}.min.json`,
  ]

  let lastErr
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`FX ${res.status}`)
      const data = await res.json()
      const rate = data?.[base]?.[quote]
      if (!rate) throw new Error('Missing rate')
      return { rate, effectiveDate: data.date || dateStr || formatDate(new Date()) }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('FX failed')
}

/** NBP fallback for * → PLN (official mid). */
async function fetchNbpToPln(from, dateStr) {
  const code = from.toLowerCase()
  if (code === 'pln') return { rate: 1, effectiveDate: dateStr || formatDate(new Date()) }

  const url = dateStr
    ? `https://api.nbp.pl/api/exchangerates/rates/a/${code}/${dateStr}/?format=json`
    : `https://api.nbp.pl/api/exchangerates/rates/a/${code}/?format=json`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`NBP ${res.status}`)
  const data = await res.json()
  const rate = data?.rates?.[0]
  if (!rate?.mid) throw new Error('NBP missing')
  return { rate: rate.mid, effectiveDate: rate.effectiveDate }
}

async function fetchRateOnce(from, to, dateStr) {
  if (from === to) {
    return { rate: 1, effectiveDate: dateStr || formatDate(new Date()) }
  }

  try {
    return await fetchCurrencyApi(from, to, dateStr)
  } catch {
    if (to === 'PLN') {
      return await fetchNbpToPln(from, dateStr)
    }
    throw new Error('No FX source')
  }
}

/** Rate from `from` → `to` on a given date (walks back on weekends/holidays). */
export async function getRateForDate(dateStr, from, to, fallback = 1) {
  if (from === to) return { rate: 1, effectiveDate: dateStr, approx: false }
  if (!dateStr) return getCurrentRate(from, to, fallback)

  const today = formatDate(new Date())
  const target = dateStr > today ? today : dateStr
  const key = cacheKey(from, to, target)
  if (cache.has(key)) return cache.get(key)

  let cursor = target
  for (let i = 0; i < 12; i++) {
    try {
      const result = await fetchRateOnce(from, to, cursor)
      const payload = {
        rate: result.rate,
        effectiveDate: result.effectiveDate,
        approx: result.effectiveDate !== dateStr,
      }
      cache.set(key, payload)
      return payload
    } catch {
      cursor = shiftDays(cursor, -1)
    }
  }

  return { rate: fallback, effectiveDate: null, approx: true }
}

export async function getCurrentRate(from, to, fallback = 1) {
  if (from === to) return { rate: 1, effectiveDate: formatDate(new Date()), approx: false }
  const key = cacheKey(from, to, 'latest')
  try {
    const result = await fetchRateOnce(from, to, null)
    const payload = {
      rate: result.rate,
      effectiveDate: result.effectiveDate,
      approx: false,
    }
    cache.set(key, payload)
    return payload
  } catch {
    return cache.get(key) || { rate: fallback, effectiveDate: null, approx: true }
  }
}

/** Converted amount stored on the entry for the active display currency. */
export function convertedAmount(entry, fallbackRate = 1) {
  if (entry.converted != null && !Number.isNaN(entry.converted)) return entry.converted
  if (entry.pln != null && !Number.isNaN(entry.pln)) return entry.pln
  const amount = entry.amount ?? entry.usd
  const rate = entry.rate || fallbackRate
  return amount * rate
}

export function clearFxCache() {
  cache.clear()
}
