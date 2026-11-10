import { useRef, useState } from 'react'
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import ExportButtons from './ExportButtons.jsx'

// Question this chart answers: do attacks that are worded alike sit together, and do the clustering methods agree?
// A fixed sample of attack prompts from outputs/attack_clusters_2d.csv, via GET /api/model-stats.

const PALETTE = ['#2563eb', '#c23a32', '#0b7f74', '#b45309', '#9333ea', '#0e7490', '#be185d', '#4d7c0f', '#53616f', '#a16207']
const NOISE = '#9aa5b1'
const METHODS = { kmeans: 'K-means', dbscan: 'DBSCAN' }
const groupName = (method, g) => (method === 'dbscan' && g === -1 ? 'Noise (no dense group)' : `Group ${g + 1}`)
const groupColour = (method, g) => (method === 'dbscan' && g === -1 ? NOISE : PALETTE[g % PALETTE.length])

function PointTooltip({ active, payload, method }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>{groupName(method, p[method])}</strong>
      {/* The attack text is shown as plain text, never as HTML. */}
      <span className="tooltip-text">{p.text}{p.text.length >= 140 ? '...' : ''}</span>
    </div>
  )
}

export default function ClusterMap({ points, totalAttacks }) {
  const [method, setMethod] = useState('kmeans')
  const [hidden, setHidden] = useState({})
  const chartRef = useRef(null)
  const groups = [...new Set(points.map((p) => p[method]))].sort((a, b) => a - b)
  const counts = Object.fromEntries(groups.map((g) => [g, points.filter((p) => p[method] === g).length]))
  const visible = groups.filter((g) => !hidden[`${method}:${g}`])

  return (
    <figure className="panel chart-panel" ref={chartRef}>
      <figcaption>
        <h2 className="chart-title">Map of the attack prompts</h2>
        <p className="chart-sub">
          {points.length.toLocaleString()} attacks chosen at random from {totalAttacks ? totalAttacks.toLocaleString() : 'all'},
          placed so that attacks with similar wording sit close together, and coloured by the group a clustering method put
          them in. Hover over a dot to read the attack. Groups that overlap heavily mean attacks do not split into neat types.
        </p>
      </figcaption>
      <div className="series-toggles" role="group" aria-label="Clustering method">
        {Object.entries(METHODS).map(([key, label]) => (
          <button key={key} type="button" className={`toggle ${method === key ? 'on' : ''}`} aria-pressed={method === key}
                  onClick={() => setMethod(key)}>
            Colour by {label}
          </button>
        ))}
      </div>
      <div className="series-toggles" role="group" aria-label="Show or hide groups">
        {groups.map((g) => {
          const on = !hidden[`${method}:${g}`]
          return (
            <button key={g} type="button" className={`toggle toggle-small ${on ? 'on' : ''}`} aria-pressed={on}
                    onClick={() => setHidden((h) => ({ ...h, [`${method}:${g}`]: on }))}>
              <span className="swatch" style={{ background: groupColour(method, g) }} aria-hidden="true" />
              {groupName(method, g)} ({counts[g]})
            </button>
          )
        })}
      </div>
      <ExportButtons chartRef={chartRef} name={`attack-map-${method}`} title={`Map of the attack prompts, coloured by ${METHODS[method]}`}
                     legend={visible.map((g) => ({ name: groupName(method, g), colour: groupColour(method, g) }))}
                     rows={points.map((p) => ({ x: p.x, y: p.y, kmeans_group: p.kmeans + 1, dbscan_group: p.dbscan === -1 ? 'noise' : p.dbscan + 1, prompt: p.text }))} />
      <div className="chart-box" aria-hidden="true">
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d6e2ea" />
            <XAxis type="number" dataKey="x" tick={false} label={{ value: 'Wording (direction 1)', position: 'insideBottom', offset: 0 }} />
            <YAxis type="number" dataKey="y" tick={false} width={28} label={{ value: 'Wording (direction 2)', angle: -90, position: 'insideLeft', offset: 10 }} />
            <Tooltip content={<PointTooltip method={method} />} cursor={{ strokeDasharray: '3 3' }} />
            {visible.map((g) => (
              <Scatter key={`${method}-${g}`} data={points.filter((p) => p[method] === g)} fill={groupColour(method, g)}
                       fillOpacity={0.65} isAnimationActive={false}
                       shape={(props) => <circle cx={props.cx} cy={props.cy} r={3} fill={groupColour(method, g)} fillOpacity={0.65} />} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-note">The two directions summarise the wording of each attack; they have no units. Group numbers are labels only.</p>
    </figure>
  )
}
