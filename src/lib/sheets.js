// Sheet IDs — one spreadsheet per dataset
const IDS = {
  sku_master:          '1Bku9tR9WVdMlRawCDJlfFQV8n0Hb2cSHIFzThXA18Sg',
  store_master:        '1-1R--rZX_b2u_GZPFzlnID1RepwAcclv7n0ADmx6NTM',
  weekly_movement:     '1ND0tNmMoWfxxwniSljOETv5CERHzPQ_KrWDIYqdxV7g',
  stock_levels:        '1GaizYNpCkZ7IKFQRP-7b_G7V_Qog3MN10TiEy_zNm5c',
  inbound_schedule:    '16aF5pgrY9iAgX8ufQYgZjH4hey8UQYK1d80pl0H0WnU',
  warehouse_locations: '1wbwfblOTuZCvQkascim35dRirdqCopRmknnUKTX74CI',
}

function sheetURL(id) {
  // gviz endpoint is CORS-friendly for public sheets
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`
}

async function fetchCSV(id) {
  const res = await fetch(sheetURL(id))
  if (!res.ok) throw new Error(`Sheet fetch failed (${res.status})`)
  return res.text()
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseLine(line) {
  const values = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (c === ',' && !inQ) {
      values.push(cur); cur = ''
    } else {
      cur += c
    }
  }
  values.push(cur)
  return values
}

function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = parseLine(lines[0]).map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = parseLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]))
  })
}

// ── Data transformers ─────────────────────────────────────────────────────────

function toSkus(rows) {
  return rows.map(r => ({
    id:           r.sku_id,
    name:         r.name,
    colorway:     r.colorway,
    rrp:          Number(r.rrp) || 0,
    leadTimeDays: Number(r.lead_time_days) || 10,
    stage:        r.lifecycle_stage,
  }))
}

function toStores(rows) {
  return rows
    .filter(r => r.store_type !== 'Warehouse')
    .map(r => ({
      id:   r.store_id,
      name: r.name,
      city: r.city,
    }))
}

// stock_levels rows → { storeId: { skuId: { 'UK8': 4, ... } } }
function toStock(rows) {
  const stock = {}
  for (const r of rows) {
    const { store_id, sku_id, size, units_on_hand } = r
    if (!stock[store_id]) stock[store_id] = {}
    if (!stock[store_id][sku_id]) stock[store_id][sku_id] = {}
    stock[store_id][sku_id][size] = Number(units_on_hand) || 0
  }
  return stock
}

// weekly_movement rows → { storeId: { skuId: [wk9, wk10, wk11, wk12] } }
// Sums across all sizes per week, keeps last 4 weeks
function toWeeklyMovement(rows) {
  const agg = {}
  for (const r of rows) {
    const { store_id, sku_id, week_number, units_sold } = r
    if (!agg[store_id]) agg[store_id] = {}
    if (!agg[store_id][sku_id]) agg[store_id][sku_id] = {}
    const w = Number(week_number)
    agg[store_id][sku_id][w] = (agg[store_id][sku_id][w] || 0) + (Number(units_sold) || 0)
  }
  const result = {}
  for (const [sid, skus] of Object.entries(agg)) {
    result[sid] = {}
    for (const [skuId, wks] of Object.entries(skus)) {
      const max = Math.max(...Object.keys(wks).map(Number))
      result[sid][skuId] = [
        wks[max - 3] || 0,
        wks[max - 2] || 0,
        wks[max - 1] || 0,
        wks[max]     || 0,
      ]
    }
  }
  return result
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchAllSheets() {
  const [skuRows, storeRows, movRows, stockRows, inboundRows, locRows] = await Promise.all([
    fetchCSV(IDS.sku_master).then(parseCSV),
    fetchCSV(IDS.store_master).then(parseCSV),
    fetchCSV(IDS.weekly_movement).then(parseCSV),
    fetchCSV(IDS.stock_levels).then(parseCSV),
    fetchCSV(IDS.inbound_schedule).then(parseCSV),
    fetchCSV(IDS.warehouse_locations).then(parseCSV),
  ])

  return {
    skus:               toSkus(skuRows),
    stores:             toStores(storeRows),
    stock:              toStock(stockRows),
    weeklyMovement:     toWeeklyMovement(movRows),
    inboundSchedule:    inboundRows,
    warehouseLocations: locRows,
  }
}
