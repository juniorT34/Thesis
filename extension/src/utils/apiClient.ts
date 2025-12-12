/**
 * Optimized API client for the Disposable Services extension
 * Uses axios for better error handling and functional approach
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiClientConfig, ApiResponse, BrowserSessionData, DesktopSessionData, SessionStatusData, StopSessionData, ExtendSessionData } from './types';


// Create axios instance with default config
const createAxiosInstance = (config: ApiClientConfig): AxiosInstance => {
  return axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout || 10000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
};

// Generic request handler with error handling
const handleRequest = async <T>(
  request: Promise<AxiosResponse<ApiResponse<T>>>
): Promise<ApiResponse<T>> => {
  try {
    const response = await request;
    return response.data;
  } catch (error: any) {
    console.error('API request failed:', error);
    console.error('Error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method,
      requestData: error.config?.data ? JSON.parse(error.config.data) : null
    });
    
    // Stringify error response data for better debugging
    const errorData = error.response?.data;
    const errorMessage = errorData ? 
      (typeof errorData === 'object' ? JSON.stringify(errorData, null, 2) : String(errorData)) : 
      'No error data available';
    
    console.error('Error response data (stringified):', errorMessage);
    
    // Handle different types of errors
    if (error.response) {
      // Server responded with error status
      return {
        success: false,
        error: error.response.data?.message || `HTTP ${error.response.status}`,
        message: error.response.data?.message || 'Request failed'
      };
    } else if (error.request) {
      // Request was made but no response received
      return {
        success: false,
        error: 'No response from server',
        message: 'Network error - server unreachable'
      };
    } else {
      // Something else happened
      return {
        success: false,
        error: error.message || 'Unknown error',
        message: 'Request failed'
      };
    }
  }
};

// Browser service API functions
export const browserApi = {
              // Start a new browser session
            startSession: async (config: ApiClientConfig, url?: string): Promise<ApiResponse<BrowserSessionData>> => {
              const instance = createAxiosInstance(config);
              return handleRequest(
                instance.post('/api/v1/browser/start', { url })
              );
            },

              // Stop a browser session
            stopSession: async (sessionId: string, config: ApiClientConfig): Promise<ApiResponse<StopSessionData>> => {
              const instance = createAxiosInstance(config);
              return handleRequest(
                instance.post('/api/v1/browser/stop', { sessionId })
              );
            },

              // Extend a browser session
            extendSession: async (sessionId: string, additionalSeconds: number, config: ApiClientConfig): Promise<ApiResponse<ExtendSessionData>> => {
              const instance = createAxiosInstance(config);
              
              // Debug logging to see what's being sent
              console.log('DEBUG: browserApi.extendSession', {
                sessionId,
                additionalSeconds,
                additionalSecondsType: typeof additionalSeconds,
                requestBody: { sessionId, additionalSeconds }
              });
              
              return handleRequest(
                instance.post('/api/v1/browser/extend', { sessionId, additionalSeconds })
              );
            },

              // Get session status
            getSessionStatus: async (sessionId: string, config: ApiClientConfig): Promise<ApiResponse<SessionStatusData>> => {
              const instance = createAxiosInstance(config);
              return handleRequest(
                instance.get(`/api/v1/browser/status/${sessionId}`)
              );
            },

              // Get remaining time for a session
            getRemainingTime: async (sessionId: string, config: ApiClientConfig): Promise<ApiResponse<any>> => {
              const instance = createAxiosInstance(config);
              return handleRequest(
                instance.get(`/api/v1/browser/remaining_time/${sessionId}`)
              );
            },

              // Get all active sessions
            getAllSessions: async (config: ApiClientConfig): Promise<ApiResponse<SessionStatusData[]>> => {
              const instance = createAxiosInstance(config);
              return handleRequest(
                instance.get('/api/v1/browser/sessions')
              );
            },

              // Cleanup expired sessions
            cleanupSessions: async (config: ApiClientConfig): Promise<ApiResponse<{ cleanedCount: number }>> => {
              const instance = createAxiosInstance(config);
              return handleRequest(
                instance.post('/api/v1/browser/cleanup')
              );
            }
};

// Desktop service API functions
export const desktopApi = {
  // Start a new desktop session
  startSession: async (config: ApiClientConfig, flavor: string): Promise<ApiResponse<DesktopSessionData>> => {
    const instance = createAxiosInstance(config);
    return handleRequest(
      instance.post('/api/v1/desktop/start', { flavor })
    );
  },

  // Stop a desktop session
  stopSession: async (sessionId: string, config: ApiClientConfig): Promise<ApiResponse<StopSessionData>> => {
    const instance = createAxiosInstance(config);
    return handleRequest(
      instance.post('/api/v1/desktop/stop', { sessionId })
    );
  },

  // Extend a desktop session
  extendSession: async (sessionId: string, additionalSeconds: number, config: ApiClientConfig): Promise<ApiResponse<ExtendSessionData>> => {
    const instance = createAxiosInstance(config);
    return handleRequest(
      instance.post('/api/v1/desktop/extend', { sessionId, additionalSeconds })
    );
  },

  // Get desktop session status
  getSessionStatus: async (sessionId: string, config: ApiClientConfig): Promise<ApiResponse<SessionStatusData>> => {
    const instance = createAxiosInstance(config);
    return handleRequest(
      instance.get(`/api/v1/desktop/status/${sessionId}`)
    );
  },

  // Get remaining time for a desktop session
  getRemainingTime: async (sessionId: string, config: ApiClientConfig): Promise<ApiResponse<any>> => {
    const instance = createAxiosInstance(config);
    return handleRequest(
      instance.get(`/api/v1/desktop/remaining_time/${sessionId}`)
    );
  },

  // Get all active desktop sessions
  getAllSessions: async (config: ApiClientConfig): Promise<ApiResponse<SessionStatusData[]>> => {
    const instance = createAxiosInstance(config);
    return handleRequest(
      instance.get('/api/v1/desktop/sessions')
    );
  },

  // Cleanup expired desktop sessions
  cleanupSessions: async (config: ApiClientConfig): Promise<ApiResponse<{ cleanedCount: number }>> => {
    const instance = createAxiosInstance(config);
    return handleRequest(
      instance.post('/api/v1/desktop/cleanup')
    );
  }
};

// Viewer service API functions (for future implementation)
export const viewerApi = {
  startSession: async (config: ApiClientConfig, document: File): Promise<ApiResponse<any>> => {
    const instance = createAxiosInstance(config);
    const formData = new FormData();
    formData.append('document', document);
    
    return handleRequest(
      instance.post('/api/viewer/start', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
    );
  },

  stopSession: async (sessionId: string, config: ApiClientConfig): Promise<ApiResponse<any>> => {
    const instance = createAxiosInstance(config);
    return handleRequest(
      instance.post('/api/viewer/stop', { sessionId })
    );
  },

  extendSession: async (sessionId: string, additionalSeconds: number, config: ApiClientConfig): Promise<ApiResponse<any>> => {
    const instance = createAxiosInstance(config);
    return handleRequest(
      instance.post('/api/viewer/extend', { sessionId, additionalSeconds })
    );
  },

  getSessionStatus: async (sessionId: string, config: ApiClientConfig): Promise<ApiResponse<any>> => {
    const instance = createAxiosInstance(config);
    return handleRequest(
      instance.get(`/api/viewer/status/${sessionId}`)
    );
  }
};

            // Health check function
            export const healthCheck = async (config: ApiClientConfig): Promise<ApiResponse<any>> => {
              const instance = createAxiosInstance(config);
              return handleRequest(
                instance.get('/api/v1/health')
              );
            };

// Utility function to get API config from settings
export const getApiConfig = async (): Promise<ApiClientConfig> => {
  const settings = await chrome.storage.local.get(['settings']);
  const defaultSettings = {
    apiUrl: 'http://localhost:4000'
  };
  
  const currentSettings = settings.settings || defaultSettings;
  
  return {
    baseURL: currentSettings.apiUrl,
    timeout: 10000
  };
};