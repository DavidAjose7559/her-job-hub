// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL     = 'https://xofnraiiieapgqfukcex.supabase.co'
const SUPABASE_ANON    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvZm5yYWlpaWVhcGdxZnVrY2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDcxMDksImV4cCI6MjA5NjUyMzEwOX0.MM03deLW2ku9LqkilD1Mk__e4G1er8tcaZ-YEJqv7Eg'
const SUPABASE_SB_KEY  = 'sb-xofnraiiieapgqfukcex-auth-token'
const APP_URL          = 'https://her-job-hub.vercel.app'

const JOB_SITE_RE = /linkedin\.com|indeed\.com|greenhouse\.io|lever\.co|workday\.com|myworkdayjobs\.com|glassdoor\.com|ziprecruiter\.com|wellfound\.com|jobbank\.gc\.ca|workopolis\.com/

// ── DOM refs ────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id)
const stateLoading  = $('state-loading')
const stateLoggedout= $('state-loggedout')
const stateNoTab    = $('state-notab')
const stateReady    = $('state-ready')
const profileAvatar = $('profile-avatar')
const profileName   = $('profile-name')
const profileEmail  = $('profile-email')
const pageHint      = $('page-hint')
const autofillBtn   = $('autofill-btn')
const btnText       = $('btn-text')
const btnIcon       = $('btn-icon')
const fillResult    = $('fill-result')

function showState(id) {
  [stateLoading, stateLoggedout, stateNoTab, stateReady].forEach((el) => el.classList.add('hidden'))
  $(id).classList.remove('hidden')
}

function setResult(type, msg) {
  fillResult.className = `fill-result ${type}`
  fillResult.textContent = msg
  fillResult.classList.remove('hidden')
}

// ── Find Her Job Hub tab ─────────────────────────────────────────────────────
async function findAppTab() {
  const tabs = await chrome.tabs.query({})
  return tabs.find((t) =>
    t.url?.includes('her-job-hub') || t.url?.includes('localhost:5173')
  ) || null
}

// ── Read Supabase session from app tab's localStorage ────────────────────────
async function readSessionFromTab(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (sbKey) => {
        const raw = localStorage.getItem(sbKey)
        const coverLetter = localStorage.getItem('hjh_last_cover_letter')
        return { raw, coverLetter }
      },
      args: [SUPABASE_SB_KEY],
    })
    return result?.result || null
  } catch {
    return null
  }
}

// ── Fetch profile from Supabase REST API ─────────────────────────────────────
async function fetchProfile(userId, accessToken) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
    { headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON } }
  )
  if (!res.ok) throw new Error(`Supabase ${res.status}`)
  const rows = await res.json()
  return rows[0] || null
}

// ── Map Supabase profile row to fill-friendly object ─────────────────────────
function mapProfile(row) {
  if (!row) return null
  const nameParts = (row.name || '').split(' ')
  const salary = (row.salary || '').split('-')
  return {
    firstName: nameParts[0] || '',
    lastName:  nameParts.slice(1).join(' ') || '',
    fullName:  row.name || '',
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

// ── Init ─────────────────────────────────────────────────────────────────────
let profile = null
let coverLetter = null
let activeTabId = null

async function init() {
  showState('state-loading')

  // Get current active tab for URL hint
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
  activeTabId = activeTab?.id

  // Check URL for job-site detection
  const url = activeTab?.url || ''
  if (JOB_SITE_RE.test(url)) {
    pageHint.textContent = '✓ Job site detected — ready to fill'
    pageHint.classList.add('detected')
  } else {
    pageHint.textContent = 'Navigate to a job application page to fill'
  }

  // Try cached profile first
  const cache = await chrome.storage.local.get(['hjhProfile', 'hjhCoverLetter'])
  if (cache.hjhProfile) {
    profile = cache.hjhProfile
    coverLetter = cache.hjhCoverLetter || null
    renderReady(profile, activeTab?.url)
  }

  // Always try to get fresh data from app tab
  const appTab = await findAppTab()

  if (!appTab) {
    if (!profile) showState('state-notab')
    return // keep showing cached if available
  }

  const tabData = await readSessionFromTab(appTab.id)
  if (!tabData?.raw) {
    if (!profile) showState('state-loggedout')
    return
  }

  let sessionObj
  try { sessionObj = JSON.parse(tabData.raw) } catch { showState('state-loggedout'); return }

  const accessToken = sessionObj.access_token
  const userId = sessionObj.user?.id

  if (!accessToken || !userId) { showState('state-loggedout'); return }

  try {
    const row = await fetchProfile(userId, accessToken)
    profile = mapProfile(row)
    coverLetter = tabData.coverLetter || null
    await chrome.storage.local.set({ hjhProfile: profile, hjhCoverLetter: coverLetter })
    renderReady(profile, activeTab?.url)
  } catch {
    if (!profile) showState('state-loggedout')
  }
}

function renderReady(p, url) {
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Profile loaded'
  profileName.textContent = name
  profileEmail.textContent = p.email || ''
  profileAvatar.textContent = (name[0] || '?').toUpperCase()
  if (url && JOB_SITE_RE.test(url)) {
    pageHint.textContent = '✓ Job site detected — ready to fill'
    pageHint.classList.add('detected')
  }
  showState('state-ready')
}

// ── Auto-fill ─────────────────────────────────────────────────────────────────
autofillBtn.addEventListener('click', async () => {
  if (!profile) return
  btnIcon.textContent = '⏳'
  btnText.textContent = 'Filling…'
  autofillBtn.disabled = true
  fillResult.classList.add('hidden')

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: 'HJH_AUTOFILL',
      profile,
      coverLetter,
    })

    const filled = response?.filled ?? 0
    if (filled > 0) {
      setResult('success', `✓ Filled ${filled} field${filled !== 1 ? 's' : ''}`)
    } else {
      setResult('warn', 'No fillable fields detected on this page.')
    }
  } catch {
    setResult('error', 'Could not reach page. Refresh and try again.')
  }

  btnIcon.textContent = '⚡'
  btnText.textContent = 'Auto-fill this page'
  autofillBtn.disabled = false
})

// ── Open app links ────────────────────────────────────────────────────────────
['open-app-login', 'open-app-notab', 'open-app-footer'].forEach((id) => {
  const el = document.getElementById(id)
  if (el) el.addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({ url: APP_URL }) })
})

// ── Run ───────────────────────────────────────────────────────────────────────
init()
