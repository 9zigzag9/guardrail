# Prompt Injection Guardrail (COS30049 Assignment 3)

**Session 11, Group 3:** Zahara Rashini Amarasiri Gunawardana, Le Thuy Duong Nguyen, Tomas Agustin Cornejo Beltran

A website that checks a prompt **before** it reaches an AI assistant and **allows** it or **blocks** it as a prompt injection, with the model's confidence, the words that triggered it and a one-line explanation. React front end, FastAPI back end, and the scikit-learn model from Assignment 2.

## Documentation

| Read this | For |
|---|---|
| **This README** | Setting up a clean machine, starting, stopping, re-running and testing; then the work to be marked, architecture, threat model, versions and references |
| [docs/running.md](docs/running.md) | The full guide: every step explained, retraining, security demos, settings, troubleshooting |
| [docs/architecture.md](docs/architecture.md) | What the app is, how a request flows through it, endpoints, pinned versions |
| [docs/security.md](docs/security.md) | The three defences to be marked: how each attack works, the defence, before and after results, cost |
| [docs/model.md](docs/model.md) | The machine learning model: data, training, test results |
| [docs/code-guide.md](docs/code-guide.md) | Where every file is and what it does |

## Quick start

### 1. You need

[Miniconda](https://docs.conda.io/en/latest/miniconda.html) (or Anaconda) and [Node.js](https://nodejs.org/) 22 or later. Commands below work in Anaconda Prompt, PowerShell, or a macOS/Linux terminal. If `conda` is not recognised in PowerShell, use Anaconda Prompt instead.

### 2. Set up (once)

Unzip the submitted ZIP and open a terminal in the unzipped folder (the one that contains this README). Then:

```bash
conda env create -f environment.yml
cd frontend
npm ci
cd ..
```

This installs the exact pinned versions. It takes a few minutes the first time. Using Git instead of the ZIP? Run `git clone https://github.com/9zigzag9/guardrail.git` and `cd guardrail` first.

### 3. Start (every time), from the project folder

Terminal 1, the back end:

```bash
conda activate guardrail
python -m uvicorn backend.main:app --port 8000 --no-server-header
```

Wait for `Application startup complete`. Then terminal 2, the website:

```bash
cd frontend
npm run dev
```

### 4. Check it works

Open **http://localhost:5173**. The status pill should be green. Choose the *Direct injection* example and select **Check prompt**: it should be **Blocked**. The API documentation is at http://localhost:8000/docs.

### 5. Stop, re-run and reset

- **Stop:** press `Ctrl` + `C` in both terminals.
- **Re-run:** repeat step 3. Setup (step 2) is only needed once.
- **Start with an empty history:** stop the back end and delete `backend/data/history.db`.
- **After pulling new code:** `conda env update -f environment.yml --prune`, then `npm ci` in `frontend/`.

### 6. Run the tests

No server needed:

```bash
conda activate guardrail
python -m pytest -q
cd frontend
npm run lint
```

All 80 tests should pass.

### 7. Retrain the model (optional)

```bash
python ml/prompt_injection_guardrail_hf.py --repos data/dataset_clean.csv
```

The website's **Our data** page shows the new results straight away. To make the website *use* the new model, follow [docs/running.md, section 7.3](docs/running.md#73-deploy-the-new-model).

Something not working? See [troubleshooting](docs/running.md#10-troubleshooting).

## Security work to be marked

| Section | Choice | Level | Details |
|---|---|---|---|
| 2.7 Defence 1 | Denial of service | Advanced | [security.md](docs/security.md#defence-1-denial-of-service-advanced) |
| 2.7 Defence 2 | SQL injection (history of past checks) | Intermediate | [security.md](docs/security.md#defence-2-sql-injection-intermediate) |
| 2.8 Advanced security | Detection evasion (look-alike letters) | Advanced | [security.md](docs/security.md#advanced-security-detection-evasion) |

## Architecture in brief

![Architecture diagram: the React website, the FastAPI back end and the files on the server, with the three defences marked](docs/diagrams/architecture.png)

One request traced step by step, and the endpoint list, are in [docs/architecture.md](docs/architecture.md).

## Threat model

**Who would attack it?**
1. **Someone trying to misuse the AI assistant behind the guardrail.** This is the main attacker. They write prompt injections and jailbreaks and want them to be **allowed**.
2. **Someone who wants the guardrail out of the way.** If the guardrail is slow or down, the assistant is either unprotected or unavailable, which is a win for attacker 1 or a denial of service for everyone.
3. **A curious or hostile user of the same deployment** who wants to read prompts other people have checked. Checked prompts can contain confidential instructions, customer data or internal system prompts.

**What are they trying to achieve?** Get an injection past the model (evasion); make the server stop answering or answer too slowly to be useful; read or change stored checks that are not theirs; learn how the model decides so they can craft prompts that just pass.

**What can they actually do?** They do not need our interface. They can send any HTTP request directly with curl or a script: any text up to the size limit, unusual Unicode, SQL syntax and LIKE wildcards in the text and the history search, thousands of requests in a short time, and text crafted to be expensive to process (for example input that makes a regular expression backtrack). They cannot log in (there are no accounts) and cannot change files on the server.

**Which risks in section 2.7 our design exposes**

| Risk | Applies? | Why |
|---|---|---|
| Denial of service | **Yes, chosen** | Running the model costs far more than sending a request, and our text features use regular expressions that can be made to backtrack. A slow guardrail is attacker 2's goal. |
| SQL injection | **Yes, chosen** | We store every check in SQLite and search it. Every input to a prompt injection guardrail is itself an attack string, so hostile text reaching SQL is guaranteed, not hypothetical. |
| Missing rate limiting | Yes, partly | The admission control built for denial of service caps how much work runs at once, but there is no per-client limit, so one client can still probe the model at the server's full speed. Not chosen, because both defences would rely on the same mechanism; listed under next steps. |
| Unsafe model loading | Yes | The model is a joblib file. The SHA-256 hash check at startup is in place but not submitted. |
| Misconfiguration and dependencies | Yes | Security headers, docs settings and audits are in place (see [Security hygiene](docs/security.md#security-hygiene-and-other-measures)), but OWASP ZAP was not run, so it is not submitted. |
| Command injection | No | The back end never runs a system command. |
| Unsafe file upload | No | The application accepts only JSON text, never files. |
| SSRF | No | The back end never makes an outbound request based on input. |
| Broken access control | No | There are no user accounts. History is kept apart per browser session instead, and another session's IDs answer 404. |

Attacker 1 is the reason for the advanced security work: an injection that the model misses because a few letters were swapped for look-alike Unicode characters is exactly "an injection that gets past the guardrail".

How each chosen risk is defended, with before and after results: [docs/security.md](docs/security.md).

## Pinned versions

Python 3.14, FastAPI 0.162.0, Starlette 1.10.0, Pydantic 2.14.1, uvicorn 0.54.0, scikit-learn 1.9.1, pandas 3.0.6, numpy 2.5.3. Node.js 22, React 19.3.1, Vite 8.3.5, react-router-dom 7.18.4, Recharts 3.10.1. Every version is pinned in `ml/requirements.txt`, `backend/requirements.txt` and `frontend/package-lock.json`; the full table is in [docs/architecture.md](docs/architecture.md#pinned-dependency-versions).

## References

Swinburne Harvard style.

Boucher, N, Shumailov, I, Anderson, R & Papernot, N 2022, 'Bad characters: imperceptible NLP attacks', *2022 IEEE Symposium on Security and Privacy (SP)*, IEEE, San Francisco, CA, pp. 1987-2004.

deepset 2023, *Prompt injections*, dataset, Hugging Face, viewed 4 October 2026, <https://huggingface.co/datasets/deepset/prompt-injections>.

FastAPI 2026, *FastAPI documentation*, viewed 9 November 2026, <https://fastapi.tiangolo.com/>.

Greshake, K, Abdelnabi, S, Mishra, S, Endres, C, Holz, T & Fritz, M 2023, 'Not what you've signed up for: compromising real-world LLM-integrated applications with indirect prompt injection', *Proceedings of the 16th ACM Workshop on Artificial Intelligence and Security (AISec '23)*, ACM, Copenhagen, pp. 79-90.

Liu, Y, Jia, Y, Geng, R, Jia, J & Gong, NZ 2024, 'Formalizing and benchmarking prompt injection attacks and defenses', *33rd USENIX Security Symposium*, USENIX Association, Philadelphia, PA, pp. 1831-1847.

NeurAlchemy 2026, *Prompt injection and jailbreak detection dataset*, dataset, Hugging Face, viewed 4 October 2026, <https://huggingface.co/datasets/neuralchemy/Prompt-injection-dataset>.

OWASP Foundation 2021, *OWASP Top 10:2021*, viewed 9 November 2026, <https://owasp.org/Top10/>.

OWASP Foundation n.d., *Denial of service cheat sheet*, OWASP Cheat Sheet Series, viewed 9 November 2026, <https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html>.

OWASP Foundation n.d., *Regular expression denial of service - ReDoS*, viewed 9 November 2026, <https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS>.

OWASP Foundation n.d., *SQL injection prevention cheat sheet*, OWASP Cheat Sheet Series, viewed 9 November 2026, <https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html>.

Pedregosa, F, Varoquaux, G, Gramfort, A, Michel, V, Thirion, B, Grisel, O, Blondel, M, Prettenhofer, P, Weiss, R, Dubourg, V, Vanderplas, J, Passos, A, Cournapeau, D, Brucher, M, Perrot, M & Duchesnay, E 2011, 'Scikit-learn: machine learning in Python', *Journal of Machine Learning Research*, vol. 12, pp. 2825-2830.

Perez, F & Ribeiro, I 2022, *Ignore previous prompt: attack techniques for language models*, NeurIPS ML Safety Workshop, viewed 7 October 2026, <https://arxiv.org/abs/2211.09527>.

Python Software Foundation 2026, *concurrent.futures: launching parallel tasks*, Python 3 documentation, viewed 9 November 2026, <https://docs.python.org/3/library/concurrent.futures.html>.

Python Software Foundation 2026, *sqlite3: DB-API 2.0 interface for SQLite databases*, Python 3 documentation, viewed 9 November 2026, <https://docs.python.org/3/library/sqlite3.html>.

React 2026, *React documentation*, viewed 9 November 2026, <https://react.dev/>.

Recharts 2026, *Recharts documentation*, viewed 9 November 2026, <https://recharts.org/>.

S-Labs 2026, *Prompt injection detection dataset*, dataset, Hugging Face, viewed 4 October 2026, <https://huggingface.co/datasets/S-Labs/prompt-injection-dataset>.

Swinburne University of Technology 2026, 'Assignment 3: full-stack web development for a secure AI application', *COS30049 Computing technology innovation project*, Learning materials via Canvas, Swinburne University of Technology, viewed 9 November 2026.

Unicode Consortium n.d., *Unicode Technical Standard #39: Unicode security mechanisms*, viewed 9 November 2026, <https://www.unicode.org/reports/tr39/>.

Vite 2026, *Vite documentation*, viewed 9 November 2026, <https://vite.dev/>.

xTRam1 2024, *safe-guard-prompt-injection*, dataset, Hugging Face, viewed 4 October 2026, <https://huggingface.co/datasets/xTRam1/safe-guard-prompt-injection>.

### Use of generative AI

Generative AI was used to add code comments and help with documentation (README, notebook), to understand and plot out data analysis, and for error checking due to time constraints. All code and information were reviewed with lecture material, edited and written by the team, and all results come from our own code and runs.
