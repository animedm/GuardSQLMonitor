import fs from 'fs';
import path from 'path';
import { config } from './index';

export type DatabaseType = 'postgres' | 'mysql' | 'mssql';

export interface AlertThresholds {
  cpu: number;
  memory: number;
  connections: number;
  slowQueryCount: number;
}

export interface AlertMaintenanceWindow {
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
}

export interface ConnectionAlertSettings {
  enabled: boolean;
  snoozedUntil?: string;
  thresholds: Partial<AlertThresholds>;
  maintenanceWindow: AlertMaintenanceWindow;
}

export interface GlobalAlertSettings {
  enabled: boolean;
  cooldownMinutes: number;
  email: {
    enabled: boolean;
    to: string;
  };
  webhook: {
    enabled: boolean;
    url: string;
  };
  thresholds: AlertThresholds;
}

export interface ManagedConnection {
  id: string;
  name: string;
  type: DatabaseType;
  enabled: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  alertSettings: ConnectionAlertSettings;
}

export interface ManagedConfiguration {
  connections: ManagedConnection[];
  alerts: GlobalAlertSettings;
}

interface ConnectionsFileData extends ManagedConfiguration {}

const CONNECTIONS_FILE = path.join(process.cwd(), 'data', 'connections.json');

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function defaultAlertThresholds(): AlertThresholds {
  return {
    cpu: config.alerts.thresholds.cpu,
    memory: config.alerts.thresholds.memory,
    connections: config.alerts.thresholds.connections,
    slowQueryCount: config.alerts.thresholds.slowQueryCount
  };
}

function defaultGlobalAlertSettings(): GlobalAlertSettings {
  return {
    enabled: config.alerts.enabled,
    cooldownMinutes: 5,
    email: {
      enabled: config.alerts.email.enabled,
      to: config.alerts.email.to || ''
    },
    webhook: {
      enabled: false,
      url: ''
    },
    thresholds: defaultAlertThresholds()
  };
}

function defaultConnectionAlertSettings(): ConnectionAlertSettings {
  return {
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
  };
}

function normalizeDaysOfWeek(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  const cleaned = Array.from(
    new Set(
      value
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    )
  ).sort((a, b) => a - b);

  return cleaned.length > 0 ? cleaned : [0, 1, 2, 3, 4, 5, 6];
}

function normalizeMutedMetric(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeHour(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  if (num < 0) {
    return 0;
  }
  if (num > 23) {
    return 23;
  }
  return Math.floor(num);
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }
  return Math.floor(num);
}

function normalizeOptionalThresholds(input: any): Partial<AlertThresholds> {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const out: Partial<AlertThresholds> = {};

  if (input.cpu !== undefined && input.cpu !== null && input.cpu !== '') {
    out.cpu = normalizePositiveNumber(input.cpu, defaultAlertThresholds().cpu);
  }
  if (input.memory !== undefined && input.memory !== null && input.memory !== '') {
    out.memory = normalizePositiveNumber(input.memory, defaultAlertThresholds().memory);
  }
  if (input.connections !== undefined && input.connections !== null && input.connections !== '') {
    out.connections = normalizePositiveNumber(input.connections, defaultAlertThresholds().connections);
  }
  if (input.slowQueryCount !== undefined && input.slowQueryCount !== null && input.slowQueryCount !== '') {
    out.slowQueryCount = normalizePositiveNumber(input.slowQueryCount, defaultAlertThresholds().slowQueryCount);
  }

  return out;
}

function normalizeConnectionAlertSettings(input: any): ConnectionAlertSettings {
  const defaults = defaultConnectionAlertSettings();

  return {
    enabled: typeof input?.enabled === 'boolean' ? input.enabled : defaults.enabled,
    snoozedUntil: typeof input?.snoozedUntil === 'string' && input.snoozedUntil.trim() ? input.snoozedUntil : undefined,
    thresholds: normalizeOptionalThresholds(input?.thresholds),
    maintenanceWindow: {
      enabled: typeof input?.maintenanceWindow?.enabled === 'boolean'
        ? input.maintenanceWindow.enabled
        : defaults.maintenanceWindow.enabled,
      startHour: normalizeHour(input?.maintenanceWindow?.startHour, defaults.maintenanceWindow.startHour),
      endHour: normalizeHour(input?.maintenanceWindow?.endHour, defaults.maintenanceWindow.endHour),
      daysOfWeek: normalizeDaysOfWeek(input?.maintenanceWindow?.daysOfWeek),
      mutedMetrics: {
        cpu: normalizeMutedMetric(input?.maintenanceWindow?.mutedMetrics?.cpu, defaults.maintenanceWindow.mutedMetrics.cpu),
        memory: normalizeMutedMetric(
          input?.maintenanceWindow?.mutedMetrics?.memory,
          defaults.maintenanceWindow.mutedMetrics.memory
        ),
        connections: normalizeMutedMetric(
          input?.maintenanceWindow?.mutedMetrics?.connections,
          defaults.maintenanceWindow.mutedMetrics.connections
        ),
        slowQueryCount: normalizeMutedMetric(
          input?.maintenanceWindow?.mutedMetrics?.slowQueryCount,
          defaults.maintenanceWindow.mutedMetrics.slowQueryCount
        )
      }
    }
  };
}

