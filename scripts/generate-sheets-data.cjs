#!/usr/bin/env node
// Run: node scripts/generate-sheets-data.js
// Generates 6 CSVs in sheets-data/ for import into Google Sheets

const fs   = require('fs')
const path = require('path')

const OUT_DIR = path.join(__dirname, '..', 'sheets-data')
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

// ── Reference data ────────────────────────────────────────────────────────────

const STORES = [
  { id: 'indiranagar',   name: 'Indiranagar',    city: 'Bangalore', type: 'Flagship', fc: 'FC-BLR-01', sqft: 1200 },
  { id: 'vasant-vihar',  name: 'Vasant Vihar',   city: 'New Delhi', type: 'Flagship', fc: 'FC-DEL-01', sqft: 900  },
  { id: 'navrangpura',   name: 'Navrangpura',    city: 'Ahmedabad', type: 'Standard', fc: 'FC-AMD-01', sqft: 750  },
  { id: 'lakeshore',     name: 'Lakeshore Mall', city: 'Hyderabad', type: 'Mall',     fc: 'FC-HYD-01', sqft: 600  },
  { id: 'sarath-city',   name: 'Sarath City',    city: 'Hyderabad', type: 'Mall',     fc: 'FC-HYD-02', sqft: 600  },
]

const SKUS = [
  { id: 'madagascar',   name: 'Madagascar',   colorway: 'Forest Green / Cream', rrp: 8999, lead_days: 10, launch: '2026-01-15', stage: 'growth'   },
  { id: 'mango-chilli', name: 'Mango Chilli', colorway: 'Burnt Orange / Red',   rrp: 7999, lead_days: 10, launch: '2025-11-01', stage: 'mature'   },
  { id: 'chestnut',     name: 'Chestnut',     colorway: 'Brown / Tan',          rrp: 8499, lead_days: 14, launch: '2025-09-01', stage: 'mature'   },
  { id: 'neptune',      name: 'Neptune',      colorway: 'Navy / Off-White',     rrp: 9499, lead_days: 12, launch: '2025-08-01', stage: 'declining'},
  { id: 'saffron',      name: 'Saffron',      colorway: 'Turmeric / White',     rrp: 8999, lead_days: 10, launch: '2026-03-15', stage: 'launch'   },
]

const SIZES = ['UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11']

// Indian men's footwear size curve: UK8–UK9 are volume sizes
const SIZE_WEIGHT = { UK6: 0.07, UK7: 0.15, UK8: 0.28, UK9: 0.26, UK10: 0.15, UK11: 0.09 }

// Peak weekly demand per store per SKU (units/week at full velocity)
const BASE_DEMAND = {
  'indiranagar':  { 'madagascar': 7, 'mango-chilli': 5, 'chestnut': 4, 'neptune': 6, 'saffron': 5 },
  'vasant-vihar': { 'madagascar': 5, 'mango-chilli': 4, 'chestnut': 4, 'neptune': 4, 'saffron': 3 },
  'navrangpura':  { 'madagascar': 3, 'mango-chilli': 3, 'chestnut': 3, 'neptune': 3, 'saffron': 2 },
  'lakeshore':    { 'madagascar': 4, 'mango-chilli': 3, 'chestnut': 3, 'neptune': 3, 'saffron': 3 },
  'sarath-city':  { 'madagascar': 4, 'mango-chilli': 4, 'chestnut': 3, 'neptune': 3, 'saffron': 3 },
}

// Warehouse initial stock per SKU per size multiplier
const WH_BASE = { 'madagascar': 18, 'mango-chilli': 14, 'chestnut': 12, 'neptune': 20, 'saffron': 25 }

// ── Utilities ─────────────────────────────────────────────────────────────────

// Deterministic seeded RNG (LCG) — same script run always produces same data
function makeRng(seed) {
  let s = seed >>> 0
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0
    return s / 0xffffffff
  }
}
const rng = makeRng(42)

function jitter(base, spread = 0.2) {
  return Math.max(0, Math.round(base * (1 - spread + rng() * spread * 2)))
}

function addDays(base, days) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const TODAY = '2026-05-19'

// Week N ending date (week 1 = 12 weeks ago, week 12 = 1 week ago)
function weekEnd(n) { return addDays(TODAY, -(13 - n) * 7) }

