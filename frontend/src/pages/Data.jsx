import { useOutletContext } from 'react-router-dom';
import ModelChart from '../components/ModelChart.jsx';
import HistoryChart from '../components/HistoryChart.jsx';

const STATS = [
  { value: '2', label: 'Classes: safe vs. injection' },
  { value: '32,003', label: 'Prompts after merging 4 sources and de-duplicating' },
  { value: '98.2%', label: 'Precision of the deployed model (test set)' },
];
const TAGS = ['Role-play framing', 'Direct override', 'Encoding / obfuscation', 'Leetspeak'];

export default function Data() {
  const { history } = useOutletContext();
  return (
    <section className="data-header" id="data-header">
      <p className="eyebrow">Dataset &amp; methodology</p>
      <h2>Our Project Data</h2>
      <p className="subtitle">
        Our classifier is trained on four Hugging Face prompt injection datasets. Prompts are cleaned to undo common
        disguises (leetspeak, spaced letters, base64, rot13) so the model generalises beyond a single phrasing of an attack.
      </p>

      <div className="stat-grid" id="stat-grid">
        {STATS.map((s) => (
          <div className="stat-card" key={s.label}>
            <span className="stat-value">{s.value}</span>
            <p className="stat-label">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="stat-note">Figures come from the submitted run (random forest, 6,401 test prompts).</p>

      <ul className="tag-row" id="tag-row" aria-label="Attack types">
        {TAGS.map((t) => (
          <li className="tag" key={t}>{t}</li>
        ))}
      </ul>

      <div className="chart-grid">
        <ModelChart />
        <HistoryChart history={history} />
      </div>
    </section>
  );
}
