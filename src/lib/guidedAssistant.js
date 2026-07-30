export function getAssistantStepError(step, form) {
  if (typeof step.validate === 'function') return step.validate(form) || ''

  if (step.fields) {
    const missing = step.fields.find((field) => field.required && !String(form?.[field.field] ?? '').trim())
    if (missing) return `${missing.label} is required before continuing.`
  }

  if (step.multiChoice) {
    const selected = Array.isArray(form?.[step.multiChoice.field]) ? form[step.multiChoice.field] : []
    if (selected.length < (step.multiChoice.min || 0)) return step.multiChoice.error || 'Choose at least one option.'
  }

  if (step.timeGroup) {
    const selected = Array.isArray(form?.[step.timeGroup.enabledField]) ? form[step.timeGroup.enabledField] : []
    const missingTime = step.timeGroup.options.find((option) => selected.includes(option.value) && !form?.[option.field])
    if (missingTime) return `Choose a time for ${missingTime.label.toLowerCase()}.`
  }

  return ''
}

export function setAssistantField(form, field, value) {
  return { ...form, [field]: value }
}

export function toggleAssistantChoice(form, field, value) {
  const selected = Array.isArray(form?.[field]) ? form[field] : []
  return {
    ...form,
    [field]: selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value],
  }
}

export function getAssistantProgress(stepIndex, stepCount) {
  if (!Number.isInteger(stepIndex) || stepCount <= 0) return 0
  return Math.round(((Math.min(stepIndex, stepCount - 1) + 1) / stepCount) * 100)
}
