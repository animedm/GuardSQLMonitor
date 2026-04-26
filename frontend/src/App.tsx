import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const ReplicationPage = lazy(() => import('./pages/ReplicationPage').then((m) => ({ default: m.ReplicationPage })));
const DashboardsPage = lazy(() => import('./pages/DashboardsPage').then((m) => ({ default: m.DashboardsPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const QueryAnalyzerPage = lazy(() => import('./pages/QueryAnalyzerPage'));
const DeadlockAnalyzerPage = lazy(() => import('./pages/DeadlockAnalyzerPage'));
const ConnectionPoolPage = lazy(() => import('./pages/ConnectionPoolPage'));
const ConfigPage = lazy(() => import('./pages/ConfigPage').then((m) => ({ default: m.ConfigPage })));

function App() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-slate-300 text-sm">Cargando modulo...</div>
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/replication" element={<ReplicationPage />} />
        <Route path="/dashboards" element={<DashboardsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/query-analyzer" element={<QueryAnalyzerPage />} />
        <Route path="/deadlocks" element={<DeadlockAnalyzerPage />} />
        <Route path="/connection-pool" element={<ConnectionPoolPage />} />
        <Route path="/config" element={<ConfigPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;
