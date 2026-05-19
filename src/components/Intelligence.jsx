import { useState } from 'react'
import { useCalc } from '../context/DataContext.jsx'

const WEEK_LABELS     = ['W-4', 'W-3', 'W-2', 'W-1']
const FORECAST_LABELS = ['W+1', 'W+2', 'W+3', 'W+4']

const MODELS = [
  { id: 'linear',  label: 'Linear Trend',  hint: 'Projects slope of last 4 weeks forward' },
  { id: 'wma',     label: 'WMA',           hint: 'Weighted moving average (recent weeks carry more weight)' },
  { id: 'holts',   label: "Holt's",        hint: 'Double exponential smoothing — best for growing/declining SKUs' },
  { id: 'croston', label: "Croston's",      hint: 'Separates demand frequency from quantity — best for edge sizes' },
]

function ForecastChart({ history, forecast }) {
  const all = [...history, ...forecast]
  const max = Math.max(...all, 1)
  return (
    <div className="forecast-chart">
      {history.map((v, i) => (
        <div key={`h${i}`} className="forecast-col">
          <div className="forecast-bar-wrap">
            <div className="forecast-bar history-bar" style={{ height: `${Math.round((v / max) * 100)}%` }} />
          </div>
          <span className="forecast-label">{WEEK_LABELS[i]}</span>
          <span className="forecast-val">{v}</span>
        </div>
      ))}
      <div className="forecast-divider" />
      {forecast.map((v, i) => (
        <div key={`f${i}`} className="forecast-col">
          <div className="forecast-bar-wrap">
            <div className="forecast-bar projected-bar" style={{ height: `${Math.round((v / max) * 100)}%` }} />
          </div>
          <span className="forecast-label forecast-label-future">{FORECAST_LABELS[i]}</span>
          <span className="forecast-val forecast-val-future">{v}</span>
        </div>
      ))}
    </div>
  )
}

function TrendChip({ direction, pct }) {
  if (direction === 'up')   return <span className="trend-chip trend-up">↑ {pct}%</span>
  if (direction === 'down') return <span className="trend-chip trend-down">↓ {Math.abs(pct)}%</span>
  return <span className="trend-chip trend-flat">→ Stable</span>
}

function SizeCurve({ items }) {
  return (
    <div className="size-curve">
      {items.map(({ size, current, depletionPct, signal }) => (
        <div key={size} className="size-curve-item">
          <span className="size-curve-size">{size}</span>
          <div className="size-curve-bar-bg">
            <div className={`size-curve-bar size-curve-${signal}`} style={{ width: `${depletionPct}%` }} />
          </div>
          <span className="size-curve-units">{current}u</span>
          <span className={`size-curve-signal signal-${signal}`}>{signal}</span>
        </div>
      ))}
    </div>
  )
}

