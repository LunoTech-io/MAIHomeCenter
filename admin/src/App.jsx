import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Admin from './components/Admin'
import SurveyList from './components/surveys/SurveyList'
import SurveyEditor from './components/surveys/SurveyEditor'
import ResponseViewer from './components/surveys/ResponseViewer'
import HouseList from './components/houses/HouseList'

function Navigation() {
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
    </nav>
  )
}

function App() {
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
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
