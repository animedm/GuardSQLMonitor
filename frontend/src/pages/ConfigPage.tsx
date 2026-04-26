import { useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { api, ConnectionEntry, GlobalAlertSettings } from '../api';
import { CheckCircle, Database, Eye, EyeOff, Loader, Plus, Save, Trash2, Wifi, XCircle } from 'lucide-react';

type DbType = 'postgres' | 'mysql' | 'mssql';
type TestState = 'idle' | 'loading' | 'success' | 'error';

type ConnectionForm = ConnectionEntry & {
  showPassword?: boolean;
  testState?: TestState;
  testMessage?: string;
  alertSettings: {
    enabled: boolean;
    snoozedUntil?: string;
    thresholds: {
      cpu?: number;
      memory?: number;
      connections?: number;
      slowQueryCount?: number;
    };
    maintenanceWindow: {
      enabled: boolean;
      startHour: number;
      endHour: number;
      daysOfWeek: number[];
      mutedMetrics: {
        cpu: boolean;
        memory: boolean;
        connections: boolean;
        slowQueryCount: boolean;
      };
    };
  };
};

const WEEK_DAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mie' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sab' }
];

const DEFAULT_ALERTS: GlobalAlertSettings = {
  enabled: true,
  cooldownMinutes: 5,
  email: {
    enabled: false,
    to: ''
  },
  webhook: {
    enabled: false,
    url: ''
  },
  thresholds: {
    cpu: 80,
    memory: 85,
    connections: 90,
    slowQueryCount: 10
  }
};

const TYPE_LABELS: Record<DbType, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL / MariaDB',
  mssql: 'SQL Server (MSSQL)'
};

const TYPE_DEFAULTS: Record<DbType, Pick<ConnectionEntry, 'port' | 'database' | 'user'>> = {
  postgres: { port: 5432, database: 'postgres', user: 'postgres' },
  mysql: { port: 3306, database: 'mysql', user: 'root' },
  mssql: { port: 1433, database: 'master', user: 'sa' }
};

const DEFAULT_MAINTENANCE = {
  enabled: false,
  startHour: 22,
  endHour: 6,
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  mutedMetrics: {
    cpu: true,
    memory: true,
    connections: false,
    slowQueryCount: true
  }
};

type MaintenancePresetKey = 'work-nights' | 'weekend' | 'never-mute-availability';
type MaintenanceWindow = ConnectionForm['alertSettings']['maintenanceWindow'];
type LastBulkPresetAction = {
  type: DbType;
  preset: MaintenancePresetKey;
  previousByConnectionId: Record<string, MaintenanceWindow>;
};
type PendingBulkPresetAction = {
  type: DbType;
  preset: MaintenancePresetKey;
  presetLabel: string;
  affectedConnections: number;
  previousByConnectionId: Record<string, MaintenanceWindow>;
};
type InitialConfigSnapshot = {
  connections: ConnectionEntry[];
  alerts: GlobalAlertSettings;
};

const MAINTENANCE_PRESETS: Array<{ key: MaintenancePresetKey; label: string }> = [
  { key: 'work-nights', label: 'Nocturno laboral' },
  { key: 'weekend', label: 'Fin de semana' },
  { key: 'never-mute-availability', label: 'Nunca silenciar conexiones' }
];

function getMaintenancePreset(key: MaintenancePresetKey): ConnectionForm['alertSettings']['maintenanceWindow'] {
  if (key === 'work-nights') {
    return {
      enabled: true,
      startHour: 22,
      endHour: 6,
      daysOfWeek: [1, 2, 3, 4, 5],
      mutedMetrics: {
        cpu: true,
        memory: true,
        connections: false,
        slowQueryCount: true
      }
    };
  }

  if (key === 'weekend') {
    return {
      enabled: true,
      startHour: 0,
      endHour: 23,
      daysOfWeek: [0, 6],
      mutedMetrics: {
        cpu: true,
        memory: true,
        connections: false,
        slowQueryCount: true
      }
    };
  }

  return {
    enabled: true,
    startHour: 0,
    endHour: 23,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    mutedMetrics: {
      cpu: true,
      memory: true,
      connections: false,
      slowQueryCount: true
    }
  };
}

const newId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

function createEmpty(type: DbType): ConnectionForm {
  const defaults = TYPE_DEFAULTS[type];
  return {
    id: newId(),
    name: `${TYPE_LABELS[type]} ${new Date().getTime().toString().slice(-4)}`,
    type,
    enabled: true,
    host: 'localhost',
    port: defaults.port,
    database: defaults.database,
    user: defaults.user,
    password: '',
    alertSettings: {
      enabled: true,
      thresholds: {},
      maintenanceWindow: {
        enabled: false,
        startHour: 22,
        endHour: 6,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        mutedMetrics: {
          cpu: true,
          memory: true,
          connections: false,
          slowQueryCount: true
        }
      }
    },
    showPassword: false,
    testState: 'idle',
    testMessage: ''
  };
}

