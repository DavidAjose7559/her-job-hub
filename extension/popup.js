// ── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL    = 'https://xofnraiiieapgqfukcex.supabase.co'
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvZm5yYWlpaWVhcGdxZnVrY2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDcxMDksImV4cCI6MjA5NjUyMzEwOX0.MM03deLW2ku9LqkilD1Mk__e4G1er8tcaZ-YEJqv7Eg'
const SUPABASE_SB_KEY = 'sb-xofnraiiieapgqfukcex-auth-token'
const APP_URL         = 'https://her-job-hub.vercel.app'

const JOB_SITE_RE = /linkedin\.com|indeed\.com|greenhouse\.io|lever\.co|workday\.com|myworkdayjobs\.com|glassdoor\.com|ziprecruiter\.com|wellfound\.com|jobbank\.gc\.ca|workopolis\.com/

// ── DOM helpers ───────────────────────────────────────────────────────────────
const $  = (id) => document.getElementById(id)
const ALL_STATES = ['state-loading', 'state-error', 'state-loggedout', 'state-notab', 'state-ready']

function showState(id) {
  ALL_STATES.forEach((s) => $(s)?.classList.add('hidden'))
  $(id)?.classList.remove('hidden')
  console.log('[HJH] showState:', id)
}

function setError(msg) {
  const el = $('error-msg')
  if (el) el.textContent = msg
  showState('state-error')
}

function setResult(type, msg) {
  const el = $('fill-result')
  el.className = `fill-result ${type}`
  el.textContent = msg
  el.classList.remove('hidden')
}

// ── Open-app buttons (all use class .open-app-btn) ────────────────────────────
// Using class instead of individual IDs so every button — including the new
// error-state one — works automatically without additional wiring.
function openApp() {
  console.log('[HJH] Opening app tab:', APP_URL)
  chrome.tabs.create({ url: APP_URL }, () => {
    if (chrome.runtime.lastError) {
      console.error('[HJH] chrome.tabs.create error:', chrome.runtime.lastError.message)
    }
  })
}

document.querySelectorAll('.open-app-btn').forEach((btn) => {
  btn.addEventListener('click', openApp)
})

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function findAppTab() {
  const tabs = await chrome.tabs.query({})
  return tabs.find((t) =>
    t.url?.includes('her-job-hub') || t.url?.includes('localhost:5173')
  ) || null
}

async function readSessionFromTab(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sbKey) => ({
      raw:         localStorage.getItem(sbKey),
      coverLetter: localStorage.getItem('hjh_last_cover_letter'),
    }),
    args: [SUPABASE_SB_KEY],
  })
  return result?.result || null
}

async function fetchProfile(userId, accessToken) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
    { headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON } }
  )
  if (!res.ok) throw new Error(`Supabase returned ${res.status}`)
  const rows = await res.json()
  return rows[0] || null
}

function mapProfile(row) {
  if (!row) return null
  const nameParts = (row.name || '').split(' ')
  const salary    = (row.salary || '').split('-')
  return {
    firstName: nameParts[0] || '',
    lastName:  nameParts.slice(1).join(' ') || '',
    fullName:  row.name      || '',
    email:     row.email     || '',
    phone:     row.phone     || '',
    location:  row.location  || '',
    linkedIn:  row.linkedin  || '',
    portfolio: row.portfolio || '',
    resume:    row.resume_text || '',
    salary:    salary[0] && salary[1]
                 ? `${salary[0].trim()} - ${salary[1].trim()}`
                 : (row.salary || ''),
  }
}

// ── State ─────────────────────────────────────────────────────────────────────
let profile     = null
let coverLetter = null

function renderReady(p, tabUrl) {
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Profile loaded'
  $('profile-name').textContent  = name
  $('profile-email').textContent = p.email || ''
  $('profile-avatar').textContent = (name[0] || '?').toUpperCase()

  const hint = $('page-hint')
  if (tabUrl && JOB_SITE_RE.test(tabUrl)) {
    hint.textContent = '✓ Job site detected — ready to fill'
    hint.classList.add('detected')
  } else {
    hint.textContent = 'Navigate to a job application page to fill'
    hint.classList.remove('detected')
  }

  showState('state-ready')
}

