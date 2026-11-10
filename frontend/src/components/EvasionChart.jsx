import { useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { percent } from '../format.js'
import ExportButtons from './ExportButtons.jsx'

// Question this chart answers: how many disguised attacks got past the guardrail, before and after the
// detection evasion defence? From outputs/evasion_*.json (demo_requests/evasion_attack.py), via GET /api/model-stats.

const RUN_COLOURS = { before: '#c23a32', after_table: '#b45309', after: '#0b7f74' }
const colour = (run) => RUN_COLOURS[run] ?? '#53616f'

function EvasionTooltip({ active, payload, runs }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>Up to {d.requests} request{d.requests === 1 ? '' : 's'} per prompt</strong>
      {runs.filter((r) => d[r.name] != null).map((r) => (
        <span key={r.name}>{r.title}: {d[r.name].toFixed(1)}% got through</span>
      ))}
    </div>
  )
}

export default function EvasionChart({ evasion }) {
  const [attackName, setAttackName] = useState(evasion.attacks[0].name)
  const [show, setShow] = useState(Object.fromEntries(evasion.runs.map((r) => [r.name, true])))
  const chartRef = useRef(null)
  const attack = evasion.attacks.find((a) => a.name === attackName) ?? evasion.attacks[0]
  const runs = evasion.runs.filter((r) => attack.final[r.name])
  const title = (run) => evasion.runs.find((r) => r.name === run)?.title ?? run
  // Versions with exactly the same results draw on top of each other, so say so instead of leaving a line hidden.
  const shown = runs.filter((r) => show[r.name])
  const identical = shown.flatMap((a, i) => shown.slice(i + 1)
    .filter((b) => attack.curve.every((p) => p[a.name] === p[b.name]))
    .map((b) => `${a.title} and ${b.title}`))

  return (
    <section className="panel" ref={chartRef}>
      <h2 className="chart-title">Disguised attacks: how many got past the guardrail?</h2>
      <p className="chart-sub">
        An attacker swaps letters for characters that look the same to a person, reads the attack probability the API
        returns, and keeps only swaps that lower it. This was run against blocked test attacks, allowing up to{' '}
        {evasion.budget} requests per prompt, on each version of the guardrail.
      </p>

      <div className="series-toggles" role="group" aria-label="Type of disguise">
        {evasion.attacks.map((a) => (
          <button key={a.name} type="button" className={`toggle ${a.name === attack.name ? 'on' : ''}`}
                  aria-pressed={a.name === attack.name} onClick={() => setAttackName(a.name)}>
            {a.title}
          </button>
        ))}
      </div>
      <div className="series-toggles" role="group" aria-label="Show or hide versions of the guardrail">
        {runs.map((r) => (
          <button key={r.name} type="button" className={`toggle ${show[r.name] ? 'on' : ''}`} aria-pressed={show[r.name]}
                  onClick={() => setShow((v) => ({ ...v, [r.name]: !v[r.name] }))}>
            <span className="swatch" style={{ background: colour(r.name) }} aria-hidden="true" />
            {r.title}
          </button>
        ))}
      </div>

      <ExportButtons chartRef={chartRef} name={`evasion-${attack.name}`} title={`Adaptive attack: ${attack.title}`}
                     legend={runs.filter((r) => show[r.name]).map((r) => ({ name: r.title, colour: colour(r.name) }))}
                     rows={attack.curve} />
      <div className="chart-box" aria-hidden="true">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={attack.curve} margin={{ top: 12, right: 18, bottom: 28, left: 18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d6e2ea" />
            <XAxis dataKey="requests" type="number" domain={[1, evasion.budget]} ticks={[1, 20, 40, 60, 80, 100].filter((t) => t <= evasion.budget)}
                   label={{ value: 'Requests the attacker sends per prompt', position: 'insideBottom', offset: -16 }} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" width={52}
                   label={{ value: 'Attacks that got through', angle: -90, position: 'left', offset: 4 }} />
            <Tooltip content={<EvasionTooltip runs={runs} />} />
            {runs.map((r) => show[r.name] && (
              <Line key={r.name} dataKey={r.name} name={r.title} stroke={colour(r.name)} strokeWidth={3}
                    dot={false} activeDot={{ r: 6 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {identical.length > 0 && (
        <p className="chart-note">{identical.join('; ')} gave exactly the same results here, so their lines overlap.</p>
      )}

      <ul className="evasion-results" aria-live="polite">
        {runs.map((r) => {
          const f = attack.final[r.name]
          return (
            <li key={r.name} style={{ borderColor: colour(r.name) }}>
              <span className="evasion-run">{r.title}</span>
              <span className="evasion-rate" style={{ color: colour(r.name) }}>{percent(f.rate)}</span>
              <span className="evasion-detail">
                {f.got_through} of {f.prompts} attacks got through (95% confidence {percent(f.low)} to {percent(f.high)})
              </span>
            </li>
          )
        })}
      </ul>

      <h3 className="chart-title chart-title-small">Other measurements</h3>
      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr><th scope="col">Measure</th>{evasion.runs.map((r) => <th key={r.name} scope="col">{r.title}</th>)}</tr>
          </thead>
          <tbody>
            {evasion.random_swaps.map((s) => (
              <tr key={s.share_swapped}>
                <th scope="row">Random swaps of {Math.round(s.share_swapped * 100)}% of letters</th>
                {evasion.runs.map((r) => <td key={r.name}>{percent(s[r.name])}</td>)}
              </tr>
            ))}
            <tr>
              <th scope="row">Safe test prompts wrongly blocked (cost)</th>
              {evasion.cost.map((c) => <td key={c.run}>{c.safe_blocked} of {c.safe.toLocaleString()}</td>)}
            </tr>
            <tr>
              <th scope="row">Median response time (cost)</th>
              {evasion.cost.map((c) => <td key={c.run}>{c.median_ms.toFixed(1)} ms</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="chart-note">
        Measured through the API by demo_requests/evasion_attack.py. {title('after')} combines folding look-alike letters,
        folding letter-like symbols, and blocking words that mix alphabets.
      </p>
    </section>
  )
}