function normalizeGlobalAlerts(input?: GlobalAlertSettings): GlobalAlertSettings {
  if (!input) {
    return DEFAULT_ALERTS;
  }

  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_ALERTS.enabled,
    cooldownMinutes: Number(input.cooldownMinutes) > 0 ? Number(input.cooldownMinutes) : DEFAULT_ALERTS.cooldownMinutes,
    email: {
      enabled: typeof input.email?.enabled === 'boolean' ? input.email.enabled : DEFAULT_ALERTS.email.enabled,
      to: typeof input.email?.to === 'string' ? input.email.to : DEFAULT_ALERTS.email.to
    },
    webhook: {
      enabled: typeof input.webhook?.enabled === 'boolean' ? input.webhook.enabled : DEFAULT_ALERTS.webhook.enabled,
      url: typeof input.webhook?.url === 'string' ? input.webhook.url : DEFAULT_ALERTS.webhook.url
    },
    thresholds: {
      cpu: Number(input.thresholds?.cpu) > 0 ? Number(input.thresholds?.cpu) : DEFAULT_ALERTS.thresholds.cpu,
      memory: Number(input.thresholds?.memory) > 0 ? Number(input.thresholds?.memory) : DEFAULT_ALERTS.thresholds.memory,
      connections: Number(input.thresholds?.connections) > 0 ? Number(input.thresholds?.connections) : DEFAULT_ALERTS.thresholds.connections,
      slowQueryCount:
        Number(input.thresholds?.slowQueryCount) > 0
          ? Number(input.thresholds?.slowQueryCount)
          : DEFAULT_ALERTS.thresholds.slowQueryCount
    }
  };
}

function normalizeLoaded(conn: ConnectionEntry): ConnectionForm {
  return {
    ...conn,
    alertSettings: {
      enabled: conn.alertSettings?.enabled ?? true,
      snoozedUntil: conn.alertSettings?.snoozedUntil,
      thresholds: {
        cpu: conn.alertSettings?.thresholds?.cpu,
        memory: conn.alertSettings?.thresholds?.memory,
        connections: conn.alertSettings?.thresholds?.connections,
        slowQueryCount: conn.alertSettings?.thresholds?.slowQueryCount
      },
      maintenanceWindow: {
        enabled: conn.alertSettings?.maintenanceWindow?.enabled ?? false,
        startHour: Number(conn.alertSettings?.maintenanceWindow?.startHour ?? 22),
        endHour: Number(conn.alertSettings?.maintenanceWindow?.endHour ?? 6),
        daysOfWeek: Array.isArray(conn.alertSettings?.maintenanceWindow?.daysOfWeek)
          ? conn.alertSettings?.maintenanceWindow?.daysOfWeek.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
          : [0, 1, 2, 3, 4, 5, 6],
        mutedMetrics: {
          cpu: conn.alertSettings?.maintenanceWindow?.mutedMetrics?.cpu ?? true,
          memory: conn.alertSettings?.maintenanceWindow?.mutedMetrics?.memory ?? true,
          connections: conn.alertSettings?.maintenanceWindow?.mutedMetrics?.connections ?? false,
          slowQueryCount: conn.alertSettings?.maintenanceWindow?.mutedMetrics?.slowQueryCount ?? true
        }
      }
    },
    showPassword: false,
    testState: 'idle',
    testMessage: ''
  };
}

function toPersistedConnection(conn: ConnectionForm): ConnectionEntry {
  return {
    id: conn.id,
    name: conn.name,
    type: conn.type,
    enabled: conn.enabled,
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: conn.user,
    password: conn.password,
    alertSettings: {
      enabled: conn.alertSettings.enabled,
      snoozedUntil: conn.alertSettings.snoozedUntil,
      thresholds: {
        cpu: conn.alertSettings.thresholds.cpu,
        memory: conn.alertSettings.thresholds.memory,
        connections: conn.alertSettings.thresholds.connections,
        slowQueryCount: conn.alertSettings.thresholds.slowQueryCount
      },
      maintenanceWindow: {
        enabled: conn.alertSettings.maintenanceWindow?.enabled ?? DEFAULT_MAINTENANCE.enabled,
        startHour: conn.alertSettings.maintenanceWindow?.startHour ?? DEFAULT_MAINTENANCE.startHour,
        endHour: conn.alertSettings.maintenanceWindow?.endHour ?? DEFAULT_MAINTENANCE.endHour,
        daysOfWeek: conn.alertSettings.maintenanceWindow?.daysOfWeek ?? DEFAULT_MAINTENANCE.daysOfWeek,
        mutedMetrics: {
          cpu: conn.alertSettings.maintenanceWindow?.mutedMetrics?.cpu ?? DEFAULT_MAINTENANCE.mutedMetrics.cpu,
          memory: conn.alertSettings.maintenanceWindow?.mutedMetrics?.memory ?? DEFAULT_MAINTENANCE.mutedMetrics.memory,
          connections:
            conn.alertSettings.maintenanceWindow?.mutedMetrics?.connections ?? DEFAULT_MAINTENANCE.mutedMetrics.connections,
          slowQueryCount:
            conn.alertSettings.maintenanceWindow?.mutedMetrics?.slowQueryCount ?? DEFAULT_MAINTENANCE.mutedMetrics.slowQueryCount
        }
      }
    }
  };
}

