import { Link, useLocation } from 'react-router-dom'

export default function NotFoundPage() {
  const { pathname } = useLocation()
  return (
    <main id="main" className="page page-centered">
      <section className="panel message-panel">
        <p className="eyebrow">Error 404</p>
        <h1>Page not found</h1>
        {/* The path is rendered as text by React, so a crafted address cannot inject markup. */}
        <p className="subtitle">There is no page at <code>{pathname}</code>.</p>
        <div className="button-row">
          <Link className="button" to="/">Check a prompt</Link>
          <Link className="btn-secondary" to="/about">About this tool</Link>
        </div>
      </section>
    </main>
  )
}
