// Small display helpers shared by the result, the charts and the history list.

export const percent = (p) => `${(p * 100).toFixed(1)}%`

const MODEL_NAMES = { logistic: 'Logistic regression', linear_svm: 'Linear SVM (calibrated)', random_forest: 'Random forest' }
export const modelName = (m) => MODEL_NAMES[m] ?? m

// The engineered features in words: [full name, short name for tight chart labels].
const FEATURE_NAMES = {
  len_raw: ['Length (characters)', 'Length'],
  entropy_raw: ['Character randomness (entropy)', 'Entropy'],
  punct_raw: ['Share of punctuation', 'Punctuation'],
  digit_raw: ['Share of digits', 'Digits'],
  non_ascii_ratio: ['Share of non-English characters', 'Non-ASCII'],
  zero_width: ['Hidden zero-width characters', 'Zero-width'],
  spaced_letters: ['Spaced or dotted letters', 'Spaced letters'],
  leet_tokens: ['Share of words in leetspeak', 'Leetspeak'],
  b64_decoded: ['Base64 text that was decoded', 'Base64'],
  struct_markers: ['Chat-format markers', 'Chat markers'],
  override_hits: ['"Ignore your instructions" phrases', 'Override'],
  role_hits: ['Role-play phrases', 'Role-play'],
  extract_hits: ['"Reveal your prompt" phrases', 'Extraction'],
  word_count: ['Number of words', 'Words'],
}
export const featureLabel = (name, short = false) => FEATURE_NAMES[name]?.[short ? 1 : 0] ?? name

const RULE_LABELS = {
  instruction_override: 'Instruction override',
  prompt_extraction: 'Prompt extraction',
  role_jailbreak: 'Role-play jailbreak',
  social_engineering: 'Social engineering',
  embedded_attack: 'Embedded attack',
  obfuscation: 'Disguised text',
  mixed_script: 'Mixed alphabets in one word',
  unclassified: 'Other attack',
}

// Category names from the model look like "prompt_extraction / Evasion"; show them in words.
export function ruleLabel(name) {
  if (!name) return ''
  const [base, evasion] = name.split(' / ')
  const label = RULE_LABELS[base] ?? base.replaceAll('_', ' ')
  return evasion ? `${label} (disguised)` : label
}

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
