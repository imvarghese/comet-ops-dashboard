import {
  STOCK   as DFLT_STOCK,
  WEEKLY_MOVEMENT as DFLT_WM,
  SKUS    as DFLT_SKUS,
  STORES  as DFLT_STORES,
  SIZES   as DFLT_SIZES,
} from '../data/inventory.js'

const DFLT_SIZES_LIST = DFLT_SIZES || ['UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11']

// ── Factory ───────────────────────────────────────────────────────────────────
// createCalc(overrides) returns every calc function pre-bound to the supplied
// data. Components call useCalc() which calls createCalc(liveData).

export function createCalc(overrides = {}) {
  const stock          = overrides.stock          || DFLT_STOCK
  const weeklyMovement = overrides.weeklyMovement || DFLT_WM
  const SKUS           = overrides.skus           || DFLT_SKUS
  const STORES         = overrides.stores         || DFLT_STORES
  const SIZES          = DFLT_SIZES_LIST
  const inboundSchedule    = overrides.inboundSchedule    || []
  const warehouseLocations = overrides.warehouseLocations || []

  // ── Core metrics ───────────────────────────────────────────

  function totalUnits(storeId, skuId) {
    return Object.values(stock[storeId]?.[skuId] ?? {}).reduce((a, b) => a + b, 0)
  }

  function avgWeeklySales(storeId, skuId) {
    const w = weeklyMovement[storeId]?.[skuId] ?? [0, 0, 0, 0]
    return w.reduce((a, b) => a + b, 0) / w.length
  }

  function weeksOfSupply(storeId, skuId) {
    const avg = avgWeeklySales(storeId, skuId)
    if (avg === 0) return null
    return totalUnits(storeId, skuId) / avg
  }

  function reorderPoint(storeId, skuId) {
    const sku = SKUS.find(s => s.id === skuId)
    const leadWeeks = (sku?.leadTimeDays ?? 10) / 7
    return avgWeeklySales(storeId, skuId) * (leadWeeks + 1)
  }

  function stockStatus(storeId, skuId) {
    const units = totalUnits(storeId, skuId)
    const wos   = weeksOfSupply(storeId, skuId)
    const rp    = reorderPoint(storeId, skuId)
    if (units === 0)                     return 'out'
    if (wos !== null && wos < 1)         return 'critical'
    if (units <= rp)                     return 'low'
    return 'ok'
  }

  function sellThrough(storeId, skuId) {
    const sold   = (weeklyMovement[storeId]?.[skuId] ?? []).reduce((a, b) => a + b, 0)
    const onHand = totalUnits(storeId, skuId)
    const total  = sold + onHand
    return total === 0 ? 0 : Math.round((sold / total) * 100)
  }

  // ── Intelligence layer ─────────────────────────────────────

  function demandTrend(storeId, skuId) {
    const w = weeklyMovement[storeId]?.[skuId] ?? [0, 0, 0, 0]
    const prior  = (w[0] + w[1]) / 2
    const recent = (w[2] + w[3]) / 2
    if (prior === 0) return { direction: 'flat', pct: 0 }
    const pct = Math.round(((recent - prior) / prior) * 100)
    return { direction: pct >= 15 ? 'up' : pct <= -15 ? 'down' : 'flat', pct }
  }

  function forecastWeeks(storeId, skuId, n = 4) {
    const w = weeklyMovement[storeId]?.[skuId] ?? [0, 0, 0, 0]
    const slope = (w[3] - w[0]) / 3
    return Array.from({ length: n }, (_, i) =>
      Math.max(0, Math.round((w[3] + slope * (i + 1)) * 10) / 10)
    )
  }

  // WMA — weighted moving average (weights 1,2,3,4 oldest→newest, projects flat)
  function wmaForecast(storeId, skuId, n = 4) {
    const w = weeklyMovement[storeId]?.[skuId] ?? [0, 0, 0, 0]
    const wma = (w[0] * 1 + w[1] * 2 + w[2] * 3 + w[3] * 4) / 10
    return Array.from({ length: n }, () => Math.max(0, Math.round(wma * 10) / 10))
  }

  // Holt's Double Exponential Smoothing (α=0.4 level, β=0.3 trend)
  function holtsForecast(storeId, skuId, n = 4) {
    const w = weeklyMovement[storeId]?.[skuId] ?? [0, 0, 0, 0]
    const α = 0.4, β = 0.3
    let L = w[0], T = w[1] - w[0]
    for (let i = 1; i < w.length; i++) {
      const Lp = L
      L = α * w[i] + (1 - α) * (L + T)
      T = β * (L - Lp) + (1 - β) * T
    }
    return Array.from({ length: n }, (_, h) =>
      Math.max(0, Math.round((L + T * (h + 1)) * 10) / 10)
    )
  }

  // Croston's Method — separates demand frequency from size (handles intermittent demand)
  function crostonsForecast(storeId, skuId, n = 4) {
    const w = weeklyMovement[storeId]?.[skuId] ?? [0, 0, 0, 0]
    const α = 0.4
    const nzIdx = w.reduce((acc, v, i) => (v > 0 ? [...acc, i] : acc), [])
    if (nzIdx.length === 0) return Array.from({ length: n }, () => 0)
    let q = w[nzIdx[0]]
    let p = nzIdx.length > 1 ? nzIdx[1] - nzIdx[0] : 1
    let last = nzIdx[0]
    for (let i = 1; i < w.length; i++) {
      if (w[i] > 0) {
        q = α * w[i] + (1 - α) * q
        p = α * (i - last) + (1 - α) * p
        last = i
      }
    }
    const rate = Math.max(0, q / Math.max(p, 0.1))
    return Array.from({ length: n }, () => Math.round(rate * 10) / 10)
  }

  function forecastWithModel(storeId, skuId, model, n = 4) {
    if (model === 'wma')     return wmaForecast(storeId, skuId, n)
    if (model === 'holts')   return holtsForecast(storeId, skuId, n)
    if (model === 'croston') return crostonsForecast(storeId, skuId, n)
    return forecastWeeks(storeId, skuId, n)
  }

  function networkForecastWithModel(skuId, model) {
    const history  = [0, 0, 0, 0]
    const forecast = [0, 0, 0, 0]
    for (const store of STORES) {
      const w = weeklyMovement[store.id]?.[skuId] ?? [0, 0, 0, 0]
      w.forEach((v, i) => { history[i] += v })
      forecastWithModel(store.id, skuId, model, 4).forEach((v, i) => { forecast[i] += v })
    }
    return { history, forecast }
  }

  function stockoutDate(storeId, skuId) {
    const units = totalUnits(storeId, skuId)
    if (units === 0) return null
    const forecast = forecastWeeks(storeId, skuId, 8)
    let remaining = units
    for (let i = 0; i < forecast.length; i++) {
      remaining -= forecast[i]
      if (remaining <= 0) {
        const d = new Date()
        d.setDate(d.getDate() + (i + 1) * 7)
        return d
      }
    }
    return null
  }

  function smartReplenishment(storeId, skuId) {
    const sku             = SKUS.find(s => s.id === skuId)
    const forecast        = forecastWeeks(storeId, skuId, 6)
    const projectedDemand = forecast.reduce((a, b) => a + b, 0)
    const currentStock    = totalUnits(storeId, skuId)
    const needed          = Math.max(0, Math.ceil(projectedDemand - currentStock))
    const warehouseAvail  = totalUnits('warehouse', skuId)
    const canFulfil       = Math.min(needed, warehouseAvail)
    const sizeStock       = stock[storeId]?.[skuId] ?? {}
    const avgPerSize      = needed / SIZES.length
    const sizePlan = Object.fromEntries(
      SIZES.map(size => [size, Math.max(0, Math.round(avgPerSize - (sizeStock[size] ?? 0)))])
    )
    return {
      projectedDemand: Math.round(projectedDemand),
      needed, canFulfil,
      leadTimeDays: sku?.leadTimeDays ?? 10,
      sizePlan,
    }
  }

  function sizeCurveInsights(storeId, skuId) {
    const sizeStock   = stock[storeId]?.[skuId] ?? {}
    const totalSold   = (weeklyMovement[storeId]?.[skuId] ?? []).reduce((a, b) => a + b, 0)
    const currentTotal = Object.values(sizeStock).reduce((a, b) => a + b, 0)
    const initialTotal = currentTotal + totalSold
    const perSize      = initialTotal / SIZES.length
    return SIZES.map(size => {
      const current     = sizeStock[size] ?? 0
      const impliedSold = Math.max(0, perSize - current)
      const depletionPct = perSize > 0 ? Math.round((impliedSold / perSize) * 100) : 0
      return {
        size, current, depletionPct,
        signal: depletionPct >= 60 ? 'hot' : depletionPct >= 30 ? 'warm' : 'cold',
      }
    })
  }

  function smartTransfers() {
    const transfers = []
    for (const sku of SKUS) {
      const storeData = STORES.map(store => ({
        store,
        units:  totalUnits(store.id, sku.id),
        wos:    weeksOfSupply(store.id, sku.id),
        avg:    avgWeeklySales(store.id, sku.id),
        status: stockStatus(store.id, sku.id),
      }))
      const donors     = storeData.filter(s => s.wos !== null && s.wos > 6 && s.units >= 4)
      const recipients = storeData.filter(s => s.status === 'out' || s.status === 'critical' || (s.wos !== null && s.wos < 2))
      for (const r of recipients) {
        for (const d of donors) {
          if (d.store.id === r.store.id) continue
          const qty = Math.min(
            Math.max(0, d.units - Math.round(d.avg * 4)),
            Math.max(0, Math.round(r.avg * 4) - r.units),
            8
          )
          if (qty > 0) {
            transfers.push({
              skuId: sku.id, skuName: sku.name, colorway: sku.colorway,
              fromStore: d.store, toStore: r.store, qty,
              donorWoS: d.wos !== null ? Math.round(d.wos * 10) / 10 : null,
              recipientStatus: r.status,
              impact: r.status === 'out' ? 'Resolves stockout' : 'Prevents stockout',
            })
          }
        }
      }
    }
    const seen = new Map()
    for (const t of transfers) {
      const key = `${t.skuId}-${t.toStore.id}`
      if (!seen.has(key) || seen.get(key).qty < t.qty) seen.set(key, t)
    }
    const order = { out: 0, critical: 1, low: 2, ok: 3 }
    return [...seen.values()].sort((a, b) => (order[a.recipientStatus] ?? 3) - (order[b.recipientStatus] ?? 3))
  }

  function networkForecast(skuId) {
    const history  = [0, 0, 0, 0]
    const forecast = [0, 0, 0, 0]
    for (const store of STORES) {
      const w = weeklyMovement[store.id]?.[skuId] ?? [0, 0, 0, 0]
      w.forEach((v, i) => { history[i] += v })
      forecastWeeks(store.id, skuId, 4).forEach((v, i) => { forecast[i] += v })
    }
    return { history, forecast }
  }

  function trendingSkus() {
    return SKUS.map(sku => {
      let totalPrior = 0, totalRecent = 0
      for (const store of STORES) {
        const w = weeklyMovement[store.id]?.[sku.id] ?? [0, 0, 0, 0]
        totalPrior  += (w[0] + w[1]) / 2
        totalRecent += (w[2] + w[3]) / 2
      }
      const pct = totalPrior > 0 ? Math.round(((totalRecent - totalPrior) / totalPrior) * 100) : 0
      return { sku, pct, direction: pct >= 10 ? 'up' : pct <= -10 ? 'down' : 'flat', totalRecent }
    }).sort((a, b) => b.pct - a.pct)
  }

  // ── Aggregates ─────────────────────────────────────────────

  function buildAlerts() {
    const alerts = []
    for (const store of STORES) {
      for (const sku of SKUS) {
        const status = stockStatus(store.id, sku.id)
        if (status === 'ok') continue
        const wos = weeksOfSupply(store.id, sku.id)
        alerts.push({
          storeId:        store.id,
          storeName:      `${store.name}, ${store.city}`,
          skuId:          sku.id,
          skuName:        sku.name,
          status,
          units:          totalUnits(store.id, sku.id),
          wos:            wos !== null ? Math.round(wos * 10) / 10 : null,
          warehouseUnits: totalUnits('warehouse', sku.id),
          avg:            Math.round(avgWeeklySales(store.id, sku.id) * 10) / 10,
        })
      }
    }
    const order = { out: 0, critical: 1, low: 2 }
    return alerts.sort((a, b) => order[a.status] - order[b.status])
  }

  function networkTotalUnits() {
    let total = 0
    for (const store of STORES)
      for (const sku of SKUS)
        total += totalUnits(store.id, sku.id)
    return total
  }

  function networkAvgWoS() {
    let sum = 0, count = 0
    for (const store of STORES) {
      for (const sku of SKUS) {
        const wos = weeksOfSupply(store.id, sku.id)
        if (wos !== null) { sum += wos; count++ }
      }
    }
    return count > 0 ? Math.round((sum / count) * 10) / 10 : 0
  }

  return {
    // data references (so components don't need separate imports)
    SKUS, STORES, SIZES, stock, weeklyMovement,
    inboundSchedule, warehouseLocations,
    // functions
    totalUnits, avgWeeklySales, weeksOfSupply, reorderPoint,
    stockStatus, sellThrough,
    demandTrend, forecastWeeks, stockoutDate,
    wmaForecast, holtsForecast, crostonsForecast,
    forecastWithModel, networkForecastWithModel,
    smartReplenishment, sizeCurveInsights, smartTransfers,
    networkForecast, trendingSkus,
    buildAlerts, networkTotalUnits, networkAvgWoS,
  }
}

// ── Default static instance (used by DataContext before live data arrives) ────
export const defaultCalc = createCalc()
