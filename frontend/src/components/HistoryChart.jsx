import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function HistoryChart({ history }) {
  const data = history.map((h) => ({
    check: `#${h.n}`,
    'Attack probability (%)': Math.round(h.probability * 1000) / 10,
    'Blocking threshold (%)': Math.round(h.threshold * 1000) / 10,
  }));

  return (
    <figure className="chart-card">
      <figcaption className="chart-title">Your checks this session vs. the blocking threshold</figcaption>
      {data.length === 0 ? (
        <p className="chart-empty">No checks yet. Run a test on the Home page and come back to see it here.</p>
      ) : (
        <div className="chart-box" role="img" aria-label={`Chart of attack probability for your last ${data.length} checks compared with the threshold.`}>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="check" label={{ value: 'Check number', position: 'insideBottom', offset: -18 }} />
              <YAxis domain={[0, 100]} label={{ value: 'Percent', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend verticalAlign="top" />
              <Bar dataKey="Attack probability (%)" fill="#1d4ed8" />
              <Line type="monotone" dataKey="Blocking threshold (%)" stroke="#b91c1c" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}
