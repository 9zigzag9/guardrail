import { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { checkPrompt, MAX_LENGTH } from '../api.js';
import ResultPanel from '../components/ResultPanel.jsx';

export default function Home() {
  const { addToHistory } = useOutletContext();
  const [text, setText] = useState('');
  const [validation, setValidation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const textRef = useRef(null);

  const validate = (value) => {
    if (!value.trim()) return 'Please enter some text before running a scan.';
    if (value.length > MAX_LENGTH)
      return `Text is too long (${value.length} characters). The limit is ${MAX_LENGTH}.`;
    return '';
  };

  async function runTest() {
    if (loading) return;
    const problem = validate(text);
    setValidation(problem);
    setError('');
    if (problem) {
      setResult(null);
      textRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const data = await checkPrompt(text);
      setResult(data);
      addToHistory({ probability: data.attack_probability, threshold: data.threshold, decision: data.decision });
    } catch (err) {
      setResult(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setText('');
    setValidation('');
    setError('');
    setResult(null);
    textRef.current?.focus();
  }

  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runTest();
    }
  }

  const status = loading ? 'Scanning...' : result ? 'Scan complete' : error ? 'Scan failed' : 'Ready to scan';
  const tooLong = text.length > MAX_LENGTH;

  return (
    <>
      <section className="injection-test" aria-labelledby="test-title">
        <div className="test-intro">
          <p className="eyebrow">Live detection</p>
          <h2 id="test-title">Injection Test</h2>
          <p className="subtitle">
            Paste a prompt below and we will show how much of it resembles known injection patterns in our dataset.
          </p>
          <p className="helper-text">
            You can press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run the test.
          </p>
        </div>

        <form
          className="test-panel"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            runTest();
          }}
        >
          <label htmlFor="userInput" className="sr-only">Prompt to test</label>
          <textarea
            id="userInput"
            ref={textRef}
            rows={10}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (validation) setValidation('');
            }}
            onKeyDown={onKeyDown}
            placeholder="Test your injection here."
            aria-invalid={Boolean(validation) || tooLong}
            aria-describedby="inputWarning charCount"
          />
          <div className="field-meta">
            <p className="input-warning" id="inputWarning" role="alert">{validation}</p>
            <p id="charCount" className={`char-count ${tooLong ? 'over' : ''}`}>
              {text.length} / {MAX_LENGTH}
            </p>
          </div>

          <div className="button-row">
            <button type="submit" id="testButton" disabled={loading}>
              {loading ? 'Scanning...' : 'Test Injection'}
            </button>
            <button type="button" id="clearButton" className="btn-secondary" onClick={clearAll} disabled={loading}>
              Clear
            </button>
            <span
              className={`status-pill ${result ? 'is-done' : ''} ${loading ? 'is-loading' : ''} ${error ? 'is-error' : ''}`}
              id="statusPill"
              role="status"
              aria-live="polite"
            >
              <span className="status-dot" aria-hidden="true" />
              {status}
            </span>
          </div>
        </form>
      </section>

      <div aria-live="polite">
        {loading && (
          <div className="loading-box" role="status">
            <span className="spinner" aria-hidden="true" />
            Checking your prompt...
          </div>
        )}

        {error && (
          <div className="error-box" role="alert">
            <strong>Something went wrong.</strong> {error}
          </div>
        )}

        {result && !loading && <ResultPanel result={result} />}
      </div>
    </>
  );
}
