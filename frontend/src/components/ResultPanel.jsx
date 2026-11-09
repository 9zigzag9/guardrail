import HighlightedText from './HighlightedText.jsx';

function riskLevel(result) {
  if (result.decision !== 'Attack') return { cls: 'risk-low', label: 'Safe' };
  return result.attack_probability >= 0.9
    ? { cls: 'risk-high', label: 'High risk' }
    : { cls: 'risk-medium', label: 'Medium risk' };
}

export default function ResultPanel({ result }) {
  const isAttack = result.decision === 'Attack';
  const pct = Math.round(result.attack_probability * 1000) / 10;
  const risk = riskLevel(result);
  const rules = result.matched_rules || [];

  return (
    <section
      className={`results-detected ${isAttack ? '' : 'results-safe'}`}
      id="results-detected"
      aria-labelledby="result-title"
    >
      <div className="result-heading">
        <h3 id="result-title">Our system has detected:</h3>
        <span className={`risk-badge ${risk.cls}`}>{risk.label}</span>
      </div>

      <label htmlFor="detectionProgress" className="progress-label">
        Attack probability: {pct}% (blocking threshold {Math.round(result.threshold * 1000) / 10}%)
      </label>
      <progress id="detectionProgress" value={pct} max="100">{pct}%</progress>

      <p id="detectionResult">
        <strong>{result.decision}</strong> with a confidence score of {pct}%.
        {result.category ? <> Category: <strong>{result.category}</strong>.</> : null}
      </p>

      <p className="quoted-text" id="detectionText">
        <HighlightedText text={result.highlighted_text} />
      </p>

      <p id="detectionExplanation">{result.explanation}</p>

      {rules.length > 0 && (
        <ul className="tag-row" aria-label="Matched rules">
          {rules.map((r) => (
            <li key={r} className="tag">{String(r).replace(/_/g, ' ')}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
