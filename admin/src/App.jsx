import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext'
import AdminLogin from './components/AdminLogin'
import Admin from './components/Admin'
import SurveyList from './components/surveys/SurveyList'
import SurveyEditor from './components/surveys/SurveyEditor'
import ResponseViewer from './components/surveys/ResponseViewer'
import HouseList from './components/houses/HouseList'
import HouseDashboard from './components/houses/HouseDashboard'

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
          <Route path="/houses" element={<HouseList />} />
          <Route path="/houses/:houseId" element={<HouseDashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

function App() {
  return (
    <AdminAuthProvider>
      <AuthenticatedApp />
    </AdminAuthProvider>
  )
}

export default App
