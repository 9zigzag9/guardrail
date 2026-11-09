import { useState } from 'react'
import { downloadCsv, downloadPng, downloadUrl } from '../exportChart.js'

// "Download PNG" saves the chart as it looks now (only the series that are switched on).
// "Download CSV" saves the numbers behind it. `name` becomes the file name.
// For a chart that is already an image (`imageUrl`), "Download PNG" saves that image.
export default function ExportButtons({ chartRef, imageUrl, name, title, legend = [], rows }) {
  const [error, setError] = useState(null)
  const savePng = () => {
    setError(null)
    const saving = imageUrl
      ? downloadUrl(imageUrl, `guardrail-${name}.png`)
      : downloadPng(chartRef.current, `guardrail-${name}.png`, title, legend)
    saving.catch((e) => setError(e.message))
  }
  return (
    <div className="export-actions">
      {(chartRef || imageUrl) && (
        <button type="button" className="btn-secondary btn-small" onClick={savePng} aria-label={`Download "${title}" as a PNG image`}>
          Download PNG
        </button>
      )}
      {rows?.length > 0 && (
        <button type="button" className="btn-secondary btn-small" onClick={() => downloadCsv(`guardrail-${name}.csv`, rows)}
                aria-label={`Download the data for "${title}" as a CSV file`}>
          Download CSV
        </button>
      )}
      {error && <span className="inline-error" role="alert">{error}</span>}
    </div>
  )
}
