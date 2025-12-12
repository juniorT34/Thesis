import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import apiClient, { SessionData, HealthStatus, ApiResponse } from '@/lib/api';

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApiState<T>(initialData: T | null = null) {
  const [state, setState] = useState<UseApiState<T>>({
    data: initialData,
    loading: false,
    error: null,
  });

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading, error: null }));
  }, []);

  const setData = useCallback((data: T) => {
    setState(prev => ({ ...prev, data, loading: false, error: null }));
  }, []);

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, error, loading: false }));
  }, []);

  return {
    ...state,
    setLoading,
    setData,
    setError,
  };
}

type SessionType = 'browser' | 'desktop';

const normalizeSessionData = (session: Partial<SessionData> & { sessionId?: string }, fallbackType?: SessionType): SessionData => {
  if (!session.sessionId) {
    throw new Error('Session payload is missing a sessionId');
  }

  const determinedType: SessionType =
    fallbackType ?? (session.type as SessionType) ?? (session.desktopUrl || session.flavor ? 'desktop' : 'browser');

  let normalizedTimeLeft = typeof session.timeLeft === 'number' ? session.timeLeft : undefined;

  if (typeof session.remainingMinutes === 'number') {
    normalizedTimeLeft = Math.max(0, Math.round(session.remainingMinutes * 60));
  } else if (normalizedTimeLeft === undefined && session.expiresAt) {
    const expiryMs = new Date(session.expiresAt).getTime() - Date.now();
    normalizedTimeLeft = Math.max(0, Math.floor(expiryMs / 1000));
  }

  return {
    sessionId: session.sessionId,
    status: (session.status as SessionData['status']) ?? 'running',
    timeLeft: normalizedTimeLeft ?? 0,
    remainingMinutes: session.remainingMinutes,
    url: session.url ?? session.browserUrl ?? session.desktopUrl ?? session.targetUrl,
    browserUrl: session.browserUrl,
    desktopUrl: session.desktopUrl,
    flavor: session.flavor,
    type: determinedType,
    userId: session.userId,
    targetUrl: session.targetUrl,
    containerId: session.containerId,
    stoppedAt: session.stoppedAt,
    lastError: session.lastError,
    createdAt: session.createdAt ?? new Date().toISOString(),
    expiresAt: session.expiresAt ?? new Date(Date.now() + (normalizedTimeLeft ?? 0) * 1000).toISOString(),
  };
};

export function useSessionManagement() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshSessions = useCallback(async () => {
    const response = await apiClient.getAllSessions();
    if (response.success && response.data) {
      const normalized = response.data.map(session =>
        normalizeSessionData(session, (session.type as SessionType) ?? 'browser'),
      );
      setSessions(normalized);
      return normalized;
    }
    throw new Error(response.message || 'Failed to load sessions');
  }, []);

  const startBrowserSession = useCallback(async (url?: string) => {
    setLoading(true);
    try {
      const response = await apiClient.startBrowserSession(url);
      if (response.success && response.data) {
        const normalized = normalizeSessionData(response.data, 'browser');
        toast.success('Browser session started successfully!');
        await refreshSessions();
        return normalized;
      } else {
        throw new Error(response.message || 'Failed to start browser session');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start browser session';
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [refreshSessions]);

  const startDesktopSession = useCallback(async (flavor: string = 'ubuntu') => {
    setLoading(true);
    try {
      const response = await apiClient.startDesktopSession(flavor);
      if (response.success && response.data) {
        const normalized = normalizeSessionData(response.data, 'desktop');
        toast.success('Desktop session started successfully!');
        await refreshSessions();
        return normalized;
      } else {
        throw new Error(response.message || 'Failed to start desktop session');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start desktop session';
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [refreshSessions]);

  const stopSession = useCallback(async (sessionId: string, type: 'browser' | 'desktop') => {
    try {
      const response = type === 'browser' 
        ? await apiClient.stopBrowserSession(sessionId)
        : await apiClient.stopDesktopSession(sessionId);
      
      if (response.success) {
        toast.success(`${type === 'browser' ? 'Browser' : 'Desktop'} session stopped successfully!`);
        await refreshSessions();
        return response.data;
      } else {
        throw new Error(response.message || `Failed to stop ${type} session`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to stop ${type} session`;
      toast.error(message);
      throw error;
    }
  }, [refreshSessions]);

  const extendSession = useCallback(async (sessionId: string, type: 'browser' | 'desktop', additionalSeconds: number = 300) => {
    try {
      const response = type === 'browser'
        ? await apiClient.extendBrowserSession(sessionId, additionalSeconds)
        : await apiClient.extendDesktopSession(sessionId, additionalSeconds);
      
      if (response.success && response.data) {
        const normalized = normalizeSessionData(response.data, type);
        toast.success(`Session extended by ${additionalSeconds / 60} minutes!`);
        await refreshSessions();
        return normalized;
      } else {
        throw new Error(response.message || `Failed to extend ${type} session`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to extend ${type} session`;
      toast.error(message);
      throw error;
    }
  }, [refreshSessions]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      await refreshSessions();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load sessions';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [refreshSessions]);

  const resetSessions = useCallback(() => {
    setSessions([]);
  }, []);

  const getSessionStatus = useCallback(async (sessionId: string, type: 'browser' | 'desktop') => {
    try {
      const response = type === 'browser'
        ? await apiClient.getBrowserSessionStatus(sessionId)
        : await apiClient.getDesktopSessionStatus(sessionId);
      
      if (response.success && response.data) {
        const normalized = normalizeSessionData(response.data, type);
        setSessions(prev => prev.map(session => 
          session.sessionId === sessionId ? { ...session, ...normalized } : session
        ));
        return normalized;
      } else {
        throw new Error(response.message || `Failed to get ${type} session status`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to get ${type} session status`;
      toast.error(message);
      throw error;
    }
  }, []);

  return {
    sessions,
    loading,
    startBrowserSession,
    startDesktopSession,
    stopSession,
    extendSession,
    loadSessions,
    getSessionStatus,
    resetSessions,
  };
}

const isHealthApiResponse = (
  payload: ApiResponse<HealthStatus> | HealthStatus,
): payload is ApiResponse<HealthStatus> => {
  return Boolean(
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    ('success' in payload || 'message' in payload),
  );
};

const extractHealthStatus = (payload: ApiResponse<HealthStatus> | HealthStatus): HealthStatus => {
  if (isHealthApiResponse(payload) && payload.data) {
    return payload.data;
  }
  return payload as HealthStatus;
};

export function useHealthCheck() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.getHealth();
      const normalized = extractHealthStatus(response);
      setHealth(normalized);
      return normalized;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check health status';
      toast.error(message);
      setHealth(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    health,
    loading,
    checkHealth,
  };
}
