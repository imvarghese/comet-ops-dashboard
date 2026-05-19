import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { fetchAllSheets } from '../lib/sheets.js'
import { createCalc, defaultCalc } from '../utils/calc.js'

const DataContext = createContext(defaultCalc)

export function DataProvider({ children }) {
  const [liveData, setLiveData]   = useState(null)
  const [loading,  setLoading]    = useState(true)
  const [error,    setError]      = useState(null)
  const [isLive,   setIsLive]     = useState(false)
  const [lastFetch, setLastFetch] = useState(null)

  useEffect(() => {
    fetchAllSheets()
      .then(data => {
        setLiveData(data)
        setIsLive(true)
        setLastFetch(new Date())
      })
      .catch(err => {
        console.warn('Google Sheets fetch failed — using static data.', err.message)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  // Rebuild calc every time live data arrives
  const calc = useMemo(
    () => liveData ? createCalc(liveData) : defaultCalc,
    [liveData]
  )

  const value = useMemo(
    () => ({ ...calc, loading, error, isLive, lastFetch }),
    [calc, loading, error, isLive, lastFetch]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// Components call useCalc() to get all functions + data bound to live sheets
export function useCalc() {
  return useContext(DataContext)
}
