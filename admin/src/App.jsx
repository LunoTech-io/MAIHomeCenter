import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import AdminLogin from './components/AdminLogin'
import Admin from './components/Admin'
import SurveyList from './components/surveys/SurveyList'
import SurveyEditor from './components/surveys/SurveyEditor'
import ResponseViewer from './components/surveys/ResponseViewer'
import AlertRuleList from './components/alerts/AlertRuleList'
import AlertRuleEditor from './components/alerts/AlertRuleEditor'
import HouseList from './components/houses/HouseList'
import HouseDashboard from './components/houses/HouseDashboard'

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
  const { admin, logout } = useAdminAuth()

  return (
    <nav className="admin-nav">
      <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} end>
        Notifications
      </NavLink>
      <NavLink to="/surveys" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Surveys
      </NavLink>
      <NavLink to="/alerts" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Alerts
      </NavLink>
      <NavLink to="/houses" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Houses
      </NavLink>
      <div className="nav-spacer" />
      <div className="nav-admin-info">
        <span className="nav-admin-name">{admin?.name || admin?.username}</span>
        <span className="nav-admin-org">{admin?.organization}</span>
      </div>
      <button className="nav-logout-btn" onClick={logout}>
        Logout
      </button>
    </nav>
  )
}

function AuthenticatedApp() {
  const { isAuthenticated, loading } = useAdminAuth()

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!isAuthenticated) {
    return <AdminLogin />
  }

  return (
    <BrowserRouter>
      <div className="app">
        <Navigation />
        <Routes>
          <Route path="/" element={<Admin />} />
          <Route path="/surveys" element={<SurveyList />} />
          <Route path="/surveys/new" element={<SurveyEditor />} />
          <Route path="/surveys/:id" element={<SurveyEditor />} />
          <Route path="/surveys/:id/responses" element={<ResponseViewer />} />
          <Route path="/alerts" element={<AlertRuleList />} />
          <Route path="/alerts/new" element={<AlertRuleEditor />} />
          <Route path="/alerts/:id" element={<AlertRuleEditor />} />
          <Route path="/houses" element={<HouseList />} />
          <Route path="/houses/:houseId" element={<HouseDashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

function App() {
  return (
    <ThemeProvider>
      <ThemeToggle />
      <AdminAuthProvider>
        <AuthenticatedApp />
      </AdminAuthProvider>
    </ThemeProvider>
  )
}

export default App
