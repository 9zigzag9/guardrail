import { useId } from 'react'
import { formatTime, percent, ruleLabel } from '../format.js'

// The session's past checks as a list. Every entry is a button, so anything that can be done by
// clicking the chart can also be done with the keyboard. The search runs on the server
// (GET /api/history?search=...), where it is passed to the database as a parameter.
export default function HistoryPanel({
  items, filters, onFiltersChange, category, onCategoryChange, selectedId, onSelect, onClear, loading, error,
}) {
  const searchId = useId()
  const decisionId = useId()
  const shown = category ? items.filter((c) => c.blocked && (c.category ?? 'unclassified') === category) : items

  return (
    <section className="panel history-panel" aria-labelledby="history-title">
      <div className="history-head">
        <h2 id="history-title" className="chart-title">Checks this session</h2>
        <button type="button" className="btn-secondary btn-small" onClick={onClear} disabled={!items.length && !filters.search}>
          Clear history
        </button>
      </div>

      <div className="filters">
        <div className="filter">
          <label htmlFor={searchId}>Search prompts</label>
          <input id={searchId} type="search" maxLength={200} value={filters.search} placeholder="Words in the prompt"
                 onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })} />
        </div>
        <div className="filter">
          <label htmlFor={decisionId}>Decision</label>
          <select id={decisionId} value={filters.decision}
                  onChange={(e) => onFiltersChange({ ...filters, decision: e.target.value })}>
            <option value="">All</option>
            <option value="Attack">Blocked only</option>
            <option value="Safe">Allowed only</option>
          </select>
        </div>
      </div>

      {category && (
        <p className="active-filter">
          Showing only <strong>{ruleLabel(category)}</strong>
          <button type="button" className="link-button" onClick={() => onCategoryChange(null)}>Show all types</button>
        </p>
      )}

      {error && <p className="inline-error" role="alert">{error}</p>}
      {loading && !items.length && <p className="empty-state">Loading history...</p>}
      {!loading && !error && shown.length === 0 && (
        <p className="empty-state">{filters.search || filters.decision || category ? 'No checks match these filters.' : 'No checks yet.'}</p>
      )}

      <ol className="history-list">
        {shown.map((c) => (
          <li key={c.id}>
            <button type="button" className={`history-item ${c.id === selectedId ? 'selected' : ''}`}
                    aria-current={c.id === selectedId ? 'true' : undefined} onClick={() => onSelect(c.id)}>
              <span className={`badge ${c.blocked ? 'badge-blocked' : 'badge-allowed'}`}>
                {c.blocked ? 'Blocked' : 'Allowed'}
              </span>
              <span className="history-text">{c.text}</span>
              <span className="history-meta">{percent(c.attack_probability)} at {formatTime(c.created_at)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
