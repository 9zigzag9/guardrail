import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import confusionImg from '../assets/outputs/confusion_matrices.png'
import lengthImg from '../assets/outputs/eda_balance_length.png'
import rocImg from '../assets/outputs/roc_pr_curves.png'
import stats from '../data/modelStats.json'
import { percent, ruleLabel } from '../format.js'

// Every figure on this page comes from modelStats.json, which make_data_page_stats.py builds from the
// deployed model, the saved test split and the outputs/ folder. Nothing here is typed in by hand.

const COLOURS = { safe: '#0b7f74', attack: '#c23a32' }
const MODEL_NAMES = { logistic: 'Logistic regression', linear_svm: 'Linear SVM (calibrated)', random_forest: 'Random forest' }
const n = (x) => x.toLocaleString()

const t = stats.test
const STATS = [
  { value: n(stats.dataset.rows), label: 'Labelled prompts after cleaning, from four public datasets' },
  { value: percent(t.accuracy), label: `Accuracy on ${n(stats.dataset.test)} test prompts the model never saw` },
  { value: percent(t.recall), label: 'Of attacks in the test set were caught (recall)' },
  { value: `${Math.round(stats.latency_ms.median)} ms`, label: 'Median time for one check through the API' },
]

const FIGURES = [
  { src: confusionImg, title: 'Confusion matrices', w: 1890, h: 570,
    text: 'Test set results for each model at its chosen threshold. Rows are the true label, columns the prediction.' },
  { src: rocImg, title: 'ROC and precision-recall curves', w: 1650, h: 600,
    text: 'All three models separate attacks from safe prompts almost perfectly. The differences are in the last few percent.' },
  { src: lengthImg, title: 'Class balance and prompt length', w: 1500, h: 525,
    text: 'There are more safe prompts than attacks, and attacks tend to be a little longer.' },
]

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

