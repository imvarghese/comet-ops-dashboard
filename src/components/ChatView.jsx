import { useState, useRef, useEffect } from 'react'
import { useCalc } from '../context/DataContext.jsx'


function buildContext(calc) {
  const {
    STORES, SKUS, totalUnits, stockStatus,
    avgWeeklySales, weeksOfSupply, inboundSchedule,
  } = calc

  const lines = [
    'You are an inventory intelligence assistant for COMET, a premium Indian sneaker brand.',
    'You have access to live inventory data. Answer concisely and actionably.',
    '',
    '## Stores',
    ...STORES.map(s => `- ${s.name}, ${s.city}`),
    '',
    '## Products (SKUs)',
    ...SKUS.map(s => `- ${s.name} (${s.colorway}) · RRP ₹${s.rrp.toLocaleString('en-IN')} · Lead time ${s.leadTimeDays}d`),
    '',
    '## Live Stock by Store',
  ]

  for (const store of STORES) {
    lines.push(`\n### ${store.name}, ${store.city}`)
    for (const sku of SKUS) {
      const units  = totalUnits(store.id, sku.id)
      const status = stockStatus(store.id, sku.id)
      const avg    = avgWeeklySales(store.id, sku.id).toFixed(1)
      const wos    = weeksOfSupply(store.id, sku.id)
      lines.push(`- ${sku.name}: ${units} units · ${status} · ${avg}/wk · ${wos !== null ? wos.toFixed(1) + 'w supply' : 'no sales data'}`)
    }
  }

  lines.push('\n### Central Warehouse (Bangalore)')
  for (const sku of SKUS) {
    lines.push(`- ${sku.name}: ${totalUnits('warehouse', sku.id)} units`)
  }

  if (inboundSchedule.length > 0) {
    lines.push('\n## Inbound POs')
    const seen = new Set()
    for (const r of inboundSchedule) {
      if (seen.has(r.po_number)) continue
      seen.add(r.po_number)
      const total = inboundSchedule
        .filter(x => x.po_number === r.po_number)
        .reduce((s, x) => s + (Number(x.quantity_ordered) || 0), 0)
      lines.push(`- ${r.po_number}: ${r.sku_name} · ${r.status} · ETA ${r.eta_date} · ${total} units`)
    }
  }

  lines.push('\nAlways suggest concrete next actions. Use ₹ for prices.')
  return lines.join('\n')
}

async function callClaude(systemCtx, messages) {
  // Skip the initial assistant greeting — Anthropic messages must start with user
  const apiMessages = messages
    .filter((m, i) => !(i === 0 && m.role === 'assistant'))
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemContext: systemCtx, messages: apiMessages }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error ?? `API error ${res.status}`)
  }
  const data = await res.json()
  return data.text
}

const QUICK_PROMPTS = [
  'Which store is most critically low on stock right now?',
  'What are the top trending SKUs this week?',
  'Which inbound POs are arriving in the next 7 days?',
  'Suggest the most urgent warehouse-to-store transfers.',
]

export default function ChatView() {
  const calc = useCalc()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your Comet Intelligence assistant. Ask me anything about stock levels, inbound orders, transfer recommendations, or demand trends across your stores.",
    },
  ])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)
    const updated = [...messages, { role: 'user', content: text }]
    setMessages(updated)
    setLoading(true)
    try {
      const reply = await callClaude(buildContext(calc), updated)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const showQuick = messages.length === 1 && !loading

  return (
    <div className="chat-view">
      <div className="chat-header">
        <div className="chat-header-brand">
          <div className="intel-label" style={{ fontSize: 11, padding: '2px 6px' }}>CI</div>
          <div>
            <h1 className="intel-title" style={{ fontSize: 20, margin: 0 }}>Comet Intelligence Chat</h1>
            <p className="intel-sub" style={{ margin: 0 }}>Ask anything about inventory, demand, and operations</p>
          </div>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble chat-bubble-${m.role}`}>
            {m.role === 'assistant' && <span className="chat-avatar">CI</span>}
            <div className="chat-text">{m.content}</div>
          </div>
        ))}

        {loading && (
          <div className="chat-bubble chat-bubble-assistant">
            <span className="chat-avatar">CI</span>
            <div className="chat-thinking">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {showQuick && (
        <div className="chat-quick-actions">
          {QUICK_PROMPTS.map(q => (
            <button key={q} className="chat-quick-btn" onClick={() => setInput(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          rows={2}
          placeholder="Ask about stock, transfers, inbound POs, demand trends…  (Enter to send)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
        />
        <button
          className="chat-send-btn"
          onClick={send}
          disabled={loading || !input.trim()}
        >
          {loading ? '…' : 'Send →'}
        </button>
      </div>
    </div>
  )
}
