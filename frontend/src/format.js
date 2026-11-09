// Small display helpers shared by the result, the charts and the history list.

export const percent = (p) => `${(p * 100).toFixed(1)}%`

const MODEL_NAMES = { logistic: 'Logistic regression', linear_svm: 'Linear SVM (calibrated)', random_forest: 'Random forest' }
export const modelName = (m) => MODEL_NAMES[m] ?? m

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
