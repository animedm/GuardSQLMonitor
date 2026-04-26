import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, Database } from '../api';

const STORAGE_KEY = 'guardsql.activeConnection';
const EVENT_NAME = 'guardsql:active-connection-changed';

export interface ActiveConnectionOption {
  key: string;
  type: string;
  name: string;
  host: string;
  port: number;
  database?: string;
}

interface UseActiveConnectionOptions {
  allowedTypes?: string[];
}

export function useActiveConnection(options?: UseActiveConnectionOptions) {
  const [connections, setConnections] = useState<Database[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const allowedTypes = options?.allowedTypes;

  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const dbs = await api.getDatabases();
      setConnections(dbs);
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const connectionOptions = useMemo<ActiveConnectionOption[]>(() => {
    const filtered = allowedTypes && allowedTypes.length > 0
      ? connections.filter((conn) => allowedTypes.includes(conn.type))
      : connections;

    return filtered.map((conn) => ({
      key: `${conn.type}|${conn.name}`,
      type: conn.type,
      name: conn.name,
      host: conn.host,
      port: conn.port,
      database: conn.database
    }));
  }, [connections, allowedTypes]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }
      setSelectedKey(localStorage.getItem(STORAGE_KEY) || '');
    };

    const onCustomSync = () => {
      setSelectedKey(localStorage.getItem(STORAGE_KEY) || '');
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(EVENT_NAME, onCustomSync);

    if (connectionOptions.length === 0) {
      setSelectedKey('');
      return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(EVENT_NAME, onCustomSync);
      };
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    const hasStored = stored && connectionOptions.some((opt) => opt.key === stored);

    if (!selectedKey) {
      const fallbackKey = hasStored ? stored! : connectionOptions[0].key;
      setSelectedKey(fallbackKey);
      localStorage.setItem(STORAGE_KEY, fallbackKey);
      return;
    }

    if (!connectionOptions.some((opt) => opt.key === selectedKey)) {
      const fallbackKey = hasStored ? stored! : connectionOptions[0].key;
      setSelectedKey(fallbackKey);
      localStorage.setItem(STORAGE_KEY, fallbackKey);
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(EVENT_NAME, onCustomSync);
    };
  }, [connectionOptions, selectedKey]);

  const setActiveConnection = useCallback((key: string) => {
    setSelectedKey(key);
    try {
      localStorage.setItem(STORAGE_KEY, key);
      window.dispatchEvent(new Event(EVENT_NAME));
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const selectedConnection = useMemo(
    () => connectionOptions.find((opt) => opt.key === selectedKey) || null,
    [connectionOptions, selectedKey]
  );

  return {
    loading,
    connectionOptions,
    selectedConnection,
    selectedKey,
    setActiveConnection,
    reloadConnections: loadConnections
  };
}
