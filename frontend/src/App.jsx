import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';

export default function App() {
  // Checks made this session, used by the chart on the Data page.
  const [history, setHistory] = useState([]);
  const addToHistory = (entry) =>
    setHistory((h) => [...h, { ...entry, n: h.length + 1 }].slice(-15));

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Header />
      <main id="main" tabIndex={-1}>
        <Outlet context={{ history, addToHistory }} />
      </main>
      <Footer />
    </>
  );
}
