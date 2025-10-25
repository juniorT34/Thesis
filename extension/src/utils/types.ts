/**
 * Shared type definitions for the Disposable Services extension
 */

export type ServiceType = 'browser' | 'desktop' | 'viewer';

export type DesktopMachineType = 'ubuntu' | 'debian' | 'fedora' | 'alpine' | 'arch';

export interface ServiceSession {
  id: string;
  port?: number;
  status: 'stopped' | 'starting' | 'running' | 'error'; // Add 'starting' status
  startTime: number;
  lastUpdated: number;
  error?: string;
  machineType?: DesktopMachineType; // Optional for desktop service
  browserUrl?: string; // URL for the browser session
  desktopUrl?: string; // URL for the desktop session

  backendStartTime?: string;
  remainingTime?: string;
  location?: string;
}

export interface ExtensionSettings {
  apiUrl: string;
  apiKey?: string; // Optional since we don't use API key authentication
  maxRetries: number;
  retryDelay: number;
  sessionTimeout: number;
  theme: 'light' | 'dark';
  defaultDesktopMachineType: DesktopMachineType;
}

// API Response types matching our backend
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Backend API response types
export interface BrowserSessionData {
  sessionId: string;
  userId: string;
  containerId: string;
  browserUrl: string;
  expiresAt: string;
  status: string;
  remainingMinutes: number;
  ports: {
    http: number;
    https: number;
  };
}

// Desktop API response types
export interface DesktopSessionData {
  sessionId: string;
  userId: string;
  flavor: string;
  containerId: string;
  desktopUrl: string;
  expiresAt: string;
  status: string;
  remainingMinutes: number;
}

export interface SessionStatusData {
  sessionId: string;
  userId: string;
  expiresAt: string;
  status: string;
  remainingMinutes: number;
}

export interface StopSessionData {
  sessionId: string;
  status: string;
}

export interface ExtendSessionData {
  sessionId: string;
  userId: string;
  expiresAt: string;
  status: string;
  remainingMinutes: number;
}

// API client configuration
export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
}