// SKU lifecycle demand multiplier for week N (weeks 1–12)
function lifecycle(skuId, n) {
  switch (skuId) {
    case 'madagascar':   return 0.55 + (n / 12) * 0.80              // growing launch
    case 'mango-chilli': return 1.10 - (n / 12) * 0.20              // gentle decline
    case 'chestnut':     return 0.95 + Math.sin(n * 0.6) * 0.12     // plateau with wobble
    case 'neptune':      return 1.15 - (n / 12) * 0.70              // clear decline
    case 'saffron':      return n < 7 ? 0.12 : 0.12 + ((n - 7) / 5) * 2.0  // slow then launch spike
    default:             return 1.0
  }
}

// CSV helpers
function esc(v) { return `"${String(v === null || v === undefined ? '' : v).replace(/"/g, '""')}"` }
function csvRow(...cols) { return cols.map(esc).join(',') }
function csv(header, rows) { return [header, ...rows].join('\n') }

// ── Sheet 1: sku_master ───────────────────────────────────────────────────────

function genSkuMaster() {
  const H = 'sku_id,name,colorway,rrp,lead_time_days,launch_date,lifecycle_stage'
  return csv(H, SKUS.map(s =>
    csvRow(s.id, s.name, s.colorway, s.rrp, s.lead_days, s.launch, s.stage)
  ))
}

// ── Sheet 2: store_master ─────────────────────────────────────────────────────

function genStoreMaster() {
  const H = 'store_id,name,city,store_type,fulfillment_center,capacity_sqft'
  const rows = [
    ...STORES.map(s => csvRow(s.id, s.name, s.city, s.type, s.fc, s.sqft)),
    csvRow('warehouse', 'Central Warehouse', 'Bangalore', 'Warehouse', 'WH-BLR-MAIN', 15000),
  ]
  return csv(H, rows)
}

// ── Sheet 3: weekly_movement ──────────────────────────────────────────────────
// 12 weeks × 5 stores × 5 SKUs × 6 sizes = 1,800 rows

function genWeeklyMovement() {
  const H = 'week_number,week_ending,store_id,store_name,sku_id,sku_name,size,units_sold'
  const rows = []
  for (let w = 1; w <= 12; w++) {
    for (const store of STORES) {
      for (const sku of SKUS) {
        const weeklyTotal = jitter(BASE_DEMAND[store.id][sku.id] * lifecycle(sku.id, w), 0.2)
        for (const size of SIZES) {
          // Intermittent demand for edge sizes — some weeks they genuinely sell 0
          const expected = weeklyTotal * SIZE_WEIGHT[size]
          let units
          if (expected < 0.5) {
            units = rng() < expected ? 1 : 0   // Croston-like: binary for very slow sizes
          } else {
            units = jitter(expected, 0.3)
          }
          rows.push(csvRow(w, weekEnd(w), store.id, store.name, sku.id, sku.name, size, units))
        }
      }
    }
  }
  return csv(H, rows)
}

// ── Sheet 4: stock_levels ─────────────────────────────────────────────────────
// Simulate 12 weeks of sales from initial stock, then snapshot the current state
// Includes a replenishment every ~3 weeks to keep stock realistic

