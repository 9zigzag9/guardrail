const TEAM = [
  { name: 'Zahara Rashini Amarasiri Gunawardana', email: '101233292@student.swin.edu.au' },
  { name: 'Le Thuy Duong Nguyen', email: '105080751@student.swin.edu.au' },
  { name: 'Tomas Agustin Cornejo Beltran', email: '105320237@student.swin.edu.au' },
]

const STEPS = [
  ['Clean', 'The text is normalised so common disguises (leetspeak such as 1gn0re, invisible characters, look-alike letters, base64, spaced letters) cannot hide an attack.'],
  ['Score', 'A machine learning model trained on 32,003 labelled prompts from four public datasets gives the probability that the prompt is an injection.'],
  ['Decide', 'Prompts at or above the blocking threshold are blocked. The threshold was chosen to catch at least 90% of attacks while blocking as few safe prompts as possible.'],
  ['Explain', 'Matched attack patterns are highlighted in your own words, with the attack type and a one-sentence reason.'],
]

export default function AboutPage() {
  return (
    <main id="main" className="page">
      <section className="intro">
        <p className="eyebrow">About</p>
        <h1>A guardrail for AI assistants</h1>
        <p className="subtitle">
          A prompt injection is a message that tries to make an AI assistant ignore its instructions, for example
          by asking it to reveal its hidden system prompt. This tool checks each prompt before it reaches the assistant.
        </p>
      </section>

      <div className="about-grid">
        <section className="panel">
          <h2 className="chart-title">Who it is for</h2>
          <ul className="plain-list">
            <li><strong>People using an AI assistant</strong>, who need a fast check that rarely blocks a genuine request.</li>
            <li><strong>IT and security teams</strong>, who need attacks caught reliably and an explanation they can act on.</li>
          </ul>
        </section>
        <section className="panel">
          <h2 className="chart-title">Limits to know about</h2>
          <ul className="plain-list">
            <li>The model is trained on English prompts, so attacks in other languages are often missed.</li>
            <li>Harmful requests that contain no injection wording may be allowed.</li>
            <li>It is one layer of defence, not a replacement for the assistant's own safety controls.</li>
          </ul>
        </section>
      </div>

      <section className="panel">
        <h2 className="chart-title">How a prompt is checked</h2>
        <ol className="steps">
          {STEPS.map(([title, text]) => (
            <li key={title}><strong>{title}</strong><span>{text}</span></li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <h2 className="chart-title">Our team</h2>
        <ul className="team">
          {TEAM.map((m) => (
            <li key={m.email}>
              <span className="avatar" aria-hidden="true">{m.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
              <span className="team-name">{m.name}</span>
              <a href={`mailto:${m.email}`}>{m.email}</a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
