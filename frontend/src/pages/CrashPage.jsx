// Shown when a component throws while rendering (React Router errorElement).
// No router hooks needed beyond this; a plain <a> does a full reload which also resets the broken state.
export default function CrashPage() {
  return (
    <div className="crash-wrap">
      <section className="about-header notice-page" role="alert">
        <p className="eyebrow">Unexpected error</p>
        <h2>Something went wrong</h2>
        <p className="subtitle">
          The app hit a problem and could not show this page. Your data was not lost on the server.
        </p>
        <p><a className="link-button" href="/">Reload the app</a></p>
      </section>
    </div>
  );
}
