import { useRef, useState } from 'react'
import { featureLabel } from '../format.js'
import ExportButtons from './ExportButtons.jsx'

// Question this chart answers: which hand-made features carry the same information?
// From outputs/eda_correlation.csv, via GET /api/model-stats. Drawn as plain SVG (a heatmap).

const CELL = 34
const LEFT = 150
const TOP = 150

// Blue for negative, white for none, red for positive correlation.
function colour(r) {
  const t = Math.min(1, Math.abs(r))
  const [R, G, B] = r >= 0 ? [194, 58, 50] : [37, 99, 235]
  const mix = (c) => Math.round(255 + (c - 255) * t)
  return `rgb(${mix(R)}, ${mix(G)}, ${mix(B)})`
}

function describe(r) {
  const a = Math.abs(r)
  const strength = a >= 0.8 ? 'very strongly' : a >= 0.5 ? 'strongly' : a >= 0.3 ? 'moderately' : a >= 0.1 ? 'weakly' : 'hardly'
  if (a < 0.1) return 'hardly related: they carry different information'
  return `${strength} related: when one is ${r > 0 ? 'high' : 'low'}, the other tends to be high${a >= 0.8 ? ', so one of them may be redundant' : ''}`
}

export default function CorrelationChart({ correlation }) {
  const { features, matrix } = correlation
  const n = features.length
  const pairs = features.flatMap((a, i) => features.slice(i + 1).map((b, k) => ({ i, j: i + 1 + k, r: matrix[i][i + 1 + k] })))
    .sort((p, q) => Math.abs(q.r) - Math.abs(p.r))
  const [selected, setSelected] = useState(pairs[0])
  const [hover, setHover] = useState(null)
  const [values, setValues] = useState(false)
  const chartRef = useRef(null)
  const active = hover ?? selected
  const size = LEFT + CELL * n + 10

  return (
    <figure className="panel chart-panel" ref={chartRef}>
      <figcaption>
        <h2 className="chart-title">Which features overlap?</h2>
        <p className="chart-sub">
          Correlation between every pair of hand-made features, from -1 (opposite) through 0 (unrelated) to 1 (move
          together). Hover over or select a square, or pick one of the strongest pairs below.
        </p>
      </figcaption>
      <div className="series-toggles" role="group" aria-label="Chart options">
        <button type="button" className={`toggle ${values ? 'on' : ''}`} aria-pressed={values} onClick={() => setValues((v) => !v)}>
          Show the numbers
        </button>
      </div>
      <ExportButtons chartRef={chartRef} name="feature-correlation" title="Correlation of the engineered features"
                     legend={[{ name: 'Move together (+1)', colour: colour(1) }, { name: 'Opposite (-1)', colour: colour(-1) }]}
                     rows={features.map((a, i) => ({ feature: a, ...Object.fromEntries(features.map((b, j) => [b, matrix[i][j]])) }))} />

      <div className="chart-box svg-chart heatmap-box" aria-hidden="true">
        <svg className="chart-svg" width={size} height={size} role="presentation">
          {features.map((name, i) => (
            <g key={name}>
              <text x={LEFT - 6} y={TOP + CELL * i + CELL / 2 + 4} textAnchor="end" fontSize="11"
                    fontWeight={active && (active.i === i || active.j === i) ? 700 : 400} fill="#17202a">{featureLabel(name, true)}</text>
              <text transform={`translate(${LEFT + CELL * i + CELL / 2 + 4}, ${TOP - 6}) rotate(-60)`} fontSize="11"
                    fontWeight={active && (active.i === i || active.j === i) ? 700 : 400} fill="#17202a">{featureLabel(name, true)}</text>
            </g>
          ))}
          {matrix.map((row, i) => row.map((r, j) => {
            const pair = { i: Math.min(i, j), j: Math.max(i, j), r }
            const on = active && active.i === pair.i && active.j === pair.j
            return (
              <g key={`${i}-${j}`} onMouseEnter={() => i !== j && setHover(pair)} onMouseLeave={() => setHover(null)}
                 onClick={() => i !== j && setSelected(pair)} style={{ cursor: i === j ? 'default' : 'pointer' }}>
                <rect x={LEFT + CELL * j} y={TOP + CELL * i} width={CELL - 2} height={CELL - 2} rx="3" fill={colour(r)}
                      stroke={on ? '#17202a' : 'none'} strokeWidth="2.5" />
                {values && <text x={LEFT + CELL * j + CELL / 2 - 1} y={TOP + CELL * i + CELL / 2 + 3} textAnchor="middle"
                                 fontSize="9" fill={Math.abs(r) > 0.6 ? '#fff' : '#17202a'}>{r.toFixed(1)}</text>}
              </g>
            )
          }))}
        </svg>
      </div>

      {active && (
        <p className="pair-detail" aria-live="polite">
          <strong>{featureLabel(features[active.i])}</strong> and <strong>{featureLabel(features[active.j])}</strong>:{' '}
          {active.r.toFixed(2)}, {describe(active.r)}.
        </p>
      )}
      <div className="series-toggles" role="group" aria-label="Strongest pairs">
        {pairs.slice(0, 5).map((p) => (
          <button key={`${p.i}-${p.j}`} type="button" className={`toggle ${selected.i === p.i && selected.j === p.j ? 'on' : ''}`}
                  aria-pressed={selected.i === p.i && selected.j === p.j} onClick={() => setSelected(p)}>
            {featureLabel(features[p.i], true)} / {featureLabel(features[p.j], true)}: {p.r.toFixed(2)}
          </button>
        ))}
      </div>
    </figure>
  )
}
