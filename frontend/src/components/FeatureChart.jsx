import { useRef, useState } from 'react'
import { featureLabel } from '../format.js'
import useElementWidth from '../useElementWidth.js'
import ExportButtons from './ExportButtons.jsx'

// Question this chart answers: which hand-made features tell attacks apart from safe prompts?
// Box plots from outputs/eda_feature_boxes.csv, via GET /api/model-stats. Drawn as plain SVG,
// because the chart library has no box plot.

const COLOURS = { safe: '#0b7f74', attack: '#c23a32' }
const NAMES = { safe: 'Safe', attack: 'Attack' }
const ROW = 70
const PAD = { left: 64, right: 24, top: 16, bottom: 44 }

const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : Number(v.toFixed(3)).toString())

// How far apart the two medians are, measured in box widths: a rough "how well does this feature separate".
function separation(f) {
  const spread = Math.max(f.safe.q3 - f.safe.q1, f.attack.q3 - f.attack.q1, 1e-9)
  return Math.abs(f.attack.median - f.safe.median) / spread
}

export default function FeatureChart({ features }) {
  const [name, setName] = useState(() => [...features].sort((a, b) => separation(b) - separation(a))[0].feature)
  const [hover, setHover] = useState(null)
  const chartRef = useRef(null)
  const boxRef = useRef(null)
  const W = Math.max(280, useElementWidth(boxRef))
  const f = features.find((x) => x.feature === name) ?? features[0]

  const lo = Math.min(f.safe.low, f.attack.low)
  const hi = Math.max(f.safe.high, f.attack.high)
  const span = hi - lo || 1
  const x = (v) => PAD.left + ((v - lo) / span) * (W - PAD.left - PAD.right)
  const ticks = Array.from({ length: 5 }, (_, i) => lo + (span * i) / 4)
  const height = PAD.top + ROW * 2 + PAD.bottom

  return (
    <figure className="panel chart-panel" ref={chartRef}>
      <figcaption>
        <h2 className="chart-title">Which features tell attacks apart?</h2>
        <p className="chart-sub">
          Each box holds the middle half of the prompts; the line inside is the median and the whiskers reach the furthest
          typical values. Boxes that do not overlap mean the feature separates attacks from safe prompts well.
        </p>
      </figcaption>
      <div className="feature-picker">
        <label htmlFor="feature-select">Feature</label>
        <select id="feature-select" value={name} onChange={(e) => setName(e.target.value)}>
          {[...features].sort((a, b) => separation(b) - separation(a)).map((x) => (
            <option key={x.feature} value={x.feature}>{featureLabel(x.feature)}</option>
          ))}
        </select>
        <span className="chart-note">Listed from most to least separating.</span>
      </div>
      <ExportButtons chartRef={chartRef} name={`feature-${f.feature}`} title={`${featureLabel(f.feature)}: safe against attack`}
                     legend={Object.keys(NAMES).map((k) => ({ name: NAMES[k], colour: COLOURS[k] }))}
                     rows={features.flatMap((x) => Object.keys(NAMES).map((k) => ({ feature: x.feature, class: k, ...x[k] })))} />

      <div className="chart-box svg-chart" aria-hidden="true" ref={boxRef}>
        <svg className="chart-svg" width={W} height={height} role="presentation">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={PAD.top} y2={PAD.top + ROW * 2} stroke="#d6e2ea" strokeDasharray="3 3" />
              <text x={x(t)} y={PAD.top + ROW * 2 + 18} textAnchor="middle" fontSize="12" fill="#45525e">{fmt(t)}</text>
            </g>
          ))}
          <text x={(PAD.left + W - PAD.right) / 2} y={height - 6} textAnchor="middle" fontSize="13" fill="#17202a">
            {featureLabel(f.feature)}
          </text>
          {Object.keys(NAMES).map((k, i) => {
            const b = f[k]
            const cy = PAD.top + ROW * i + ROW / 2
            return (
              <g key={k} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} style={{ cursor: 'default' }}>
                <rect x={0} y={cy - ROW / 2} width={W} height={ROW} fill={hover === k ? 'rgba(37, 99, 235, 0.06)' : 'transparent'} />
                <text x={PAD.left - 10} y={cy + 4} textAnchor="end" fontSize="13" fontWeight="600" fill="#17202a">{NAMES[k]}</text>
                <line x1={x(b.low)} x2={x(b.high)} y1={cy} y2={cy} stroke={COLOURS[k]} strokeWidth="2" />
                <line x1={x(b.low)} x2={x(b.low)} y1={cy - 10} y2={cy + 10} stroke={COLOURS[k]} strokeWidth="2" />
                <line x1={x(b.high)} x2={x(b.high)} y1={cy - 10} y2={cy + 10} stroke={COLOURS[k]} strokeWidth="2" />
                <rect x={x(b.q1)} y={cy - 18} width={Math.max(2, x(b.q3) - x(b.q1))} height={36} rx="4"
                      fill={COLOURS[k]} fillOpacity="0.25" stroke={COLOURS[k]} strokeWidth="2" />
                <line x1={x(b.median)} x2={x(b.median)} y1={cy - 18} y2={cy + 18} stroke="#17202a" strokeWidth="3" />
              </g>
            )
          })}
        </svg>
        {hover && (
          <div className="chart-tooltip svg-tooltip" style={{ top: hover === 'safe' ? '8%' : '42%' }}>
            <strong>{NAMES[hover]} prompts ({f[hover].count.toLocaleString()})</strong>
            <span>Median {fmt(f[hover].median)}, mean {fmt(f[hover].mean)}</span>
            <span>Middle half: {fmt(f[hover].q1)} to {fmt(f[hover].q3)}</span>
            <span>Typical range: {fmt(f[hover].low)} to {fmt(f[hover].high)}</span>
          </div>
        )}
      </div>

      <table className="data-table compact">
        <caption className="sr-only">{featureLabel(f.feature)} for safe prompts and attacks</caption>
        <thead><tr><th scope="col">Class</th><th scope="col">Median</th><th scope="col">Middle half</th><th scope="col">Mean</th></tr></thead>
        <tbody>
          {Object.keys(NAMES).map((k) => (
            <tr key={k}>
              <th scope="row">{NAMES[k]}</th><td>{fmt(f[k].median)}</td><td>{fmt(f[k].q1)} to {fmt(f[k].q3)}</td><td>{fmt(f[k].mean)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
