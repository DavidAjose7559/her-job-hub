const APP_URL = 'http://localhost:5173'

const statusBox    = document.getElementById('profile-status')
const statusText   = document.getElementById('status-text')
const profileSummary = document.getElementById('profile-summary')
const profileName  = document.getElementById('profile-name')
const profileEmail = document.getElementById('profile-email')
const autofillBtn  = document.getElementById('autofill-btn')
const btnText      = document.getElementById('btn-text')
const fillResult   = document.getElementById('fill-result')
const openAppLink  = document.getElementById('open-app')
const pageHint     = document.getElementById('page-hint')

const JOB_SITE_PATTERNS = [
  /linkedin\.com/,
  /indeed\.com/,
  /greenhouse\.io/,
  /lever\.co/,
  /workday\.com/,
  /myworkdayjobs\.com/,
]

function setStatus(type, message) {
  statusBox.className = `status-box status-${type}`
  statusText.textContent = message
}

function showError(message) {
  fillResult.className = 'fill-result error'
  fillResult.textContent = message
  fillResult.classList.remove('hidden')
}

function showSuccess(message) {
  fillResult.className = 'fill-result success'
  fillResult.textContent = message
  fillResult.classList.remove('hidden')
}

// Load profile from storage
chrome.storage.local.get('hjh_profile', (result) => {
  const profile = result.hjh_profile

  if (!profile) {
    setStatus('error', 'No profile found')
    statusText.innerHTML = 'No profile found. <a href="' + APP_URL + '" target="_blank" style="color:inherit;font-weight:600;">Open the app</a> to set up your profile.'
  } else {
    setStatus('ok', 'Profile loaded ✓')
    profileSummary.classList.remove('hidden')
    profileName.textContent = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'No name set'
    profileEmail.textContent = profile.email || ''
    autofillBtn.disabled = false
  }
})

// Check current tab URL to show helpful hint
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url || ''
  const isJobSite = JOB_SITE_PATTERNS.some((p) => p.test(url))
  if (isJobSite) {
    pageHint.textContent = '✓ Job site detected — ready to auto-fill'
    pageHint.style.color = '#065F46'
  } else {
    pageHint.textContent = 'Navigate to a job application to auto-fill'
  }
})

// Open app link
openAppLink.addEventListener('click', (e) => {
  e.preventDefault()
  chrome.tabs.create({ url: APP_URL })
})

// Auto-fill button
autofillBtn.addEventListener('click', () => {
  btnText.innerHTML = '<span class="spinner"></span> Filling…'
  autofillBtn.disabled = true
  fillResult.classList.add('hidden')

  chrome.runtime.sendMessage({ type: 'AUTOFILL_PAGE' }, (response) => {
    btnText.textContent = 'Auto-fill this page'
    autofillBtn.disabled = false

    if (chrome.runtime.lastError) {
      showError('Could not connect to page. Refresh and try again.')
      return
    }

    const filled = response?.filled ?? 0
    if (filled > 0) {
      showSuccess(`✓ Filled ${filled} field${filled > 1 ? 's' : ''}`)
    } else {
      showError('No fillable fields detected on this page.')
    }
  })
})
