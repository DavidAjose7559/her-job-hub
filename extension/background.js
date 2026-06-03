chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_PROFILE') {
    chrome.storage.local.set({ hjh_profile: message.profile }, () => {
      sendResponse({ ok: true })
    })
    return true
  }

  if (message.type === 'GET_PROFILE') {
    chrome.storage.local.get('hjh_profile', (result) => {
      sendResponse({ profile: result.hjh_profile || null })
    })
    return true
  }

  if (message.type === 'AUTOFILL_PAGE') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'DO_AUTOFILL' }, (response) => {
          sendResponse(response || { filled: 0 })
        })
      }
    })
    return true
  }
})
