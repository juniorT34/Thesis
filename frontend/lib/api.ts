const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface ApiResponse<T = unknown> {
  success: boolean;
  status?: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface SessionData {
  sessionId: string;
  status: 'running' | 'stopped' | 'starting' | 'extended' | 'expired' | 'error';
  timeLeft?: number;
  remainingMinutes?: number;
  userId?: string;
  targetUrl?: string;
  containerId?: string;
  url?: string;
  browserUrl?: string;
  desktopUrl?: string;
  flavor?: string;
  type?: 'browser' | 'desktop';
  stoppedAt?: string;
  lastError?: string;
  createdAt: string;
  expiresAt: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    external: number;
  };
  environment: string;
  sessionManager: Record<string, unknown>;
  database: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt?: string;
  updatedAt?: string;
}

export type CreateAdminUserPayload = {
  name: string;
  email: string;
  password: string;
  role: 'USER' | 'ADMIN';
};

export type UpdateAdminUserPayload = {
  name?: string;
  email?: string;
  password?: string;
  role?: 'USER' | 'ADMIN';
};

export interface AuthResponse {
  token: string;
  user: UserAccount;
}

export interface AdminStats {
  totalUsers: number;
  roleBreakdown: Record<string, number>;
  activeSessions: {
    browser: number;
    desktop: number;
  };
  totalActiveSessions: number;
}

export type AdminSessionSummary = SessionData & Required<Pick<SessionData, 'type'>>;

export interface AdminCommandResult {
  sessionId?: string;
  type?: 'browser' | 'desktop';
  command: string;
  output: string;
  exitCode: number;
  timestamp: string;
}

export interface AdminLogsResponse {
  sessionId?: string;
  type?: 'browser' | 'desktop';
  content: string;
  tail: number;
  timestamp: string;
}

