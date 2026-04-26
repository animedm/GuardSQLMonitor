import { useEffect, useMemo, useState } from 'react';
import { api, Database, DatabaseMetrics, Alert, HistoricalMetricRow } from '../api';
import DatabaseCard from '../components/DatabaseCard';
import AlertPanel from '../components/AlertPanel';
import MetricsChart from '../components/MetricsChart';
import { Activity, AlertTriangle, Clock, Database as DBIcon, Filter, Gauge, Search, X } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useRefreshSettings } from '../hooks/useRefreshSettings';
import { useToast } from '../components/ToastProvider';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export function Dashboard() {
  const { refreshIntervalSec } = useRefreshSettings();
  const { showToast } = useToast();
  const [metrics, setMetrics] = useState<DatabaseMetrics[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [alertStats, setAlertStats] = useState<any>(null);
  const [selectedAlertAlias, setSelectedAlertAlias] = useState<string>('all');
  const [selectedAlertSeverity, setSelectedAlertSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [alertSearch, setAlertSearch] = useState('');
  const [healthTrend, setHealthTrend] = useState<Array<{ time: string; score: number }>>([]);
  const [temporalRiskRanking, setTemporalRiskRanking] = useState<
    Array<{ key: string; name: string; type: string; current: number; avg24h: number; delta: number }>
  >([]);
  const [aliasSearch, setAliasSearch] = useState<string>(() => {
    try {
      return localStorage.getItem('dashboard.aliasSearch') || '';
    } catch {
      return '';
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const computeHealthScore = (metric: DatabaseMetrics): number => {
    if (metric.status === 'down') {
      return 5;
    }

    let score = 100;
    const connectionUsage = metric.connections.max > 0
      ? (metric.connections.total / metric.connections.max) * 100
      : 0;

    if (metric.responseTime > 200) {
      const penalty = Math.min(25, ((metric.responseTime - 200) / 800) * 25);
      score -= penalty;
    }

    if (connectionUsage > 70) {
      const penalty = Math.min(25, ((connectionUsage - 70) / 30) * 25);
      score -= penalty;
    }

    score -= Math.min(20, metric.performance.slowQueries * 2);

    if (metric.resources.cpuUsage && metric.resources.cpuUsage > 70) {
      score -= Math.min(15, ((metric.resources.cpuUsage - 70) / 30) * 15);
    }

    if (metric.resources.memoryUsage && metric.resources.memoryUsage > 75) {
      score -= Math.min(15, ((metric.resources.memoryUsage - 75) / 25) * 15);
    }

    if (metric.status === 'degraded') {
      score -= 15;
    }

    return Math.max(0, Math.round(score));
  };

  const mapHistoricalToMetric = (row: HistoricalMetricRow, maxConnections: number): DatabaseMetrics => {
    return {
      timestamp: row.timestamp,
      databaseType: row.database_type,
      databaseName: row.database_name,
      status: 'healthy',
      responseTime: Number(row.response_time || 0),
      connections: {
        active: Number(row.connections_active || 0),
        idle: Number(row.connections_idle || 0),
        total: Number(row.connections_total || 0),
        max: maxConnections,
        waiting: 0
      },
      performance: {
        queriesPerSecond: 0,
        slowQueries: Number(row.slow_queries || 0),
        avgQueryTime: 0,
        transactionsPerSecond: 0
      },
      resources: {},
      size: {
        totalSizeMB: 0,
        dataSize: 0,
        indexSize: 0
      }
    };
  };

  const fetchHealthTrendData = async (currentMetrics: DatabaseMetrics[]) => {
    if (currentMetrics.length === 0) {
      setHealthTrend([]);
      setTemporalRiskRanking([]);
      return;
    }

    const maxByKey = new Map(
      currentMetrics.map((m) => [`${m.databaseType}:${m.databaseName}`, Math.max(1, m.connections.max)])
    );

    const historicalResults = await Promise.all(
      currentMetrics.map(async (m) => {
        const key = `${m.databaseType}:${m.databaseName}`;
        try {
          const rows = await api.getHistoricalMetrics(m.databaseType, m.databaseName, 24);
          return { key, rows };
        } catch {
          return { key, rows: [] as HistoricalMetricRow[] };
        }
      })
    );

    const temporalRanking = currentMetrics
      .map((m) => {
        const key = `${m.databaseType}:${m.databaseName}`;
        const max = maxByKey.get(key) || 100;
        const result = historicalResults.find((r) => r.key === key);
        const historicScores = (result?.rows || []).map((row) => computeHealthScore(mapHistoricalToMetric(row, max)));
        const currentScore = computeHealthScore(m);
        const allScores = [...historicScores, currentScore];
        const avg24h = allScores.length > 0 ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length : currentScore;

        return {
          key,
          name: m.databaseName,
          type: m.databaseType,
          current: currentScore,
          avg24h,
          delta: currentScore - avg24h
        };
      })
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 5);

    setTemporalRiskRanking(temporalRanking);

    const bucketMap = new Map<string, { ts: string; total: number; count: number }>();

    for (const result of historicalResults) {
      const max = maxByKey.get(result.key) || 100;
      for (const row of result.rows) {
        const date = new Date(row.timestamp);
        if (Number.isNaN(date.getTime())) {
          continue;
        }

        const bucketDate = new Date(date);
        bucketDate.setSeconds(0, 0);
        const bucketKey = bucketDate.toISOString();
        const score = computeHealthScore(mapHistoricalToMetric(row, max));
        const existing = bucketMap.get(bucketKey);

        if (existing) {
          existing.total += score;
          existing.count += 1;
        } else {
          bucketMap.set(bucketKey, { ts: bucketKey, total: score, count: 1 });
        }
      }
    }

    const now = new Date();
    now.setSeconds(0, 0);
    const nowKey = now.toISOString();
    const nowAvg = currentMetrics.reduce((sum, metric) => sum + computeHealthScore(metric), 0) / currentMetrics.length;
    bucketMap.set(nowKey, {
      ts: nowKey,
      total: nowAvg,
      count: 1
    });

    const trendPoints = Array.from(bucketMap.values())
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
      .slice(-72)
      .map((bucket) => ({
        time: new Date(bucket.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        score: Number((bucket.total / bucket.count).toFixed(1))
      }));

    setHealthTrend(trendPoints);
  };

  const fetchData = async () => {
    try {
      const [metricsResult, alertsResult, statsResult, dbListResult] = await Promise.allSettled([
        api.getLatestMetrics(),
        api.getAlerts(true),
        api.getAlertStats(),
        api.getDatabases()
      ]);

      const loadedMetrics = metricsResult.status === 'fulfilled' ? metricsResult.value : [];
      setMetrics(loadedMetrics);
      setAlerts(alertsResult.status === 'fulfilled' ? alertsResult.value : []);
      setAlertStats(
        statsResult.status === 'fulfilled'
          ? statsResult.value
          : { total: 0, active: 0, resolved: 0, critical: 0, warning: 0, info: 0 }
      );
      setDatabases(dbListResult.status === 'fulfilled' ? dbListResult.value : []);

      const failedRequests = [metricsResult, alertsResult, statsResult, dbListResult].filter(
        (r) => r.status === 'rejected'
      );

      if (failedRequests.length > 0) {
        const firstError = failedRequests[0] as PromiseRejectedResult;
        const message = firstError.reason?.message || 'Some dashboard data failed to load';
        setError(message);
        showToast('Se cargaron datos parciales del dashboard.', 'warning');
      } else {
        setError(null);
      }

      try {
        await fetchHealthTrendData(loadedMetrics);
      } catch {
        // Keep dashboard functional even if trend calculations fail.
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
      console.error('Error fetching data:', err);
      showToast('No se pudo cargar el dashboard.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    const interval = setInterval(fetchData, refreshIntervalSec * 1000);
    
    return () => clearInterval(interval);
  }, [refreshIntervalSec]);

  useEffect(() => {
    try {
      localStorage.setItem('dashboard.aliasSearch', aliasSearch);
    } catch {
      // Ignore storage errors in restricted environments.
    }
  }, [aliasSearch]);

  const totalConnections = metrics.reduce((sum, m) => sum + m.connections.total, 0);
  const avgResponseTime = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length
    : 0;

  const scoredMetrics = useMemo(
    () => metrics.map((metric) => ({ metric, healthScore: computeHealthScore(metric) })),
    [metrics]
  );

  const avgHealthScore = scoredMetrics.length > 0
    ? scoredMetrics.reduce((sum, item) => sum + item.healthScore, 0) / scoredMetrics.length
    : 0;

  const riskiestConnections = useMemo(
    () => [...scoredMetrics].sort((a, b) => a.healthScore - b.healthScore).slice(0, 5),
    [scoredMetrics]
  );

  const filteredMetrics = useMemo(() => {
    const term = aliasSearch.trim().toLowerCase();
    if (!term) {
      return metrics;
    }

    return metrics.filter((metric) => {
      const searchable = `${metric.databaseType} ${metric.databaseName}`.toLowerCase();
      return searchable.includes(term);
    });
  }, [metrics, aliasSearch]);

  const groupedMetrics = useMemo(() => {
    const grouped = filteredMetrics.reduce((acc, metric) => {
      const key = metric.databaseType;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(metric);
      return acc;
    }, {} as Record<string, DatabaseMetrics[]>);

    for (const key of Object.keys(grouped)) {
      grouped[key] = grouped[key].sort((a, b) => a.databaseName.localeCompare(b.databaseName));
    }

    return grouped;
  }, [filteredMetrics]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (selectedAlertAlias !== 'all' && alert.database !== selectedAlertAlias) {
        return false;
      }

      if (selectedAlertSeverity !== 'all' && alert.severity !== selectedAlertSeverity) {
        return false;
      }

      const term = alertSearch.trim().toLowerCase();
      if (!term) {
        return true;
      }

      return [alert.database, alert.type, alert.message, alert.metric]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [alerts, selectedAlertAlias, selectedAlertSeverity, alertSearch]);

  const aliases = useMemo(() => {
    const aliasSet = new Set<string>();
    for (const db of databases) {
      aliasSet.add(db.name);
    }
    for (const metric of metrics) {
      aliasSet.add(metric.databaseName);
    }
    return Array.from(aliasSet).sort((a, b) => a.localeCompare(b));
  }, [databases, metrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-2">Error loading dashboard</p>
          <p className="text-slate-400 text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Databases</h3>
            <DBIcon className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-white">{metrics.length}</p>
          <p className="text-xs text-slate-400 mt-1">Monitoreadas activamente</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Active Connections</h3>
            <Activity className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-white">{totalConnections}</p>
          <p className="text-xs text-slate-400 mt-1">Across all databases</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Avg Response Time</h3>
            <Clock className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold text-white">{avgResponseTime.toFixed(0)}ms</p>
          <p className="text-xs text-slate-400 mt-1">Last measurement</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Active Alerts</h3>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-white">{alertStats?.active || 0}</p>
          <p className="text-xs text-slate-400 mt-1">
            {alertStats?.critical || 0} critical, {alertStats?.warning || 0} warnings
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Health Score</h3>
            <Gauge className="w-5 h-5 text-cyan-400" />
          </div>
          <p className="text-3xl font-bold text-white">{avgHealthScore.toFixed(0)}</p>
          <p className="text-xs text-slate-400 mt-1">Promedio de conexiones (0-100)</p>
        </div>
      </div>

      {healthTrend.length > 1 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-200">Tendencia historica Health Score (24h)</h3>
            <span className="text-xs text-slate-400">Promedio global por minuto</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={healthTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" minTickGap={32} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#cbd5e1' }}
                />
                <Line type="monotone" dataKey="score" stroke="#22d3ee" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Alerts Panel */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-blue-400" />
          <label className="text-slate-300 text-sm">Filtros de alertas</label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={selectedAlertAlias}
            onChange={(e) => setSelectedAlertAlias(e.target.value)}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Todos los alias</option>
            {aliases.map((alias) => (
              <option key={alias} value={alias}>
                {alias}
              </option>
            ))}
          </select>
          <select
            value={selectedAlertSeverity}
            onChange={(e) => setSelectedAlertSeverity(e.target.value as 'all' | 'critical' | 'warning' | 'info')}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Todas las severidades</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <input
            type="text"
            value={alertSearch}
            onChange={(e) => setAlertSearch(e.target.value)}
            placeholder="Buscar por mensaje, tipo o metrica"
            className="bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-emerald-400" />
          <label className="text-slate-300 text-sm">Buscar conexiones por alias</label>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={aliasSearch}
            onChange={(e) => setAliasSearch(e.target.value)}
            placeholder="Ejemplo: prod, staging, cliente-a"
            className="flex-1 bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
          />
          {aliasSearch.trim().length > 0 && (
            <button
              onClick={() => setAliasSearch('')}
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
              title="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Mostrando {filteredMetrics.length} de {metrics.length} conexiones
        </p>
      </div>

      {riskiestConnections.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm text-slate-200 font-medium">Conexiones con mayor riesgo</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {riskiestConnections.map(({ metric, healthScore }) => (
              <div
                key={`risk-${metric.databaseType}-${metric.databaseName}`}
                className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2"
              >
                <p className="text-sm text-white font-medium truncate">{metric.databaseName}</p>
                <p className="text-xs text-slate-400">{metric.databaseType.toUpperCase()}</p>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Score</span>
                  <span className={healthScore < 60 ? 'text-red-400' : healthScore < 80 ? 'text-amber-300' : 'text-emerald-400'}>
                    {healthScore}/100
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {temporalRiskRanking.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-rose-300" />
            <h3 className="text-sm text-slate-200 font-medium">Ranking temporal (caida vs promedio 24h)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {temporalRiskRanking.map((item) => (
              <div key={`temporal-${item.key}`} className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2">
                <p className="text-sm text-white font-medium truncate">{item.name}</p>
                <p className="text-xs text-slate-400">{item.type.toUpperCase()}</p>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Actual</span>
                  <span className="text-slate-200">{item.current.toFixed(0)}/100</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Promedio 24h</span>
                  <span className="text-slate-300">{item.avg24h.toFixed(0)}/100</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Delta</span>
                  <span className={item.delta < 0 ? 'text-red-400' : 'text-emerald-400'}>{item.delta.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredAlerts.length > 0 && <AlertPanel alerts={filteredAlerts} onResolve={fetchData} />}

      {/* Grouped Database Cards + Charts */}
      {Object.entries(groupedMetrics).map(([type, typeMetrics]) => (
        <section key={type} className="space-y-4">
          <div className="flex items-center gap-2">
            <DBIcon className="w-5 h-5 text-blue-400" />
            <h3 className="text-xl font-semibold text-white">{type.toUpperCase()}</h3>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-300">
              {typeMetrics.length} alias
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {typeMetrics.map((metric) => (
              <DatabaseCard key={`${metric.databaseType}-${metric.databaseName}`} metrics={metric} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {typeMetrics.map((metric) => (
              <MetricsChart
                key={`chart-${metric.databaseType}-${metric.databaseName}`}
                databaseType={metric.databaseType}
                databaseName={metric.databaseName}
              />
            ))}
          </div>
        </section>
      ))}

      {metrics.length > 0 && filteredMetrics.length === 0 && (
        <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
          <Search className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Sin coincidencias</h3>
          <p className="text-slate-400 mb-4">
            No hay alias que coincidan con &quot;{aliasSearch}&quot;.
          </p>
          <button
            onClick={() => setAliasSearch('')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            Limpiar búsqueda
          </button>
        </div>
      )}

      {metrics.length === 0 && (
        <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
          <DBIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Databases Configured</h3>
          <p className="text-slate-400 mb-4">
            Configure your database connections in the .env file to start monitoring.
          </p>
        </div>
      )}
    </div>
    </Layout>
  );
}

export default Dashboard;
