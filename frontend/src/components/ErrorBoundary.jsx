import { Component } from 'react'

// Catches any error thrown while rendering and shows a fallback page instead of a blank screen.
// React only supports this as a class component.
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('Unexpected error in the interface', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="page page-centered" role="alert">
        <section className="panel message-panel">
          <p className="eyebrow">Something went wrong</p>
          <h1>The page stopped working</h1>
          <p className="subtitle">
            An unexpected error happened in the interface. Your prompts were not lost: the history is kept
            on the server for this tab.
          </p>
          <div className="button-row">
            <button type="button" onClick={() => window.location.reload()}>Reload the page</button>
            <a className="btn-secondary" href="/">Go to the home page</a>
          </div>
        </section>
      </main>
    )
  }
}
