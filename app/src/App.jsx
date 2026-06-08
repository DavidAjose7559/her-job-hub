import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import Profile from './pages/Profile'
import Apply from './pages/Apply'
import Tracker from './pages/Tracker'
import FindJobs from './pages/FindJobs'
import AuthPage from './pages/AuthPage'

function AppShell() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span className="spinner spinner-primary" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    )
  }

  if (!user) return <AuthPage />

  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="/profile"   element={<Profile />} />
          <Route path="/find-jobs" element={<FindJobs />} />
          <Route path="/apply"     element={<Apply />} />
          <Route path="/tracker"   element={<Tracker />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
