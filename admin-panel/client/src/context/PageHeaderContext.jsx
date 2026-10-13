import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const PageHeaderContext = createContext(null)

export function PageHeaderProvider({ children }) {
  const [config, setConfigState] = useState(null)

  const setPageHeader = useCallback((next) => {
    setConfigState(next)
  }, [])

  const clearPageHeader = useCallback(() => {
    setConfigState(null)
  }, [])

  const value = useMemo(
    () => ({ config, setPageHeader, clearPageHeader }),
    [config, setPageHeader, clearPageHeader]
  )

  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>
}

export function usePageHeader() {
  const ctx = useContext(PageHeaderContext)
  if (!ctx) {
    throw new Error('usePageHeader must be used within PageHeaderProvider')
  }
  return ctx
}

/** Register app-bar title, optional back link, and actions for the current page. */
export function useRegisterPageHeader(config, deps = []) {
  const { setPageHeader, clearPageHeader } = usePageHeader()

  useEffect(() => {
    setPageHeader(config)
    return () => clearPageHeader()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
