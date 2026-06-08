import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Allow the Her Job Hub extension to read the Supabase session via postMessage.
// chrome.scripting.executeScript cannot read localStorage directly due to
// extension isolation, so the extension's content script asks the page here.
window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (event.data?.type === 'HJH_GET_SESSION') {
    const session     = localStorage.getItem('sb-xofnraiiieapgqfukcex-auth-token')
    const coverLetter = localStorage.getItem('hjh_last_cover_letter')
    window.postMessage({ type: 'HJH_SESSION_RESPONSE', session, coverLetter }, '*')
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
