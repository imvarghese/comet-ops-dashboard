import { useState, useMemo } from 'react'
import { useCalc } from '../context/DataContext.jsx'

function utilClass(pct) {
  if (pct === 0)  return 'bin-empty'
  if (pct < 25)   return 'bin-low'
  if (pct < 60)   return 'bin-mid'
  if (pct < 85)   return 'bin-high'
  return 'bin-full'
}

const ZONE_SKU_LABEL = {
  A: 'Madagascar',
  B: 'Mango Chilli · Chestnut',
  C: 'Neptune',
  D: 'Saffron',
}

export default function HoldingView() {
  const { warehouseLocations } = useCalc()
  const [selectedBin, setSelectedBin] = useState(null)
  const [activeZone, setActiveZone]   = useState('All')

  const zones = useMemo(() => {
    const map = {}
    for (const r of warehouseLocations) {
      const { zone, location_code, sku_id, sku_name, size, units, capacity, level, aisle, bay } = r
      if (!map[zone]) map[zone] = { zone, bins: {}, totalUnits: 0, totalCap: 0 }
      if (!map[zone].bins[location_code]) {
        map[zone].bins[location_code] = {
          code: location_code, zone, aisle, bay, level,
          items: [], units: 0, capacity: Number(capacity) || 40,
        }
      }
      const b = map[zone].bins[location_code]
      b.items.push({ sku_id, sku_name, size, units: Number(units) || 0 })
      b.units              += Number(units) || 0
      map[zone].totalUnits += Number(units) || 0
      map[zone].totalCap   += Number(capacity) || 40
    }
    for (const z of Object.values(map)) {
      for (const b of Object.values(z.bins)) {
        b.utilPct = b.capacity > 0 ? Math.round((b.units / b.capacity) * 100) : 0
      }
      z.bins    = Object.values(z.bins).sort((a, b) => a.code.localeCompare(b.code))
      z.utilPct = z.totalCap > 0 ? Math.round((z.totalUnits / z.totalCap) * 100) : 0
    }
    return Object.values(map).sort((a, b) => a.zone.localeCompare(b.zone))
  }, [warehouseLocations])

  const totalUnitsAll = zones.reduce((s, z) => s + z.totalUnits, 0)
  const totalCapAll   = zones.reduce((s, z) => s + z.totalCap, 0)
  const overallUtil   = totalCapAll > 0 ? Math.round((totalUnitsAll / totalCapAll) * 100) : 0
  const displayZones  = activeZone === 'All' ? zones : zones.filter(z => z.zone === activeZone)

  return (
    <div className="holding-view">
      <div className="inverting-header">
        <div>
          <h1 className="store-view-title">Holding</h1>
          <p className="store-view-sub">WH-BLR-MAIN · Bangalore Central · Bin-level stock visibility</p>
        </div>
        <div className="inverting-kpis">
          <div className="kpi-mini">
            <span className="kpi-mini-val">{totalUnitsAll.toLocaleString('en-IN')}</span>
            <span className="kpi-mini-label">Total Units</span>
          </div>
          <div className="kpi-mini">
            <span className={`kpi-mini-val ${overallUtil > 80 ? 'kpi-red' : overallUtil > 55 ? 'kpi-amber' : 'kpi-green'}`}>
              {overallUtil}%
            </span>
            <span className="kpi-mini-label">Utilisation</span>
          </div>
          <div className="kpi-mini">
            <span className="kpi-mini-val">{zones.reduce((s, z) => s + z.bins.length, 0)}</span>
            <span className="kpi-mini-label">Bin Locations</span>
          </div>
        </div>
      </div>

      {warehouseLocations.length === 0 ? (
        <p className="empty-state" style={{ marginTop: 48 }}>
          No bin location data. Connect Google Sheets to see the warehouse grid.
        </p>
      ) : (
        <>
          <div className="status-tabs">
            {['All', ...zones.map(z => z.zone)].map(z => (
              <button
                key={z}
                className={`status-tab ${activeZone === z ? 'status-tab-active' : ''}`}
                onClick={() => { setActiveZone(z); setSelectedBin(null) }}
              >
                {z === 'All' ? 'All Zones' : `Zone ${z}`}
                {z !== 'All' && (
                  <span className="tab-count">{zones.find(x => x.zone === z)?.bins.length}</span>
                )}
              </button>
            ))}
          </div>

          <p className="section-hint" style={{ marginBottom: 16 }}>
            <span className="legend-bin bin-empty-swatch">■</span> Empty &nbsp;
            <span className="legend-bin bin-low-swatch">■</span> &lt;25% &nbsp;
            <span className="legend-bin bin-mid-swatch">■</span> 25–60% &nbsp;
            <span className="legend-bin bin-high-swatch">■</span> 60–85% &nbsp;
            <span className="legend-bin bin-full-swatch">■</span> 85%+ &nbsp;·&nbsp; Click a bin for detail
          </p>

          <div className="zone-grid">
            {displayZones.map(zone => (
              <div key={zone.zone} className="zone-section">
                <div className="zone-header">
                  <div>
                    <span className="zone-label">Zone {zone.zone}</span>
                    <span className="zone-sub"> · {ZONE_SKU_LABEL[zone.zone] ?? ''}</span>
                  </div>
                  <div className="zone-stats">
                    <span>{zone.totalUnits} units</span>
                    <span className={`zone-util-badge ${zone.utilPct > 80 ? 'util-high' : zone.utilPct > 55 ? 'util-mid' : 'util-ok'}`}>
                      {zone.utilPct}% full
                    </span>
                  </div>
                </div>

                <div className="bin-grid">
                  {zone.bins.map(bin => (
                    <div
                      key={bin.code}
                      className={`bin-cell ${utilClass(bin.utilPct)} ${selectedBin?.code === bin.code ? 'bin-selected' : ''}`}
                      onClick={() => setSelectedBin(selectedBin?.code === bin.code ? null : bin)}
                      title={`${bin.code} · ${bin.units}/${bin.capacity} units · ${bin.utilPct}%`}
                    >
                      <span className="bin-code">{bin.code}</span>
                      <span className="bin-pct">{bin.utilPct}%</span>
                    </div>
                  ))}
                </div>

                {selectedBin && zone.bins.some(b => b.code === selectedBin.code) && (
                  <div className="bin-detail-panel">
                    <div className="bin-detail-header">
                      <strong>{selectedBin.code}</strong>
                      <span className="text-secondary">
                        {' '}· Level {selectedBin.level} · Aisle {selectedBin.aisle} · Bay {selectedBin.bay}
                      </span>
                      <span className={`zone-util-badge ${selectedBin.utilPct > 80 ? 'util-high' : selectedBin.utilPct > 55 ? 'util-mid' : 'util-ok'}`} style={{ marginLeft: 8 }}>
                        {selectedBin.units}/{selectedBin.capacity} units · {selectedBin.utilPct}%
                      </span>
                    </div>
                    <div className="bin-items">
                      {selectedBin.items.map((item, i) => (
                        <div key={i} className="bin-item">
                          <span className="bin-item-sku">{item.sku_name}</span>
                          <span className="bin-item-size">{item.size}</span>
                          <span className="bin-item-units">{item.units} units</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
