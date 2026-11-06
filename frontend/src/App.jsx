import { NavLink, Route, Routes } from 'react-router-dom'
import AboutPage from './pages/AboutPage.jsx'
import CheckPage from './pages/CheckPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <NavLink to="/" className="brand" aria-label="AI Prompt Injection Detector, home">
          <span className="brand-dot" aria-hidden="true" />
          <span>AI Prompt Injection Detector</span>
        </NavLink>
        <nav aria-label="Main">
          <NavLink to="/" end>Check a prompt</NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<CheckPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <footer className="site-footer">
        <p>COS30049 Computing Technology Innovation Project, Session 11 Group 3</p>
      </footer>
    </>
  )
}
