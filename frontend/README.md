# Front end (React + Vite)

The web interface for the prompt injection guardrail. It talks only to the FastAPI back end in `../backend`.

```bash
npm ci          # installs the exact versions in package-lock.json (Node 22 or later, see .nvmrc)
npm run dev     # http://localhost:5173  (start the back end first)
npm run build   # production build in dist/
npm run lint
```

The back end address defaults to `http://localhost:8000`. To change it, copy `.env.example` to `.env.local`
and edit `VITE_API_URL`.

| Path | What it does |
|---|---|
| `src/api.js` | The only code that calls the back end: session ID, time limit, readable errors |
| `src/pages/CheckPage.jsx` | Main page: form, result, charts, history, and the loading, success and error states |
| `src/components/ResultCard.jsx` | The decision and its confidence, the most prominent element |
| `src/components/HighlightedText.jsx` | Marks the matched words using the API's `segments`, as plain text (never HTML) |
| `src/components/SessionChart.jsx` | Chart 1: risk of every check this session; select a dot to see that check |
| `src/components/CategoryChart.jsx` | Chart 2: blocked checks by attack type; select a bar to filter the list |
| `src/components/HistoryPanel.jsx` | Searchable list of past checks; the keyboard route to everything the charts do |
| `src/components/ErrorBoundary.jsx` | Fallback page for unexpected errors, so the screen is never blank |
| `src/pages/NotFoundPage.jsx` | Page for addresses that do not exist |
| `src/pages/AboutPage.jsx` | About the project and the team (team photos are the prototype's cat pictures) |
| `src/pages/DataPage.jsx` | Our data: dataset sources, attack types, test results, model comparison, example outputs and charts from `outputs/` |
| `src/data/modelStats.json` | Figures for the data page. Rebuild with `python make_data_page_stats.py . frontend/src/data/modelStats.json` from the project root while the back end is running |

The look (background, glass header and panels, gradient buttons, team cards) comes from the team's HTML prototype
(COS30049_Website), with text colours darkened where needed to reach a 4.5:1 contrast ratio.
