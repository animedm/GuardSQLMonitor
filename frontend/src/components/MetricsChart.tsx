import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api, DatabaseMetrics } from '../api';
import { format } from 'date-fns';
import { Activity } from 'lucide-react';

interface MetricsChartProps {
  databaseType: string;
  databaseName: string;
}

export default function MetricsChart({ databaseType, databaseName }: MetricsChartProps) {
  const [history, setHistory] = useState<DatabaseMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await api.getMetricsHistory(databaseType, databaseName, 20);
        setHistory(data);
      } catch (error) {
        console.error('Failed to fetch metrics history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 30000);
    
    return () => clearInterval(interval);
  }, [databaseType, databaseName]);

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-center h-64">
          <Activity className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </div>
    );
  }

  const chartData = history.map((m) => ({
    time: format(new Date(m.timestamp), 'HH:mm:ss'),
    connections: m.connections.active,
    responseTime: m.responseTime,
    slowQueries: m.performance.slowQueries
  }));

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white capitalize">
          {databaseType} - {databaseName}
        </h3>
        <p className="text-sm text-slate-400">Performance metrics over time</p>
      </div>

      <div className="p-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff'
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="connections"
              stroke="#3b82f6"
              name="Active Connections"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="responseTime"
              stroke="#f59e0b"
              name="Response Time (ms)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="slowQueries"
              stroke="#ef4444"
              name="Slow Queries"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
