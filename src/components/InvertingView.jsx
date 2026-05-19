import { useState, useMemo } from 'react'
import { useCalc } from '../context/DataContext.jsx'

const STATUS_ORDER  = ['In Transit', 'At Port', 'Confirmed', 'Delivered']
const STATUS_BADGE  = {
  'Confirmed':  'badge-confirmed',
  'In Transit': 'badge-transit',
  'At Port':    'badge-atport',
  'Delivered':  'badge-delivered',
}

function etaDays(etaStr) {
  if (!etaStr) return null
  const eta = new Date(etaStr)
  if (isNaN(eta)) return null
  return Math.round((eta - new Date()) / 86400000)
}

function EtaTag({ days }) {
  if (days === null) return null
  if (days < 0)  return <span className="eta-tag eta-overdue">Overdue {Math.abs(days)}d</span>
  if (days === 0) return <span className="eta-tag eta-today">Due Today</span>
  if (days <= 3)  return <span className="eta-tag eta-urgent">{days}d left</span>
  return <span className="eta-tag eta-ok">{days}d away</span>
}

export default function InvertingView() {
  const { inboundSchedule } = useCalc()
  const [activeStatus, setActiveStatus] = useState('All')
  const [expandedPO, setExpandedPO]     = useState(null)

  const pos = useMemo(() => {
    const map = new Map()
    for (const r of inboundSchedule) {
      if (!map.has(r.po_number)) {
        map.set(r.po_number, {
          po_number: r.po_number,
          vendor_name: r.vendor_name,
          vendor_country: r.vendor_country,
          eta_date: r.eta_date,
          order_date: r.order_date,
          actual_arrival: r.actual_arrival,
          destination: r.destination,
          status: r.status,
          notes: r.notes,
          skus: {},
          total_ordered: 0,
        })
      }
      const po  = map.get(r.po_number)
      const qty = Number(r.quantity_ordered) || 0
      po.total_ordered += qty
      if (!po.skus[r.sku_id]) {
        po.skus[r.sku_id] = { sku_id: r.sku_id, sku_name: r.sku_name, sizes: {}, total: 0 }
      }
      po.skus[r.sku_id].sizes[r.size] = qty
      po.skus[r.sku_id].total += qty
    }
    return [...map.values()].sort((a, b) => {
      const ai = STATUS_ORDER.indexOf(a.status)
      const bi = STATUS_ORDER.indexOf(b.status)
      if (ai !== bi) return ai - bi
      return new Date(a.eta_date) - new Date(b.eta_date)
    })
  }, [inboundSchedule])

  const STATUSES = ['All', 'In Transit', 'At Port', 'Confirmed', 'Delivered']
  const filtered  = activeStatus === 'All' ? pos : pos.filter(p => p.status === activeStatus)

  const counts = useMemo(() => {
    const c = { All: pos.length }
    for (const s of STATUSES.slice(1)) c[s] = pos.filter(p => p.status === s).length
    return c
  }, [pos])

  const totalInbound   = pos.filter(p => p.status !== 'Delivered').reduce((s, p) => s + p.total_ordered, 0)
  const inPipelineCount = pos.filter(p => p.status === 'In Transit' || p.status === 'At Port').length

  return (
    <div className="inverting-view">
      <div className="inverting-header">
        <div>
          <h1 className="store-view-title">Inverting</h1>
          <p className="store-view-sub">Inbound PO schedule · Vendor receiving pipeline</p>
        </div>
        <div className="inverting-kpis">
          <div className="kpi-mini">
            <span className="kpi-mini-val">{pos.length}</span>
            <span className="kpi-mini-label">Total POs</span>
          </div>
          <div className="kpi-mini">
            <span className="kpi-mini-val kpi-amber">{inPipelineCount}</span>
            <span className="kpi-mini-label">In Pipeline</span>
          </div>
          <div className="kpi-mini">
            <span className="kpi-mini-val">{totalInbound.toLocaleString('en-IN')}</span>
            <span className="kpi-mini-label">Units Inbound</span>
          </div>
        </div>
      </div>

      {inboundSchedule.length === 0 ? (
        <p className="empty-state" style={{ marginTop: 48 }}>
          No inbound data. Connect Google Sheets or upload an inbound schedule.
        </p>
      ) : (
        <>
          <div className="status-tabs">
            {STATUSES.map(s => (
              <button
                key={s}
                className={`status-tab ${activeStatus === s ? 'status-tab-active' : ''} ${s !== 'All' ? `status-tab-${s.toLowerCase().replace(' ', '-')}` : ''}`}
                onClick={() => setActiveStatus(s)}
              >
                {s}
                {counts[s] > 0 && <span className="tab-count">{counts[s]}</span>}
              </button>
            ))}
          </div>

          <div className="po-list">
            {filtered.map(po => {
              const days     = etaDays(po.eta_date)
              const expanded = expandedPO === po.po_number
              return (
                <div key={po.po_number} className={`po-card po-status-${po.status.toLowerCase().replace(' ', '-')}`}>
                  <div className="po-card-header" onClick={() => setExpandedPO(expanded ? null : po.po_number)}>
                    <div className="po-card-left">
                      <div className="po-number">{po.po_number}</div>
                      <div className="po-vendor">{po.vendor_name} · {po.vendor_country}</div>
                      {po.notes && <div className="po-notes">{po.notes}</div>}
                    </div>
                    <div className="po-card-right">
                      <span className={`badge ${STATUS_BADGE[po.status] ?? 'badge-ok'}`}>{po.status}</span>
                      <EtaTag days={days} />
                      <div className="po-sku-summary">
                        {Object.values(po.skus).map(s => s.sku_name).join(' · ')}
                      </div>
                      <div className="po-total-units">{po.total_ordered} units</div>
                      <span className="po-expand-icon">{expanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {expanded && (
                    <div className="po-card-detail">
                      <div className="po-meta">
                        <span>Ordered: {po.order_date}</span>
                        <span>ETA: {po.eta_date}</span>
                        {po.actual_arrival && <span>Arrived: {po.actual_arrival}</span>}
                        <span>Destination: {po.destination}</span>
                      </div>
                      {Object.values(po.skus).map(sku => (
                        <div key={sku.sku_id} className="po-sku-row">
                          <div className="po-sku-name">
                            {sku.sku_name}
                            <span className="text-secondary"> · {sku.total} units</span>
                          </div>
                          <div className="po-size-pills">
                            {Object.entries(sku.sizes).map(([size, qty]) => (
                              <span key={size} className="size-pill">{size}: {qty}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
