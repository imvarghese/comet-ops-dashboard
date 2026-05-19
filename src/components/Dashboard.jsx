import { useCalc } from '../context/DataContext.jsx'

const STATUS_LABEL = { out: 'Out of Stock', critical: 'Critical', low: 'Reorder', ok: 'Healthy' }
const STATUS_CLASS = { out: 'badge-out', critical: 'badge-critical', low: 'badge-low', ok: 'badge-ok' }

export default function Dashboard({ onSelectStore }) {
  const {
    SKUS, STORES,
    buildAlerts, networkTotalUnits, networkAvgWoS,
    totalUnits, stockStatus, sellThrough, avgWeeklySales,
  } = useCalc()

  const alerts      = buildAlerts()
  const totalUnitsAll = networkTotalUnits()
  const avgWoS      = networkAvgWoS()

  return (
    <div className="dashboard">
      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-label">Network Stock</span>
          <span className="kpi-value">{totalUnitsAll}</span>
          <span className="kpi-sub">units across {STORES.length} stores</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Active Alerts</span>
          <span className={`kpi-value ${alerts.length > 0 ? 'kpi-danger' : ''}`}>{alerts.length}</span>
          <span className="kpi-sub">SKUs need action</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Avg Weeks of Supply</span>
          <span className={`kpi-value ${avgWoS < 2 ? 'kpi-warning' : ''}`}>{avgWoS}w</span>
          <span className="kpi-sub">across all stores + SKUs</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">SKUs Tracked</span>
          <span className="kpi-value">{SKUS.length}</span>
          <span className="kpi-sub">across {STORES.length} stores</span>
        </div>
      </div>

      <div className="dashboard-body">
        <div className="section">
          <h2 className="section-title">
            Reorder Alerts
            {alerts.length > 0 && <span className="alert-count">{alerts.length}</span>}
          </h2>
          {alerts.length === 0 ? (
            <p className="empty-state">All SKUs are healthy across every store.</p>
          ) : (
            <div className="alert-list">
              {alerts.map((a, i) => (
                <div key={i} className={`alert-card alert-${a.status}`}>
                  <div className="alert-left">
                    <span className={`badge ${STATUS_CLASS[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                    <span className="alert-sku">{a.skuName}</span>
                    <span className="alert-store">{a.storeName}</span>
                  </div>
                  <div className="alert-right">
                    <div className="alert-stat">
                      <span className="stat-num">{a.units}</span>
                      <span className="stat-label">on hand</span>
                    </div>
                    <div className="alert-stat">
                      <span className="stat-num">{a.wos !== null ? `${a.wos}w` : '—'}</span>
                      <span className="stat-label">supply left</span>
                    </div>
                    <div className="alert-stat">
                      <span className="stat-num">{a.avg}/wk</span>
                      <span className="stat-label">avg sales</span>
                    </div>
                    <div className="alert-stat">
                      <span className={`stat-num ${a.warehouseUnits > 0 ? 'text-green' : 'text-red'}`}>
                        {a.warehouseUnits}
                      </span>
                      <span className="stat-label">in warehouse</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section">
          <h2 className="section-title">Store Health</h2>
          <div className="store-grid">
            {STORES.map(store => {
              const skuStatuses = SKUS.map(sku => stockStatus(store.id, sku.id))
              const alertCount  = skuStatuses.filter(s => s !== 'ok').length
              const outCount    = skuStatuses.filter(s => s === 'out').length
              const overall     = outCount > 0 ? 'out' : alertCount > 2 ? 'critical' : alertCount > 0 ? 'low' : 'ok'
              return (
                <button
                  key={store.id}
                  className={`store-card store-card-${overall}`}
                  onClick={() => onSelectStore(store.id)}
                >
                  <div className="store-card-header">
                    <div>
                      <div className="store-card-name">{store.name}</div>
                      <div className="store-card-city">{store.city}</div>
                    </div>
                    <span className={`badge ${STATUS_CLASS[overall]}`}>
                      {alertCount === 0 ? 'Healthy' : `${alertCount} alert${alertCount !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div className="store-sku-list">
                    {SKUS.map(sku => (
                      <div key={sku.id} className="store-sku-row">
                        <span className="store-sku-name">{sku.name}</span>
                        <span className={`badge-sm ${STATUS_CLASS[stockStatus(store.id, sku.id)]}`}>
                          {totalUnits(store.id, sku.id)}u · {sellThrough(store.id, sku.id)}% ST
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="store-card-footer">View detail →</div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="section">
          <h2 className="section-title">SKU Velocity — 4-week avg units/week</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  {STORES.map(s => <th key={s.id}>{s.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {SKUS.map(sku => (
                  <tr key={sku.id}>
                    <td className="sku-name-cell">
                      <div className="sku-cell-name">{sku.name}</div>
                      <div className="sku-cell-color">{sku.colorway}</div>
                    </td>
                    {STORES.map(store => {
                      const avg    = avgWeeklySales(store.id, sku.id)
                      const units  = totalUnits(store.id, sku.id)
                      const status = stockStatus(store.id, sku.id)
                      return (
                        <td key={store.id} className={`velocity-cell velocity-${status}`}>
                          <span className="vel-avg">{avg.toFixed(1)}/wk</span>
                          <span className={`badge-sm ${STATUS_CLASS[status]}`}>{units}u</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
