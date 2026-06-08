// Her Job Hub — content.js
// Runs on all pages. Receives HJH_AUTOFILL message from popup and fills form fields.

// ── Native value setter (works with React / Vue / Angular) ────────────────────
function setNativeValue(el, value) {
  try {
    const proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) setter.call(el, value)
    else el.value = value
  } catch {
    el.value = value
  }
  el.dispatchEvent(new Event('input',  { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.dispatchEvent(new Event('blur',   { bubbles: true }))
}

// ── Get all label / hint text associated with an element ─────────────────────
function getFieldContext(el) {
  const parts = []
  if (el.name)          parts.push(el.name)
  if (el.id)            parts.push(el.id)
  if (el.placeholder)   parts.push(el.placeholder)

  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel) parts.push(ariaLabel)

  const ariaLabelledBy = el.getAttribute('aria-labelledby')
  if (ariaLabelledBy) {
    ariaLabelledBy.split(/\s+/).forEach((ref) => {
      const lbl = document.getElementById(ref)
      if (lbl) parts.push(lbl.textContent)
    })
  }

  // Workday / custom apps use data-automation-id
  const autoId = el.getAttribute('data-automation-id')
  if (autoId) parts.push(autoId)

  // Explicit <label for="id">
  if (el.id) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (label) parts.push(label.textContent)
    } catch {}
  }

  // Wrapping <label>
  const parentLabel = el.closest('label')
  if (parentLabel) parts.push(parentLabel.textContent)

  // Immediately preceding sibling text
  let prev = el.previousElementSibling
  if (prev && ['LABEL','SPAN','DIV','P','LEGEND','H1','H2','H3','H4'].includes(prev.tagName)) {
    parts.push(prev.textContent)
  }

  // Parent's preceding sibling (one level up) — catches grid/flex label wrappers
  if (el.parentElement) {
    let prevParent = el.parentElement.previousElementSibling
    if (prevParent) parts.push(prevParent.textContent)
  }

  return parts.map((s) => s?.trim()).filter(Boolean).join(' ').toLowerCase()
}

// ── Classify a field by its context text ─────────────────────────────────────
function classifyField(el) {
  const ctx = getFieldContext(el)
  const ac  = (el.getAttribute('autocomplete') || '').toLowerCase()
  const tag = el.tagName

  // Autocomplete attribute is most reliable — check first
  if (ac === 'given-name'  || ac.includes('given-name'))  return 'firstName'
  if (ac === 'family-name' || ac.includes('family-name')) return 'lastName'
  if (ac === 'name')                                       return 'fullName'
  if (ac.includes('email'))                               return 'email'
  if (ac.includes('tel'))                                 return 'phone'
  if (ac.includes('url') && /portfolio|website/i.test(ctx)) return 'website'

  // Pattern matching on context
  if (/\b(first[\s_-]?name|fname|given[\s_-]?name|forename)\b/.test(ctx)) return 'firstName'
  if (/\b(last[\s_-]?name|lname|surname|family[\s_-]?name)\b/.test(ctx))   return 'lastName'
  if (/\bfull[\s_-]?name\b/.test(ctx))                                       return 'fullName'
  if (/\bemail\b/.test(ctx))                                                 return 'email'
  if (/\b(phone|mobile|telephone|cell|contact[\s_-]?number)\b/.test(ctx))   return 'phone'
  if (/\blinkedin\b/.test(ctx))                                              return 'linkedIn'
  if (/\b(portfolio|personal[\s_-]?website|personal[\s_-]?url)\b/.test(ctx))return 'website'
  if (/\b(city|location|address|where|region)\b/.test(ctx))                 return 'location'
  if (/\b(salary|compensation|expected[\s_-]?pay|wage|ctc|rate)\b/.test(ctx)) return 'salary'

  // Textareas — order matters: cover letter before resume
  if (tag === 'TEXTAREA') {
    if (/\b(cover[\s_-]?letter|motivation|why[\s_-]?(you|us|apply|this|interested)|statement|message|interest)\b/.test(ctx)) return 'coverLetter'
    if (/\b(resume|cv|work[\s_-]?experience|background|employment|summary)\b/.test(ctx)) return 'resumeText'
  }

  return null
}

// ── Generic fill across all inputs/textareas on the page ─────────────────────
function autofillGeneric(profile, coverLetter) {
  const fields = Array.from(
    document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea')
  )

  const filledTypes = new Set()
  let count = 0

  for (const el of fields) {
    if (el.disabled || el.readOnly || el.value) continue

    const type = classifyField(el)
    if (!type || filledTypes.has(type)) continue

    let value = null
    switch (type) {
      case 'firstName':   value = profile.firstName; break
      case 'lastName':    value = profile.lastName;  break
      case 'fullName':    value = profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' '); break
      case 'email':       value = profile.email;     break
      case 'phone':       value = profile.phone;     break
      case 'linkedIn':    value = profile.linkedIn;  break
      case 'website':     value = profile.portfolio; break
      case 'location':    value = profile.location;  break
      case 'salary':      value = profile.salary;    break
      case 'coverLetter': value = coverLetter || null; break
      case 'resumeText':  value = profile.resume || null; break
    }

    if (value) {
      setNativeValue(el, value)
      filledTypes.add(type)
      count++
    }
  }

  return count
}

