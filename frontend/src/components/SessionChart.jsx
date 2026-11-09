import { useRef, useState } from 'react'
import {
  CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatTime, percent } from '../format.js'
import ExportButtons from './ExportButtons.jsx'

const COLOURS = { Allowed: '#0b7f74', Blocked: '#c23a32' }

// Whole-number ticks, thinned out once there are too many to read.
function xTicks(count) {
  const last = Math.max(count, 5)
  const step = Math.ceil(last / 10)
  return Array.from({ length: Math.floor(last / step) }, (_, i) => (i + 1) * step)
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const c = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>Check {c.n}: {c.blocked ? 'Blocked' : 'Allowed'}</strong>
      <span>Attack probability {percent(c.attack_probability)}</span>
      <span>{formatTime(c.created_at)}</span>
      {/* Rendered as text, so a prompt containing markup is shown, never run. */}
      <span className="tooltip-text">{c.text.length > 80 ? `${c.text.slice(0, 80)}...` : c.text}</span>
      <em>Click to see the full check</em>
    </div>
  )
}

// Question this chart answers: how risky was each prompt I checked, and how close did it come to being blocked?
export default function SessionChart({ items, threshold, selectedId, onSelect }) {
  const [show, setShow] = useState({ Allowed: true, Blocked: true })
  const chartRef = useRef(null)
  const points = [...items].reverse().map((c, i) => ({ ...c, n: i + 1, score: c.attack_probability * 100 }))
  const series = {
    Allowed: points.filter((c) => !c.blocked),
    Blocked: points.filter((c) => c.blocked),
  }

  return (
    <figure className="panel chart-panel" ref={chartRef}>
      <figcaption>
        <h2 className="chart-title">Risk of each prompt this session</h2>
        <p className="chart-sub">Each dot is one check. Dots above the dashed line were blocked. Select a dot for its details.</p>
      </figcaption>

      <div className="series-toggles" role="group" aria-label="Show or hide decisions">
        {Object.keys(series).map((name) => (
          <button key={name} type="button" className={`toggle ${show[name] ? 'on' : ''}`} aria-pressed={show[name]}
                  onClick={() => setShow((s) => ({ ...s, [name]: !s[name] }))}>
            <span className="swatch" style={{ background: COLOURS[name] }} aria-hidden="true" />
            {name} ({series[name].length})
          </button>
        ))}
      </div>

      {points.length > 0 && (
        <ExportButtons chartRef={chartRef} name="session-risk" title="Risk of each prompt this session"
                       legend={Object.keys(series).filter((s) => show[s]).map((s) => ({ name: s, colour: COLOURS[s] }))}
                       rows={points.map((c) => ({ check: c.n, time: c.created_at, decision: c.blocked ? 'Blocked' : 'Allowed',
                                                  attack_probability: c.attack_probability, category: c.category ?? '', prompt: c.text }))} />
      )}

      {points.length === 0 ? (
        <p className="empty-state">No checks yet. Each prompt you check appears here.</p>
      ) : (
        <div className="chart-box" aria-hidden="true">
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 12, right: 18, bottom: 28, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d6e2ea" />
              <XAxis type="number" dataKey="n" name="Check" allowDecimals={false}
                     domain={[0.5, Math.max(points.length, 5) + 0.5]} ticks={xTicks(points.length)}
                     label={{ value: 'Check number (in order made)', position: 'insideBottom', offset: -16 }} />
              <YAxis type="number" dataKey="score" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" width={48}
                     label={{ value: 'Attack probability', angle: -90, position: 'left', offset: 6 }} />
              <ReferenceLine y={threshold * 100} stroke="#53616f" strokeDasharray="6 4"
                             label={{ value: `Blocks at ${percent(threshold)}`, position: 'insideTopRight', fill: '#3a4651', fontSize: 12 }} />
              <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              {Object.entries(series).map(([name, data]) => show[name] && (
                <Scatter key={name} name={name} data={data} fill={COLOURS[name]} cursor="pointer"
                         onClick={(point) => onSelect(point.payload?.id ?? point.id)}
                         shape={(props) => (
                           <circle cx={props.cx} cy={props.cy} r={props.payload.id === selectedId ? 9 : 6}
                                   fill={COLOURS[name]} stroke={props.payload.id === selectedId ? '#17202a' : '#fff'}
                                   strokeWidth={2} />
                         )} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="chart-note">Keyboard users: the same checks are listed below, and each can be opened from there.</p>
    </figure>
  )
}