function normalizeGlobalAlertSettings(input: any): GlobalAlertSettings {
  const defaults = defaultGlobalAlertSettings();
  const thresholdsInput = input?.thresholds || {};

  return {
    enabled: typeof input?.enabled === 'boolean' ? input.enabled : defaults.enabled,
    cooldownMinutes: normalizePositiveNumber(input?.cooldownMinutes, defaults.cooldownMinutes),
    email: {
      enabled: typeof input?.email?.enabled === 'boolean' ? input.email.enabled : defaults.email.enabled,
      to: typeof input?.email?.to === 'string' ? input.email.to : defaults.email.to
    },
    webhook: {
      enabled: typeof input?.webhook?.enabled === 'boolean' ? input.webhook.enabled : defaults.webhook.enabled,
      url: typeof input?.webhook?.url === 'string' ? input.webhook.url : defaults.webhook.url
    },
    thresholds: {
      cpu: normalizePositiveNumber(thresholdsInput.cpu, defaults.thresholds.cpu),
      memory: normalizePositiveNumber(thresholdsInput.memory, defaults.thresholds.memory),
      connections: normalizePositiveNumber(thresholdsInput.connections, defaults.thresholds.connections),
      slowQueryCount: normalizePositiveNumber(thresholdsInput.slowQueryCount, defaults.thresholds.slowQueryCount)
    }
  };
}

function defaultConnectionsFromConfig(): ManagedConnection[] {
  return [
    {
      id: 'default-postgres',
      name: `PostgreSQL - ${config.databases.postgres.database}`,
      type: 'postgres',
      enabled: config.databases.postgres.enabled,
      host: config.databases.postgres.host,
      port: config.databases.postgres.port,
      database: config.databases.postgres.database,
      user: config.databases.postgres.user,
      password: config.databases.postgres.password,
      alertSettings: defaultConnectionAlertSettings()
    },
    {
      id: 'default-mysql',
      name: `MySQL - ${config.databases.mysql.database}`,
      type: 'mysql',
      enabled: config.databases.mysql.enabled,
      host: config.databases.mysql.host,
      port: config.databases.mysql.port,
      database: config.databases.mysql.database,
      user: config.databases.mysql.user,
      password: config.databases.mysql.password,
      alertSettings: defaultConnectionAlertSettings()
    },
    {
      id: 'default-mssql',
      name: `MSSQL - ${config.databases.mssql.database}`,
      type: 'mssql',
      enabled: config.databases.mssql.enabled,
      host: config.databases.mssql.server,
      port: config.databases.mssql.port,
      database: config.databases.mssql.database,
      user: config.databases.mssql.user,
      password: config.databases.mssql.password,
      alertSettings: defaultConnectionAlertSettings()
    }
  ];
}

function normalizeConnection(input: Partial<ManagedConnection>, index: number): ManagedConnection {
  const type = (input.type || 'postgres') as DatabaseType;
  const defaults =
    type === 'postgres'
      ? { port: 5432, database: 'postgres', user: 'postgres' }
      : type === 'mysql'
      ? { port: 3306, database: 'mysql', user: 'root' }
      : { port: 1433, database: 'master', user: 'sa' };

  return {
    id: input.id && String(input.id).trim() ? String(input.id) : makeId(),
    name: input.name && String(input.name).trim() ? String(input.name) : `${type.toUpperCase()} ${index + 1}`,
    type,
    enabled: Boolean(input.enabled),
    host: input.host && String(input.host).trim() ? String(input.host) : 'localhost',
    port: Number(input.port) || defaults.port,
    database: input.database && String(input.database).trim() ? String(input.database) : defaults.database,
    user: input.user && String(input.user).trim() ? String(input.user) : defaults.user,
    password: typeof input.password === 'string' ? input.password : '',
    alertSettings: normalizeConnectionAlertSettings((input as any).alertSettings)
  };
}

function normalizeConnections(connections: Partial<ManagedConnection>[]): ManagedConnection[] {
  return connections.map((conn, index) => normalizeConnection(conn, index));
}

function readRawFile(): any {
  if (!fs.existsSync(CONNECTIONS_FILE)) {
    return null;
  }

  const raw = fs.readFileSync(CONNECTIONS_FILE, 'utf-8');
  return JSON.parse(raw);
}

