import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import ManagerGate from './components/ManagerGate'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import CompetitionsIndex from './pages/CompetitionsIndex'
import StandingsPage from './pages/StandingsPage'
import Competition from './pages/Competition'
import FixtureDetail from './pages/FixtureDetail'
import TeamDetail from './pages/TeamDetail'
import ScorersPage from './pages/ScorersPage'
import HonoursPage from './pages/HonoursPage'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import Discipline from './pages/Discipline'
import TeamsAdmin from './pages/TeamsAdmin'
import HistoricalSeason from './pages/HistoricalSeason'
import ListsAdmin from './pages/ListsAdmin'
import TeamsHub from './pages/TeamsHub'
import SeasonAdmin from './pages/SeasonAdmin'
import RefereesHub from './pages/RefereesHub'
import FixtureTracker from './pages/FixtureTracker'

export default function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/competitions" element={<CompetitionsIndex />} />
          <Route path="/standings" element={<StandingsPage />} />
          <Route path="/competitions/:slug" element={<Competition />} />
          <Route path="/fixtures/:id" element={<FixtureDetail />} />
          <Route path="/teams/:id" element={<TeamDetail />} />
          <Route path="/scorers" element={<ScorersPage />} />
          <Route path="/honours" element={<HonoursPage />} />
          <Route path="/history" element={<HistoricalSeason />} />
          <Route path="/teams" element={<TeamsHub />} />
          <Route path="/referees" element={<RefereesHub />} />
          <Route
            path="/admin/season"
            element={
              <ProtectedRoute>
                <SeasonAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/fixture-tracker"
            element={
              <ProtectedRoute>
                <FixtureTracker />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/lists"
            element={
              <ProtectedRoute>
                <ListsAdmin />
              </ProtectedRoute>
            }
          />
          <Route path="/admin" element={<AdminLogin />} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/discipline"
            element={
              <ProtectedRoute>
                <Discipline />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/teams"
            element={
              <ProtectedRoute>
                <TeamsAdmin />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      <Footer />
      <ManagerGate />
    </div>
  )
}
