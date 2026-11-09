import { useRef } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ruleLabel } from '../format.js'
import ExportButtons from './ExportButtons.jsx'

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>{d.label}</strong>
      <span>{d.count} blocked prompt{d.count === 1 ? '' : 's'}</span>
      <em>{d.active ? 'Click to show every check again' : 'Click to list only these checks'}</em>
    </div>
  )
}

// Question this chart answers: what kinds of attack were found in my prompts?
// Selecting a bar filters the history list below to that attack type.
export default function CategoryChart({ items, activeCategory, onSelectCategory }) {
  const counts = {}
  for (const c of items) {
    if (c.blocked) counts[c.category ?? 'unclassified'] = (counts[c.category ?? 'unclassified'] ?? 0) + 1
  }
  const data = Object.entries(counts)
    .map(([category, count]) => ({ category, count, label: ruleLabel(category), active: category === activeCategory }))
    .sort((a, b) => b.count - a.count)
  const allowed = items.filter((c) => !c.blocked).length
  const chartRef = useRef(null)

  return (
    <figure className="panel chart-panel" ref={chartRef}>
      <figcaption>
        <h2 className="chart-title">Types of attack blocked this session</h2>
        <p className="chart-sub">
          {data.length ? 'Select a bar to list only those checks below.' : 'Blocked prompts are grouped here by attack type.'}
          {' '}{allowed} prompt{allowed === 1 ? ' was' : 's were'} allowed.
        </p>
      </figcaption>
      {data.length > 0 && (
        <ExportButtons chartRef={chartRef} name="session-attack-types" title="Types of attack blocked this session"
                       legend={[{ name: 'Blocked prompts', colour: '#c23a32' }]}
                       rows={data.map((d) => ({ attack_type: d.label, blocked_prompts: d.count }))} />
      )}
      {data.length === 0 ? (
        <p className="empty-state">No prompts have been blocked yet.</p>
      ) : (
        <div className="chart-box" aria-hidden="true">
          <ResponsiveContainer width="100%" height={Math.max(160, data.length * 46 + 50)}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 20, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d6e2ea" horizontal={false} />
              <XAxis type="number" allowDecimals={false}
                     label={{ value: 'Blocked prompts', position: 'insideBottom', offset: -12 }} />
              <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 13 }} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }} />
              <Bar dataKey="count" name="Blocked prompts" radius={[0, 6, 6, 0]} cursor="pointer"
                   onClick={(bar) => onSelectCategory((bar.payload ?? bar).category)}>
                {data.map((d) => (
                  <Cell key={d.category} fill={activeCategory && !d.active ? '#e7b0ab' : '#c23a32'}
                        stroke={d.active ? '#17202a' : 'none'} strokeWidth={2} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  )
}
