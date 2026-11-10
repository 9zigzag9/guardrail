import { useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ExportButtons from './ExportButtons.jsx'

// Question this chart answers: do the attacks fall into clear groups, and how many?
// From outputs/kmeans_k_selection.csv, via GET /api/model-stats.

const SERIES = {
  silhouette: { name: 'Silhouette (higher = better separated)', colour: '#2563eb', axis: 'right' },
  inertia: { name: 'Inertia (lower = tighter groups)', colour: '#53616f', axis: 'left' },
}

function ClusterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>{d.k} clusters</strong>
      <span>Silhouette {d.silhouette.toFixed(3)}</span>
      <span>Inertia {d.inertia.toLocaleString()}</span>
    </div>
  )
}

export default function ClusterChart({ clusters }) {
  const [show, setShow] = useState({ silhouette: true, inertia: true })
  const best = clusters.rows.find((r) => r.k === clusters.best_k)
  const chartRef = useRef(null)

  return (
    <figure className="panel chart-panel" ref={chartRef}>
      <figcaption>
        <h2 className="chart-title">Do the attacks form groups?</h2>
        <p className="chart-sub">
          K-means was tried on the attack prompts with {clusters.rows[0].k} to {clusters.rows.at(-1).k} groups. The best
          silhouette is at {clusters.best_k} groups ({best.silhouette.toFixed(3)}).{' '}
          {best.silhouette < 0.25
            ? 'A score below 0.25 means the groups overlap heavily: attacks share words and tricks rather than splitting into neat types.'
            : 'A score of 0.25 or more means the groups are reasonably distinct.'}
        </p>
      </figcaption>
      <div className="series-toggles" role="group" aria-label="Show or hide measures">
        {Object.entries(SERIES).map(([key, s]) => (
          <button key={key} type="button" className={`toggle ${show[key] ? 'on' : ''}`} aria-pressed={show[key]}
                  onClick={() => setShow((v) => ({ ...v, [key]: !v[key] }))}>
            <span className="swatch" style={{ background: s.colour }} aria-hidden="true" />
            {s.name}
          </button>
        ))}
      </div>
      <ExportButtons chartRef={chartRef} name="attack-groups" title="Do the attacks form groups? (k-means)"
                     legend={Object.entries(SERIES).filter(([k]) => show[k]).map(([, s]) => ({ name: s.name, colour: s.colour }))}
                     rows={clusters.rows} />
      <div className="chart-box" aria-hidden="true">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={clusters.rows} margin={{ top: 12, right: 8, bottom: 24, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d6e2ea" />
            <XAxis dataKey="k" label={{ value: 'Number of groups (k)', position: 'insideBottom', offset: -14 }} />
            <YAxis yAxisId="left" width={56} hide={!show.inertia} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} />
            <YAxis yAxisId="right" orientation="right" width={48} hide={!show.silhouette} tickFormatter={(v) => v.toFixed(2)} />
            <Tooltip content={<ClusterTooltip />} />
            <ReferenceLine x={clusters.best_k} yAxisId="left" stroke="#17202a" strokeDasharray="6 4"
                           label={{ value: `Best: ${clusters.best_k}`, position: 'insideTopRight', fill: '#3a4651', fontSize: 12 }} />
            {Object.entries(SERIES).map(([key, s]) => show[key] && (
              <Line key={key} yAxisId={s.axis} dataKey={key} name={s.name} stroke={s.colour} strokeWidth={2.5}
                    dot={{ r: 4 }} activeDot={{ r: 7 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="data-table compact">
        <caption className="sr-only">K-means scores for each number of groups</caption>
        <thead><tr><th scope="col">Groups</th><th scope="col">Silhouette</th><th scope="col">Inertia</th></tr></thead>
        <tbody>
          {clusters.rows.map((r) => (
            <tr key={r.k}><th scope="row">{r.k}</th><td>{r.silhouette.toFixed(3)}</td><td>{r.inertia.toLocaleString()}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
