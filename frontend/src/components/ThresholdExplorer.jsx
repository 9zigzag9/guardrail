import { useRef, useState } from 'react'
import { CartesianGrid, ReferenceDot, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { modelName, percent } from '../format.js'
import ExportButtons from './ExportButtons.jsx'

// Question this panel answers: what would each threshold have done on the test set, and why did we pick ours?
// Everything is calculated from the per-threshold counts in GET /api/model-stats (outputs/test_scores.csv).

const MODEL_COLOURS = { logistic: '#2563eb', linear_svm: '#9333ea', random_forest: '#b45309' }
const colour = (m) => MODEL_COLOURS[m] ?? '#53616f'
const n = (x) => x.toLocaleString()

// Everything the panel shows for one threshold, from how many attacks (tp) and safe prompts (fp) it blocks.
function measures(c, g) {
  const fn = c.positives - g.tp
  const tn = c.negatives - g.fp
  const precision = g.tp + g.fp ? g.tp / (g.tp + g.fp) : null
  const recall = g.tp / c.positives
  return {
    t: g.t, tp: g.tp, fp: g.fp, fn, tn, precision, recall,
    fpr: g.fp / c.negatives,
    accuracy: (g.tp + tn) / (c.positives + c.negatives),
    f1: precision ? (2 * precision * recall) / (precision + recall) : null,
  }
}

function CurveTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>{modelName(p.model)}</strong>
      <span>Blocks at {percent(p.t)}</span>
      <span>Catches {percent(p.recall)} of attacks</span>
      <span>Blocks {percent(p.fpr)} of safe prompts ({n(p.fp)})</span>
      {p.precision != null && <span>{percent(p.precision)} of blocked prompts are attacks</span>}
      <em>Click to use this threshold</em>
    </div>
  )
}