export default function DataPage() {
  const sources = [...stats.dataset.sources]
    .sort((a, b) => b.total - a.total)
    .map((s) => ({ ...s, short: s.name.split('/')[0] }))
  const types = stats.attack_types.filter((a) => a.category !== 'unclassified')
  const unclassified = stats.attack_types.find((a) => a.category === 'unclassified')?.count ?? 0

  return (
    <main id="main" className="page">
      <section className="intro">
        <p className="eyebrow">Dataset and methodology</p>
        <h1 className="about-title">Our project data</h1>
        <p className="subtitle">
          The guardrail is a {MODEL_NAMES[stats.model].toLowerCase()} model trained on prompts from four public
          Hugging Face datasets. Duplicates and prompts with conflicting labels were removed, then the data was split
          80/20 into training and test sets.
        </p>
      </section>

      <ul className="stat-grid" aria-label="Key figures">
        {STATS.map((s) => (
          <li key={s.label} className="stat-card">
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </li>
        ))}
      </ul>

      <div className="charts-grid">
        <figure className="panel chart-panel">
          <figcaption>
            <h2 className="chart-title">Where the prompts come from</h2>
            <p className="chart-sub">
              {n(stats.dataset.safe)} safe prompts and {n(stats.dataset.attacks)} attacks
              ({percent(stats.dataset.attacks / stats.dataset.rows)} attacks).
            </p>
          </figcaption>
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
              Attacks that could be given a type, from the dataset's own labels or our rule tagger.
              Another {n(unclassified)} attacks did not match a known type.
            </p>
          </figcaption>
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
        </figure>
      </div>

      <section className="panel">
        <h2 className="chart-title">How the deployed model did on the test set</h2>
        <p className="chart-sub">
          {n(stats.dataset.test)} prompts held back from training. A prompt is blocked when its attack probability
          is {percent(stats.threshold)} or more, chosen to catch at least 90% of attacks while blocking as few safe
          prompts as possible.
        </p>
        <div className="result-split">
          <table className="confusion" aria-label="Confusion matrix for the deployed model">
            <thead>
              <tr><td /><th scope="col">Allowed</th><th scope="col">Blocked</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Safe prompt</th><td className="cell-good">{n(t.tn)}</td><td className="cell-bad">{n(t.fp)}</td></tr>
              <tr><th scope="row">Attack</th><td className="cell-bad">{n(t.fn)}</td><td className="cell-good">{n(t.tp)}</td></tr>
            </tbody>
          </table>
          <dl className="result-facts">
            <div><dt>Precision</dt><dd>{percent(t.precision)} of blocked prompts were real attacks</dd></div>
            <div><dt>Recall</dt><dd>{percent(t.recall)} of attacks were caught</dd></div>
            <div><dt>F1 score</dt><dd>{t.f1.toFixed(3)}</dd></div>
            <div><dt>ROC-AUC / PR-AUC</dt><dd>{t.roc_auc.toFixed(3)} / {t.pr_auc.toFixed(3)}</dd></div>
            <div><dt>Safe prompts wrongly blocked</dt><dd>{n(t.fp)} of {n(t.tn + t.fp)}</dd></div>
            <div><dt>Attacks missed</dt><dd>{n(t.fn)} of {n(t.tp + t.fn)}</dd></div>
          </dl>
        </div>
        <p className="chart-note">
          Measured by scoring the saved test file (data/test.csv) with the deployed model. One safe prompt scores
          differently after being saved to and read back from the file, so this shows one more wrongly blocked
          prompt than the training-run table below.
        </p>
      </section>

      <section className="panel">
        <h2 className="chart-title">Models we compared</h2>
        <p className="chart-sub">Each was tuned with 5-fold cross-validation on the training set only, then tested once.</p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Model</th><th scope="col">Threshold</th><th scope="col">Precision</th>
                <th scope="col">Recall</th><th scope="col">PR-AUC</th><th scope="col">Safe blocked</th><th scope="col">Attacks missed</th>
              </tr>
            </thead>
            <tbody>
              {stats.comparison.map((m) => (
                <tr key={m.model} className={m.model === stats.model ? 'is-deployed' : undefined}>
                  <th scope="row">
                    {MODEL_NAMES[m.model] ?? m.model}
                    {m.model === stats.model && <span className="badge badge-allowed deployed-badge">Deployed</span>}
                  </th>
                  <td>{percent(m.threshold)}</td><td>{percent(m.precision)}</td><td>{percent(m.recall)}</td>
                  <td>{m.pr_auc.toFixed(3)}</td><td>{m.fp}</td><td>{m.fn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="chart-note">
          Figures from the training run (outputs/model_comparison.csv). The three models are within about one
          percentage point of each other on every measure.
        </p>
      </section>

      <section className="panel">
        <h2 className="chart-title">Example outputs</h2>
        <p className="chart-sub">Test scenarios from the training run (outputs/explanation_demo.csv).</p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th scope="col">Prompt</th><th scope="col">Decision</th><th scope="col">Attack probability</th><th scope="col">Attack type</th></tr>
            </thead>
            <tbody>
              {stats.examples.map((e) => (
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

      <section className="panel">
        <h2 className="chart-title">Charts from the training run</h2>
        <p className="chart-sub">Saved in the outputs folder. Select a chart to open it full size.</p>
        <div className="figure-grid">
          {FIGURES.map((f) => (
            <figure key={f.title} className="output-figure">
              <a href={f.src} target="_blank" rel="noopener noreferrer">
                <img src={f.src} alt={`${f.title}. ${f.text}`} width={f.w} height={f.h} loading="lazy" />
              </a>
              <figcaption><strong>{f.title}</strong><span>{f.text}</span></figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="chart-title">Limits of this data</h2>
        <ul className="plain-list">
          <li>Almost every prompt is in English, so attacks in other languages are often missed.</li>
          <li>Many attack types are rare (for example {n(stats.attack_types.find((a) => a.category === 'social_engineering')?.count ?? 0)} social
            engineering prompts), so results for those types are less certain.</li>
          <li>Spaced-out letters and dot-split words were not part of training, so those disguises are weaker spots.</li>
        </ul>
      </section>
    </main>
  )
}
