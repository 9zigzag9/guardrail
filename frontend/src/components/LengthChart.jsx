import { useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { percent } from '../format.js'
import ExportButtons from './ExportButtons.jsx'

// Question this chart answers: are attacks longer or shorter than safe prompts?
// Counted from the processed dataset by GET /api/model-stats.

const COLOURS = { safe: '#0b7f74', attack: '#c23a32' }
const NAMES = { safe: 'Safe', attack: 'Attack' }

function LengthTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>{d.label} characters</strong>
      <span>{d.safe.toLocaleString()} safe ({percent(d.safeShare)} of safe prompts)</span>
      <span>{d.attack.toLocaleString()} attacks ({percent(d.attackShare)} of attacks)</span>
    </div>
  )
}

export default function LengthChart({ bins }) {
  const [share, setShare] = useState(true)
  const [show, setShow] = useState({ safe: true, attack: true })
  const totals = bins.reduce((t, b) => ({ safe: t.safe + b.safe, attack: t.attack + b.attack }), { safe: 0, attack: 0 })
  const data = bins.map((b) => ({ ...b, safeShare: b.safe / totals.safe, attackShare: b.attack / totals.attack }))
  const key = (s) => (share ? `${s}Share` : s)
  const chartRef = useRef(null)

  return (
    <figure className="panel chart-panel" ref={chartRef}>
      <figcaption>
        <h2 className="chart-title">How long the prompts are</h2>
        <p className="chart-sub">Prompts grouped by length in characters. Each group is twice as wide as the one before.</p>
      </figcaption>
      <div className="series-toggles" role="group" aria-label="Chart options">
        {Object.keys(NAMES).map((s) => (
          <button key={s} type="button" className={`toggle ${show[s] ? 'on' : ''}`} aria-pressed={show[s]}
                  onClick={() => setShow((v) => ({ ...v, [s]: !v[s] }))}>
            <span className="swatch" style={{ background: COLOURS[s] }} aria-hidden="true" />
            {NAMES[s]}
          </button>
        ))}
        <button type="button" className={`toggle ${share ? 'on' : ''}`} aria-pressed={share} onClick={() => setShare((v) => !v)}>
          Compare as % of each class
        </button>
      </div>
      <ExportButtons chartRef={chartRef} name="prompt-length" title={`How long the prompts are${share ? ' (% of each class)' : ''}`}
                     legend={Object.keys(NAMES).filter((s) => show[s]).map((s) => ({ name: NAMES[s], colour: COLOURS[s] }))}
                     rows={data.map((b) => ({ characters: b.label, safe: b.safe, attack: b.attack,
                                              safe_share: +b.safeShare.toFixed(4), attack_share: +b.attackShare.toFixed(4) }))} />
      <div className="chart-box" aria-hidden="true">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 40, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d6e2ea" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end"
                   label={{ value: 'Length (characters)', position: 'insideBottom', offset: -34 }} />
            <YAxis width={48} tickFormatter={(v) => (share ? `${Math.round(v * 100)}%` : v >= 1000 ? `${v / 1000}k` : v)} />
            <Tooltip content={<LengthTooltip />} cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }} />
            {Object.keys(NAMES).map((s) => show[s] && (
              <Bar key={s} dataKey={key(s)} name={NAMES[s]} fill={COLOURS[s]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="data-table compact">
        <caption className="sr-only">Prompts by length</caption>
        <thead><tr><th scope="col">Characters</th><th scope="col">Safe</th><th scope="col">Attack</th></tr></thead>
        <tbody>
          {data.map((b) => (
            <tr key={b.label}><th scope="row">{b.label}</th><td>{b.safe.toLocaleString()}</td><td>{b.attack.toLocaleString()}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
