import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Database, Activity, Bell, BarChart3, RefreshCw, Layout as LayoutIcon, Clock, Search, AlertTriangle, Users, Settings } from 'lucide-react';
import { useActiveConnection } from '../hooks/useActiveConnection';
import { api } from '../api';
import { useRefreshSettings } from '../hooks/useRefreshSettings';
import { useToast } from './ToastProvider';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { selectedKey, setActiveConnection, connectionOptions } = useActiveConnection();
  const { refreshIntervalSec, setRefreshIntervalSec } = useRefreshSettings();
  const { preferences, setTypeEnabled } = useToast();
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'degraded' | 'unhealthy' | 'error'>('healthy');
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    const loadHealth = async () => {
      try {
        const health = await api.getHealth();
        setHealthStatus(health?.status || 'healthy');
      } catch {
        setHealthStatus('error');
      }
    };

    loadHealth();
    const interval = setInterval(loadHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!notificationsRef.current) {
        return;
      }
      if (!notificationsRef.current.contains(event.target as Node)) {
        setShowNotificationsMenu(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const healthBadge = useMemo(() => {
    if (healthStatus === 'healthy') {
      return {
        icon: 'text-green-500',
        text: 'All Systems Operational'
      };
    }

    if (healthStatus === 'degraded') {
      return {
        icon: 'text-yellow-500',
        text: 'Systems Degraded'
      };
    }

    return {
      icon: 'text-red-500',
      text: 'Systems Unavailable'
    };
  }, [healthStatus]);

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
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/60 border border-slate-600 text-xs">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-400">Active DB:</span>
                <select
                  value={selectedKey}
                  onChange={(e) => setActiveConnection(e.target.value)}
                  className="bg-slate-800 text-slate-100 border border-slate-600 rounded px-2 py-1 focus:outline-none"
                >
                  {connectionOptions.length === 0 && <option value="">None</option>}
                  {connectionOptions.map((conn) => (
                    <option key={conn.key} value={conn.key}>
                      {conn.type.toUpperCase()} / {conn.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/60 border border-slate-600 text-xs">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">Refresh:</span>
                <select
                  value={refreshIntervalSec}
                  onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
                  className="bg-slate-800 text-slate-100 border border-slate-600 rounded px-2 py-1 focus:outline-none"
                >
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                  <option value={120}>120s</option>
                </select>
              </div>
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setShowNotificationsMenu((prev) => !prev)}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                  title="Notification settings"
                >
                  <Bell className="w-5 h-5" />
                </button>
                {showNotificationsMenu && (
                  <div className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-600 bg-slate-800 shadow-xl p-3 z-50">
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Notifications</p>
                    <div className="space-y-2 text-sm text-slate-200">
                      <label className="flex items-center justify-between">
                        <span>Errors</span>
                        <input
                          type="checkbox"
                          checked={preferences.error}
                          onChange={(e) => setTypeEnabled('error', e.target.checked)}
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span>Warnings</span>
                        <input
                          type="checkbox"
                          checked={preferences.warning}
                          onChange={(e) => setTypeEnabled('warning', e.target.checked)}
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span>Info</span>
                        <input
                          type="checkbox"
                          checked={preferences.info}
                          onChange={(e) => setTypeEnabled('info', e.target.checked)}
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span>Success</span>
                        <input
                          type="checkbox"
                          checked={preferences.success}
                          onChange={(e) => setTypeEnabled('success', e.target.checked)}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-slate-400 mt-3">Repeated messages are automatically muted for 10s.</p>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2 text-sm text-slate-400">
                <Activity className={`w-4 h-4 ${healthBadge.icon}`} />
                <span>{healthBadge.text}</span>
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
            <Link
              to="/config"
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                isActive('/config')
                  ? 'text-white bg-slate-900 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Settings</span>
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
