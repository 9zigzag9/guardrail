import { formatTime, percent, ruleLabel } from '../format.js'

// Details of the check selected in the chart or the list, fetched from GET /api/history/{id}.
export default function CheckDetail({ detail, loading, error, onClose }) {
  if (!detail && !loading && !error) return null
  return (
    <section className="panel detail-panel" aria-labelledby="detail-title" aria-live="polite">
      <div className="history-head">
        <h2 id="detail-title" className="chart-title">Selected check</h2>
        <button type="button" className="link-button" onClick={onClose}>Close</button>
      </div>
      {loading && <p className="empty-state">Loading...</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {detail && !loading && (
        <>
          <dl className="result-facts">
            <div><dt>Decision</dt><dd>
              <span className={`badge ${detail.blocked ? 'badge-blocked' : 'badge-allowed'}`}>
                {detail.blocked ? 'Blocked' : 'Allowed'}
              </span>
            </dd></div>
            <div><dt>Attack probability</dt><dd>{percent(detail.attack_probability)}</dd></div>
            {detail.category && <div><dt>Attack type</dt><dd>{ruleLabel(detail.category)}</dd></div>}
            <div><dt>Checked at</dt><dd>{formatTime(detail.created_at)}</dd></div>
          </dl>
          <h3 className="small-heading">Prompt</h3>
          <p className="prompt-text">{detail.text}</p>
        </>
      )}
    </section>
  )
}
