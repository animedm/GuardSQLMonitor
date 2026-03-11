import { Alert } from '../api';
import { AlertTriangle, AlertCircle, Info, X, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../api';

interface AlertPanelProps {
  alerts: Alert[];
  onResolve: () => void;
}

export default function AlertPanel({ alerts, onResolve }: AlertPanelProps) {
  const handleResolve = async (alertId: string) => {
    try {
      await api.resolveAlert(alertId);
      onResolve();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'red';
      case 'warning':
        return 'yellow';
      default:
        return 'blue';
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span>Active Alerts ({alerts.length})</span>
          </h2>
        </div>
      </div>

      <div className="divide-y divide-slate-700">
        {alerts.map((alert) => {
          const color = getAlertColor(alert.severity);
          return (
            <div
              key={alert.id}
              className={`px-6 py-4 bg-${color}-500/10 border-l-4 border-${color}-500 hover:bg-${color}-500/20 transition-colors`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className={`text-${color}-500 mt-0.5`}>
                    {getAlertIcon(alert.severity)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`text-xs font-semibold text-${color}-500 uppercase`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-400">{alert.database}</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-400">
                        {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-white font-medium mb-1">{alert.message}</p>
                    {alert.metric && (
                      <p className="text-xs text-slate-400">
                        {alert.metric}: {alert.value?.toFixed(2)}
                        {alert.threshold && ` (threshold: ${alert.threshold})`}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleResolve(alert.id)}
                  className={`ml-4 p-2 rounded-lg bg-${color}-500/20 hover:bg-${color}-500/30 text-${color}-500 transition-colors`}
                  title="Resolve alert"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {alerts.length === 0 && (
        <div className="px-6 py-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-slate-400">No active alerts</p>
        </div>
      )}
    </div>
  );
}
