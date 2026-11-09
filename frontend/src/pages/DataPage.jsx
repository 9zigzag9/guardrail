import { useCallback, useEffect, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, figureUrl } from '../api.js'
import ClusterChart from '../components/ClusterChart.jsx'
import EvasionChart from '../components/EvasionChart.jsx'
import ExportButtons from '../components/ExportButtons.jsx'
import LengthChart from '../components/LengthChart.jsx'
import ThresholdExplorer from '../components/ThresholdExplorer.jsx'
import { modelName, percent, ruleLabel } from '../format.js'

// Every figure and chart on this page comes from GET /api/model-stats, which the back end reads from the training
// outputs (outputs/). Re-running the training script changes the page; nothing here is typed in by hand.

const COLOURS = { safe: '#0b7f74', attack: '#c23a32' }
const n = (x) => (x ?? 0).toLocaleString()
const formatDate = (unix) =>
  new Date(unix * 1000).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function SourceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>{d.name}</strong>
      <span>{n(d.safe)} safe, {n(d.attacks)} attacks</span>
      <span>{n(d.total)} prompts in total</span>
    </div>
  )
}

function StatCards({ stats }) {
  const { dataset: ds, test: t, latency } = stats
  const cards = [
    ds && { value: n(ds.rows), label: `Labelled prompts after cleaning, from ${ds.sources.length} public dataset${ds.sources.length === 1 ? '' : 's'}` },
    t?.accuracy != null && { value: percent(t.accuracy), label: `Accuracy on ${n(ds?.test_rows)} test prompts the model never saw` },
    t && { value: percent(t.recall), label: 'Of attacks in the test set were caught (recall)' },
    latency.checks
      ? { value: `${Math.round(latency.median_ms)} ms`, label: `Median time per check, measured live over the last ${n(latency.checks)} check${latency.checks === 1 ? '' : 's'}` }
      : { value: 'No checks yet', label: 'Response time appears here once prompts have been checked', small: true },
  ].filter(Boolean)
  return (
    <ul className="stat-grid" aria-label="Key figures">
      {cards.map((c) => (
        <li key={c.label} className="stat-card">
          <span className={c.small ? 'stat-value stat-value-small' : 'stat-value'}>{c.value}</span>
          <span className="stat-label">{c.label}</span>
        </li>
      ))}
    </ul>
  )
}

function DatasetPanels({ ds }) {
  const sources = ds.sources.map((s) => ({ ...s, short: s.name.split('/')[0] }))
  const types = ds.attack_types.filter((a) => a.category !== 'unclassified')
  const unclassified = ds.attack_types.find((a) => a.category === 'unclassified')?.count ?? 0
  const sourcesRef = useRef(null)
  return (
    <div className="charts-grid">
      <figure className="panel chart-panel" ref={sourcesRef}>
        <figcaption>
          <h2 className="chart-title">Where the prompts come from</h2>
          <p className="chart-sub">
            {n(ds.safe)} safe prompts and {n(ds.attacks)} attacks ({percent(ds.attacks / ds.rows)} attacks).
          </p>
        </figcaption>
        <ExportButtons chartRef={sourcesRef} name="prompt-sources" title="Where the prompts come from"
                       legend={[{ name: 'Safe', colour: COLOURS.safe }, { name: 'Attack', colour: COLOURS.attack }]}
                       rows={sources.map((s) => ({ dataset: s.name, safe: s.safe, attack: s.attacks, total: s.total }))} />
        <div className="chart-box" aria-hidden="true">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sources} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d6e2ea" vertical={false} />
              <XAxis dataKey="short" tick={{ fontSize: 12 }} interval={0} />
              <YAxis tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} width={44} />
              <Tooltip content={<SourceTooltip />} cursor={{ fill: 'rgba(37, 99, 235, 0.06)' }} />
              <Legend verticalAlign="top" height={28} />
              <Bar dataKey="safe" name="Safe" stackId="a" fill={COLOURS.safe} />
              <Bar dataKey="attacks" name="Attack" stackId="a" fill={COLOURS.attack} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* The same numbers as text, for screen readers and anyone who cannot read the chart. */}
        <table className="data-table compact">
          <caption className="sr-only">Prompts per source dataset</caption>
          <thead><tr><th scope="col">Dataset</th><th scope="col">Safe</th><th scope="col">Attack</th></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.name}><th scope="row">{s.name}</th><td>{n(s.safe)}</td><td>{n(s.attacks)}</td></tr>
            ))}
          </tbody>
        </table>
      </figure>

      <figure className="panel chart-panel">
        <figcaption>
          <h2 className="chart-title">Types of attack in the data</h2>
          <p className="chart-sub">
            {types.length
              ? <>Attacks given a type by the dataset&apos;s own labels or our rule tagger. Another {n(unclassified)} attacks
                  did not match a known type.</>
              : 'This training run did not record attack types.'}
          </p>
        </figcaption>
        {types.length > 0 && (
          <ExportButtons name="attack-types" title="Types of attack in the data"
                         rows={ds.attack_types.map((a) => ({ attack_type: ruleLabel(a.category), prompts: a.count }))} />
        )}
        {types.length > 0 && (
          <ul className="type-bars">
            {types.map((a) => (
              <li key={a.category}>
                <span className="type-name">{ruleLabel(a.category)}</span>
                <span className="type-track" aria-hidden="true">
                  <span className="type-fill" style={{ width: `${(a.count / types[0].count) * 100}%` }} />
                </span>
                <span className="type-count">{n(a.count)}</span>
              </li>
            ))}
          </ul>
        )}
      </figure>
    </div>
  )
}

