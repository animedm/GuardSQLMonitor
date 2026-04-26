import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  preferences: ToastPreferences;
  setTypeEnabled: (type: ToastType, enabled: boolean) => void;
}

interface ToastPreferences {
  success: boolean;
  error: boolean;
  warning: boolean;
  info: boolean;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);
const TOAST_PREFS_KEY = 'guardsql.toast-preferences';
const TOAST_DUPLICATE_WINDOW_MS = 10000;

function getStoredPreferences(): ToastPreferences {
  const defaults: ToastPreferences = {
    success: true,
    error: true,
    warning: true,
    info: true
  };

  try {
    const raw = localStorage.getItem(TOAST_PREFS_KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw);
    return {
      success: typeof parsed.success === 'boolean' ? parsed.success : defaults.success,
      error: typeof parsed.error === 'boolean' ? parsed.error : defaults.error,
      warning: typeof parsed.warning === 'boolean' ? parsed.warning : defaults.warning,
      info: typeof parsed.info === 'boolean' ? parsed.info : defaults.info
    };
  } catch {
    return defaults;
  }
}

function getToastStyles(type: ToastType) {
  switch (type) {
    case 'success':
      return {
        container: 'bg-green-900/70 border-green-700 text-green-100',
        icon: <CheckCircle2 className="w-4 h-4 text-green-400" />
      };
    case 'error':
      return {
        container: 'bg-red-900/70 border-red-700 text-red-100',
        icon: <XCircle className="w-4 h-4 text-red-400" />
      };
    case 'warning':
      return {
        container: 'bg-amber-900/70 border-amber-700 text-amber-100',
        icon: <AlertTriangle className="w-4 h-4 text-amber-400" />
      };
    default:
      return {
        container: 'bg-sky-900/70 border-sky-700 text-sky-100',
        icon: <Info className="w-4 h-4 text-sky-400" />
      };
  }
}

function newId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [preferences, setPreferences] = useState<ToastPreferences>(() => getStoredPreferences());
  const lastShownRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const setTypeEnabled = useCallback((type: ToastType, enabled: boolean) => {
    setPreferences((prev) => {
      const next = { ...prev, [type]: enabled };
      try {
        localStorage.setItem(TOAST_PREFS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors.
      }
      return next;
    });
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    if (!preferences[type]) {
      return;
    }

    const dedupeKey = `${type}:${message}`;
    const now = Date.now();
    const lastShown = lastShownRef.current.get(dedupeKey);

    if (lastShown && now - lastShown < TOAST_DUPLICATE_WINDOW_MS) {
      return;
    }

    lastShownRef.current.set(dedupeKey, now);

    const id = newId();
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    window.setTimeout(() => dismiss(id), 4000);
  }, [dismiss, preferences]);

  const value = useMemo(() => ({ showToast, preferences, setTypeEnabled }), [showToast, preferences, setTypeEnabled]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2rem)]">
        {toasts.map((toast) => {
          const styles = getToastStyles(toast.type);
          return (
            <button
              key={toast.id}
              onClick={() => dismiss(toast.id)}
              className={`text-left border rounded-lg px-3 py-2 backdrop-blur ${styles.container}`}
            >
              <div className="flex items-start gap-2">
                <div className="pt-0.5">{styles.icon}</div>
                <span className="text-sm leading-5">{toast.message}</span>
              </div>
            </button>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return ctx;
}
