// Runs on job sites — listens for DO_AUTOFILL and fills detected fields

function setNativeValue(el, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(el), 'value'
  )?.set
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  } else {
    el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

function tryFill(selectors, value) {
  if (!value) return false
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el && !el.disabled && !el.readOnly) {
      setNativeValue(el, value)
      el.focus()
      el.blur()
      return true
    }
  }
  return false
}

function fillTextarea(selectors, value) {
  if (!value) return false
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el && !el.disabled && !el.readOnly) {
      setNativeValue(el, value)
      return true
    }
  }
  return false
}

function autofill(profile) {
  if (!profile) return 0
  let filled = 0

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ')

  // First name
  if (tryFill([
    'input[name="first_name"]', 'input[id*="first_name"]', 'input[id*="firstName"]',
    'input[autocomplete="given-name"]', 'input[placeholder*="first name" i]',
    'input[aria-label*="first name" i]', '#first-name', '#firstName',
  ], profile.firstName)) filled++

  // Last name
  if (tryFill([
    'input[name="last_name"]', 'input[id*="last_name"]', 'input[id*="lastName"]',
    'input[autocomplete="family-name"]', 'input[placeholder*="last name" i]',
    'input[aria-label*="last name" i]', '#last-name', '#lastName',
  ], profile.lastName)) filled++

  // Full name (if no separate first/last)
  if (tryFill([
    'input[name="name"]', 'input[id*="full_name"]', 'input[id*="fullName"]',
    'input[autocomplete="name"]', 'input[placeholder*="full name" i]',
    'input[aria-label*="full name" i]',
  ], fullName)) filled++

  // Email
  if (tryFill([
    'input[type="email"]', 'input[name="email"]', 'input[id*="email"]',
    'input[autocomplete="email"]', 'input[placeholder*="email" i]',
  ], profile.email)) filled++

  // Phone
  if (tryFill([
    'input[type="tel"]', 'input[name="phone"]', 'input[name="phone_number"]',
    'input[id*="phone"]', 'input[autocomplete="tel"]', 'input[placeholder*="phone" i]',
  ], profile.phone)) filled++

  // Location / City
  if (tryFill([
    'input[name="location"]', 'input[id*="location"]', 'input[name="city"]',
    'input[autocomplete="address-level2"]', 'input[placeholder*="location" i]',
    'input[placeholder*="city" i]',
  ], profile.location)) filled++

  // LinkedIn
  if (tryFill([
    'input[name="linkedin"]', 'input[id*="linkedin"]',
    'input[placeholder*="linkedin" i]', 'input[aria-label*="linkedin" i]',
  ], profile.linkedIn)) filled++

  // Portfolio / Website
  if (tryFill([
    'input[name="website"]', 'input[name="portfolio"]', 'input[id*="website"]',
    'input[id*="portfolio"]', 'input[placeholder*="website" i]', 'input[placeholder*="portfolio" i]',
    'input[autocomplete="url"]',
  ], profile.portfolio)) filled++

  // Cover letter textarea
  const coverLetterKey = 'hjh_last_cover_letter'
  const savedCoverLetter = localStorage.getItem(coverLetterKey)
  if (savedCoverLetter) {
    if (fillTextarea([
      'textarea[name*="cover"]', 'textarea[id*="cover"]',
      'textarea[placeholder*="cover letter" i]', 'textarea[aria-label*="cover letter" i]',
      'textarea[name="message"]', 'textarea[id*="message"]',
      // LinkedIn EasyApply
      'textarea[id*="coverLetter"]',
    ], savedCoverLetter)) filled++
  }

  // Resume text area (if paste-resume field)
  if (profile.resume) {
    if (fillTextarea([
      'textarea[name*="resume"]', 'textarea[id*="resume"]',
      'textarea[placeholder*="resume" i]', 'textarea[aria-label*="resume" i]',
      'textarea[name*="experience"]',
    ], profile.resume)) filled++
  }

  return filled
}

// Listen for popup autofill trigger
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DO_AUTOFILL') {
    chrome.runtime.sendMessage({ type: 'GET_PROFILE' }, (response) => {
      const filled = autofill(response?.profile)
      sendResponse({ filled })
    })
    return true
  }
})
