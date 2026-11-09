import { NavLink } from 'react-router-dom';

export default function Header() {
  return (
    <header>
      <div className="title" id="title">
        <h1>AI Prompt Injection Detector</h1>
      </div>
      <nav className="nav-menu" id="nav-menu" aria-label="Main">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Home</NavLink>
        <NavLink to="/about" className={({ isActive }) => (isActive ? 'active' : '')}>About</NavLink>
        <NavLink to="/data" className={({ isActive }) => (isActive ? 'active' : '')}>Our Data</NavLink>
      </nav>
    </header>
  );
}