function genStockLevels() {
  const H = 'snapshot_date,store_id,store_name,sku_id,sku_name,size,units_on_hand,reorder_point,days_on_hand,stock_value_inr'
  const rows = []

  // Build stock object
  const stock = {}

  // Initialise store stock (generous opening stock 3–4 weeks of supply)
  for (const store of STORES) {
    stock[store.id] = {}
    for (const sku of SKUS) {
      stock[store.id][sku.id] = {}
      for (const size of SIZES) {
        const base = BASE_DEMAND[store.id][sku.id] * SIZE_WEIGHT[size] * 4
        stock[store.id][sku.id][size] = Math.max(1, jitter(base, 0.3))
      }
    }
  }

  // Initialise warehouse stock
  stock['warehouse'] = {}
  for (const sku of SKUS) {
    stock['warehouse'][sku.id] = {}
    for (const size of SIZES) {
      stock['warehouse'][sku.id][size] = jitter(WH_BASE[sku.id] * SIZE_WEIGHT[size], 0.25)
    }
  }

  // Simulate 12 weeks
  for (let w = 1; w <= 12; w++) {
    for (const store of STORES) {
      for (const sku of SKUS) {
        const weeklyTotal = jitter(BASE_DEMAND[store.id][sku.id] * lifecycle(sku.id, w), 0.2)
        for (const size of SIZES) {
          const sold = Math.min(
            stock[store.id][sku.id][size],
            Math.round(weeklyTotal * SIZE_WEIGHT[size] * (0.8 + rng() * 0.4))
          )
          stock[store.id][sku.id][size] = Math.max(0, stock[store.id][sku.id][size] - sold)
        }

        // Replenish from warehouse every ~3 weeks if stock is low
        if (w % 3 === 0) {
          const storeTotal = Object.values(stock[store.id][sku.id]).reduce((a, b) => a + b, 0)
          const weekDemand  = BASE_DEMAND[store.id][sku.id] * lifecycle(sku.id, w)
          if (storeTotal < weekDemand * 2) {
            for (const size of SIZES) {
              const replenish = jitter(weekDemand * SIZE_WEIGHT[size] * 3, 0.2)
              const available = stock['warehouse'][sku.id][size]
              const moved     = Math.min(replenish, available)
              stock[store.id][sku.id][size]  += moved
              stock['warehouse'][sku.id][size] -= moved
            }
          }
        }
      }
    }
  }

  // Write current snapshot
  const snap = weekEnd(12)
  const allStores = [...STORES, { id: 'warehouse', name: 'Central Warehouse' }]

  for (const store of allStores) {
    for (const sku of SKUS) {
      for (const size of SIZES) {
        const units   = stock[store.id]?.[sku.id]?.[size] ?? 0
        const avgWkly = store.id !== 'warehouse'
          ? BASE_DEMAND[store.id][sku.id] * lifecycle(sku.id, 12) * SIZE_WEIGHT[size]
          : 0
        const doh  = avgWkly > 0 ? Math.round((units / avgWkly) * 7) : null
        const rp   = avgWkly > 0 ? Math.round(avgWkly * (sku.lead_days / 7 + 1)) : 0
        const val  = units * sku.rrp
        const sku_ = SKUS.find(s => s.id === sku.id)
        rows.push(csvRow(snap, store.id, store.name, sku.id, sku.name, size, units, rp, doh ?? '', val))
      }
    }
  }

  return csv(H, rows)
}

// ── Sheet 5: inbound_schedule ─────────────────────────────────────────────────

function genInboundSchedule() {
  const H = 'po_number,vendor_name,vendor_country,sku_id,sku_name,size,quantity_ordered,order_date,eta_date,actual_arrival,destination,status,notes'
  const rows = []

  const VENDORS = [
    { name: 'Foshan Athletic Mfg Co.',   country: 'China'     },
    { name: 'Binh Duong Footwear Ltd.',  country: 'Vietnam'   },
    { name: 'PT Jakarta Sole Works',     country: 'Indonesia' },
    { name: 'Artcraft Leather Goods',    country: 'India'     },
  ]

  // PO templates: [orderDaysAgo, etaDaysFromNow, status, notes]
  const PO_TEMPLATES = [
    [-42, -14, 'Delivered',  ''],
    [-35, -7,  'Delivered',  ''],
    [-28, -3,  'Delivered',  ''],
    [-14,  4,  'At Port',    'Awaiting unloading slot — JNPT'],
    [-12,  6,  'In Transit', 'Flight EK-512, departs Dubai 21 May'],
    [-10,  8,  'In Transit', 'Customs clearance in progress'],
    [ -5, 12,  'Confirmed',  'Production complete, awaiting dispatch'],
    [  0, 16,  'Confirmed',  ''],
    [  3, 21,  'Confirmed',  ''],
    [  7, 28,  'Confirmed',  'Bulk order for Delhi + Ahmedabad restock'],
  ]

  let poNum = 1001
  for (const tpl of PO_TEMPLATES) {
    const [orderOffset, etaOffset, status, notes] = tpl
    // Each PO covers 2–4 SKUs
    const skuSubset = SKUS.filter(() => rng() > 0.4)
    if (skuSubset.length === 0) skuSubset.push(SKUS[Math.floor(rng() * SKUS.length)])

    for (const sku of skuSubset) {
      const vendor  = VENDORS[Math.floor(rng() * VENDORS.length)]
      const po      = `PO-2026-${poNum++}`
      const orderDt = addDays(TODAY, orderOffset - 7)
      const etaDt   = addDays(TODAY, etaOffset)
      const arrival = status === 'Delivered' ? addDays(TODAY, etaOffset) : ''
      const dest    = status === 'Delivered' ? 'WH-BLR-MAIN' : 'WH-BLR-MAIN'

      for (const size of SIZES) {
        const qty = Math.max(1, jitter(30 * SIZE_WEIGHT[size], 0.3))
        rows.push(csvRow(po, vendor.name, vendor.country, sku.id, sku.name, size, qty, orderDt, etaDt, arrival, dest, status, notes))
      }
    }
  }

  return csv(H, rows)
}

