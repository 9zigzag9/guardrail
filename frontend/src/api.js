// Backend connection
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';


export const CHECK_PATH = '/api/check';
const REQUEST_FIELD = 'text';

export const MAX_LENGTH = 10000; // backend returns 422 above this

export async function checkPrompt(text, signal) {
  let res;
  try {
    res = await fetch(API_URL + CHECK_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [REQUEST_FIELD]: text }),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Cannot reach the server. Check that the backend is running on port 8000.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    // Errors always look like {"error": {"code", "message"}}
    throw new Error(data?.error?.message || `Request failed (status ${res.status}).`);
  }
  return data;
}