export default function Intelligence() {
  const [model, setModel] = useState('linear')
  const {
    SKUS, STORES,
    trendingSkus, networkForecastWithModel, smartTransfers,
    smartReplenishment, stockoutDate, totalUnits, sizeCurveInsights,
  } = useCalc()

  const trending  = trendingSkus()
  const transfers = smartTransfers()
  const activeModel = MODELS.find(m => m.id === model)

  return (
    <div className="intelligence">
      <div className="intel-header">
        <div>
          <div className="intel-label">CI</div>
          <h1 className="intel-title">Comet Intelligence</h1>
          <p className="intel-sub">Demand sensing · Predictive replenishment · Transfer optimisation</p>
        </div>
        <div className="intel-badge">Powered by live Google Sheets data</div>
      </div>

      <div className="section">
        <h2 className="section-title">Demand Signals — Network</h2>
        <p className="section-hint">Compares last 2 weeks vs prior 2 weeks. Signals ≥15% change.</p>
        <div className="trend-signal-grid">
          {trending.map(({ sku, direction, pct, totalRecent }) => (
            <div key={sku.id} className={`trend-signal-card trend-signal-${direction}`}>
              <div className="trend-signal-top">
                <div>
                  <div className="trend-signal-name">{sku.name}</div>
                  <div className="trend-signal-color">{sku.colorway}</div>
                </div>
                <TrendChip direction={direction} pct={pct} />
              </div>
              <div className="trend-signal-bottom">
                <span className="trend-signal-stat">{totalRecent.toFixed(1)} units/wk network</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Network Demand Forecast</h2>
        <p className="section-hint">
          Historical (solid) + projected demand (dashed) across all {STORES.length} stores.
        </p>

        <div className="model-selector">
          {MODELS.map(m => (
            <button
              key={m.id}
              className={`model-btn ${model === m.id ? 'model-btn-active' : ''}`}
              onClick={() => setModel(m.id)}
              title={m.hint}
            >
              {m.label}
            </button>
          ))}
          <span className="model-hint">{activeModel?.hint}</span>
        </div>

        <div className="forecast-grid">
          {SKUS.map(sku => {
            const { history, forecast } = networkForecastWithModel(sku.id, model)
            const totalF = forecast.reduce((a, b) => a + b, 0)
            const totalH = history.reduce((a, b) => a + b, 0)
            const growthPct = totalH > 0 ? Math.round(((totalF - totalH) / totalH) * 100) : 0
            return (
              <div key={sku.id} className="forecast-card">
                <div className="forecast-card-header">
                  <div>
                    <div className="forecast-sku-name">{sku.name}</div>
                    <div className="forecast-sku-color">{sku.colorway}</div>
                  </div>
                  <div className="forecast-card-stats">
                    <span className="forecast-total">{totalF} projected</span>
                    <TrendChip direction={growthPct >= 10 ? 'up' : growthPct <= -10 ? 'down' : 'flat'} pct={growthPct} />
                  </div>
                </div>
                <ForecastChart history={history} forecast={forecast} />
              </div>
            )
          })}
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">
          Smart Transfer Engine
          {transfers.length > 0 && <span className="alert-count">{transfers.length}</span>}
        </h2>
        <p className="section-hint">Moves excess stock store-to-store — avoids warehouse round-trips.</p>
        {transfers.length === 0 ? (
          <p className="empty-state">No transfers needed. Network stock is balanced.</p>
        ) : (
          <div className="transfer-engine-list">
            {transfers.map((t, i) => (
              <div key={i} className="transfer-engine-card">
                <div className="transfer-engine-sku">
                  <strong>{t.skuName}</strong>
                  <span className="text-secondary"> · {t.colorway}</span>
                </div>
                <div className="transfer-engine-route">
                  <div className="transfer-node transfer-from">
                    <div className="transfer-node-name">{t.fromStore.name}</div>
                    <div className="transfer-node-city">{t.fromStore.city}</div>
                    <div className="transfer-node-wos">{t.donorWoS}w supply</div>
                  </div>
                  <div className="transfer-arrow">
                    <div className="transfer-qty">{t.qty} units</div>
                    <div className="transfer-arrow-line">→</div>
                    <div className="transfer-impact">{t.impact}</div>
                  </div>
                  <div className="transfer-node transfer-to">
                    <div className="transfer-node-name">{t.toStore.name}</div>
                    <div className="transfer-node-city">{t.toStore.city}</div>
                    <div className={`transfer-node-status badge badge-${t.recipientStatus}`}>
                      {t.recipientStatus === 'out' ? 'Out of Stock' : 'Critical'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">Predictive Replenishment</h2>
        <p className="section-hint">
          6-week projected demand vs current stock. Order quantity needed now to avoid stockout.
        </p>
        <div className="replenishment-grid">
          {STORES.flatMap(store =>
            SKUS.map(sku => {
              const rep       = smartReplenishment(store.id, sku.id)
              if (rep.needed === 0) return null
              const stockoutD = stockoutDate(store.id, sku.id)
              const stockoutStr = stockoutD
                ? stockoutD.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                : null

              let orderByStr = 'end of month'
              if (stockoutD) {
                const daysLeft  = Math.round((stockoutD - new Date()) / 86400000)
                const orderInDays = Math.max(1, daysLeft - rep.leadTimeDays)
                const orderDate = new Date()
                orderDate.setDate(orderDate.getDate() + orderInDays)
                orderByStr = orderDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              }

              return (
                <div key={`${store.id}-${sku.id}`} className="replenish-card">
                  <div className="replenish-header">
                    <div>
                      <div className="replenish-sku">{sku.name}</div>
                      <div className="replenish-store">{store.name}, {store.city}</div>
                    </div>
                    {stockoutStr && (
                      <div className="stockout-countdown">
                        <span className="stockout-label">Stockout by</span>
                        <span className="stockout-date">{stockoutStr}</span>
                      </div>
                    )}
                  </div>
                  <div className="replenish-stats">
                    <div className="replenish-stat">
                      <span className="replenish-num">{rep.projectedDemand}</span>
                      <span className="replenish-label">6-wk demand</span>
                    </div>
                    <div className="replenish-stat">
                      <span className="replenish-num">{totalUnits(store.id, sku.id)}</span>
                      <span className="replenish-label">on hand</span>
                    </div>
                    <div className="replenish-stat highlight">
                      <span className="replenish-num">{rep.needed}</span>
                      <span className="replenish-label">order now</span>
                    </div>
                    <div className="replenish-stat">
                      <span className={`replenish-num ${rep.canFulfil < rep.needed ? 'text-red' : 'text-green'}`}>
                        {rep.canFulfil}
                      </span>
                      <span className="replenish-label">warehouse avail</span>
                    </div>
                  </div>
                  <div className="replenish-lead">
                    Lead time: {rep.leadTimeDays} days · Order by {orderByStr}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Size Curve Intelligence</h2>
        <p className="section-hint">
          Hot = depleting fast. Cold = barely moving. Use to right-size replenishment orders.
        </p>
        <div className="size-curve-grid">
          {STORES.map(store => (
            <div key={store.id} className="size-curve-store-card">
              <div className="size-curve-store-name">{store.name}</div>
              <div className="size-curve-store-city">{store.city}</div>
              {SKUS.map(sku => (
                <div key={sku.id} className="size-curve-sku-block">
                  <div className="size-curve-sku-label">{sku.name}</div>
                  <SizeCurve items={sizeCurveInsights(store.id, sku.id)} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