export interface AdminResourceSnapshot {
  sessionId?: string;
  type?: 'browser' | 'desktop';
  cpu: {
    percent: number;
    totalUsage: number;
    systemUsage: number;
    cores: number;
  };
  memory: {
    usageBytes: number;
    limitBytes: number;
    percent: number;
  };
  network: {
    rxBytes: number;
    txBytes: number;
  };
  blockIO: {
    readBytes: number;
    writeBytes: number;
  };
  collectedAt: string;
  uptimeSeconds?: number | null;
}

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  private buildHeaders(headers?: Record<string, string>) {
    const finalHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers || {}),
    };

    if (this.authToken) {
      finalHeaders.Authorization = `Bearer ${this.authToken}`;
    }

    return finalHeaders;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: this.buildHeaders(options.headers as Record<string, string> | undefined),
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Authentication
  async signUp(payload: { name: string; email: string; password: string }): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>('/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async signIn(payload: { email: string; password: string }): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>('/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async signOut(): Promise<ApiResponse> {
    return this.request('/auth/sign-out', {
      method: 'POST',
    });
  }

  async getProfile(): Promise<ApiResponse<{ user: UserAccount }>> {
    return this.request<{ user: UserAccount }>('/auth/me');
  }

  // Health check
  async getHealth(): Promise<ApiResponse<HealthStatus>> {
    return this.request<HealthStatus>('/health');
  }

  // Browser session management
  async startBrowserSession(url?: string): Promise<ApiResponse<SessionData>> {
    return this.request<SessionData>('/browser/start', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async stopBrowserSession(sessionId: string): Promise<ApiResponse<{ sessionId: string; status: string }>> {
    return this.request<{ sessionId: string; status: string }>('/browser/stop', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  async extendBrowserSession(sessionId: string, additionalSeconds: number = 300): Promise<ApiResponse<SessionData>> {
    return this.request<SessionData>('/browser/extend', {
      method: 'POST',
      body: JSON.stringify({ sessionId, additionalSeconds }),
    });
  }

  async getBrowserSessionStatus(sessionId: string): Promise<ApiResponse<SessionData>> {
    return this.request<SessionData>(`/browser/status/${sessionId}`);
  }

  async getBrowserRemainingTime(sessionId: string): Promise<ApiResponse<{ timeLeft: number }>> {
    return this.request<{ timeLeft: number }>(`/browser/remaining_time/${sessionId}`);
  }

  async getAllBrowserSessions(): Promise<ApiResponse<SessionData[]>> {
    return this.request<SessionData[]>('/browser/sessions');
  }

  async getAllSessions(): Promise<ApiResponse<SessionData[]>> {
    return this.request<SessionData[]>('/sessions');
  }

  // Desktop session management
  async startDesktopSession(flavor: string = 'ubuntu'): Promise<ApiResponse<SessionData>> {
    return this.request<SessionData>('/desktop/start', {
      method: 'POST',
      body: JSON.stringify({ flavor }),
    });
  }

  async stopDesktopSession(sessionId: string): Promise<ApiResponse<{ sessionId: string; status: string }>> {
    return this.request<{ sessionId: string; status: string }>('/desktop/stop', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  async extendDesktopSession(sessionId: string, additionalSeconds: number = 300): Promise<ApiResponse<SessionData>> {
    return this.request<SessionData>('/desktop/extend', {
      method: 'POST',
      body: JSON.stringify({ sessionId, additionalSeconds }),
    });
  }

  async getDesktopSessionStatus(sessionId: string): Promise<ApiResponse<SessionData>> {
    return this.request<SessionData>(`/desktop/status/${sessionId}`);
  }

  async getDesktopRemainingTime(sessionId: string): Promise<ApiResponse<{ timeLeft: number }>> {
    return this.request<{ timeLeft: number }>(`/desktop/remaining_time/${sessionId}`);
  }

  async getAllDesktopSessions(): Promise<ApiResponse<SessionData[]>> {
    return this.request<SessionData[]>('/desktop/sessions');
  }

  // Admin endpoints
  async getAdminUsers(): Promise<ApiResponse<UserAccount[]>> {
    return this.request<UserAccount[]>('/admin/users');
  }

  async createAdminUser(payload: CreateAdminUserPayload): Promise<ApiResponse<UserAccount>> {
    return this.request<UserAccount>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateAdminUser(userId: string, payload: UpdateAdminUserPayload): Promise<ApiResponse<UserAccount>> {
    return this.request<UserAccount>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async updateUserRole(userId: string, role: 'USER' | 'ADMIN'): Promise<ApiResponse<UserAccount>> {
    return this.request<UserAccount>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async deleteAdminUser(userId: string): Promise<ApiResponse<{ id: string }>> {
    return this.request<{ id: string }>(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async getAdminStats(): Promise<ApiResponse<AdminStats>> {
    return this.request<AdminStats>('/admin/stats');
  }

  async getAdminSessions(): Promise<ApiResponse<AdminSessionSummary[]>> {
    return this.request<AdminSessionSummary[]>('/admin/sessions/history');
  }

  async executeAdminSessionCommand(
    sessionId: string,
    payload: { type: 'browser' | 'desktop'; command: string }
  ): Promise<ApiResponse<AdminCommandResult>> {
    return this.request<AdminCommandResult>(`/admin/sessions/${sessionId}/terminal`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getAdminSessionLogs(
    sessionId: string,
    params: { type: 'browser' | 'desktop'; tail?: number } 
  ): Promise<ApiResponse<AdminLogsResponse>> {
    const searchParams = new URLSearchParams({
      type: params.type,
    });
    if (params.tail) {
      searchParams.append('tail', params.tail.toString());
    }
    return this.request<AdminLogsResponse>(`/admin/sessions/${sessionId}/logs?${searchParams.toString()}`);
  }

  async getAdminSessionResources(
    sessionId: string,
    params: { type: 'browser' | 'desktop' }
  ): Promise<ApiResponse<AdminResourceSnapshot>> {
    const searchParams = new URLSearchParams({
      type: params.type,
    });
    return this.request<AdminResourceSnapshot>(`/admin/sessions/${sessionId}/resources?${searchParams.toString()}`);
  }
}

export const apiClient = new ApiClient();
export default apiClient;
