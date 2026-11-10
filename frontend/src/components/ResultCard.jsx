import HighlightedText from './HighlightedText.jsx'
import { percent, ruleLabel } from '../format.js'

// The result is the most prominent element on the page: the decision in large type, then the
// model's confidence, then why. role="status" makes screen readers announce each new result.
export default function ResultCard({ result }) {
  const { blocked, attack_probability: p, threshold } = result
  const verdict = blocked ? 'Blocked' : 'Allowed'
  return (
    <section className={`panel result-card ${blocked ? 'is-blocked' : 'is-allowed'}`} role="status" aria-live="polite"
             aria-label={`Result: ${verdict}, attack probability ${percent(p)}`}>
      <div className="result-head">
        <div>
          <p className="eyebrow">Result</p>
          <h2 className="verdict">{verdict}</h2>
          <p className="verdict-sub">
            {blocked ? 'This prompt looks like an injection attempt and would not reach the assistant.'
                     : 'This prompt would be passed to the assistant.'}
          </p>
        </div>
        <div className="confidence" aria-hidden="true">
          <span className="confidence-value">{percent(p)}</span>
          <span className="confidence-label">attack probability</span>
        </div>
      </div>

      {/* The meter shows how far the score is from the blocking threshold. */}
      <div className="meter" aria-hidden="true">
        <div className="meter-fill" style={{ width: `${p * 100}%` }} />
        <div className="meter-threshold" style={{ left: `${threshold * 100}%` }}>
          <span>blocks at {percent(threshold)}</span>
        </div>
      </div>
      <p className="sr-only">The model blocks prompts at {percent(threshold)} or above.</p>

      <dl className="result-facts">
        {result.category && (
          <div><dt>Attack type</dt><dd>{ruleLabel(result.category)}</dd></div>
        )}
        <div>
          <dt>Matched patterns</dt>
          <dd>{result.matched_rules.length ? result.matched_rules.map(ruleLabel).join(', ') : 'None'}</dd>
        </div>
      </dl>

      <p className="explanation">{result.explanation}</p>

      <h3 className="small-heading">Your prompt{result.matched_rules.length ? ', with the matched words marked' : ''}</h3>
      <HighlightedText segments={result.segments} />
    </section>
  )
}
