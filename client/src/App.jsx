import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Dashboard from './components/Dashboard'
import InstallPrompt from './components/InstallPrompt'
import Login from './components/Login'
import SurveyList from './components/surveys/SurveyList'
import SurveyView from './components/surveys/SurveyView'

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

function Navigation() {
  const { isAuthenticated, house, logout } = useAuth()

  if (!isAuthenticated) return null

  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <span className="nav-icon">🏠</span>
        <span className="nav-label">Home</span>
      </NavLink>
      <NavLink to="/surveys" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <span className="nav-icon">📋</span>
        <span className="nav-label">Surveys</span>
      </NavLink>
      <button className="nav-item" onClick={logout}>
        <span className="nav-icon">🚪</span>
        <span className="nav-label">Logout</span>
      </button>
    </nav>
  )
}

function AppContent() {
  return (
    <div className="app">
      <InstallPrompt />
      <div className="main-content">
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
      </div>
      <Navigation />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
