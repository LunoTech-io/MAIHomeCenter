import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import InstallPrompt from './components/InstallPrompt'
import Login from './components/Login'

// Lazy-load heavy routes (Recharts ~200KB, react-gauge-component ~50KB)
const Dashboard = lazy(() => import('./components/Dashboard'))
const GaugeDashboard = lazy(() => import('./components/GaugeDashboard'))
const RoomSummary = lazy(() => import('./components/RoomSummary'))
const AlertList = lazy(() => import('./components/AlertList'))
const SurveyList = lazy(() => import('./components/surveys/SurveyList'))
const SurveyView = lazy(() => import('./components/surveys/SurveyView'))

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <div className="loading-screen">Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

function AuthRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <div className="loading-screen">Loading...</div>
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}

function ThemeToggle() {
  const { effectiveTheme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {effectiveTheme === 'dark' ? (
          <>
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </>
        ) : (
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        )}
      </svg>
    </button>
  )
}

function Navigation() {
  const { isAuthenticated, house, logout } = useAuth()

  if (!isAuthenticated) return null

  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <svg className="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span className="nav-label">Home</span>
      </NavLink>
      <NavLink to="/surveys" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <svg className="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span className="nav-label">Surveys</span>
      </NavLink>
      <NavLink to="/alerts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <svg className="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span className="nav-label">Alerts</span>
      </NavLink>
      <button className="nav-item" onClick={logout}>
        <svg className="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span className="nav-label">Logout</span>
      </button>
    </nav>
  )
}

function AppContent() {
  return (
    <div className="app">
      <InstallPrompt />
      <ThemeToggle />
      <main className="main-content">
        <Suspense fallback={<div className="loading-screen">Loading...</div>}>
          <Routes>
            <Route path="/login" element={
              <AuthRoute>
                <Login />
              </AuthRoute>
            } />
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/status" element={
              <ProtectedRoute>
                <GaugeDashboard />
              </ProtectedRoute>
            } />
            <Route path="/summary" element={
              <ProtectedRoute>
                <RoomSummary />
              </ProtectedRoute>
            } />
            <Route path="/alerts" element={
              <ProtectedRoute>
                <AlertList />
              </ProtectedRoute>
            } />
            <Route path="/surveys" element={
              <ProtectedRoute>
                <SurveyList />
              </ProtectedRoute>
            } />
            <Route path="/surveys/:assignmentId" element={
              <ProtectedRoute>
                <SurveyView />
              </ProtectedRoute>
            } />
          </Routes>
        </Suspense>
      </main>
      <Navigation />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
