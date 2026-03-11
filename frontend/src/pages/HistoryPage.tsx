import React, { useState } from 'react';
import { SlowQueriesHistory } from '../components/SlowQueriesHistory';
import { MetricsTimeline } from '../components/MetricsTimeline';
import { EventsLog } from '../components/EventsLog';
import { Clock, TrendingUp, Bell, Calendar, Download, FileSpreadsheet } from 'lucide-react';

type TabType = 'slow-queries' | 'metrics' | 'events';

export const HistoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('slow-queries');
  const [selectedDatabase, setSelectedDatabase] = useState({
    type: 'postgres',
    name: 'neondb'
  });

  // Date range state
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setHours(date.getHours() - 24);
    return date.toISOString().slice(0, 16);
  });
  
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 16);
  });

  // Quick date range presets
  const setQuickRange = (hours: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    setStartDate(start.toISOString().slice(0, 16));
    setEndDate(end.toISOString().slice(0, 16));
  };

  // Export functions
  const handleExportToExcel = async () => {
    try {
      const params = new URLSearchParams({
        databaseType: selectedDatabase.type,
        databaseName: selectedDatabase.name,
        startDate,
        endDate
      });

      const response = await fetch(`http://localhost:3001/api/export/excel?${params}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `guardsql-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export to Excel');
    }
  };

  const handleExportMetricsCSV = async () => {
    try {
      const params = new URLSearchParams({
        databaseType: selectedDatabase.type,
        databaseName: selectedDatabase.name,
        startDate,
        endDate
      });

      const response = await fetch(`http://localhost:3001/api/export/metrics/csv?${params}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metrics-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting metrics to CSV:', error);
      alert('Failed to export metrics to CSV');
    }
  };

  const handleExportSlowQueriesCSV = async () => {
    try {
      const params = new URLSearchParams({
        databaseType: selectedDatabase.type,
        databaseName: selectedDatabase.name,
        startDate,
        endDate
      });

      const response = await fetch(`http://localhost:3001/api/export/slow-queries/csv?${params}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `slow-queries-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting slow queries to CSV:', error);
      alert('Failed to export slow queries to CSV');
    }
  };

  const tabs = [
    { id: 'slow-queries' as TabType, label: 'Slow Queries', icon: Clock },
    { id: 'metrics' as TabType, label: 'Metrics Timeline', icon: TrendingUp },
    { id: 'events' as TabType, label: 'Events Log', icon: Bell }
  ];

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Historical Data</h1>
          <p className="text-slate-400">
            View historical slow queries, metrics trends, and system events (30-day retention)
          </p>
        </div>

        {/* Database selector */}
        <div className="bg-slate-800 rounded-lg p-4 mb-6">
          <label className="text-slate-400 text-sm mb-2 block">Database</label>
          <div className="flex gap-4">
            <select
              value={selectedDatabase.type}
              onChange={(e) => setSelectedDatabase({ ...selectedDatabase, type: e.target.value })}
              className="bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="postgres">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="sqlserver">SQL Server</option>
            </select>
            <input
              type="text"
              value={selectedDatabase.name}
              onChange={(e) => setSelectedDatabase({ ...selectedDatabase, name: e.target.value })}
              placeholder="Database name"
              className="bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none flex-1"
            />
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="bg-slate-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={20} className="text-blue-400" />
            <label className="text-slate-400 text-sm">Date & Time Range</label>
          </div>
          
          {/* Quick presets */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setQuickRange(1)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
            >
              Last Hour
            </button>
            <button
              onClick={() => setQuickRange(6)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
            >
              Last 6 Hours
            </button>
            <button
              onClick={() => setQuickRange(24)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
            >
              Last 24 Hours
            </button>
            <button
              onClick={() => setQuickRange(24 * 7)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setQuickRange(24 * 30)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
            >
              Last 30 Days
            </button>
          </div>

          {/* Custom date inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Start Date & Time</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">End Date & Time</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="bg-slate-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Download size={20} className="text-green-400" />
            <label className="text-slate-400 text-sm">Export Data</label>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleExportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <FileSpreadsheet size={18} />
              Export to Excel (All Data)
            </button>
            <button
              onClick={handleExportMetricsCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Download size={18} />
              Export Metrics to CSV
            </button>
            <button
              onClick={handleExportSlowQueriesCSV}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Download size={18} />
              Export Slow Queries to CSV
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-blue-400 border-blue-400'
                    : 'text-slate-400 border-transparent hover:text-slate-300'
                }`}
              >
                <Icon size={20} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="space-y-6">
          {activeTab === 'slow-queries' && (
            <SlowQueriesHistory
              databaseType={selectedDatabase.type}
              databaseName={selectedDatabase.name}
              minExecutionTime={1}
              autoRefresh={false}
              startDate={startDate}
              endDate={endDate}
            />
          )}

          {activeTab === 'metrics' && (
            <MetricsTimeline
              databaseType={selectedDatabase.type}
              databaseName={selectedDatabase.name}
              autoRefresh={false}
              startDate={startDate}
              endDate={endDate}
            />
          )}

          {activeTab === 'events' && (
            <EventsLog
              autoRefresh={false}
              limit={100}
              startDate={startDate}
              endDate={endDate}
            />
          )}
        </div>
      </div>
    </div>
  );
};
