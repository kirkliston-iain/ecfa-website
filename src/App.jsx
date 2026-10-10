import { useLayoutEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom'
import MatchHistory from './pages/MatchHistory'
import { HistoryDirectory } from './components/HistoryLinks'
import Header from './components/Header'
import Footer from './components/Footer'
import ManagerGate from './components/ManagerGate'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import News from './pages/News'
import NewsAdmin from './pages/NewsAdmin'
import CompetitionsIndex from './pages/CompetitionsIndex'
import StandingsPage from './pages/StandingsPage'
import Competition from './pages/Competition'
import FixtureDetail from './pages/FixtureDetail'
import VenueFixtures from './pages/VenueFixtures'
import TeamDetail from './pages/TeamDetail'
import ScorersPage from './pages/ScorersPage'
import StatsPage from './pages/StatsPage'
import HonoursPage from './pages/HonoursPage'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import Discipline from './pages/Discipline'
import TeamsAdmin from './pages/TeamsAdmin'
import TransfersAdmin from './pages/TransfersAdmin'
import HistoricalSeason from './pages/HistoricalSeason'
import ListsAdmin from './pages/ListsAdmin'
import TeamsHub from './pages/TeamsHub'
import PreviousTeam from './pages/PreviousTeam'
import SeasonAdmin from './pages/SeasonAdmin'
import RefereesHub from './pages/RefereesHub'
import FixtureTracker from './pages/FixtureTracker'
import Downloads from './pages/Downloads'
import PlayerReportDownload from './pages/PlayerReportDownload'
import RefereeReportDownload from './pages/RefereeReportDownload'
import WebStats from './pages/WebStats'
import AdminWebStats from './pages/AdminWebStats'
import Contact from './pages/Contact'
import Sponsors from './pages/Sponsors'
import Search from './pages/Search'
import PlayerDetail from './pages/PlayerDetail'
import WeeklyDisciplineReport from './pages/WeeklyDisciplineReport'
import MatchAppointments from './pages/MatchAppointments'
import TeamPreferencesAdmin from './pages/TeamPreferencesAdmin'
import AdminChangePassword from './pages/AdminChangePassword'
import AdminAccounts from './pages/AdminAccounts'
import AdminAudit from './pages/AdminAudit'
import DownloadsAdmin from './pages/DownloadsAdmin'
import SponsorsAdmin from './pages/SponsorsAdmin'
import Charity from './pages/Charity'
import RecordsAdmin from './pages/RecordsAdmin'
import AdminDataExport from './pages/AdminDataExport'
import TeamWebsitesAdmin from './pages/TeamWebsitesAdmin'
import LogosAdmin from './pages/LogosAdmin'

export default function App() {
  const location = useLocation()
  const navigationType = useNavigationType()
  useLayoutEffect(() => {
    if (navigationType === 'PUSH') window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.key, navigationType])
  const isAdminArea = location.pathname.startsWith('/admin') || location.pathname.startsWith('/discipline')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <HistoryDirectory>
      <Header />
      <main className={isAdminArea ? 'site-main site-main--admin' : 'site-main site-main--public'} style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home key={location.key} />} />
          <Route path="/news" element={<News key={location.key} />} />
          <Route path="/competitions" element={<CompetitionsIndex key={location.key} />} />
          <Route path="/standings" element={<StandingsPage key={location.key} />} />
          <Route path="/competitions/:slug" element={<Competition key={location.key} />} />
          <Route path="/fixtures/:id" element={<FixtureDetail key={location.key} />} />
          <Route path="/matches" element={<MatchHistory key={location.key} />} />
          <Route path="/venues/:venueKey" element={<VenueFixtures key={location.key} />} />
          <Route path="/teams/:id" element={<TeamDetail key={location.key} />} />
          <Route path="/scorers" element={<Navigate to={`/goalscorers${location.search}`} replace />} />
          <Route path="/goalscorers" element={<ScorersPage key={location.key} />} />
          <Route path="/stats" element={<StatsPage key={location.key} />} />
          <Route path="/honours" element={<HonoursPage key={location.key} />} />
          <Route path="/archive" element={<HistoricalSeason key={location.key} />} />
          <Route path="/history" element={<HistoricalSeason key={location.key} />} />
          <Route path="/teams" element={<TeamsHub key={location.key} />} />
          <Route path="/teams/previous/:teamName" element={<PreviousTeam key={location.key} />} />
          <Route path="/referees" element={<RefereesHub key={location.key} />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/downloads/player-report" element={<PlayerReportDownload />} />
          <Route path="/downloads/referee-report" element={<RefereeReportDownload />} />
          <Route path="/web-stats" element={<WebStats />} />
          <Route path="/admin/web-stats" element={<ProtectedRoute requireAdmin><AdminWebStats /></ProtectedRoute>} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/sponsors" element={<Sponsors />} />
          <Route path="/charity" element={<Charity />} />
          <Route path="/search" element={<Search key={location.key} />} />
          <Route path="/players/:id" element={<PlayerDetail key={location.key} />} />
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
            path="/admin/team-preferences"
            element={
              <ProtectedRoute>
                <TeamPreferencesAdmin />
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
          <Route path="/admin/transfers" element={<ProtectedRoute requireAdmin><TransfersAdmin /></ProtectedRoute>} />
          <Route path="/admin/news" element={<ProtectedRoute requireAdmin><NewsAdmin /></ProtectedRoute>} />
          <Route path="/admin/logos" element={<ProtectedRoute requireAdmin><LogosAdmin /></ProtectedRoute>} />
          <Route path="/admin/team-websites" element={<ProtectedRoute requireAdmin><TeamWebsitesAdmin /></ProtectedRoute>} />
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
            path="/admin/data-export"
            element={
              <ProtectedRoute requireAdmin>
                <AdminDataExport />
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
      </HistoryDirectory>
    </div>
  )
}
