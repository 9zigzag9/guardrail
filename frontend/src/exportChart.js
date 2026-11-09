// Download helpers for the charts: a PNG picture of a chart, or the numbers behind it as CSV.
// Everything happens in the browser; nothing is sent to the server.

function save(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Spreadsheet apps treat a cell that starts with = + - @ (or a tab or carriage return) as a formula, so a
// prompt such as =HYPERLINK(...) could run when the file is opened (CSV injection). Text cells like that
// get a leading apostrophe, which makes the spreadsheet show them as plain text. Numbers are left alone.
export function csvCell(value) {
  if (value == null) return ''
  let s = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

// rows: an array of objects that share the same keys; the keys become the header row.
export function downloadCsv(filename, rows) {
  const keys = Object.keys(rows[0] ?? {})
  const lines = [keys.map(csvCell).join(','), ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(','))]
  // The byte order mark tells Excel the file is UTF-8, so non-English characters open correctly.
  save(new Blob(['\ufeff', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), filename)
}

// Saves an image the back end serves (the training charts shown as pictures). The file is fetched first,
// because browsers ignore a plain download link to another address (the API runs on a different port).
export async function downloadUrl(url, filename) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('The chart could not be downloaded.')
  save(await response.blob(), filename)
}

// Draws the chart's SVG onto a white canvas with its title above and a legend below, then saves it as PNG.
export async function downloadPng(container, filename, title, legend = []) {
  // Recharts also draws small SVG icons, so take the largest SVG: that is the chart itself.
  const svg = [...container.querySelectorAll('svg.recharts-surface')]
    .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0]
  if (!svg) throw new Error('The chart has not been drawn yet.')
  const { width, height } = svg.getBoundingClientRect()
  const font = getComputedStyle(svg).fontFamily
  const clone = svg.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', width)
  clone.setAttribute('height', height)
  clone.style.fontFamily = font

  const image = new Image()
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = () => reject(new Error('The chart could not be turned into an image.'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`
  })

  const scale = 2                          // twice the screen size, so the picture stays sharp in documents
  const pad = 16
  const head = title ? 40 : 0
  const foot = legend.length ? 32 : 0
  const w = width + pad * 2
  const h = height + head + foot + pad * 2
  const canvas = document.createElement('canvas')
  canvas.width = w * scale
  canvas.height = h * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.textBaseline = 'middle'
  if (title) {
    ctx.fillStyle = '#17202a'
    ctx.font = `600 16px ${font}`
    ctx.fillText(title, pad, pad + head / 2 - 4)
  }
  ctx.drawImage(image, pad, pad + head, width, height)
  let x = pad
  const y = pad + head + height + foot / 2
  ctx.font = `13px ${font}`
  for (const { name, colour } of legend) {
    ctx.fillStyle = colour
    ctx.fillRect(x, y - 6, 12, 12)
    ctx.fillStyle = '#17202a'
    ctx.fillText(name, x + 18, y)
    x += 18 + ctx.measureText(name).width + 20
  }
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  save(blob, filename)
}