// ── Init (with 5-second timeout) ──────────────────────────────────────────────
async function init() {
  console.log('[HJH] Step 1: popup opened')
  showState('state-loading')

  // Timeout — if any await hangs, show a useful error after 5 seconds
  const timeoutId = setTimeout(() => {
    console.warn('[HJH] Timeout: still loading after 5 s')
    setError('Took too long to load. Make sure Her Job Hub is open and you are logged in.')
  }, 5000)

  try {
    // Step 2 — get active tab for URL hint
    console.log('[HJH] Step 2: querying active tab')
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const activeUrl   = activeTab?.url || ''
    const activeTabId = activeTab?.id
    console.log('[HJH] Step 3: active tab url:', activeUrl)

    // Step 3 — load cached profile so UI shows something fast
    const cache = await chrome.storage.local.get(['hjhProfile', 'hjhCoverLetter'])
    if (cache.hjhProfile) {
      console.log('[HJH] Step 3b: cached profile found, showing ready state')
      profile     = cache.hjhProfile
      coverLetter = cache.hjhCoverLetter || null
      renderReady(profile, activeUrl)
    }

    // Step 4 — find Her Job Hub tab
    console.log('[HJH] Step 4: looking for Her Job Hub tab')
    const appTab = await findAppTab()
    console.log('[HJH] Step 5: tab found:', appTab ? appTab.url : 'none')

    if (!appTab) {
      clearTimeout(timeoutId)
      if (!profile) showState('state-notab')
      return
    }

    // Step 5 — read Supabase session from that tab's localStorage
    console.log('[HJH] Step 6: reading localStorage from tab', appTab.id)
    let tabData
    try {
      tabData = await readSessionFromTab(appTab.id)
    } catch (err) {
      console.error('[HJH] executeScript failed:', err)
      clearTimeout(timeoutId)
      if (!profile) showState('state-loggedout')
      return
    }
    console.log('[HJH] Step 7: session data:', tabData?.raw ? 'found' : 'not found')

    if (!tabData?.raw) {
      clearTimeout(timeoutId)
      if (!profile) showState('state-loggedout')
      return
    }

    // Step 6 — parse session
    let sessionObj
    try {
      sessionObj = JSON.parse(tabData.raw)
    } catch {
      console.error('[HJH] Could not parse session JSON')
      clearTimeout(timeoutId)
      if (!profile) showState('state-loggedout')
      return
    }

    const accessToken = sessionObj.access_token
    const userId      = sessionObj.user?.id
    console.log('[HJH] Step 8: userId:', userId ? userId.slice(0, 8) + '…' : 'missing')

    if (!accessToken || !userId) {
      clearTimeout(timeoutId)
      if (!profile) showState('state-loggedout')
      return
    }

    // Step 7 — fetch profile from Supabase
    console.log('[HJH] Step 9: calling Supabase for profile')
    const row = await fetchProfile(userId, accessToken)
    console.log('[HJH] Step 10: profile result:', row ? 'loaded' : 'empty')

    clearTimeout(timeoutId)

    if (!row) {
      if (!profile) showState('state-loggedout')
      return
    }

    profile     = mapProfile(row)
    coverLetter = tabData.coverLetter || null
    await chrome.storage.local.set({ hjhProfile: profile, hjhCoverLetter: coverLetter })
    renderReady(profile, activeUrl)

  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[HJH] Init error:', err)
    if (!profile) {
      setError('Something went wrong: ' + (err.message || 'unknown error'))
    }
    // If we already have a cached profile showing, leave it visible
  }
}

// ── Auto-fill button ──────────────────────────────────────────────────────────
$('autofill-btn').addEventListener('click', async () => {
  if (!profile) return
  $('btn-icon').textContent = '⏳'
  $('btn-text').textContent = 'Filling…'
  $('autofill-btn').disabled = true
  $('fill-result').classList.add('hidden')

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    console.log('[HJH] Sending autofill to tab', activeTab?.id)
    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: 'HJH_AUTOFILL',
      profile,
      coverLetter,
    })
    const filled = response?.filled ?? 0
    console.log('[HJH] Filled', filled, 'fields')
    if (filled > 0) {
      setResult('success', `✓ Filled ${filled} field${filled !== 1 ? 's' : ''}`)
    } else {
      setResult('warn', 'No fillable fields detected on this page.')
    }
  } catch (err) {
    console.error('[HJH] Autofill error:', err)
    setResult('error', 'Could not reach page. Refresh and try again.')
  }

  $('btn-icon').textContent = '⚡'
  $('btn-text').textContent = 'Auto-fill this page'
  $('autofill-btn').disabled = false
})

// ── Run ───────────────────────────────────────────────────────────────────────
init()
