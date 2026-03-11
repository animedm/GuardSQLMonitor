import { ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Database, Activity, Bell, BarChart3, RefreshCw, Layout as LayoutIcon, Clock, Search, AlertTriangle, Users } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">GuardSQL Monitor</h1>
                <p className="text-sm text-slate-400">Enterprise Database Monitoring</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 text-slate-400 hover:text-white transition-colors">
                <Bell className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-2 text-sm text-slate-400">
                <Activity className="w-4 h-4 text-green-500" />
                <span>All Systems Operational</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-slate-800 border-b border-slate-700">
        <div className="container mx-auto px-4">
          <div className="flex space-x-1">
            <Link
              to="/"
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                isActive('/')
                  ? 'text-white bg-slate-900 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>Dashboard</span>
              </div>
            </Link>
            <Link
              to="/replication"
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                isActive('/replication')
                  ? 'text-white bg-slate-900 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4" />
                <span>Replication & Backup</span>
              </div>
            </Link>
            <Link
              to="/dashboards"
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                isActive('/dashboards')
                  ? 'text-white bg-slate-900 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <LayoutIcon className="w-4 h-4" />
                <span>Custom Dashboards</span>
              </div>
            </Link>
            <Link
              to="/history"
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                isActive('/history')
                  ? 'text-white bg-slate-900 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>History</span>
              </div>
            </Link>
            <Link
              to="/query-analyzer"
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                isActive('/query-analyzer')
                  ? 'text-white bg-slate-900 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4" />
                <span>Query Analyzer</span>
              </div>
            </Link>
            <Link
              to="/deadlocks"
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                isActive('/deadlocks')
                  ? 'text-white bg-slate-900 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Deadlocks</span>
              </div>
            </Link>
            <Link
              to="/connection-pool"
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                isActive('/connection-pool')
                  ? 'text-white bg-slate-900 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Connection Pool</span>
              </div>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 border-t border-slate-700 mt-12">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-sm text-slate-400">
            GuardSQL Monitor v1.0.0 · Real-time Database Monitoring
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