// ── Site-specific overrides (run before generic fill) ─────────────────────────
function autofillSiteSpecific(profile, coverLetter) {
  const host = location.hostname
  let count = 0

  // ── LinkedIn Easy Apply ──────────────────────────────────────────────────
  if (host.includes('linkedin.com')) {
    const tryFill = (sel, value) => {
      if (!value) return
      const el = document.querySelector(sel)
      if (el && !el.value && !el.disabled) { setNativeValue(el, value); count++ }
    }
    tryFill('.artdeco-text-input--input[name="phoneNumber"]', profile.phone)
    tryFill('.artdeco-text-input--input[name="city"]', profile.location)
    tryFill('.fb-text-selectable__option [role="combobox"]', profile.location)
    if (coverLetter) {
      const clArea = document.querySelector(
        '.jobs-easy-apply-content textarea, textarea[id*="coverLetter"], textarea[id*="cover-letter"]'
      )
      if (clArea && !clArea.value) { setNativeValue(clArea, coverLetter); count++ }
    }
  }

  // ── Indeed ────────────────────────────────────────────────────────────────
  if (host.includes('indeed.com')) {
    const tryFill = (sel, value) => {
      if (!value) return
      document.querySelectorAll(sel).forEach((el) => {
        if (!el.value && !el.disabled) { setNativeValue(el, value); count++ }
      })
    }
    tryFill('input[id="applicant.name"]', profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' '))
    tryFill('input[id="applicant.phoneNumber"]', profile.phone)
    tryFill('input[id="applicant.linkedinUrl"]', profile.linkedIn)
  }

  // ── Greenhouse (boards.greenhouse.io) ─────────────────────────────────────
  if (host.includes('greenhouse.io') || host.includes('grnh.se')) {
    const tryFill = (name, value) => {
      if (!value) return
      const el = document.querySelector(`input[name="${name}"], textarea[name="${name}"]`)
      if (el && !el.value) { setNativeValue(el, value); count++ }
    }
    tryFill('first_name', profile.firstName)
    tryFill('last_name',  profile.lastName)
    tryFill('email',      profile.email)
    tryFill('phone',      profile.phone)
    tryFill('linkedin_profile', profile.linkedIn)
    tryFill('website',    profile.portfolio)
  }

  // ── Lever (jobs.lever.co) ─────────────────────────────────────────────────
  if (host.includes('lever.co')) {
    const tryFill = (sel, value) => {
      if (!value) return
      const el = document.querySelector(sel)
      if (el && !el.value) { setNativeValue(el, value); count++ }
    }
    tryFill('input[name="name"]',     profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(' '))
    tryFill('input[name="email"]',    profile.email)
    tryFill('input[name="phone"]',    profile.phone)
    tryFill('input[name="org"]',      '')
    tryFill('input[name="urls[LinkedIn]"]', profile.linkedIn)
    tryFill('input[name="urls[Portfolio]"]', profile.portfolio)
    if (coverLetter) {
      const cl = document.querySelector('textarea[name="comments"], textarea[class*="cover"]')
      if (cl && !cl.value) { setNativeValue(cl, coverLetter); count++ }
    }
  }

  // ── Workday (myworkdayjobs.com) ───────────────────────────────────────────
  if (host.includes('workday.com') || host.includes('myworkdayjobs.com')) {
    const tryAutoId = (automationId, value) => {
      if (!value) return
      const el = document.querySelector(`input[data-automation-id="${automationId}"]`)
      if (el && !el.value) { setNativeValue(el, value); count++ }
    }
    tryAutoId('legalNameSection_firstName', profile.firstName)
    tryAutoId('legalNameSection_lastName',  profile.lastName)
    tryAutoId('email',                      profile.email)
    tryAutoId('phone-number',               profile.phone)
    tryAutoId('addressSection_city',        profile.location)
    tryAutoId('linkedIn',                   profile.linkedIn)
  }

  return count
}

// ── Message listener ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'HJH_AUTOFILL') return false

  const { profile, coverLetter } = message

  let filled = 0
  // Run site-specific first (uses precise selectors)
  filled += autofillSiteSpecific(profile, coverLetter)
  // Then generic smart detection (fills anything site-specific missed)
  filled += autofillGeneric(profile, coverLetter)

  sendResponse({ filled })
  return true
})
