import { useCalc } from '../context/DataContext.jsx'

const STATUS_CLASS = { out: 'badge-out', critical: 'badge-critical', low: 'badge-low', ok: 'badge-ok' }

function SizeCell({ units }) {
  const cls = units === 0 ? 'size-cell-out' : units <= 4 ? 'size-cell-low' : 'size-cell-ok'
  return <td className={`size-cell ${cls}`}>{units}</td>
}

export default function WarehouseView() {
  const {
    SKUS, STORES, SIZES, stock,
    totalUnits, stockStatus,
  } = useCalc()

  const warehouseStock = stock['warehouse'] ?? {}

  const totalValue = SKUS.reduce((sum, sku) => {
    const units = totalUnits('warehouse', sku.id)
    return sum + units * sku.rrp
  }, 0)

  return (
    <div className="warehouse-view">
      <div className="warehouse-header">
        <div>
          <h1 className="store-view-title">Central Warehouse</h1>
          <p className="store-view-sub">Bangalore · Available to replenish all stores</p>
        </div>
        <div className="kpi-card" style={{ minWidth: 200 }}>
          <span className="kpi-label">Total Stock Value</span>
          <span className="kpi-value" style={{ fontSize: 24 }}>
            ₹{totalValue.toLocaleString('en-IN')}
          </span>
          <span className="kpi-sub">at RRP across all SKUs</span>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Stock Available by SKU</h2>
        <p className="section-hint">
          <span className="legend-out">■</span> None &nbsp;
          <span className="legend-low">■</span> Low (1–4) &nbsp;
          <span className="legend-ok">■</span> Available (5+)
        </p>
        <div className="table-wrap">
          <table className="data-table sku-table">
            <thead>
              <tr>
                <th>SKU</th>
                {SIZES.map(s => <th key={s}>{s}</th>)}
                <th>Total</th>
                <th>RRP</th>
                <th>Stock Value</th>
              </tr>
            </thead>
            <tbody>
              {SKUS.map(sku => {
                const sizeStock = warehouseStock[sku.id] ?? {}
                const units     = totalUnits('warehouse', sku.id)
                return (
                  <tr key={sku.id} className="sku-row">
                    <td className="sku-name-cell">
                      <div className="sku-cell-name">{sku.name}</div>
                      <div className="sku-cell-color">{sku.colorway}</div>
                    </td>
                    {SIZES.map(size => <SizeCell key={size} units={sizeStock[size] ?? 0} />)}
                    <td className="bold">{units}</td>
                    <td className="text-secondary">₹{sku.rrp.toLocaleString('en-IN')}</td>
                    <td className="bold">₹{(units * sku.rrp).toLocaleString('en-IN')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Transfer Recommendations</h2>
        <p className="section-hint">SKUs out or critical at a store with warehouse stock available.</p>
        <div className="transfer-list">
          {SKUS.flatMap(sku =>
            STORES.map(store => {
              const status        = stockStatus(store.id, sku.id)
              const warehouseUnits = totalUnits('warehouse', sku.id)
              if ((status === 'out' || status === 'critical') && warehouseUnits > 0) {
                return (
                  <div key={`${store.id}-${sku.id}`} className="transfer-card">
                    <div className="transfer-info">
                      <div className="transfer-sku">{sku.name}</div>
                      <div className="transfer-store">→ {store.name}, {store.city}</div>
                    </div>
                    <div className="transfer-detail">
                      <span className={`badge ${STATUS_CLASS[status]}`}>
                        {status === 'out' ? 'Out of Stock' : 'Critical'}
                      </span>
                      <span className="transfer-available">{warehouseUnits} available in warehouse</span>
                    </div>
                    <div className="transfer-action">
                      Suggest sending <strong>{Math.min(warehouseUnits, 6)} units</strong>
                    </div>
                  </div>
                )
              }
              return null
            })
          ).filter(Boolean)}
        </div>
      </div>
    </div>
  )
}