function ensureDir(): void {
  const dir = path.dirname(CONNECTIONS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadManagedConnections(): ManagedConnection[] {
  return loadManagedConfiguration().connections;
}

export function loadManagedConfiguration(): ManagedConfiguration {
  try {
    const raw = readRawFile();

    if (!raw) {
      return {
        connections: defaultConnectionsFromConfig(),
        alerts: defaultGlobalAlertSettings()
      };
    }

    // New format: { connections: [...] }
    if (Array.isArray(raw.connections)) {
      const normalized = normalizeConnections(raw.connections);
      return {
        connections: normalized,
        alerts: normalizeGlobalAlertSettings(raw.alerts)
      };
    }

    // Backward compatibility with previous fixed format
    if (raw.postgres || raw.mysql || raw.mssql) {
      const migrated: Partial<ManagedConnection>[] = [];
      if (raw.postgres) {
        migrated.push({
          id: 'migrated-postgres',
          name: `PostgreSQL - ${raw.postgres.database || 'postgres'}`,
          type: 'postgres',
          enabled: Boolean(raw.postgres.enabled),
          host: raw.postgres.host,
          port: raw.postgres.port,
          database: raw.postgres.database,
          user: raw.postgres.user,
          password: raw.postgres.password || '',
          alertSettings: defaultConnectionAlertSettings()
        });
      }
      if (raw.mysql) {
        migrated.push({
          id: 'migrated-mysql',
          name: `MySQL - ${raw.mysql.database || 'mysql'}`,
          type: 'mysql',
          enabled: Boolean(raw.mysql.enabled),
          host: raw.mysql.host,
          port: raw.mysql.port,
          database: raw.mysql.database,
          user: raw.mysql.user,
          password: raw.mysql.password || '',
          alertSettings: defaultConnectionAlertSettings()
        });
      }
      if (raw.mssql) {
        migrated.push({
          id: 'migrated-mssql',
          name: `MSSQL - ${raw.mssql.database || 'master'}`,
          type: 'mssql',
          enabled: Boolean(raw.mssql.enabled),
          host: raw.mssql.host || raw.mssql.server,
          port: raw.mssql.port,
          database: raw.mssql.database,
          user: raw.mssql.user,
          password: raw.mssql.password || '',
          alertSettings: defaultConnectionAlertSettings()
        });
      }

      const normalized = normalizeConnections(migrated);
      const migratedConfig: ManagedConfiguration = {
        connections: normalized,
        alerts: defaultGlobalAlertSettings()
      };
      saveManagedConfiguration(migratedConfig);
      return migratedConfig;
    }
  } catch {
    // Fall back to config defaults on malformed file
  }

  return {
    connections: defaultConnectionsFromConfig(),
    alerts: defaultGlobalAlertSettings()
  };
}

export function saveManagedConnections(connections: Partial<ManagedConnection>[]): ManagedConnection[] {
  const current = loadManagedConfiguration();
  const saved = saveManagedConfiguration({
    connections,
    alerts: current.alerts
  });
  return saved.connections;
}

export function saveManagedConfiguration(data: {
  connections: Partial<ManagedConnection>[];
  alerts?: Partial<GlobalAlertSettings>;
}): ManagedConfiguration {
  const normalized = normalizeConnections(data.connections);
  const baseAlerts = data.alerts ?? loadManagedConfiguration().alerts;
  const normalizedAlerts = normalizeGlobalAlertSettings(baseAlerts);
  ensureDir();
  const fileData: ConnectionsFileData = {
    connections: normalized,
    alerts: normalizedAlerts
  };
  fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(fileData, null, 2), 'utf-8');
  return fileData;
}

export function applyPrimaryConnectionsToRuntimeConfig(connections: ManagedConnection[]): void {
  const pg = connections.find((c) => c.type === 'postgres' && c.enabled);
  const my = connections.find((c) => c.type === 'mysql' && c.enabled);
  const ms = connections.find((c) => c.type === 'mssql' && c.enabled);

  config.databases.postgres.enabled = Boolean(pg);
  if (pg) {
    config.databases.postgres.host = pg.host;
    config.databases.postgres.port = pg.port;
    config.databases.postgres.database = pg.database;
    config.databases.postgres.user = pg.user;
    config.databases.postgres.password = pg.password;
  }

  config.databases.mysql.enabled = Boolean(my);
  if (my) {
    config.databases.mysql.host = my.host;
    config.databases.mysql.port = my.port;
    config.databases.mysql.database = my.database;
    config.databases.mysql.user = my.user;
    config.databases.mysql.password = my.password;
  }

  config.databases.mssql.enabled = Boolean(ms);
  if (ms) {
    config.databases.mssql.server = ms.host;
    config.databases.mssql.port = ms.port;
    config.databases.mssql.database = ms.database;
    config.databases.mssql.user = ms.user;
    config.databases.mssql.password = ms.password;
  }
}