function TestResults({ t, threshold, testRows }) {
  return (
    <section className="panel">
      <h2 className="chart-title">How the deployed model did on the test set</h2>
      <p className="chart-sub">
        {testRows ? `${n(testRows)} prompts` : 'Prompts'} held back from training. A prompt is blocked when its attack
        probability is {percent(threshold)} or more, chosen to catch at least 90% of attacks while blocking as few
        safe prompts as possible.
      </p>
      <div className="result-split">
        {t.tp != null && (
          <table className="confusion" aria-label="Confusion matrix for the deployed model">
            <thead>
              <tr><td /><th scope="col">Allowed</th><th scope="col">Blocked</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Safe prompt</th><td className="cell-good">{n(t.tn)}</td><td className="cell-bad">{n(t.fp)}</td></tr>
              <tr><th scope="row">Attack</th><td className="cell-bad">{n(t.fn)}</td><td className="cell-good">{n(t.tp)}</td></tr>
            </tbody>
          </table>
        )}
        <dl className="result-facts">
          <div><dt>Precision</dt><dd>{percent(t.precision)} of blocked prompts were real attacks</dd></div>
          <div><dt>Recall</dt><dd>{percent(t.recall)} of attacks were caught</dd></div>
          <div><dt>F1 score</dt><dd>{t.f1.toFixed(3)}</dd></div>
          <div><dt>ROC-AUC / PR-AUC</dt><dd>{t.roc_auc.toFixed(3)} / {t.pr_auc.toFixed(3)}</dd></div>
          <div><dt>Safe prompts wrongly blocked</dt><dd>{n(t.fp)}{t.tn != null && ` of ${n(t.tn + t.fp)}`}</dd></div>
          <div><dt>Attacks missed</dt><dd>{n(t.fn)}{t.tp != null && ` of ${n(t.tp + t.fn)}`}</dd></div>
        </dl>
      </div>
    </section>
  )
}

