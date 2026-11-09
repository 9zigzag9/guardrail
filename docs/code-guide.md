# Code guide: where everything is

[Back to README](../README.md)

## Folders

| Path | What it is |
|---|---|
| `backend/` | FastAPI back end (the API, its defences and the served model) |
| `frontend/` | React website (Vite) |
| `ml/` | The machine learning code from Assignment 2. The back end imports `ml/prompt_injection_guardrail.py` |
| `tests/` | All automated tests: 22 for the model library, 58 for the API. Run with `python -m pytest -q` |
| `demo_requests/` | Attack demos run against your own local server, and sample request bodies |
| `data/` | The processed dataset and the exact train/test split used for the deployed model |
| `outputs/` | Everything the training run produced (tables, charts, models) and the evasion measurements |
| `docs/` | The documentation listed in the README |
| `environment.yml` | The conda environment (installs `ml/requirements.txt` and `backend/requirements.txt`) |
| `pytest.ini` | Test settings, so `python -m pytest` finds the tests and the code |

## Back end (`backend/`)

| File | What it does |
|---|---|
| `main.py` | The API: endpoints, request and response models, middleware (CORS, security headers, body size limit, error format) and admission control |
| `inference.py` | The worker processes that run the model, so a slow check never blocks other requests |
| `history.py` | The SQLite history of past checks, using parameterised queries only |
| `model_stats.py` | Builds the figures and chart data for the Our data page from `outputs/` and the dataset |
| `make_hashes.py` | Records the SHA-256 hashes of the model files after a retrain |
| `model/` | The served model files and `model_meta.json` (model name and threshold) |
| `model_hashes.json` | The expected hashes, checked at startup |
| `requirements.txt`, `requirements-frozen.txt` | Pinned packages, and the full lock file |
| `.env.example` | Every setting with its default |

## Machine learning (`ml/`)

| File | What it does |
|---|---|
| `prompt_injection_guardrail.py` | The library: text cleaning (including the look-alike letter defence), features, model pipelines, evaluation, clustering and `explain()` |
| `prompt_injection_guardrail_hf.py` | Runs the whole training workflow end to end and saves the model |
| `predict.py` | Checks prompts from the command line using the saved model |
| `prompt_injection_guardrail.ipynb` | The training workflow step by step, with explanations and charts |
| `requirements.txt` | Pinned machine learning packages |

## Front end (`frontend/`)

Commands (run inside `frontend/`, Node.js 22 or later):

```bash
npm ci          # installs the exact versions in package-lock.json
npm run dev     # http://localhost:5173  (start the back end first)
npm run build   # production build in dist/
npm run lint
```

The back end address defaults to `http://localhost:8000`. To change it, copy `.env.example` to `.env.local` and edit `VITE_API_URL`.

| File | What it does |
|---|---|
| `src/main.jsx`, `src/App.jsx` | Starts the app; the header, navigation and page routes |
| `src/api.js` | The only code that calls the back end: session ID, time limit, readable errors |
| `src/validation.js` | Checks a prompt before sending (the back end repeats every check) |
| `src/format.js` | Turns API values into readable labels, including model and feature names |
| `src/useElementWidth.js` | Measures a chart's width, so the hand-drawn charts keep readable text on a phone |
| `src/exportChart.js` | Saves a chart as PNG or its data as CSV, in the browser (CSV cells that a spreadsheet would run as a formula are neutralised) |
| `src/pages/CheckPage.jsx` | Main page: form, result, charts, history, and the loading, success and error states |
| `src/pages/DataPage.jsx` | Our data: dataset, attack types, test results, model comparison, examples and the training charts, loaded live from `GET /api/model-stats` |
| `src/pages/AboutPage.jsx` | About the project and the team |
| `src/pages/NotFoundPage.jsx` | Page for addresses that do not exist |
| `src/components/PromptForm.jsx` | The prompt box, with checks beside the field before sending |
| `src/components/ResultCard.jsx` | The decision and its confidence, the most prominent element |
| `src/components/HighlightedText.jsx` | Marks the matched words using the API's `segments`, as plain text (never HTML) |
| `src/components/SessionChart.jsx` | Chart 1: risk of every check this session; select a dot to see that check |
| `src/components/CategoryChart.jsx` | Chart 2: blocked checks by attack type; select a bar to filter the list |
| `src/components/ThresholdExplorer.jsx` | Our data: a threshold slider with a live confusion matrix, and ROC and precision-recall curves for every model; select a point to use that threshold |
| `src/components/LengthChart.jsx` | Our data: prompt length of safe prompts and attacks, as counts or as a share of each class |
| `src/components/ClusterChart.jsx` | Our data: k-means scores for each number of attack groups tried |
| `src/components/EvasionChart.jsx` | Our data: how many disguised attacks got through, by attacker request budget, for each version of the guardrail |
| `src/components/ExportButtons.jsx` | The Download PNG and Download CSV buttons on every chart |
| `src/components/FeatureChart.jsx` | Our data: box plot of any engineered feature, safe against attack (drawn as plain SVG) |
| `src/components/CorrelationChart.jsx` | Our data: correlation heatmap of the features; select a square to explain that pair |
| `src/components/ClusterMap.jsx` | Our data: map of 3,000 attack prompts coloured by k-means or DBSCAN group; hover to read an attack |
| `src/components/CheckDetail.jsx` | Details of the check selected in a chart or the list |
| `src/components/HistoryPanel.jsx` | Searchable list of past checks; the keyboard route to everything the charts do |
| `src/components/ErrorBoundary.jsx` | Fallback page for unexpected errors, so the screen is never blank |
| `src/index.css` | All styles, including the team prototype's background and glass panels |

## Tests (`tests/`)

| File | What it tests |
|---|---|
| `test_prompt_injection_guardrail.py` | The model library: cleaning, look-alike folding, features, data loading, explanations |
| `test_api.py` | The API with the real model: every endpoint, errors, size limits, the denial-of-service and SQL injection defences, the Our data page |

## Security demos (`demo_requests/`)

| File | What it shows |
|---|---|
| `dos_attack.py` | The denial-of-service attack, before and after the defence |
| `sqli_demo.py` | The SQL injection attack on an unsafe query, then the same input against the real API |
| `evasion_attack.py` | The look-alike letter attack and its measurement (writes `outputs/evasion_*.json` and the chart) |
| `*.json` | Sample request bodies for trying the API by hand |