function Curve({ title, name, sub, curves, model, current, xKey, yKey, xLabel, yLabel, zoom, onPick }) {
  const chartRef = useRef(null)
  const [x0, y0] = zoom ? [xKey === 'fpr' ? 0 : 0.8, 0.8] : [0, 0]
  const x1 = zoom && xKey === 'fpr' ? 0.2 : 1
  const ticks = (lo, hi) => Array.from({ length: 5 }, (_, i) => +(lo + ((hi - lo) * i) / 4).toFixed(2))
  return (
    <figure className="chart-panel" ref={chartRef}>
      <figcaption>
        <h3 className="chart-title chart-title-small">{title}</h3>
        <p className="chart-sub">{sub}</p>
      </figcaption>
      <ExportButtons chartRef={chartRef} name={name} title={`${title} (ringed: ${modelName(model)} at ${percent(current.t)})`}
                     legend={curves.map((c) => ({ name: modelName(c.model), colour: colour(c.model) }))}
                     rows={curves.flatMap((c) => c.points.map((p) => ({
                       model: c.model, threshold: p.t, attacks_blocked: p.tp, safe_blocked: p.fp,
                       recall: +p.recall.toFixed(4), false_positive_rate: +p.fpr.toFixed(4),
                       precision: p.precision == null ? '' : +p.precision.toFixed(4),
                     })))} />
      <div className="chart-box" aria-hidden="true">
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 10, right: 16, bottom: 28, left: 18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d6e2ea" />
            <XAxis type="number" dataKey={xKey} domain={[x0, x1]} ticks={ticks(x0, x1)} allowDataOverflow
                   tickFormatter={(v) => `${Math.round(v * 100)}%`}
                   label={{ value: xLabel, position: 'insideBottom', offset: -16 }} />
            <YAxis type="number" dataKey={yKey} domain={[y0, 1]} ticks={ticks(y0, 1)} allowDataOverflow width={48}
                   tickFormatter={(v) => `${Math.round(v * 100)}%`}
                   label={{ value: yLabel, angle: -90, position: 'left', offset: 4 }} />
            <Tooltip content={<CurveTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            {/* The selected model is drawn last so it sits on top, at full strength. */}
            {[...curves].sort((a, b) => (a.model === model) - (b.model === model)).map((c) => {
              const on = c.model === model
              return (
                <Scatter key={c.model} name={modelName(c.model)} cursor="pointer"
                         data={c.points.filter((p) => p[yKey] != null)}
                         fill={colour(c.model)} fillOpacity={on ? 1 : 0.35}
                         line={{ stroke: colour(c.model), strokeWidth: on ? 2.5 : 1.5, strokeOpacity: on ? 1 : 0.35 }}
                         shape={(props) => <circle cx={props.cx} cy={props.cy} r={on ? 3 : 2} fill={colour(c.model)} fillOpacity={on ? 1 : 0.35} />}
                         onClick={(point) => onPick(c.model, (point.payload ?? point).t)} />
              )
            })}
            {current[yKey] != null && (
              <ReferenceDot x={current[xKey]} y={current[yKey]} r={8} fill="#fff" stroke="#17202a" strokeWidth={3} ifOverflow="hidden" />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

export default function ThresholdExplorer({ curves, deployed, comparison }) {
  const [model, setModel] = useState(deployed)
  const [zoom, setZoom] = useState(true)
  const c = curves.find((x) => x.model === model) ?? curves[0]
  const chosenIndex = c.grid.findIndex((g) => g.t === c.chosen_threshold)
  const [index, setIndex] = useState(chosenIndex)
  const all = curves.map((x) => ({ ...x, points: x.grid.map((g) => ({ ...measures(x, g), model: x.model })) }))
  const m = measures(c, c.grid[index])
  const row = comparison.find((r) => r.model === c.model)
  const atChosen = index === chosenIndex

  const pickModel = (name) => {
    const next = curves.find((x) => x.model === name)
    setModel(name)
    setIndex(next.grid.findIndex((g) => g.t === next.chosen_threshold))
  }
  const pickPoint = (name, t) => {
    const next = curves.find((x) => x.model === name)
    setModel(name)
    setIndex(next.grid.findIndex((g) => g.t === t))
  }

  return (
    <section className="panel">
      <h2 className="chart-title">Choosing when to block: try any threshold</h2>
      <p className="chart-sub">
        Every model gives each prompt an attack probability, and a prompt is blocked when it reaches the threshold. Move the
        slider, or select a point on a curve, to see what that threshold would have done to the {n(c.positives + c.negatives)} test
        prompts the models never saw. Training picked the threshold that catches at least 90% of attacks while blocking as few
        safe prompts as possible.
      </p>

      <div className="explorer-controls">
        <div className="series-toggles" role="group" aria-label="Model">
          {curves.map((x) => (
            <button key={x.model} type="button" className={`toggle ${x.model === model ? 'on' : ''}`}
                    aria-pressed={x.model === model} onClick={() => pickModel(x.model)}>
              <span className="swatch" style={{ background: colour(x.model) }} aria-hidden="true" />
              {modelName(x.model)}{x.model === deployed && ' (deployed)'}
            </button>
          ))}
        </div>

        <div className="slider-row">
          <label htmlFor="threshold-slider">
            Block when the attack probability is at least <strong>{percent(m.t)}</strong>
          </label>
          <input id="threshold-slider" type="range" min={0} max={c.grid.length - 1} step={1} value={index}
                 onChange={(e) => setIndex(Number(e.target.value))}
                 aria-valuetext={`${percent(m.t)}: catches ${percent(m.recall)} of attacks, blocks ${n(m.fp)} safe prompts`} />
          <div className="slider-actions">
            {atChosen
              ? <span className="badge badge-allowed">The threshold training chose</span>
              : <button type="button" className="btn-secondary btn-small" onClick={() => setIndex(chosenIndex)}>
                  Back to the chosen {percent(c.chosen_threshold)}
                </button>}
          </div>
        </div>
      </div>

      <div className="result-split">
        <table className="confusion" aria-label={`Test results for ${modelName(c.model)} at ${percent(m.t)}`}>
          <thead>
            <tr><td /><th scope="col">Allowed</th><th scope="col">Blocked</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">Safe prompt</th><td className="cell-good">{n(m.tn)}</td><td className="cell-bad">{n(m.fp)}</td></tr>
            <tr><th scope="row">Attack</th><td className="cell-bad">{n(m.fn)}</td><td className="cell-good">{n(m.tp)}</td></tr>
          </tbody>
        </table>
        <dl className="result-facts" aria-live="polite">
          <div><dt>Attacks caught (recall)</dt><dd>{percent(m.recall)}</dd></div>
          <div><dt>Blocked that were attacks (precision)</dt><dd>{m.precision == null ? 'Nothing blocked' : percent(m.precision)}</dd></div>
          <div><dt>Accuracy</dt><dd>{percent(m.accuracy)}</dd></div>
          <div><dt>F1 score</dt><dd>{m.f1 == null ? '-' : m.f1.toFixed(3)}</dd></div>
          <div><dt>Safe prompts wrongly blocked</dt><dd>{n(m.fp)} of {n(c.negatives)}</dd></div>
          <div><dt>Attacks missed</dt><dd>{n(m.fn)} of {n(c.positives)}</dd></div>
          {row && <div><dt>ROC-AUC / PR-AUC (any threshold)</dt><dd>{row.roc_auc.toFixed(3)} / {row.pr_auc.toFixed(3)}</dd></div>}
        </dl>
      </div>

      <div className="series-toggles explorer-zoom">
        <button type="button" className={`toggle ${zoom ? 'on' : ''}`} aria-pressed={zoom} onClick={() => setZoom((z) => !z)}>
          Zoom in on the useful corner
        </button>
      </div>
      <div className="charts-grid charts-even">
        <Curve title="ROC curve" name="roc-curve" sub="Higher and further left is better: more attacks caught for fewer safe prompts blocked."
               curves={all} model={model} current={m} xKey="fpr" yKey="recall" zoom={zoom} onPick={pickPoint}
               xLabel="Safe prompts blocked" yLabel="Attacks caught" />
        <Curve title="Precision-recall curve" name="precision-recall-curve" sub="Higher and further right is better: blocks are rarely wrong and few attacks get through."
               curves={all} model={model} current={m} xKey="recall" yKey="precision" zoom={zoom} onPick={pickPoint}
               xLabel="Attacks caught (recall)" yLabel="Precision" />
      </div>
      <p className="chart-note">The ringed dot is the threshold on the slider. Keyboard users: the slider and the figures above show the same results as the curves.</p>
    </section>
  )
}