function Comparison({ rows, deployed }) {
  return (
    <section className="panel">
      <h2 className="chart-title">Models we compared</h2>
      <p className="chart-sub">Each was tuned with cross-validation on the training set only, then tested once on the test set.</p>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Model</th><th scope="col">Threshold</th><th scope="col">Precision</th>
              <th scope="col">Recall</th><th scope="col">PR-AUC</th><th scope="col">Safe blocked</th><th scope="col">Attacks missed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.model} className={m.model === deployed ? 'is-deployed' : undefined}>
                <th scope="row">
                  {modelName(m.model)}
                  {m.model === deployed && <span className="badge badge-allowed deployed-badge">Deployed</span>}
                </th>
                <td>{percent(m.threshold)}</td><td>{percent(m.precision)}</td><td>{percent(m.recall)}</td>
                <td>{m.pr_auc.toFixed(3)}</td><td>{m.fp}</td><td>{m.fn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Examples({ rows }) {
  return (
    <section className="panel">
      <h2 className="chart-title">Example outputs</h2>
      <p className="chart-sub">The test scenarios the training run checks every time, and what the model returned.</p>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr><th scope="col">Prompt</th><th scope="col">Decision</th><th scope="col">Attack probability</th><th scope="col">Attack type</th></tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.scenario}>
                <td className="example-text">{e.text}</td>
                <td>
                  <span className={`badge ${e.decision === 'Attack' ? 'badge-blocked' : 'badge-allowed'}`}>
                    {e.decision === 'Attack' ? 'Blocked' : 'Allowed'}
                  </span>
                </td>
                <td>{percent(e.probability)}</td>
                <td>{e.category ? ruleLabel(e.category) : 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Figures({ figures }) {
  return (
    <section className="panel">
      <h2 className="chart-title">More charts from the training run</h2>
      <p className="chart-sub">Made by the training script and served from the outputs folder. Select a chart to open it full size.</p>
      <div className="figure-grid">
        {figures.map((f) => (
          <figure key={f.name} className="output-figure">
            <a href={figureUrl(f)} target="_blank" rel="noopener noreferrer">
              <img src={figureUrl(f)} alt={`${f.title}. ${f.text}`} loading="lazy" />
            </a>
            <figcaption>
              <strong>{f.title}</strong>
              <span>{f.text}</span>
              <ExportButtons imageUrl={figureUrl(f)} name={f.name.replace(/\.png$/, '')} title={f.title} />
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

export default function DataPage() {
  const [load, setLoad] = useState({ state: 'loading', stats: null, error: null })

  // Results are only stored when the request finishes, so a slow answer never blanks figures already shown.
  const fetchStats = useCallback(() => {
    api.modelStats()
      .then((stats) => setLoad({ state: 'ready', stats, error: null }))
      .catch((error) => setLoad((l) => ({ state: l.stats ? 'ready' : 'error', stats: l.stats, error })))
  }, [])

  const refresh = () => {
    setLoad((l) => ({ ...l, state: l.stats ? 'refreshing' : 'loading' }))
    fetchStats()
  }

  // Load on open, and again whenever the tab regains focus, so a finished training run shows up without a rebuild.
  useEffect(() => {
    fetchStats()
    window.addEventListener('focus', fetchStats)
    return () => window.removeEventListener('focus', fetchStats)
  }, [fetchStats])

  const { stats } = load
  const training = stats?.training_in_progress

  // While a new training run is writing its outputs, check every 30 seconds, so the page switches to the
  // new results by itself as soon as the run finishes.
  useEffect(() => {
    if (!training) return undefined
    const timer = setInterval(fetchStats, 30000)
    return () => clearInterval(timer)
  }, [training, fetchStats])
  const socialCount = stats?.dataset?.attack_types.find((a) => a.category === 'social_engineering')?.count

  return (
    <main id="main" className="page">
      <section className="intro">
        <p className="eyebrow">Dataset and methodology</p>
        <h1 className="about-title">Our project data</h1>
        <p className="subtitle">
          {stats
            ? <>The guardrail is a {modelName(stats.model).toLowerCase()} model trained on labelled prompts from public
                Hugging Face datasets. Duplicates and prompts with conflicting labels were removed, then the data was
                split 80/20 into training and test sets.</>
            : 'Dataset size, test results and charts from the latest training run.'}
        </p>
        {stats && (
          <div className="data-meta">
            <span className="status-pill status-ok">
              <span className="status-dot" aria-hidden="true" />
              Training outputs last updated {formatDate(stats.trained_at)}
            </span>
            <button type="button" className="btn-secondary btn-small" onClick={refresh} disabled={load.state === 'refreshing'}>
              {load.state === 'refreshing' ? 'Refreshing...' : 'Refresh figures'}
            </button>
          </div>
        )}
      </section>

      {load.state === 'loading' && (
        <section className="panel placeholder-card" role="status" aria-live="polite">
          <span className="spinner spinner-large" aria-hidden="true" />
          <h2>Loading the latest figures...</h2>
        </section>
      )}

      {load.state === 'error' && (
        <section className="panel error-card" role="alert">
          <p className="eyebrow">Figures unavailable</p>
          <h2>The data could not be loaded</h2>
          <p>{load.error.message}</p>
          <button type="button" onClick={refresh}>Try again</button>
        </section>
      )}

      {stats && (
        <>
          {training && (
            <p className="panel notice" role="status">
              A new training run is in progress. These are the results of the previous complete run; the page switches to
              the new results by itself when the run finishes.
            </p>
          )}
          {!stats.in_sync && !training && (
            <p className="panel notice" role="note">
              These figures come from a newer training run than the model currently answering checks. To use the new
              model, copy it into <code>backend/model</code>, run <code>python backend/make_hashes.py</code> and restart
              the back end.
            </p>
          )}
          {load.error && <p className="inline-error" role="alert">Could not refresh: {load.error.message}</p>}
          <StatCards stats={stats} />
          {stats.dataset && <DatasetPanels ds={stats.dataset} />}
          {stats.curves.length > 0
            ? <ThresholdExplorer key={stats.trained_at} curves={stats.curves} deployed={stats.model} comparison={stats.comparison} />
            : stats.test && <TestResults t={stats.test} threshold={stats.threshold} testRows={stats.dataset?.test_rows} />}
          <Comparison rows={stats.comparison} deployed={stats.model} />
          {(stats.lengths || stats.clusters) && (
            <div className="charts-grid charts-even">
              {stats.lengths && <LengthChart bins={stats.lengths} />}
              {stats.clusters && <ClusterChart clusters={stats.clusters} />}
            </div>
          )}
          {stats.evasion && <EvasionChart evasion={stats.evasion} />}
          {stats.examples.length > 0 && <Examples rows={stats.examples} />}
          {stats.figures.length > 0 && <Figures figures={stats.figures} />}
          <section className="panel">
            <h2 className="chart-title">Limits of this data</h2>
            <ul className="plain-list">
              <li>Almost every prompt is in English, so attacks in other languages are often missed.</li>
              {socialCount != null && (
                <li>Some attack types are rare (for example {n(socialCount)} social engineering prompts), so results for
                  those types are less certain.</li>
              )}
              <li>Spaced-out letters and dot-split words are not part of the training augmentation, so those disguises are weaker spots.</li>
            </ul>
          </section>
        </>
      )}
    </main>
  )
}
