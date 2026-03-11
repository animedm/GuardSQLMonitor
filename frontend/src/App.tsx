import { Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ReplicationPage } from './pages/ReplicationPage';
import { DashboardsPage } from './pages/DashboardsPage';
import { HistoryPage } from './pages/HistoryPage';
import QueryAnalyzerPage from './pages/QueryAnalyzerPage';
import DeadlockAnalyzerPage from './pages/DeadlockAnalyzerPage';
import ConnectionPoolPage from './pages/ConnectionPoolPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/replication" element={<ReplicationPage />} />
      <Route path="/dashboards" element={<DashboardsPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/query-analyzer" element={<QueryAnalyzerPage />} />
      <Route path="/deadlocks" element={<DeadlockAnalyzerPage />} />
      <Route path="/connection-pool" element={<ConnectionPoolPage />} />
    </Routes>
  );
}

export default App;
