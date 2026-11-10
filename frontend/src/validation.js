import { MAX_TEXT_CHARS } from './api.js'

// Returns a message for the user, or null when the text can be sent. These checks are for
// usability only: the back end repeats them, because an attacker does not use this form.
export function validatePrompt(text) {
  if (!text.trim()) return 'Enter a prompt to check. It cannot be empty or only spaces.'
  if (text.length > MAX_TEXT_CHARS) {
    return `This prompt is ${text.length.toLocaleString()} characters. The limit is ${MAX_TEXT_CHARS.toLocaleString()}.`
  }
  return null
}
