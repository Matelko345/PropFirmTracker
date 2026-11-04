import './style.css'
import { loadState, saveState, exportJson, importJson } from './storage.js'
import { getCurrentRate, getRateForDate, convertedAmount, clearFxCache } from './fx.js'
import { t, LANGS } from './i18n.js'
import { CURRENCIES, currencyMeta } from './currencies.js'

const iEdit = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>`
const iDel = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`

const state = loadState()
let editId = null
let rateBusy = false

const $ = (id) => document.getElementById(id)
const tr = (key, vars) => t(state.lang, key, vars)
const locale = () => (state.lang === 'pl' ? 'pl-PL' : 'en-US')

function entryAmount(e) {
  return e.amount ?? e.usd ?? 0
}

function fMoney(n, code) {
  if (n == null || Number.isNaN(n)) return '—'
  try {
    return new Intl.NumberFormat(locale(), {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    const meta = currencyMeta(code)
    const sign = n < 0 ? '−' : ''
    return (
      sign +
      Math.abs(n).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      '\u00a0' +
      meta.symbol
    )
  }
}

const fPct = (n) => {
  if (n == null || Number.isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
}

function persist() {
  saveState(state)
}

function firms() {
  return [...new Set(state.entries.map((e) => e.firm).filter(Boolean))].sort()
}

function filteredEntries() {
  const firm = $('firmFilter').value
  return firm ? state.entries.filter((e) => e.firm === firm) : state.entries
}

function applyStaticI18n() {
  document.documentElement.lang = state.lang
  $('tagline').textContent = tr('tagline')
  $('btnExport').textContent = tr('export')
  $('btnImportText').textContent = tr('import')
  $('btnEval').textContent = tr('addEval')
  $('btnPayout').textContent = tr('addPayout')
  $('btnSettings').title = tr('settings')
  $('histTitle').textContent = tr('history')
  $('firmTitle').textContent = tr('firmSummary')
  $('thDate').textContent = tr('date')
  $('thFirm').textContent = tr('firm')
  $('thType').textContent = tr('type')
  $('thAmount').textContent = state.entryCurrency
  $('thConverted').textContent = `${state.displayCurrency} · ${tr('convertedOnDay')}`
  $('thStatus').textContent = tr('status')
  $('thNote').textContent = tr('note')
  $('thFirm2').textContent = tr('firm')
  $('thSpent').textContent = tr('spentCol')
  $('thPayouts').textContent = tr('payoutsCol')
  $('thNet').textContent = tr('netProfit')
  $('thRoi').textContent = tr('roi')
  $('thEntries').textContent = tr('entriesCol')
  $('histEmpty').textContent = tr('emptyHistory')
  $('footText').textContent = tr('foot')
  $('lFirm').textContent = tr('firmLabel')
  $('fFirm').placeholder = tr('firmPh')
  $('lType').textContent = tr('typeLabel')
  $('optEval').textContent = tr('typeEval')
  $('optPayout').textContent = tr('typePayout')
  $('lDate').textContent = tr('dateLabel')
  $('lAmount').textContent = tr('amountLabel', { code: state.entryCurrency })
  $('lConverted').textContent = tr('convertedLabel', { code: state.displayCurrency })
  $('lSize').textContent = tr('sizeLabel')
  $('fSize').placeholder = tr('sizePh')
  $('lStatus').textContent = tr('statusLabel')
  $('optActive').textContent = tr('statusActive')
  $('optPass').textContent = tr('statusPass')
  $('optFail').textContent = tr('statusFail')
  $('lNote').textContent = tr('noteLabel')
  $('fNote').placeholder = tr('notePh')
  $('mCancel').textContent = tr('cancel')
  $('sTit').textContent = tr('settingsTitle')
  $('lLang').textContent = tr('language')
  $('lEntryCur').textContent = tr('entryCurrency')
  $('hEntryCur').textContent = tr('entryCurrencyHint')
  $('lDisplayCur').textContent = tr('displayCurrency')
  $('hDisplayCur').textContent = tr('displayCurrencyHint')
  $('sCancel').textContent = tr('close')
  $('sSave').textContent = tr('apply')
  $('sRecalc').textContent = tr('recalculating')
}

function fillSettingsSelects() {
  const lang = $('sLang')
  lang.innerHTML = ''
  LANGS.forEach((l) => {
    const o = document.createElement('option')
    o.value = l.code
    o.textContent = l.label
    lang.appendChild(o)
  })
  lang.value = state.lang

  ;['sEntryCur', 'sDisplayCur'].forEach((id) => {
    const sel = $(id)
    sel.innerHTML = ''
    CURRENCIES.forEach((c) => {
      const o = document.createElement('option')
      o.value = c.code
      o.textContent = `${c.code} — ${c.name}`
      sel.appendChild(o)
    })
  })
  $('sEntryCur').value = state.entryCurrency
  $('sDisplayCur').value = state.displayCurrency
}

function updateFirmFilter() {
  const sel = $('firmFilter')
  const cur = sel.value
  sel.innerHTML = `<option value="">${tr('allFirms')}</option>`
  firms().forEach((f) => {
    const o = document.createElement('option')
    o.value = f
    o.textContent = f
    if (f === cur) o.selected = true
    sel.appendChild(o)
  })

  const list = $('firmList')
  list.innerHTML = ''
  firms().forEach((f) => {
    const o = document.createElement('option')
    o.value = f
    list.appendChild(o)
  })
}

function renderStats() {
  const list = filteredEntries()
  const evalTotal = list.filter((e) => e.type === 'eval').reduce((s, e) => s + entryAmount(e), 0)
  const payTotal = list.filter((e) => e.type === 'payout').reduce((s, e) => s + entryAmount(e), 0)
  const profit = payTotal - evalTotal
  const roi = evalTotal > 0 ? (profit / evalTotal) * 100 : null

  const evalConv = list
    .filter((e) => e.type === 'eval')
    .reduce((s, e) => s + convertedAmount(e, state.rate), 0)
  const payConv = list
    .filter((e) => e.type === 'payout')
    .reduce((s, e) => s + convertedAmount(e, state.rate), 0)
  const profitConv = payConv - evalConv

  const evalCount = list.filter((e) => e.type === 'eval').length
  const passCount = list.filter((e) => e.type === 'eval' && e.status === 'pass').length
  const failCount = list.filter((e) => e.type === 'eval' && e.status === 'fail').length
  const payCount = list.filter((e) => e.type === 'payout').length

  $('stats').innerHTML = `
    <article class="stat glass">
      <div class="label">${tr('spent')}</div>
      <div class="value neg">${fMoney(evalTotal, state.entryCurrency)}</div>
      <div class="sub">${fMoney(evalConv, state.displayCurrency)}</div>
    </article>
    <article class="stat glass">
      <div class="label">${tr('payouts')}</div>
      <div class="value pos">${fMoney(payTotal, state.entryCurrency)}</div>
      <div class="sub">${fMoney(payConv, state.displayCurrency)}</div>
    </article>
    <article class="stat glass">
      <div class="label">${tr('netProfit')}</div>
      <div class="value ${profit >= 0 ? 'pos' : 'neg'}">${fMoney(profit, state.entryCurrency)}</div>
      <div class="sub">${fMoney(profitConv, state.displayCurrency)}</div>
    </article>
    <article class="stat glass">
      <div class="label">${tr('roi')}</div>
      <div class="value ${roi == null ? 'neu' : roi >= 0 ? 'pos' : 'neg'}">${fPct(roi)}</div>
      <div class="sub">${roi != null ? tr('onStake', { amount: fMoney(evalTotal, state.entryCurrency) }) : '—'}</div>
    </article>
    <article class="stat glass">
      <div class="label">${tr('evals')}</div>
      <div class="value neu">${evalCount}</div>
      <div class="sub">${passCount} ${tr('passed')} · ${failCount} ${tr('failed')} · ${payCount} ${tr('payoutCount')}</div>
    </article>
  `
}

function renderHistory() {
  const sorted = [...filteredEntries()].sort((a, b) => b.date.localeCompare(a.date))
  const tb = $('histBody')
  tb.innerHTML = ''
  $('histEmpty').hidden = sorted.length > 0

  sorted.forEach((e) => {
    const isEval = e.type === 'eval'
    const amt = entryAmount(e)
    const conv = convertedAmount(e, state.rate)
    const status = isEval
      ? `<span class="badge ${e.status === 'pass' ? 'b-pass' : e.status === 'fail' ? 'b-fail' : 'b-active'}">${
          e.status === 'pass' ? tr('badgePass') : e.status === 'fail' ? tr('badgeFail') : tr('badgeActive')
        }</span>${e.size ? `<span class="tag">${e.size}</span>` : ''}`
      : `<span class="badge b-payout">${tr('badgePayout')}</span>`

    const trEl = document.createElement('tr')
    trEl.innerHTML = `
      <td class="muted">${e.date ? new Date(e.date + 'T12:00').toLocaleDateString(locale()) : '—'}</td>
      <td><strong>${e.firm || '—'}</strong></td>
      <td><span class="badge ${isEval ? 'b-eval' : 'b-payout'}">${isEval ? tr('badgeEval') : tr('badgePayout')}</span></td>
      <td class="r mono"><span class="${isEval ? 'neg' : 'pos'}">${isEval ? '−' : '+'} ${fMoney(amt, state.entryCurrency)}</span></td>
      <td class="r mono muted">${fMoney(conv, state.displayCurrency)}${e.rate ? `<div class="faint">${e.rate.toFixed(4)}</div>` : ''}</td>
      <td>${status}</td>
      <td class="muted" style="max-width:140px;overflow:hidden;text-overflow:ellipsis">${e.note || '—'}</td>
      <td>
        <div class="acts">
          <button class="icon-btn edit" data-edit="${e.id}" title="${tr('edit')}">${iEdit}</button>
          <button class="icon-btn del" data-del="${e.id}" title="${tr('del')}">${iDel}</button>
        </div>
      </td>
    `
    tb.appendChild(trEl)
  })
}

function renderFirms() {
  const tb = $('firmBody')
  tb.innerHTML = ''
  const list = firms()
  if (!list.length) {
    tb.innerHTML = `<tr><td colspan="6" class="empty">${tr('noData')}</td></tr>`
    return
  }

  let totEval = 0
  let totPay = 0

  list.forEach((firm) => {
    const fe = state.entries.filter((e) => e.firm === firm && e.type === 'eval')
    const fp = state.entries.filter((e) => e.firm === firm && e.type === 'payout')
    const evalSum = fe.reduce((s, e) => s + entryAmount(e), 0)
    const paySum = fp.reduce((s, e) => s + entryAmount(e), 0)
    const profit = paySum - evalSum
    const roi = evalSum > 0 ? (profit / evalSum) * 100 : null
    const evalConv = fe.reduce((s, e) => s + convertedAmount(e, state.rate), 0)
    const payConv = fp.reduce((s, e) => s + convertedAmount(e, state.rate), 0)
    const profitConv = payConv - evalConv
    totEval += evalSum
    totPay += paySum

    const row = document.createElement('tr')
    row.innerHTML = `
      <td><strong>${firm}</strong></td>
      <td class="r mono neg">−${fMoney(evalSum, state.entryCurrency)}<br><span class="faint">${fMoney(evalConv, state.displayCurrency)}</span></td>
      <td class="r mono pos">+${fMoney(paySum, state.entryCurrency)}<br><span class="faint">${fMoney(payConv, state.displayCurrency)}</span></td>
      <td class="r mono"><span class="${profit >= 0 ? 'pos' : 'neg'}">${profit >= 0 ? '+' : ''}${fMoney(profit, state.entryCurrency)}</span><br><span class="faint">${fMoney(profitConv, state.displayCurrency)}</span></td>
      <td class="r mono"><span class="${profit >= 0 ? 'pos' : 'neg'}">${fPct(roi)}</span></td>
      <td class="r muted">${fe.length} eval · ${fp.length} pay</td>
    `
    tb.appendChild(row)
  })

  if (list.length > 1) {
    const tot = totPay - totEval
    const row = document.createElement('tr')
    row.className = 'profit-row'
    row.innerHTML = `
      <td>${tr('total')}</td>
      <td class="r mono">−${fMoney(totEval, state.entryCurrency)}</td>
      <td class="r mono">+${fMoney(totPay, state.entryCurrency)}</td>
      <td class="r mono">${tot >= 0 ? '+' : ''}${fMoney(tot, state.entryCurrency)}</td>
      <td class="r mono">${fPct(totEval > 0 ? (tot / totEval) * 100 : null)}</td>
      <td></td>
    `
    tb.appendChild(row)
  }
}

function render() {
  applyStaticI18n()
  updateFirmFilter()
  renderStats()
  renderHistory()
  renderFirms()
  $('footMeta').textContent = tr('autoSave', { n: state.entries.length })
}

function onTypeChange() {
  $('evalFields').style.display = $('fType').value === 'eval' ? 'block' : 'none'
}

async function calcConverted() {
  const amount = parseFloat($('fAmount').value)
  const date = $('fDate').value
  if (!date) {
    $('rateHint').textContent = tr('rateHintPickDate')
    return null
  }
  if (Number.isNaN(amount) || amount <= 0) {
    $('rateHint').textContent = tr('rateHintPickAmount')
    return null
  }

  rateBusy = true
  $('rateHint').textContent = tr('rateHintLoading', { date })
  try {
    const fx = await getRateForDate(date, state.entryCurrency, state.displayCurrency, state.rate)
    const converted = +(amount * fx.rate).toFixed(2)
    $('fConverted').value = converted.toFixed(2)
    $('fConverted').dataset.rate = String(fx.rate)
    $('rateHint').textContent = fx.approx
      ? tr('rateHintApprox', { rate: fx.rate.toFixed(4), date: fx.effectiveDate || date })
      : tr('rateHintOk', { rate: fx.rate.toFixed(4), date: fx.effectiveDate || date })
    return { rate: fx.rate, converted, effectiveDate: fx.effectiveDate }
  } catch {
    $('rateHint').textContent = tr('rateHintFail')
    return null
  } finally {
    rateBusy = false
  }
}

function openModal(type, id = null) {
  editId = id
  $('fType').value = type || 'eval'
  onTypeChange()
  $('mTit').textContent = id
    ? tr('editTitle')
    : type === 'payout'
      ? tr('addPayoutTitle')
      : tr('addEvalTitle')
  $('mSave').textContent = id ? tr('saveChanges') : tr('save')
  delete $('fConverted').dataset.rate

  if (id) {
    const e = state.entries.find((x) => x.id === id)
    if (!e) return
    $('fFirm').value = e.firm || ''
    $('fType').value = e.type
    onTypeChange()
    $('fDate').value = e.date || ''
    $('fAmount').value = entryAmount(e) || ''
    $('fConverted').value = convertedAmount(e, state.rate) || ''
    if (e.rate) $('fConverted').dataset.rate = String(e.rate)
    $('fSize').value = e.size || ''
    $('fStatus').value = e.status || 'active'
    $('fNote').value = e.note || ''
    $('rateHint').textContent = e.rate
      ? tr('rateSaved', { rate: e.rate.toFixed(4) })
      : tr('rateHintIdle')
  } else {
    $('fFirm').value = ''
    $('fDate').value = new Date().toISOString().slice(0, 10)
    $('fAmount').value = ''
    $('fConverted').value = ''
    $('fSize').value = ''
    $('fStatus').value = 'active'
    $('fNote').value = ''
    $('rateHint').textContent = tr('rateHintIdle')
  }

  $('overlay').hidden = false
  $('fFirm').focus()
}

function closeModal() {
  $('overlay').hidden = true
  editId = null
}

function openSettings() {
  fillSettingsSelects()
  applyStaticI18n()
  $('sRecalc').hidden = true
  $('settingsOverlay').hidden = false
}

function closeSettings() {
  $('settingsOverlay').hidden = true
}

async function saveSettings() {
  const nextLang = $('sLang').value
  const nextEntry = $('sEntryCur').value
  const nextDisplay = $('sDisplayCur').value
  const currencyChanged =
    nextEntry !== state.entryCurrency || nextDisplay !== state.displayCurrency

  state.lang = nextLang
  state.entryCurrency = nextEntry
  state.displayCurrency = nextDisplay
  persist()

  if (currencyChanged) {
    $('sRecalc').hidden = false
    clearFxCache()
    await recalculateAllEntries()
  }

  await refreshFx()
  closeSettings()
  render()
}

async function saveEntry() {
  if (rateBusy) return
  const firm = $('fFirm').value.trim()
  const type = $('fType').value
  const date = $('fDate').value
  const amount = parseFloat($('fAmount').value)

  if (!firm || !date || Number.isNaN(amount) || amount <= 0) {
    $('fFirm').focus()
    return
  }

  const fx = await calcConverted()
  if (!fx) {
    alert(tr('alertRate'))
    return
  }

  const entry = {
    firm,
    type,
    date,
    usd: amount,
    amount,
    pln: fx.converted,
    converted: fx.converted,
    rate: fx.rate,
    rateDate: fx.effectiveDate || date,
    quoteCurrency: state.displayCurrency,
    entryCurrency: state.entryCurrency,
    size: $('fSize').value.trim(),
    status: $('fStatus').value,
    note: $('fNote').value.trim(),
  }

  if (editId != null) {
    const i = state.entries.findIndex((e) => e.id === editId)
    if (i > -1) state.entries[i] = { ...state.entries[i], ...entry }
  } else {
    state.entries.push({ id: state.nextId++, ...entry })
  }

  persist()
  closeModal()
  render()
}

function delEntry(id) {
  if (!confirm(tr('confirmDel'))) return
  state.entries = state.entries.filter((e) => e.id !== id)
  persist()
  render()
}

async function refreshFx() {
  const pair = `${state.entryCurrency}/${state.displayCurrency}`
  $('fxLabel').textContent = `${pair} …`
  const fx = await getCurrentRate(state.entryCurrency, state.displayCurrency, state.rate)
  state.rate = fx.rate
  state.rateDate = fx.effectiveDate
  persist()
  $('fxLabel').textContent = `${pair} ${fx.rate.toFixed(4)}`
  render()
}

async function recalculateAllEntries() {
  for (const e of state.entries) {
    if (!e.date) continue
    const amount = entryAmount(e)
    try {
      const fx = await getRateForDate(
        e.date,
        state.entryCurrency,
        state.displayCurrency,
        state.rate,
      )
      e.rate = fx.rate
      e.converted = +(amount * fx.rate).toFixed(2)
      e.pln = e.converted
      e.rateDate = fx.effectiveDate || e.date
      e.quoteCurrency = state.displayCurrency
      e.entryCurrency = state.entryCurrency
      e.amount = amount
      e.usd = amount
    } catch {
      /* keep existing */
    }
  }
  persist()
}

async function backfillRates() {
  let changed = false
  for (const e of state.entries) {
    const amount = entryAmount(e)
    e.amount = amount
    e.usd = amount

    const needs =
      e.converted == null && e.pln == null
        ? true
        : e.quoteCurrency && e.quoteCurrency !== state.displayCurrency

    if (!needs && e.rate) {
      if (e.converted == null && e.pln != null) {
        e.converted = e.pln
        changed = true
      }
      continue
    }

    if (e.pln != null && e.converted == null && (!e.quoteCurrency || e.quoteCurrency === state.displayCurrency)) {
      e.converted = e.pln
      if (!e.rate && amount) e.rate = +(e.pln / amount).toFixed(4)
      e.quoteCurrency = state.displayCurrency
      changed = true
      continue
    }

    if (!e.date) continue
    try {
      const fx = await getRateForDate(
        e.date,
        state.entryCurrency,
        state.displayCurrency,
        state.rate,
      )
      e.rate = fx.rate
      e.converted = +(amount * fx.rate).toFixed(2)
      e.pln = e.converted
      e.quoteCurrency = state.displayCurrency
      changed = true
    } catch {
      /* keep going */
    }
  }
  if (changed) {
    persist()
    render()
  }
}

// Events
$('firmFilter').addEventListener('change', render)
$('btnEval').addEventListener('click', () => openModal('eval'))
$('btnPayout').addEventListener('click', () => openModal('payout'))
$('btnSettings').addEventListener('click', openSettings)
$('btnExport').addEventListener('click', () => exportJson(state))
$('importFile').addEventListener('change', async (ev) => {
  const file = ev.target.files?.[0]
  if (!file) return
  try {
    const data = await importJson(file)
    state.entries = data.entries
    state.nextId = data.nextId || Math.max(0, ...data.entries.map((e) => e.id)) + 1
    if (data.lang) state.lang = data.lang
    if (data.entryCurrency) state.entryCurrency = data.entryCurrency
    if (data.displayCurrency) state.displayCurrency = data.displayCurrency
    if (data.rate || data.usdPln) state.rate = data.rate || data.usdPln
    persist()
    render()
    await backfillRates()
  } catch {
    alert(tr('alertImport'))
  }
  ev.target.value = ''
})

$('mCancel').addEventListener('click', closeModal)
$('mSave').addEventListener('click', () => saveEntry())
$('fType').addEventListener('change', onTypeChange)
$('fAmount').addEventListener('input', () => {
  clearTimeout($('fAmount')._t)
  $('fAmount')._t = setTimeout(calcConverted, 280)
})
$('fDate').addEventListener('change', calcConverted)
$('overlay').addEventListener('click', (e) => {
  if (e.target === $('overlay')) closeModal()
})
$('settingsOverlay').addEventListener('click', (e) => {
  if (e.target === $('settingsOverlay')) closeSettings()
})
$('sCancel').addEventListener('click', closeSettings)
$('sSave').addEventListener('click', () => saveSettings())
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  if (!$('overlay').hidden) closeModal()
  if (!$('settingsOverlay').hidden) closeSettings()
})

$('histBody').addEventListener('click', (e) => {
  const edit = e.target.closest('[data-edit]')
  const del = e.target.closest('[data-del]')
  if (edit) openModal(null, Number(edit.dataset.edit))
  if (del) delEntry(Number(del.dataset.del))
})

if (navigator.userAgent.includes('Electron')) {
  document.body.classList.add('is-electron')
}

render()
refreshFx()
backfillRates()
