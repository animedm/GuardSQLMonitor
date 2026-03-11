import React, { useState, useEffect } from 'react';
import { Clock, Database, User, AlertTriangle } from 'lucide-react';

interface SlowQuery {
  id: number;
  timestamp: string;
  database_type: string;
  database_name: string;
  query: string;
  execution_time: number;
  client_address?: string;
  username?: string;
  rows_affected?: number;
}

interface SlowQueriesHistoryProps {
  databaseType?: string;
  databaseName?: string;
  minExecutionTime?: number;
  autoRefresh?: boolean;
  startDate?: string;
  endDate?: string;
}

export const SlowQueriesHistory: React.FC<SlowQueriesHistoryProps> = ({
  databaseType,
  databaseName,
  minExecutionTime = 1,
  autoRefresh = true,
  startDate,
  endDate
}) => {
  const [queries, setQueries] = useState<SlowQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchSlowQueries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      // Use time range endpoint if dates are provided
      if (startDate && endDate) {
        params.append('startTime', new Date(startDate).toISOString());
        params.append('endTime', new Date(endDate).toISOString());
        if (databaseType) params.append('databaseType', databaseType);
        if (databaseName) params.append('databaseName', databaseName);
        
        const response = await fetch(`http://localhost:3001/api/history/slow-queries/range?${params}`);
        if (!response.ok) throw new Error('Failed to fetch slow queries');
        const data = await response.json();
        setQueries(data);
      } else {
        // Use default endpoint with limit
        if (databaseType) params.append('databaseType', databaseType);
        if (databaseName) params.append('databaseName', databaseName);
        if (minExecutionTime) params.append('minExecutionTime', minExecutionTime.toString());
        params.append('limit', '50');

        const response = await fetch(`http://localhost:3001/api/history/slow-queries?${params}`);
        if (!response.ok) throw new Error('Failed to fetch slow queries');
        const data = await response.json();
        setQueries(data);
      }
      
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlowQueries();
    
    if (autoRefresh) {
      const interval = setInterval(fetchSlowQueries, 30000);
      return () => clearInterval(interval);
    }
  }, [databaseType, databaseName, minExecutionTime, autoRefresh, startDate, endDate]);

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getExecutionTimeColor = (ms: number) => {
    if (ms < 1000) return 'text-green-400';
    if (ms < 5000) return 'text-yellow-400';
    if (ms < 10000) return 'text-orange-400';
    return 'text-red-400';
  };

  const truncateQuery = (query: string, maxLength: number = 100) => {
    if (query.length <= maxLength) return query;
    return query.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 animate-pulse">
        <div className="h-8 bg-slate-700 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle size={20} />
          <span>Error: {error}</span>
        </div>
        <button
          onClick={fetchSlowQueries}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Clock size={24} />
          Slow Queries History
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">
            {queries.length} queries
          </span>
          <button
            onClick={fetchSlowQueries}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {queries.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p>No slow queries found</p>
          <p className="text-sm mt-2">Queries slower than {minExecutionTime}s will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queries.map((query) => (
            <div
              key={query.id}
              className="bg-slate-700 rounded-lg p-4 hover:bg-slate-650 transition-colors cursor-pointer"
              onClick={() => setExpandedId(expandedId === query.id ? null : query.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Database size={16} className="text-blue-400 flex-shrink-0" />
                    <span className="text-white font-medium">
                      {query.database_type.toUpperCase()} - {query.database_name}
                    </span>
                    <span
                      className={`font-mono font-bold flex-shrink-0 ${getExecutionTimeColor(
                        query.execution_time
                      )}`}
                    >
                      {formatExecutionTime(query.execution_time)}
                    </span>
                  </div>

                  <div className="font-mono text-sm text-slate-300 bg-slate-800 p-3 rounded border border-slate-600 mb-2">
                    {expandedId === query.id ? query.query : truncateQuery(query.query)}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(query.timestamp).toLocaleString()}
                    </span>
                    {query.username && (
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {query.username}
                      </span>
                    )}
                    {query.rows_affected !== undefined && query.rows_affected !== null && (
                      <span>Rows: {query.rows_affected.toLocaleString()}</span>
                    )}
                    {query.client_address && (
                      <span>Client: {query.client_address}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
