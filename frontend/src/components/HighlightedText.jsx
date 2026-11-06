import { ruleLabel } from '../format.js'

// Shows the prompt with the flagged pieces marked. The back end sends the prompt already split
// into segments, so this only renders text nodes: user input is never parsed or inserted as HTML.
export default function HighlightedText({ segments }) {
  if (!segments.some((s) => s.flagged)) {
    return <p className="prompt-text">{segments.map((s) => s.text).join('')}</p>
  }
  return (
    <p className="prompt-text">
      {segments.map((s, i) =>
        s.flagged
          ? <mark key={i} title={`Matched: ${s.rules.map(ruleLabel).join(', ')}`}>{s.text}</mark>
          : <span key={i}>{s.text}</span>,
      )}
    </p>
  )
}
