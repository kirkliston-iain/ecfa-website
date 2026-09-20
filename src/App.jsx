import { Routes, Route, useLocation } from 'react-router-dom'
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
import Downloads from './pages/Downloads'
import PlayerReportDownload from './pages/PlayerReportDownload'
import RefereeReportDownload from './pages/RefereeReportDownload'
import WebStats from './pages/WebStats'
import Contact from './pages/Contact'
import Sponsors from './pages/Sponsors'
import Search from './pages/Search'
import PlayerDetail from './pages/PlayerDetail'
import WeeklyDisciplineReport from './pages/WeeklyDisciplineReport'
import MatchAppointments from './pages/MatchAppointments'
import AdminChangePassword from './pages/AdminChangePassword'
import AdminAccounts from './pages/AdminAccounts'
import AdminAudit from './pages/AdminAudit'
import DownloadsAdmin from './pages/DownloadsAdmin'
import SponsorsAdmin from './pages/SponsorsAdmin'
import Charity from './pages/Charity'
import RecordsAdmin from './pages/RecordsAdmin'

export default function App() {
  const location = useLocation()
  const isAdminArea = location.pathname.startsWith('/admin') || location.pathname.startsWith('/discipline')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main className={isAdminArea ? 'site-main site-main--admin' : 'site-main site-main--public'} style={{ flex: 1 }}>
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
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/downloads/player-report" element={<PlayerReportDownload />} />
          <Route path="/downloads/referee-report" element={<RefereeReportDownload />} />
          <Route path="/web-stats" element={<WebStats />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/sponsors" element={<Sponsors />} />
          <Route path="/charity" element={<Charity />} />
          <Route path="/search" element={<Search />} />
          <Route path="/players/:id" element={<PlayerDetail />} />
          <Route
            path="/admin/season"
            element={
              <ProtectedRoute>
                <SeasonAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/appointments"
            element={
              <ProtectedRoute>
                <MatchAppointments />
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
            path="/admin/change-password"
            element={
              <ProtectedRoute>
                <AdminChangePassword />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/accounts"
            element={
              <ProtectedRoute>
                <AdminAccounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <ProtectedRoute>
                <AdminAudit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/downloads"
            element={
              <ProtectedRoute>
                <DownloadsAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/sponsors"
            element={
              <ProtectedRoute>
                <SponsorsAdmin />
              </ProtectedRoute>
            }
          />
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
            path="/discipline/weekly"
            element={
              <ProtectedRoute requireAdmin>
                <WeeklyDisciplineReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/records"
            element={
              <ProtectedRoute requireAdmin>
                <RecordsAdmin />
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
