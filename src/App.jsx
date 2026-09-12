import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Competition from './pages/Competition'
import FixtureDetail from './pages/FixtureDetail'
import TeamDetail from './pages/TeamDetail'
import ScorersPage from './pages/ScorersPage'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/competitions/:slug" element={<Competition />} />
          <Route path="/fixtures/:id" element={<FixtureDetail />} />
          <Route path="/teams/:id" element={<TeamDetail />} />
          <Route path="/scorers" element={<ScorersPage />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
