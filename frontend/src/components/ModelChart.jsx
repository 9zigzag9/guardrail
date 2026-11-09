import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Numbers from the README "Results of the submitted run" table (test set, 6,401 prompts).
const DATA = [
  { model: 'Logistic regression', Precision: 0.983, Recall: 0.902, 'ROC-AUC': 0.992 },
  { model: 'Linear SVM', Precision: 0.984, Recall: 0.9, 'ROC-AUC': 0.992 },
  { model: 'Random forest', Precision: 0.982, Recall: 0.915, 'ROC-AUC': 0.994 },
];

export default function ModelChart() {
  return (
    <figure className="chart-card">
      <figcaption className="chart-title">Model comparison on the test set</figcaption>
      <div className="chart-box" role="img" aria-label="Bar chart comparing precision, recall and ROC-AUC of three models. All score between 0.90 and 0.99.">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={DATA} margin={{ top: 10, right: 16, left: 8, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="model" label={{ value: 'Model', position: 'insideBottom', offset: -18 }} />
            <YAxis domain={[0.85, 1]} tickFormatter={(v) => v.toFixed(2)} label={{ value: 'Score', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(v) => v.toFixed(3)} />
            <Legend verticalAlign="top" />
            <Bar dataKey="Precision" fill="#1d4ed8" />
            <Bar dataKey="Recall" fill="#b45309" />
            <Bar dataKey="ROC-AUC" fill="#0f766e" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-note">The y-axis starts at 0.85 so the small differences are visible.</p>
    </figure>
  );
}
