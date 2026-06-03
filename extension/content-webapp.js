// Runs on the Her Job Hub web app — syncs localStorage profile to chrome.storage.local

function syncProfile() {
  try {
    const raw = localStorage.getItem('hjh_profile')
    if (!raw) return
    const profile = JSON.parse(raw)
    chrome.runtime.sendMessage({ type: 'SAVE_PROFILE', profile })
  } catch (e) {
    // silently ignore
  }
}

// Sync on load
syncProfile()

// Sync whenever localStorage changes (e.g. user saves profile)
window.addEventListener('storage', (e) => {
  if (e.key === 'hjh_profile') syncProfile()
})

// Also poll every 5 seconds in case same-window saves don't fire storage event
setInterval(syncProfile, 5000)
