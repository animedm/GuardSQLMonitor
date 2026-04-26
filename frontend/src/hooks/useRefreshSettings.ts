import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'guardsql.refreshIntervalSec';
const EVENT_NAME = 'guardsql:refresh-interval-changed';
const DEFAULT_INTERVAL = 30;

export function getStoredRefreshInterval(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_INTERVAL;
  } catch {
    return DEFAULT_INTERVAL;
  }
}

export function useRefreshSettings() {
  const [refreshIntervalSec, setRefreshIntervalSecState] = useState<number>(() => getStoredRefreshInterval());

  const setRefreshIntervalSec = useCallback((value: number) => {
    const safe = Number.isFinite(value) && value > 0 ? value : DEFAULT_INTERVAL;
    setRefreshIntervalSecState(safe);

    try {
      localStorage.setItem(STORAGE_KEY, String(safe));
      window.dispatchEvent(new Event(EVENT_NAME));
    } catch {
      // Ignore storage errors.
    }
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setRefreshIntervalSecState(getStoredRefreshInterval());
      }
    };

    const onCustom = () => {
      setRefreshIntervalSecState(getStoredRefreshInterval());
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(EVENT_NAME, onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(EVENT_NAME, onCustom);
    };
  }, []);

  return {
    refreshIntervalSec,
    setRefreshIntervalSec
  };
}
