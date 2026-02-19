'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface DebugContextValue {
  isEnabled: boolean;
  toggle: () => void;
  enable: () => void;
  disable: () => void;
}

const DebugContext = createContext<DebugContextValue | null>(null);

// 从环境变量读取是否启用 Debug 功能
const isDebugEnabledByDefault = process.env.NEXT_PUBLIC_DEBUG === 'true';

export function DebugProvider({ children }: { children: ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(isDebugEnabledByDefault);

  const toggle = useCallback(() => {
    setIsEnabled(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('debug-enabled', String(next));
      }
      return next;
    });
  }, []);

  const enable = useCallback(() => {
    setIsEnabled(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('debug-enabled', 'true');
    }
  }, []);

  const disable = useCallback(() => {
    setIsEnabled(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('debug-enabled', 'false');
    }
  }, []);

  return (
    <DebugContext.Provider value={{ isEnabled, toggle, enable, disable }}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug() {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error('useDebug must be used within DebugProvider');
  }
  return context;
}

// 检查是否在生产环境且未强制启用 Debug
export function isDebugDisabled() {
  return process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DEBUG !== 'true';
}