// ── Sheet 6: warehouse_locations ─────────────────────────────────────────────

function genWarehouseLocations() {
  const H = 'zone,aisle,bay,level,location_code,sku_id,sku_name,size,units,capacity,utilisation_pct,last_updated'

  // Warehouse layout: 4 zones, each zone dedicated to a SKU family
  const SKU_ZONE = {
    'madagascar':   'A',
    'mango-chilli': 'B',
    'chestnut':     'B',
    'neptune':      'C',
    'saffron':      'D',
  }
  const LEVELS = ['G', 'M', 'T']  // Ground · Middle · Top
  const CAPACITY_PER_BIN = 40     // units per bin

  const rows = []
  const today = TODAY

  let aisleCounter = {}
  for (const zone of ['A', 'B', 'C', 'D']) aisleCounter[zone] = 1

  for (const sku of SKUS) {
    const zone = SKU_ZONE[sku.id]
    for (const size of SIZES) {
      const aisle = String(aisleCounter[zone]).padStart(2, '0')
      const bay   = String(Math.ceil(aisleCounter[zone] / 3)).padStart(2, '0')
      const level = LEVELS[Math.floor(rng() * LEVELS.length)]
      const code  = `${zone}${aisle}-${bay}-${level}`
      const units = jitter(WH_BASE[sku.id] * SIZE_WEIGHT[size], 0.25)
      const util  = Math.min(100, Math.round((units / CAPACITY_PER_BIN) * 100))
      rows.push(csvRow(zone, aisle, bay, level, code, sku.id, sku.name, size, units, CAPACITY_PER_BIN, util, today))
      aisleCounter[zone]++
    }
  }

  return csv(H, rows)
}

// ── Write all files ───────────────────────────────────────────────────────────

const SHEETS = {
  'sku_master.csv':          genSkuMaster(),
  'store_master.csv':        genStoreMaster(),
  'weekly_movement.csv':     genWeeklyMovement(),
  'stock_levels.csv':        genStockLevels(),
  'inbound_schedule.csv':    genInboundSchedule(),
  'warehouse_locations.csv': genWarehouseLocations(),
}

console.log('\n Generating Comet Inventory — Google Sheets Data\n')
for (const [file, content] of Object.entries(SHEETS)) {
  const filepath = path.join(OUT_DIR, file)
  fs.writeFileSync(filepath, content, 'utf8')
  const rows = content.split('\n').length - 1
  console.log(`  ✓  ${file.padEnd(30)} ${String(rows).padStart(4)} rows`)
}

console.log(`\n  Output: ${OUT_DIR}\n`)
console.log('─'.repeat(56))
console.log(' Next steps\n')
console.log('  1. Go to sheets.google.com → create a new spreadsheet')
console.log('  2. For each CSV below, add a new tab and import it:')
console.log('     File → Import → Upload → Insert new sheet(s)')
console.log('     Name each tab exactly as shown (without .csv):')
Object.keys(SHEETS).forEach(f => console.log(`       · ${f.replace('.csv', '')}`))
console.log('  3. Share → Anyone with the link → Viewer')
console.log('  4. Copy the spreadsheet ID from the URL:')
console.log('     https://docs.google.com/spreadsheets/d/[THIS PART]/edit')
console.log('  5. Paste the ID here and we\'ll wire up the app\n')
