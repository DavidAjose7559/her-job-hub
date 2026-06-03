import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Profile from './pages/Profile'
import Apply from './pages/Apply'
import Tracker from './pages/Tracker'

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/apply" element={<Apply />} />
          <Route path="/tracker" element={<Tracker />} />
        </Routes>
      </main>
    </div>
  )
}
