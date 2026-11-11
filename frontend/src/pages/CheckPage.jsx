import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import CategoryChart from '../components/CategoryChart.jsx'
import CheckDetail from '../components/CheckDetail.jsx'
import HistoryPanel from '../components/HistoryPanel.jsx'
import PromptForm from '../components/PromptForm.jsx'
import ResultCard from '../components/ResultCard.jsx'
import SessionChart from '../components/SessionChart.jsx'
import { percent } from '../format.js'

export default function CheckPage() {
  // Server status, shown so the user knows whether checks can work at all.
  const [health, setHealth] = useState({ state: 'loading' })
  // The current check: idle -> loading -> success or error.
  const [check, setCheck] = useState({ state: 'idle' })
  const lastText = useRef('')
  const resultRef = useRef(null)
  // Every check this session (for the charts), and the filtered list shown below them.
  const [allItems, setAllItems] = useState([])
  const [list, setList] = useState({ items: [], loading: true, error: null })
  const [filters, setFilters] = useState({ search: '', decision: '' })
  const [category, setCategory] = useState(null)
  const [selected, setSelected] = useState({ id: null, detail: null, loading: false, error: null })

  const loadHealth = useCallback(() => {
    api.health()
      .then((h) => setHealth({ state: 'ok', ...h }))
      .catch((e) => setHealth({ state: 'down', message: e.message }))
  }, [])

  useEffect(() => { loadHealth() }, [loadHealth])

  const refreshAll = useCallback(() => api.history().then((r) => setAllItems(r.items)).catch(() => {}), [])

  // The filtered list waits 300 ms after typing stops, so a search is not sent on every key press.
  useEffect(() => {
    let cancelled = false
    setList((l) => ({ ...l, loading: true }))
    const timer = setTimeout(() => {
      api.history({ decision: filters.decision || undefined, search: filters.search.trim() || undefined })
        .then((r) => !cancelled && setList({ items: r.items, loading: false, error: null }))
        .catch((e) => !cancelled && setList({ items: [], loading: false, error: e.message }))
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [filters, allItems])

  useEffect(() => { refreshAll() }, [refreshAll])

  // On a phone the result is below the form, so bring it into view when it arrives.
  useEffect(() => {
    const el = resultRef.current
    if (!el || (check.state !== 'success' && check.state !== 'error')) return
    const { top } = el.getBoundingClientRect()
    if (top < 0 || top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [check])

  const select = useCallback((id) => {
    if (!id) return
    setSelected({ id, detail: null, loading: true, error: null })
    api.historyItem(id)
      .then((detail) => setSelected({ id, detail, loading: false, error: null }))
      .catch((e) => setSelected({ id, detail: null, loading: false, error: e.message }))
  }, [])

  async function runCheck(text) {
    lastText.current = text
    setCheck({ state: 'loading' })
    try {
      const result = await api.check(text)
      setCheck({ state: 'success', result })
      // The status pill only checks the server on page load, so refresh it once the server answers again.
      if (health.state !== 'ok') loadHealth()
      await refreshAll()
      if (result.check_id) setSelected({ id: result.check_id, detail: null, loading: false, error: null })
    } catch (e) {
      setCheck({ state: 'error', error: e })
      // A check that cannot reach the server means the "Server ready" pill is out of date.
      if (e.code === 'network') setHealth({ state: 'down', message: e.message })
    }
  }

  async function clearHistory() {
    if (!window.confirm('Delete every check saved in this session?')) return
    try {
      await api.clearHistory()
      setSelected({ id: null, detail: null, loading: false, error: null })
      setCategory(null)
      await refreshAll()
    } catch (e) {
      setList((l) => ({ ...l, error: e.message }))
    }
  }

  return (
    <main id="main" className="page">
      <section className="intro">
        <p className="eyebrow">Live detection</p>
        <h1>Check a prompt before it reaches your AI assistant</h1>
        <p className="subtitle">
          The guardrail decides whether a prompt is safe to pass on or looks like an injection attack, and shows
          which words drove the decision.
        </p>
        <p className={`status-pill status-${health.state}`} role="status">
          <span className="status-dot" aria-hidden="true" />
          {health.state === 'loading' && 'Connecting to the guardrail server...'}
          {health.state === 'ok' && `Server ready: ${health.model} model, blocks at ${percent(health.threshold)}`}
          {health.state === 'down' && health.message}
        </p>
      </section>

      <div className="check-grid">
        <PromptForm onSubmit={runCheck} busy={check.state === 'loading'} />

        <div className="result-slot" ref={resultRef}>
          {check.state === 'idle' && (
            <section className="panel placeholder-card">
              <h2>Your result appears here</h2>
              <p>Enter a prompt and select <strong>Check prompt</strong>. You will see whether it is allowed or blocked,
                 how confident the model is, and why.</p>
            </section>
          )}
          {check.state === 'loading' && (
            <section className="panel placeholder-card" role="status" aria-live="polite">
              <span className="spinner spinner-large" aria-hidden="true" />
              <h2>Checking your prompt...</h2>
            </section>
          )}
          {check.state === 'error' && (
            <section className="panel error-card" role="alert">
              <p className="eyebrow">{check.error.code === 'server_busy' ? 'Server busy' : 'Check failed'}</p>
              <h2>The prompt could not be checked</h2>
              <p>{check.error.message}</p>
              <button type="button" onClick={() => runCheck(lastText.current)}>Try again</button>
            </section>
          )}
          {check.state === 'success' && <ResultCard result={check.result} />}
        </div>
      </div>

      <h2 className="section-title">This session</h2>
      <div className="charts-grid">
        <SessionChart items={allItems} threshold={health.threshold ?? check.result?.threshold ?? 0.5}
                      selectedId={selected.id} onSelect={select} />
        <CategoryChart items={allItems} activeCategory={category}
                       onSelectCategory={(c) => setCategory((cur) => (cur === c ? null : c))} />
      </div>

      <div className="history-grid">
        <HistoryPanel items={list.items} filters={filters} onFiltersChange={setFilters}
                      category={category} onCategoryChange={setCategory}
                      selectedId={selected.id} onSelect={select} onClear={clearHistory}
                      loading={list.loading} error={list.error} />
        <CheckDetail detail={selected.detail} loading={selected.loading} error={selected.error}
                     onClose={() => setSelected({ id: null, detail: null, loading: false, error: null })} />
      </div>
    </main>
  )
}
