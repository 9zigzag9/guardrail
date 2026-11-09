import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="about-header notice-page">
      <p className="eyebrow">Error 404</p>
      <h2>Page not found</h2>
      <p className="subtitle">The page you are looking for does not exist or has moved.</p>
      <p><Link className="link-button" to="/">Back to Home</Link></p>
    </section>
  );
}
