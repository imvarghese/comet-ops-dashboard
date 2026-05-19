import { useState } from 'react'
import { DataProvider, useCalc } from './context/DataContext.jsx'
import Dashboard     from './components/Dashboard.jsx'
import StoreView     from './components/StoreView.jsx'
import InvertingView from './components/InvertingView.jsx'
import HoldingView   from './components/HoldingView.jsx'
import WarehouseView from './components/WarehouseView.jsx'
import Intelligence  from './components/Intelligence.jsx'
import ChatView      from './components/ChatView.jsx'
import './App.css'

function AppShell() {
  const [view,          setView]          = useState('dashboard')
  const [selectedStore, setSelectedStore] = useState(null)
  const { STORES, loading, error, isLive, lastFetch, buildAlerts } = useCalc()

  // Default selected store to first store once data loads
  const storeId = selectedStore ?? STORES[0]?.id

  const alerts = buildAlerts()

  const lastUpdated = lastFetch
    ? lastFetch.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  function handleSelectStore(id) {
    setSelectedStore(id)
    setView('stores')
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-inner">
          <div className="loading-spinner" />
          <div className="loading-brand">COMET</div>
          <div className="loading-text">Fetching live data from Google Sheets…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-mark">●</span>
          <span className="brand-name">COMET</span>
          <span className="brand-tag">Inventory</span>
        </div>

        <nav className="header-nav">
          {[
            { id: 'dashboard',    label: 'Dashboard'      },
            { id: 'stores',       label: 'Stores'         },
            { id: 'inverting',    label: 'Inverting'      },
            { id: 'holding',      label: 'Holding'        },
            { id: 'warehouse',    label: 'Warehouse'      },
            { id: 'intelligence', label: '✦ Intelligence' },
            { id: 'chat',         label: '✦ Ask CI'       },
          ].map(({ id, label }) => (
            <button
              key={id}
              className={`nav-btn ${id === 'intelligence' ? 'nav-btn-intel' : ''} ${view === id ? 'nav-btn-active' : ''}`}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="header-right">
          {alerts.length > 0 && (
            <button className="alert-pill" onClick={() => setView('dashboard')}>
              ⚠ {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
            </button>
          )}
          <span className={`live-dot ${isLive ? 'live-dot-on' : ''}`} title={isLive ? 'Live data' : 'Static data'} />
          {error && <span className="data-source-badge badge-low">Static data</span>}
          {isLive && <span className="data-source-badge badge-ok">Live · {lastUpdated}</span>}
        </div>
      </header>

      <main className="app-main">
        {view === 'dashboard'    && <Dashboard    onSelectStore={handleSelectStore} />}
        {view === 'stores'       && storeId && <StoreView storeId={storeId} onChangeStore={setSelectedStore} />}
        {view === 'inverting'    && <InvertingView />}
        {view === 'holding'      && <HoldingView />}
        {view === 'warehouse'    && <WarehouseView />}
        {view === 'intelligence' && <Intelligence />}
        {view === 'chat'         && <ChatView />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <DataProvider>
      <AppShell />
    </DataProvider>
  )
}