function buildConfigSnapshot(connections: ConnectionForm[], alerts: GlobalAlertSettings): string {
  return JSON.stringify({
    connections: connections.map(toPersistedConnection),
    alerts
  });
}

export function ConfigPage() {
  const [connections, setConnections] = useState<ConnectionForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [bulkPresetMessage, setBulkPresetMessage] = useState('');
  const [lastBulkPresetAction, setLastBulkPresetAction] = useState<LastBulkPresetAction | null>(null);
  const [pendingBulkPresetAction, setPendingBulkPresetAction] = useState<PendingBulkPresetAction | null>(null);
  const [initialConfigSnapshot, setInitialConfigSnapshot] = useState<InitialConfigSnapshot | null>(null);
  const [alertsConfig, setAlertsConfig] = useState<GlobalAlertSettings>(DEFAULT_ALERTS);
  const lastBulkPresetTriggerRef = useRef<HTMLElement | null>(null);
  const applyBulkPresetButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    api
      .getConnections()
      .then((data) => {
        const normalizedConnections = (data.connections || []).map(normalizeLoaded);
        const normalizedAlerts = normalizeGlobalAlerts(data.alerts);
        setConnections(normalizedConnections);
        setAlertsConfig(normalizedAlerts);
        setInitialConfigSnapshot({
          connections: normalizedConnections.map(toPersistedConnection),
          alerts: normalizedAlerts
        });
      })
      .catch(() => {
        setConnections([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!bulkPresetMessage) {
      return;
    }

    const timeout = setTimeout(() => setBulkPresetMessage(''), 5000);
    return () => clearTimeout(timeout);
  }, [bulkPresetMessage]);

  useEffect(() => {
    if (!pendingBulkPresetAction) {
      return;
    }

    applyBulkPresetButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPendingBulkPresetAction(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingBulkPresetAction]);

  useEffect(() => {
    if (pendingBulkPresetAction) {
      return;
    }

    if (lastBulkPresetTriggerRef.current) {
      lastBulkPresetTriggerRef.current.focus();
      lastBulkPresetTriggerRef.current = null;
    }
  }, [pendingBulkPresetAction]);

  const currentConfigSnapshot = useMemo(() => buildConfigSnapshot(connections, alertsConfig), [connections, alertsConfig]);
  const savedConfigSnapshot = useMemo(
    () => (initialConfigSnapshot ? JSON.stringify(initialConfigSnapshot) : ''),
    [initialConfigSnapshot]
  );
  const hasUnsavedChanges = !loading && !!savedConfigSnapshot && currentConfigSnapshot !== savedConfigSnapshot;

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', beforeUnloadHandler);
    return () => window.removeEventListener('beforeunload', beforeUnloadHandler);
  }, [hasUnsavedChanges]);

  const connectionValidationErrors = useMemo(() => {
    const errorsById: Record<string, string[]> = {};

    connections.forEach((conn) => {
      const errors: string[] = [];

      if (!conn.name.trim()) {
        errors.push('Nombre de conexion requerido.');
      }
      if (!conn.host.trim()) {
        errors.push('Host requerido.');
      }
      if (!Number.isInteger(conn.port) || conn.port < 1 || conn.port > 65535) {
        errors.push('Puerto invalido (1-65535).');
      }
      if (!conn.database.trim()) {
        errors.push('Database requerida.');
      }
      if (!conn.user.trim()) {
        errors.push('Usuario requerido.');
      }

      if (errors.length > 0) {
        errorsById[conn.id] = errors;
      }
    });

    return errorsById;
  }, [connections]);

  const validationErrorCount = useMemo(
    () => Object.values(connectionValidationErrors).reduce((acc, errors) => acc + errors.length, 0),
    [connectionValidationErrors]
  );
  const hasValidationErrors = validationErrorCount > 0;

  const grouped = useMemo(
    () => ({
      postgres: connections.filter((c) => c.type === 'postgres'),
      mysql: connections.filter((c) => c.type === 'mysql'),
      mssql: connections.filter((c) => c.type === 'mssql')
    }),
    [connections]
  );

  const updateConnection = (id: string, patch: Partial<ConnectionForm>) => {
    setConnections((prev) => prev.map((conn) => (conn.id === id ? { ...conn, ...patch } : conn)));
  };

  const updateConnectionAlertThreshold = (
    id: string,
    key: 'cpu' | 'memory' | 'connections' | 'slowQueryCount',
    value: string
  ) => {
    setConnections((prev) =>
      prev.map((conn) => {
        if (conn.id !== id) {
          return conn;
        }

        const parsed = value === '' ? undefined : Number(value);

        return {
          ...conn,
          alertSettings: {
            ...conn.alertSettings,
            thresholds: {
              ...conn.alertSettings.thresholds,
              [key]: Number.isFinite(parsed as number) ? parsed : undefined
            }
          }
        };
      })
    );
  };

  const addConnection = (type: DbType) => {
    setConnections((prev) => [...prev, createEmpty(type)]);
  };

  const snoozeConnectionAlerts = (id: string, minutes: number) => {
    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    setConnections((prev) =>
      prev.map((conn) =>
        conn.id === id
          ? {
              ...conn,
              alertSettings: {
                ...conn.alertSettings,
                snoozedUntil
              }
            }
          : conn
      )
    );
  };

  const clearSnooze = (id: string) => {
    setConnections((prev) =>
      prev.map((conn) =>
        conn.id === id
          ? {
              ...conn,
              alertSettings: {
                ...conn.alertSettings,
                snoozedUntil: undefined
              }
            }
          : conn
      )
    );
  };

  const removeConnection = (id: string) => {
    setConnections((prev) => prev.filter((conn) => conn.id !== id));
  };

  const applyMaintenancePreset = (id: string, preset: MaintenancePresetKey) => {
    const presetValues = getMaintenancePreset(preset);
    setConnections((prev) =>
      prev.map((conn) =>
        conn.id === id
          ? {
              ...conn,
              alertSettings: {
                ...conn.alertSettings,
                maintenanceWindow: presetValues
              }
            }
          : conn
      )
    );
  };

  const applyMaintenancePresetToType = (
    type: DbType,
    preset: MaintenancePresetKey,
    triggerElement?: HTMLElement | null
  ) => {
    const presetLabel = MAINTENANCE_PRESETS.find((item) => item.key === preset)?.label ?? preset;
    const previousByConnectionId = connections
      .filter((conn) => conn.type === type)
      .reduce<Record<string, MaintenanceWindow>>((acc, conn) => {
        acc[conn.id] = conn.alertSettings.maintenanceWindow;
        return acc;
      }, {});

    const affectedConnections = Object.keys(previousByConnectionId).length;
    if (affectedConnections === 0) {
      return;
    }

    if (triggerElement) {
      lastBulkPresetTriggerRef.current = triggerElement;
    }

    setPendingBulkPresetAction({
      type,
      preset,
      presetLabel,
      affectedConnections,
      previousByConnectionId
    });
  };

  const confirmPendingBulkPreset = () => {
    if (!pendingBulkPresetAction) {
      return;
    }

    const { type, preset, presetLabel, affectedConnections, previousByConnectionId } = pendingBulkPresetAction;
    const presetValues = getMaintenancePreset(preset);

    setLastBulkPresetAction({
      type,
      preset,
      previousByConnectionId
    });
    setBulkPresetMessage(
      `Preset "${presetLabel}" aplicado a ${affectedConnections} conexion${affectedConnections === 1 ? '' : 'es'} de ${TYPE_LABELS[type]}.`
    );
    setPendingBulkPresetAction(null);

    setConnections((prev) =>
      prev.map((conn) =>
        conn.type === type
          ? {
              ...conn,
              alertSettings: {
                ...conn.alertSettings,
                maintenanceWindow: presetValues
              }
            }
          : conn
      )
    );
  };

  const cancelPendingBulkPreset = () => {
    setPendingBulkPresetAction(null);
  };

  const handleRevertChanges = () => {
    if (!initialConfigSnapshot) {
      return;
    }

    setConnections(initialConfigSnapshot.connections.map(normalizeLoaded));
    setAlertsConfig(initialConfigSnapshot.alerts);
    setPendingBulkPresetAction(null);
    setLastBulkPresetAction(null);
    setBulkPresetMessage('Cambios locales descartados. Se restauro el ultimo estado guardado.');
  };

  const undoLastBulkPreset = () => {
    if (!lastBulkPresetAction) {
      return;
    }

    const restoredCount = Object.keys(lastBulkPresetAction.previousByConnectionId).length;
    setConnections((prev) =>
      prev.map((conn) => {
        const previousMaintenance = lastBulkPresetAction.previousByConnectionId[conn.id];
        if (!previousMaintenance) {
          return conn;
        }

        return {
          ...conn,
          alertSettings: {
            ...conn.alertSettings,
            maintenanceWindow: previousMaintenance
          }
        };
      })
    );

    setBulkPresetMessage(
      `Deshecho: ${restoredCount} conexion${restoredCount === 1 ? '' : 'es'} restauradas en ${TYPE_LABELS[lastBulkPresetAction.type]}.`
    );
    setLastBulkPresetAction(null);
  };

  const handleTest = async (conn: ConnectionForm) => {
    updateConnection(conn.id, { testState: 'loading', testMessage: '' });

    try {
      const result = await api.testConnection({
        type: conn.type,
        host: conn.host,
        port: conn.port,
        database: conn.database,
        user: conn.user,
        password: conn.password
      });

      if (result.success) {
        updateConnection(conn.id, {
          testState: 'success',
          testMessage: `Conectado en ${result.responseTime}ms`
        });
      } else {
        updateConnection(conn.id, {
          testState: 'error',
          testMessage: result.error || 'Fallo de conexion'
        });
      }
    } catch (error: any) {
      updateConnection(conn.id, {
        testState: 'error',
        testMessage: error.message || 'Fallo de conexion'
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError('');

    try {
      const persistedConnections = connections.map(toPersistedConnection);
      await api.saveConnections({
        connections: persistedConnections,
        alerts: alertsConfig
      });
      setInitialConfigSnapshot({
        connections: persistedConnections,
        alerts: alertsConfig
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (error: any) {
      setSaveError(error.message || 'No se pudo guardar la configuracion');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Database Connections</h1>
            <p className="text-slate-400 mt-1">Agrega todas las conexiones que necesites, incluso varias del mismo tipo.</p>
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleRevertChanges}
                className="inline-flex items-center px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
              >
                Revertir cambios
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || hasValidationErrors}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Guardando...' : 'Guardar y aplicar'}</span>
            </button>
          </div>
        </div>

        {hasUnsavedChanges && (
          <div className="mb-4 bg-amber-900/30 border border-amber-700 text-amber-200 px-4 py-3 rounded-lg text-sm">
            Tienes cambios sin guardar.
          </div>
        )}
        {hasValidationErrors && (
          <div className="mb-4 bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
            Corrige {validationErrorCount} error{validationErrorCount === 1 ? '' : 'es'} antes de guardar.
          </div>
        )}

        {saveSuccess && (
          <div className="mb-4 flex items-center space-x-2 bg-green-900/30 border border-green-700 text-green-400 px-4 py-3 rounded-lg">
            <CheckCircle className="w-5 h-5" />
            <span>Configuracion guardada. El monitor se reinicio con las nuevas conexiones.</span>
          </div>
        )}
        {saveError && (
          <div className="mb-4 flex items-center space-x-2 bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded-lg">
            <XCircle className="w-5 h-5" />
            <span>{saveError}</span>
          </div>
        )}
        {bulkPresetMessage && (
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-blue-900/30 border border-blue-700 text-blue-200 px-4 py-3 rounded-lg">
            <span className="text-sm">{bulkPresetMessage}</span>
            {lastBulkPresetAction && (
              <button
                type="button"
                onClick={undoLastBulkPreset}
                className="px-3 py-1.5 text-xs rounded bg-blue-700/50 hover:bg-blue-600/60 text-blue-100 border border-blue-500"
              >
                Deshacer
              </button>
            )}
          </div>
        )}

        {pendingBulkPresetAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <button
              type="button"
              aria-label="Cerrar confirmacion"
              onClick={cancelPendingBulkPreset}
              className="absolute inset-0 bg-black/60"
            />
            <div className="relative w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
              <h3 className="text-base font-semibold text-white">Confirmar preset masivo</h3>
              <p className="mt-2 text-sm text-slate-300">
                Vas a aplicar <span className="font-medium text-blue-200">{pendingBulkPresetAction.presetLabel}</span> a{' '}
                <span className="font-medium text-blue-200">
                  {pendingBulkPresetAction.affectedConnections} conexion
                  {pendingBulkPresetAction.affectedConnections === 1 ? '' : 'es'}
                </span>{' '}
                de <span className="font-medium text-blue-200">{TYPE_LABELS[pendingBulkPresetAction.type]}</span>.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelPendingBulkPreset}
                  className="px-3 py-2 text-sm rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmPendingBulkPreset}
                  ref={applyBulkPresetButtonRef}
                  className="px-3 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Aplicar preset
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-8">
          <section className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white">Alertas y notificaciones</h2>
              <p className="text-sm text-slate-400 mt-1">Configura reglas globales y canales de notificacion desde esta pantalla.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
                <label className="flex items-center justify-between text-sm text-slate-200">
                  <span>Alertas habilitadas globalmente</span>
                  <input
                    type="checkbox"
                    checked={alertsConfig.enabled}
                    onChange={(e) => setAlertsConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
                  />
                </label>
                <label className="flex items-center justify-between text-sm text-slate-200 gap-3">
                  <span>Cooldown entre alertas (min)</span>
                  <input
                    type="number"
                    min={1}
                    value={alertsConfig.cooldownMinutes}
                    onChange={(e) =>
                      setAlertsConfig((prev) => ({
                        ...prev,
                        cooldownMinutes: Math.max(1, Number(e.target.value) || 1)
                      }))
                    }
                    className="w-24 bg-slate-800 border border-slate-600 text-white rounded-md px-2 py-1 text-sm"
                  />
                </label>
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
                <label className="flex items-center justify-between text-sm text-slate-200">
                  <span>Enviar correo para warning/critical</span>
                  <input
                    type="checkbox"
                    checked={alertsConfig.email.enabled}
                    onChange={(e) =>
                      setAlertsConfig((prev) => ({
                        ...prev,
                        email: {
                          ...prev.email,
                          enabled: e.target.checked
                        }
                      }))
                    }
                  />
                </label>
                <input
                  value={alertsConfig.email.to}
                  onChange={(e) =>
                    setAlertsConfig((prev) => ({
                      ...prev,
                      email: {
                        ...prev.email,
                        to: e.target.value
                      }
                    }))
                  }
                  placeholder="Email destino (ej. dba@empresa.com)"
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                />

                <label className="flex items-center justify-between text-sm text-slate-200">
                  <span>Webhook habilitado (proximo paso)</span>
                  <input
                    type="checkbox"
                    checked={alertsConfig.webhook.enabled}
                    onChange={(e) =>
                      setAlertsConfig((prev) => ({
                        ...prev,
                        webhook: {
                          ...prev.webhook,
                          enabled: e.target.checked
                        }
                      }))
                    }
                  />
                </label>
                <input
                  value={alertsConfig.webhook.url}
                  onChange={(e) =>
                    setAlertsConfig((prev) => ({
                      ...prev,
                      webhook: {
                        ...prev.webhook,
                        url: e.target.value
                      }
                    }))
                  }
                  placeholder="Webhook URL"
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-5 bg-slate-900 border border-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Umbrales globales por defecto</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="number"
                  min={1}
                  value={alertsConfig.thresholds.cpu}
                  onChange={(e) =>
                    setAlertsConfig((prev) => ({
                      ...prev,
                      thresholds: {
                        ...prev.thresholds,
                        cpu: Math.max(1, Number(e.target.value) || 1)
                      }
                    }))
                  }
                  placeholder="CPU %"
                  className="bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={alertsConfig.thresholds.memory}
                  onChange={(e) =>
                    setAlertsConfig((prev) => ({
                      ...prev,
                      thresholds: {
                        ...prev.thresholds,
                        memory: Math.max(1, Number(e.target.value) || 1)
                      }
                    }))
                  }
                  placeholder="Memoria %"
                  className="bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={alertsConfig.thresholds.connections}
                  onChange={(e) =>
                    setAlertsConfig((prev) => ({
                      ...prev,
                      thresholds: {
                        ...prev.thresholds,
                        connections: Math.max(1, Number(e.target.value) || 1)
                      }
                    }))
                  }
                  placeholder="Conexiones %"
                  className="bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={alertsConfig.thresholds.slowQueryCount}
                  onChange={(e) =>
                    setAlertsConfig((prev) => ({
                      ...prev,
                      thresholds: {
                        ...prev.thresholds,
                        slowQueryCount: Math.max(1, Number(e.target.value) || 1)
                      }
                    }))
                  }
                  placeholder="Slow queries"
                  className="bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
          </section>

          {(['postgres', 'mysql', 'mssql'] as DbType[]).map((type) => (
            <section key={type} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center space-x-2">
                  <Database className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-semibold text-white">{TYPE_LABELS[type]}</h2>
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-300">
                    {grouped[type].length} conexiones
                  </span>
                </div>
                <div className="flex flex-col sm:items-end gap-2">
                  <button
                    onClick={() => addConnection(type)}
                    className="inline-flex items-center space-x-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar conexion</span>
                  </button>
                  {grouped[type].length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {MAINTENANCE_PRESETS.map((preset) => (
                        <button
                          key={`${type}-${preset.key}`}
                          type="button"
                          onClick={(event) => applyMaintenancePresetToType(type, preset.key, event.currentTarget)}
                          className="px-2 py-1 text-[11px] rounded border bg-slate-900 border-slate-600 text-slate-300 hover:bg-slate-800"
                          title={`Aplicar preset a todas las conexiones ${TYPE_LABELS[type]}`}
                        >
                          {preset.label} (todas)
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {grouped[type].length === 0 && (
                <p className="text-slate-400 text-sm">No hay conexiones de este tipo. Agrega una nueva para comenzar.</p>
              )}

              <div className="space-y-4">
                {grouped[type].map((conn) => (
                  <div key={conn.id} className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <input
                          value={conn.name}
                          onChange={(e) => updateConnection(conn.id, { name: e.target.value })}
                          placeholder="Nombre de conexion"
                          className="bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm min-w-64"
                        />
                        <label className="flex items-center space-x-2 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={conn.enabled}
                            onChange={(e) => updateConnection(conn.id, { enabled: e.target.checked })}
                          />
                          <span>Activa</span>
                        </label>
                      </div>
                      <button
                        onClick={() => removeConnection(conn.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-md text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Eliminar</span>
                      </button>
                    </div>

                    {connectionValidationErrors[conn.id] && (
                      <div className="mb-3 rounded-md border border-red-800 bg-red-900/20 px-3 py-2">
                        <p className="text-xs font-medium text-red-300 mb-1">Corrige esta conexion:</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {connectionValidationErrors[conn.id].map((error) => (
                            <li key={`${conn.id}-${error}`} className="text-xs text-red-300">
                              {error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <input
                        value={conn.host}
                        onChange={(e) => updateConnection(conn.id, { host: e.target.value })}
                        placeholder="Host"
                        className="bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        value={conn.port}
                        onChange={(e) => updateConnection(conn.id, { port: Number(e.target.value) || 0 })}
                        placeholder="Port"
                        className="bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                      />
                      <input
                        value={conn.database}
                        onChange={(e) => updateConnection(conn.id, { database: e.target.value })}
                        placeholder="Database"
                        className="bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                      />
                      <input
                        value={conn.user}
                        onChange={(e) => updateConnection(conn.id, { user: e.target.value })}
                        placeholder="User"
                        className="bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                      />
                      <div className="relative sm:col-span-2">
                        <input
                          type={conn.showPassword ? 'text' : 'password'}
                          value={conn.password}
                          onChange={(e) => updateConnection(conn.id, { password: e.target.value })}
                          placeholder="Password"
                          className="w-full bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 pr-10 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => updateConnection(conn.id, { showPassword: !conn.showPassword })}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                        >
                          {conn.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div className="w-full bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-medium text-slate-200">Alertas de esta conexion</p>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm text-slate-300">
                              <input
                                type="checkbox"
                                checked={conn.alertSettings.enabled}
                                onChange={(e) =>
                                  updateConnection(conn.id, {
                                    alertSettings: {
                                      ...conn.alertSettings,
                                      enabled: e.target.checked
                                    }
                                  })
                                }
                              />
                              <span>Habilitadas</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => snoozeConnectionAlerts(conn.id, 30)}
                              className="px-2 py-1 text-xs rounded bg-amber-800/40 text-amber-300 hover:bg-amber-700/40"
                            >
                              Silenciar 30m
                            </button>
                            <button
                              type="button"
                              onClick={() => clearSnooze(conn.id)}
                              className="px-2 py-1 text-xs rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
                            >
                              Quitar silencio
                            </button>
                          </div>
                        </div>

                        {conn.alertSettings.snoozedUntil && Date.parse(conn.alertSettings.snoozedUntil) > Date.now() && (
                          <p className="text-xs text-amber-300 mb-2">
                            Silenciada hasta {new Date(conn.alertSettings.snoozedUntil).toLocaleString()}
                          </p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          <input
                            type="number"
                            min={1}
                            value={conn.alertSettings.thresholds.cpu ?? ''}
                            onChange={(e) => updateConnectionAlertThreshold(conn.id, 'cpu', e.target.value)}
                            placeholder="CPU % (default)"
                            className="bg-slate-900 border border-slate-600 text-white rounded-md px-2 py-1.5 text-xs"
                          />
                          <input
                            type="number"
                            min={1}
                            value={conn.alertSettings.thresholds.memory ?? ''}
                            onChange={(e) => updateConnectionAlertThreshold(conn.id, 'memory', e.target.value)}
                            placeholder="Mem % (default)"
                            className="bg-slate-900 border border-slate-600 text-white rounded-md px-2 py-1.5 text-xs"
                          />
                          <input
                            type="number"
                            min={1}
                            value={conn.alertSettings.thresholds.connections ?? ''}
                            onChange={(e) => updateConnectionAlertThreshold(conn.id, 'connections', e.target.value)}
                            placeholder="Conn % (default)"
                            className="bg-slate-900 border border-slate-600 text-white rounded-md px-2 py-1.5 text-xs"
                          />
                          <input
                            type="number"
                            min={1}
                            value={conn.alertSettings.thresholds.slowQueryCount ?? ''}
                            onChange={(e) => updateConnectionAlertThreshold(conn.id, 'slowQueryCount', e.target.value)}
                            placeholder="Slow count (default)"
                            className="bg-slate-900 border border-slate-600 text-white rounded-md px-2 py-1.5 text-xs"
                          />
                        </div>

                        <div className="mt-3 border-t border-slate-700 pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-slate-300">Ventana de mantenimiento (silencia alertas)</p>
                            <label className="flex items-center gap-2 text-xs text-slate-300">
                              <input
                                type="checkbox"
                                checked={conn.alertSettings.maintenanceWindow?.enabled ?? DEFAULT_MAINTENANCE.enabled}
                                onChange={(e) =>
                                  updateConnection(conn.id, {
                                    alertSettings: {
                                      ...conn.alertSettings,
                                      maintenanceWindow: {
                                        ...DEFAULT_MAINTENANCE,
                                        ...conn.alertSettings.maintenanceWindow,
                                        enabled: e.target.checked
                                      }
                                    }
                                  })
                                }
                              />
                              <span>Programada</span>
                            </label>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs text-slate-400">
                              Inicio (hora 0-23)
                              <input
                                type="number"
                                min={0}
                                max={23}
                                value={conn.alertSettings.maintenanceWindow?.startHour ?? DEFAULT_MAINTENANCE.startHour}
                                onChange={(e) =>
                                  updateConnection(conn.id, {
                                    alertSettings: {
                                      ...conn.alertSettings,
                                      maintenanceWindow: {
                                        ...DEFAULT_MAINTENANCE,
                                        ...conn.alertSettings.maintenanceWindow,
                                        startHour: Math.max(0, Math.min(23, Number(e.target.value) || 0))
                                      }
                                    }
                                  })
                                }
                                className="mt-1 w-full bg-slate-900 border border-slate-600 text-white rounded-md px-2 py-1.5 text-xs"
                              />
                            </label>
                            <label className="text-xs text-slate-400">
                              Fin (hora 0-23)
                              <input
                                type="number"
                                min={0}
                                max={23}
                                value={conn.alertSettings.maintenanceWindow?.endHour ?? DEFAULT_MAINTENANCE.endHour}
                                onChange={(e) =>
                                  updateConnection(conn.id, {
                                    alertSettings: {
                                      ...conn.alertSettings,
                                      maintenanceWindow: {
                                        ...DEFAULT_MAINTENANCE,
                                        ...conn.alertSettings.maintenanceWindow,
                                        endHour: Math.max(0, Math.min(23, Number(e.target.value) || 0))
                                      }
                                    }
                                  })
                                }
                                className="mt-1 w-full bg-slate-900 border border-slate-600 text-white rounded-md px-2 py-1.5 text-xs"
                              />
                            </label>
                          </div>
                          <div className="mt-3">
                            <p className="text-xs text-slate-400 mb-1">Dias activos</p>
                            <div className="flex flex-wrap gap-1.5">
                              {WEEK_DAYS.map((day) => {
                                const safeDays = conn.alertSettings.maintenanceWindow?.daysOfWeek ?? DEFAULT_MAINTENANCE.daysOfWeek;
                                const selected = safeDays.includes(day.value);
                                return (
                                  <button
                                    key={`${conn.id}-day-${day.value}`}
                                    type="button"
                                    onClick={() => {
                                      const current = conn.alertSettings.maintenanceWindow?.daysOfWeek ?? DEFAULT_MAINTENANCE.daysOfWeek;
                                      const next = selected
                                        ? current.filter((d) => d !== day.value)
                                        : [...current, day.value].sort((a, b) => a - b);
                                      updateConnection(conn.id, {
                                        alertSettings: {
                                          ...conn.alertSettings,
                                          maintenanceWindow: {
                                            ...DEFAULT_MAINTENANCE,
                                            ...conn.alertSettings.maintenanceWindow,
                                            daysOfWeek: next.length > 0 ? next : [0, 1, 2, 3, 4, 5, 6]
                                          }
                                        }
                                      });
                                    }}
                                    className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                                      selected
                                        ? 'bg-blue-700/50 border-blue-500 text-blue-100'
                                        : 'bg-slate-900 border-slate-600 text-slate-300 hover:bg-slate-800'
                                    }`}
                                  >
                                    {day.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="mt-3">
                            <p className="text-xs text-slate-400 mb-1">Metricas silenciadas durante mantenimiento</p>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { key: 'cpu', label: 'CPU' },
                                { key: 'memory', label: 'Memoria' },
                                { key: 'slowQueryCount', label: 'Slow Queries' },
                                { key: 'connections', label: 'Conexiones/Disponibilidad' }
                              ].map((item) => (
                                <label key={`${conn.id}-mute-${item.key}`} className="flex items-center gap-2 text-xs text-slate-300">
                                  <input
                                    type="checkbox"
                                    checked={
                                      conn.alertSettings.maintenanceWindow?.mutedMetrics?.[
                                        item.key as keyof typeof DEFAULT_MAINTENANCE.mutedMetrics
                                      ] ?? false
                                    }
                                    onChange={(e) =>
                                      updateConnection(conn.id, {
                                        alertSettings: {
                                          ...conn.alertSettings,
                                          maintenanceWindow: {
                                            ...DEFAULT_MAINTENANCE,
                                            ...conn.alertSettings.maintenanceWindow,
                                            mutedMetrics: {
                                              ...DEFAULT_MAINTENANCE.mutedMetrics,
                                              ...conn.alertSettings.maintenanceWindow?.mutedMetrics,
                                              [item.key]: e.target.checked
                                            }
                                          }
                                        }
                                      })
                                    }
                                  />
                                  <span>{item.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="mt-3">
                            <p className="text-xs text-slate-400 mb-1">Presets rapidos</p>
                            <div className="flex flex-wrap gap-1.5">
                              {MAINTENANCE_PRESETS.map((preset) => (
                                <button
                                  key={`${conn.id}-${preset.key}`}
                                  type="button"
                                  onClick={() => applyMaintenancePreset(conn.id, preset.key)}
                                  className="px-2 py-1 text-[11px] rounded border bg-slate-900 border-slate-600 text-slate-200 hover:bg-slate-800"
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-2">
                            Si cruza medianoche (ejemplo 22 a 6), el silencio aplica durante la noche completa.
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleTest(conn)}
                        disabled={conn.testState === 'loading'}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white rounded-md text-sm"
                      >
                        {conn.testState === 'loading' ? <Loader className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                        <span>Probar conexion</span>
                      </button>

                      {conn.testState === 'success' && (
                        <span className="inline-flex items-center gap-1 text-green-400 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          {conn.testMessage}
                        </span>
                      )}
                      {conn.testState === 'error' && (
                        <span className="inline-flex items-center gap-1 text-red-400 text-sm">
                          <XCircle className="w-4 h-4" />
                          {conn.testMessage}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Layout>
  );
}
