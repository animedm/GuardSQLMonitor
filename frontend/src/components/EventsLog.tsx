import React, { useState, useEffect } from 'react';
import { Bell, AlertCircle, AlertTriangle, Info, CheckCircle, Filter } from 'lucide-react';

interface Event {
  id: number;
  timestamp: string;
  event_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details?: string;
  database_type?: string;
  database_name?: string;
}

interface EventsLogProps {
  autoRefresh?: boolean;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export const EventsLog: React.FC<EventsLogProps> = ({
  autoRefresh = true,
  limit = 50,
  startDate,
  endDate
}) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (startDate && endDate) {
        params.append('startTime', new Date(startDate).toISOString());
        params.append('endTime', new Date(endDate).toISOString());
      } else {
        params.append('limit', limit.toString());
      }
      
      if (filterSeverity !== 'all') params.append('severity', filterSeverity);
      if (filterType !== 'all') params.append('eventType', filterType);

      const response = await fetch(`http://localhost:3001/api/history/events?${params}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      
      const data = await response.json();
      setEvents(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    
    if (autoRefresh) {
      const interval = setInterval(fetchEvents, 30000);
      return () => clearInterval(interval);
    }
  }, [filterSeverity, filterType, limit, autoRefresh, startDate, endDate]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle size={20} className="text-red-500" />;
      case 'error':
        return <AlertCircle size={20} className="text-red-400" />;
      case 'warning':
        return <AlertTriangle size={20} className="text-yellow-400" />;
      case 'info':
        return <Info size={20} className="text-blue-400" />;
      default:
        return <CheckCircle size={20} className="text-green-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-900 border-red-700';
      case 'error':
        return 'bg-red-800 border-red-600';
      case 'warning':
        return 'bg-yellow-800 border-yellow-600';
      case 'info':
        return 'bg-blue-800 border-blue-600';
      default:
        return 'bg-slate-700 border-slate-600';
    }
  };

  const uniqueEventTypes = Array.from(new Set(events.map(e => e.event_type)));

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
          onClick={fetchEvents}
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
          <Bell size={24} />
          Events Log
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">
            {events.length} events
          </span>
          <button
            onClick={fetchEvents}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap items-center">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <span className="text-slate-400 text-sm">Filters:</span>
        </div>
        
        {/* Severity filter */}
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
        >
          <option value="all">All Types</option>
          {uniqueEventTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* Events list */}
      {events.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Bell size={48} className="mx-auto mb-4 opacity-50" />
          <p>No events found</p>
          <p className="text-sm mt-2">System events will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className={`rounded-lg p-4 border ${getSeverityColor(event.severity)}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getSeverityIcon(event.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-white font-semibold">{event.event_type}</span>
                    <span className="text-xs px-2 py-1 rounded bg-slate-900 text-slate-300 uppercase">
                      {event.severity}
                    </span>
                    {event.database_type && event.database_name && (
                      <span className="text-xs text-slate-300">
                        {event.database_type.toUpperCase()} - {event.database_name}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-200 mb-2">{event.message}</p>
                  {event.details && (
                    <details className="text-sm text-slate-300">
                      <summary className="cursor-pointer hover:text-white">Details</summary>
                      <pre className="mt-2 p-2 bg-slate-900 rounded text-xs overflow-x-auto">
                        {event.details}
                      </pre>
                    </details>
                  )}
                  <div className="text-xs text-slate-400 mt-2">
                    {new Date(event.timestamp).toLocaleString()}
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
