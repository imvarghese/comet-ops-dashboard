import React, { useState } from 'react'
import { useCalc } from '../context/DataContext.jsx'

const STATUS_LABEL = { out: 'Out of Stock', critical: 'Critical', low: 'Reorder', ok: 'Healthy' }
const STATUS_CLASS = { out: 'badge-out', critical: 'badge-critical', low: 'badge-low', ok: 'badge-ok' }

function SizeCell({ units }) {
  const cls = units === 0 ? 'size-cell-out' : units <= 2 ? 'size-cell-low' : 'size-cell-ok'
  return <td className={`size-cell ${cls}`}>{units}</td>
}

function TrendBars({ weeks }) {
  const max = Math.max(...weeks, 1)
  return (
    <div className="trend-bars">
      {weeks.map((v, i) => (
        <div key={i} className="trend-bar-col">
          <div className="trend-bar" style={{ height: `${Math.round((v / max) * 100)}%` }} />
          <span className="trend-bar-label">{v}</span>
        </div>
      ))}
    </div>
  )
}

export default function StoreView({ storeId, onChangeStore }) {
  const [expandedSku, setExpandedSku] = useState(null)
  const {
    STORES, SKUS, SIZES, stock, weeklyMovement,
    totalUnits, avgWeeklySales, weeksOfSupply, stockStatus, sellThrough, reorderPoint,
  } = useCalc()

  const store = STORES.find(s => s.id === storeId) ?? STORES[0]

  return (
    <div className="store-view">
      <div className="store-view-header">
        <div>
          <h1 className="store-view-title">{store.name}</h1>
          <p className="store-view-sub">{store.city}{store.manager ? ` · Manager: ${store.manager}` : ''}</p>
        </div>
        <div className="store-selector">
          {STORES.map(s => (
            <button
              key={s.id}
              className={`store-tab ${s.id === storeId ? 'store-tab-active' : ''}`}
              onClick={() => onChangeStore(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Inventory by SKU</h2>
        <p className="section-hint">
          Sizes: <span className="legend-out">■</span> Out &nbsp;
          <span className="legend-low">■</span> Low (1–2) &nbsp;
          <span className="legend-ok">■</span> Healthy (3+) &nbsp;·&nbsp; Click a row to expand
        </p>
        <div className="table-wrap">
          <table className="data-table sku-table">
            <thead>
              <tr>
                <th>SKU</th>
                {SIZES.map(s => <th key={s}>{s}</th>)}
                <th>Total</th>
                <th>Avg/wk</th>
                <th>WoS</th>
                <th>ST%</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {SKUS.map(sku => {
                const sizeStock = stock[storeId]?.[sku.id] ?? {}
                const units     = totalUnits(storeId, sku.id)
                const avg       = avgWeeklySales(storeId, sku.id)
                const wos       = weeksOfSupply(storeId, sku.id)
                const st        = sellThrough(storeId, sku.id)
                const status    = stockStatus(storeId, sku.id)
                const rp        = reorderPoint(storeId, sku.id)
                const weeks     = weeklyMovement[storeId]?.[sku.id] ?? [0, 0, 0, 0]
                const expanded  = expandedSku === sku.id

                return (
                  <React.Fragment key={sku.id}>
                    <tr
                      className={`sku-row sku-row-${status} ${expanded ? 'sku-row-expanded' : ''}`}
                      onClick={() => setExpandedSku(expanded ? null : sku.id)}
                    >
                      <td className="sku-name-cell">
                        <div className="sku-cell-name">{sku.name}</div>
                        <div className="sku-cell-color">{sku.colorway}</div>
                      </td>
                      {SIZES.map(size => <SizeCell key={size} units={sizeStock[size] ?? 0} />)}
                      <td className="bold">{units}</td>
                      <td>{avg.toFixed(1)}</td>
                      <td className={wos !== null && wos < 1.5 ? 'text-red bold' : ''}>
                        {wos !== null ? `${wos.toFixed(1)}w` : '—'}
                      </td>
                      <td>
                        <div className="st-bar-wrap">
                          <div className="st-bar" style={{ width: `${st}%` }} />
                          <span className="st-label">{st}%</span>
                        </div>
                      </td>
                      <td><span className={`badge ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span></td>
                    </tr>
                    {expanded && (
                      <tr className="sku-detail-row">
                        <td colSpan={SIZES.length + 6}>
                          <div className="sku-detail">
                            <div className="sku-detail-section">
                              <div className="sku-detail-label">4-Week Sales Trend</div>
                              <TrendBars weeks={weeks} />
                            </div>
                            <div className="sku-detail-section">
                              <div className="sku-detail-label">Reorder Point</div>
                              <div className="sku-detail-value">{rp.toFixed(0)} units</div>
                              <div className="sku-detail-hint">
                                {avg.toFixed(1)}/wk avg · {sku.leadTimeDays}d lead time · 1w safety stock
                              </div>
                            </div>
                            <div className="sku-detail-section">
                              <div className="sku-detail-label">RRP</div>
                              <div className="sku-detail-value">₹{sku.rrp.toLocaleString('en-IN')}</div>
                            </div>
                            <div className="sku-detail-section">
                              <div className="sku-detail-label">Stock Value</div>
                              <div className="sku-detail-value">₹{(units * sku.rrp).toLocaleString('en-IN')}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
