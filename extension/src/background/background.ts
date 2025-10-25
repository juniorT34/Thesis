/**
 * Background service worker for the Disposable Services extension
 */

import { ServiceType, ServiceSession, ExtensionSettings, DesktopMachineType } from '../utils/types';
import { browserApi, desktopApi, viewerApi } from '../utils/apiClient';
import { ApiClientConfig } from '../utils/types';

const DEFAULT_SETTINGS: ExtensionSettings = {
  apiUrl: 'http://localhost:4000',
  apiKey: '', // No API key needed for our backend
  maxRetries: 3,
  retryDelay: 1000,
  sessionTimeout: 300000, // 5 minutes in milliseconds (matches backend default)
  theme: 'light',
  defaultDesktopMachineType: 'ubuntu'
};

// Track browser sessions and their associated tabs
const browserSessionTabs = new Map<string, number>(); // sessionId -> tabId
const tabToSessionMap = new Map<number, { sessionId: string, serviceType: ServiceType }>(); // tabId -> { sessionId, serviceType }
const stoppingSessions = new Set<string>(); // Track sessions that are currently being stopped

// Initialize the extension when installed
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Disposable Services extension installed');
  
  // Initialize default settings
  const settings = await chrome.storage.local.get(['settings']);
  console.log('Current settings from storage:', settings);
  
  if (!settings.settings) {
    console.log('No settings found, initializing with defaults');
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    console.log('Default settings saved:', DEFAULT_SETTINGS);
  } else {
    console.log('Settings found:', settings.settings);
    
    // Ensure all required settings are present
    const currentSettings = settings.settings;
    const updatedSettings = { ...DEFAULT_SETTINGS, ...currentSettings };
    
    // Check if apiUrl is missing or undefined
    if (!updatedSettings.apiUrl) {
      console.log('apiUrl is missing, setting default');
      updatedSettings.apiUrl = DEFAULT_SETTINGS.apiUrl;
      await chrome.storage.local.set({ settings: updatedSettings });
      console.log('Updated settings with default apiUrl:', updatedSettings);
    }
  }

  // Clear any existing sessions
  await chrome.storage.local.remove(['browserSession', 'desktopSession', 'viewerSession']);

  // Create context menu items(right click)
  chrome.contextMenus.create({
    id: 'open-in-safebox',
    title: 'Open in SafeBox',
    contexts: ['link'],
    documentUrlPatterns: ['<all_urls>']
  });

  chrome.contextMenus.create({
    id: 'open-page-in-safebox',
    title: 'Open this page in SafeBox',
    contexts: ['page'],
    documentUrlPatterns: ['<all_urls>']
  });
});

// Listen for tab updates and closures
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log(`Tab ${tabId} was closed`);
  
  // Check if this tab was associated with a session
  const sessionInfo = tabToSessionMap.get(tabId);
  if (sessionInfo) {
    const { sessionId, serviceType } = sessionInfo;
    console.log(`${serviceType} session tab closed: ${sessionId}, stopping container`);
    
    // Check if session is already being stopped to prevent double-stop
    if (stoppingSessions.has(sessionId)) {
      console.log(`Session ${sessionId} is already being stopped, skipping duplicate stop attempt`);
      return;
    }
    
    // Mark session as being stopped
    stoppingSessions.add(sessionId);
    
    try {
      // Stop the session based on service type
      const config = await getApiConfig();
      
      switch (serviceType) {
        case 'browser':
          await browserApi.stopSession(sessionId, config);
          // Clear from storage
          await chrome.storage.local.remove(['browserSession']);
          break;
        case 'desktop':
          await desktopApi.stopSession(sessionId, config);
          // Clear from storage
          await chrome.storage.local.remove(['desktopSession']);
          break;
        case 'viewer':
          await viewerApi.stopSession(sessionId, config);
          // Clear from storage
          await chrome.storage.local.remove(['viewerSession']);
          break;
        default:
          console.warn(`Unknown service type: ${serviceType}`);
          return;
      }
      
      // Remove from tracking
      if (serviceType === 'browser') {
        browserSessionTabs.delete(sessionId);
      }
      tabToSessionMap.delete(tabId);
      
      console.log(`Successfully stopped ${serviceType} session ${sessionId} after tab closure`);
      
      // Show notification to user
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'SafeBox Session Ended',
        message: `${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} session has been automatically stopped since the tab was closed.`
      });
    } catch (error) {
      console.error(`Failed to stop ${serviceType} session ${sessionId} after tab closure:`, error);
    } finally {
      // Always remove from stopping sessions set
      stoppingSessions.delete(sessionId);
    }
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message:", message);
  
  // Specific handler for start service actions
  if (message.action.startsWith('start') && message.action.endsWith('Service')) {
    const serviceType = message.action.replace('start', '').replace('Service', '').toLowerCase() as ServiceType;
    console.log(`Starting ${serviceType} service`);
    handleStartService(serviceType, message.machineType)
      .then(response => sendResponse(response))
      .catch(error => {
        console.error(`Failed to start ${serviceType}:`, error);
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          code: error instanceof Error ? (error as any).code || 'UNKNOWN_ERROR' : 'UNKNOWN_ERROR'
        });
      });
    return true;
  }

  // Specific handler for stop service actions
  if (message.action.startsWith('stop') && message.action.endsWith('Service')) {
    const serviceType = message.action.replace('stop', '').replace('Service', '').toLowerCase() as ServiceType;
    console.log(`Stopping ${serviceType} service with session ID ${message.sessionId}`);
    
    handleStopService(serviceType, message.sessionId)
      .then(response => sendResponse(response))
      .catch(error => {
        console.error(`Failed to stop ${serviceType}:`, error);
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
    return true;
  }

  // Specific handler for extend service actions
  if (message.action.startsWith('extend') && message.action.endsWith('Service')) {
    const serviceType = message.action.replace('extend', '').replace('Service', '').toLowerCase() as ServiceType;
    console.log(`Extending ${serviceType} service`);
    
    handleExtendService(serviceType, message.sessionId, message.additionalSeconds)
      .then(response => sendResponse(response))
      .catch(error => {
        console.error(`Failed to extend ${serviceType}:`, error);
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
    return true;
  }

  // Specific handler for get remaining time actions
  if (message.action.startsWith('get') && message.action.includes('RemainingTime')) {
    const serviceType = message.action.replace('get', '').replace('RemainingTime', '').toLowerCase() as ServiceType;
    console.log(`Getting ${serviceType} remaining time`);
    
    handleGetRemainingTime(serviceType, message.sessionId)
      .then(response => sendResponse(response))
      .catch(error => {
        console.error(`Failed to get ${serviceType} remaining time:`, error);
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
    return true;
  }

  // Handle get service status
  if (message.action === 'getServiceStatus') {
    console.log('Getting service status');
    handleGetServiceStatus()
      .then(response => sendResponse(response))
      .catch(error => {
        console.error('Failed to get service status:', error);
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
    return true;
  }

  // Handle tracking browser tabs from popup
  if (message.action === 'trackBrowserTab') {
    console.log('Tracking browser tab:', message.sessionId, message.tabId);
    browserSessionTabs.set(message.sessionId, message.tabId);
    tabToSessionMap.set(message.tabId, { sessionId: message.sessionId, serviceType: 'browser' });
    sendResponse({ success: true });
    return true;
  }

  // Handle tracking desktop tabs from popup
  if (message.action === 'trackDesktopTab') {
    console.log('Tracking desktop tab:', message.sessionId, message.tabId);
    tabToSessionMap.set(message.tabId, { sessionId: message.sessionId, serviceType: 'desktop' });
    sendResponse({ success: true });
    return true;
  }

  // Handle session expiration
  if (message.action === 'sessionExpired') {
    console.log('Session expired:', message.service, message.sessionId);
    if (message.service === 'browser' && message.sessionId) {
      closeBrowserTab(message.sessionId).then(() => {
        console.log(`Closed browser tab for expired session ${message.sessionId}`);
      }).catch(error => {
        console.error(`Failed to close browser tab for expired session ${message.sessionId}:`, error);
      });
    }
    sendResponse({ success: true });
    return true;
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('Context menu clicked:', info.menuItemId);
  
  if (info.menuItemId === 'open-in-safebox' && info.linkUrl) {
    console.log('Opening link in SafeBox:', info.linkUrl);
    await openUrlInSafeBox(info.linkUrl);
  } else if (info.menuItemId === 'open-page-in-safebox' && tab?.url) {
    console.log('Opening page in SafeBox:', tab.url);
    await openUrlInSafeBox(tab.url);
  }
});

// Function to open URL in SafeBox browser
async function openUrlInSafeBox(url: string): Promise<void> {
  try {
    console.log('Starting browser service for URL:', url);
    
    // Start browser service using new API
    const config = await getApiConfig();
    const response = await browserApi.startSession(config, url);
    
    if (response.success && response.data) {
      // Open the browser service URL
      const browserUrl = response.data.browserUrl;
      const sessionId = response.data.sessionId;
      console.log('Opening browser service at:', browserUrl);
      
      // Open the browser service in a new tab
      const tab = await chrome.tabs.create({ url: browserUrl });
      
      // Track this tab for automatic cleanup
      if (tab.id && sessionId) {
        browserSessionTabs.set(sessionId, tab.id);
        tabToSessionMap.set(tab.id, { sessionId, serviceType: 'browser' });
        console.log(`Tracking browser session ${sessionId} with tab ${tab.id}`);
      }
      
      // Show a notification to the user
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'SafeBox Browser Started',
        message: 'Your secure browser session is ready. The session will automatically stop when you close the tab.'
      });
    } else {
      console.error('Failed to start browser service:', response.error);
      // Show error notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'SafeBox Error',
        message: `Failed to start browser service: ${response.error}`
      });
    }
  } catch (error) {
    console.error('Error opening URL in SafeBox:', error);
    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'SafeBox Error',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

// Enhanced handleStartService function with better error handling
async function handleStartService(service: ServiceType, machineType?: DesktopMachineType, document?: any): Promise<any> {
  const settings = await getSettings();
  const existingSession = await getCurrentSession(service);

  // Ensure settings have valid values
  const maxRetries = settings.maxRetries || 3;
  const retryDelay = settings.retryDelay || 1000;

  console.log(`Starting ${service} service with maxRetries: ${maxRetries}, retryDelay: ${retryDelay}`);

  // Check for existing session and handle conflicts
  if (existingSession && existingSession.status === 'running') {
    console.log(`Service ${service} is already running with session:`, existingSession);
    
    // For desktop service, check if we can reuse the existing session
    if (service === 'desktop' && existingSession.machineType === machineType) {
      console.log(`Reusing existing ${service} session with matching machine type`);
      return {
        success: true,
        sessionId: existingSession.id,
        desktopUrl: existingSession.desktopUrl,
        port: existingSession.port
      };
    } else if (service === 'desktop' && existingSession.machineType !== machineType) {
      // For desktop with different machine type, stop the existing session
      console.log(`Stopping existing ${service} session with different machine type before starting new one`);
      try {
        await handleStopService(service, existingSession.id);
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.warn(`Failed to stop existing ${service} session:`, error);
      }
    } else {
      // For other services, return the existing session instead of stopping it
      console.log(`Service ${service} is already running, returning existing session`);
      return {
        success: true,
        sessionId: existingSession.id,
        browserUrl: existingSession.browserUrl,
        desktopUrl: existingSession.desktopUrl,
        port: existingSession.port
      };
    }
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt + 1}/${maxRetries} to start ${service} service`);
      
      const config = await getApiConfig();
      
      // Enhanced debug logging for config
      console.log('DEBUG: handleStartService config:', config);
      console.log('DEBUG: config.baseURL:', config.baseURL);
      console.log('DEBUG: config.timeout:', config.timeout);
      
      if (!config.baseURL) {
        throw new Error('API baseURL is undefined - check extension settings');
      }
      
      // Test connectivity before making the actual request
      try {
        const healthResponse = await fetch(`${config.baseURL}/api/v1/health`);
        if (!healthResponse.ok) {
          throw new Error(`Backend health check failed: ${healthResponse.status}`);
        }
        console.log('Backend health check passed');
      } catch (healthError) {
        console.error('Backend health check failed:', healthError);
        const errorMessage = healthError instanceof Error ? healthError.message : 'Unknown error';
        throw new Error(`Cannot reach backend server: ${errorMessage}`);
      }
      
      let response;
      switch (service) {
        case 'browser':
          response = await browserApi.startSession(config, undefined);
          break;
        case 'desktop':
          console.log('Starting desktop service with config:', config);
          console.log('Machine type:', machineType || 'ubuntu');
          response = await desktopApi.startSession(config, machineType || 'ubuntu');
          console.log('Desktop service response:', response);
          break;
        case 'viewer':
          response = await viewerApi.startSession(config, document);
          break;
        default:
          throw new Error(`Unknown service type: ${service}`);
      }

      if (response.success && response.data) {
        console.log(`Received successful response for ${service}:`, response.data);
        
        // Store session info with backend data
        const session: ServiceSession = {
          id: response.data.sessionId,
          port: response.data.ports?.http || 3000, // Use HTTP port from new API structure
          status: 'running',
          startTime: Date.now(),
          lastUpdated: Date.now(),
          machineType: service === 'desktop' ? machineType : undefined,
          backendStartTime: new Date().toISOString(),
          remainingTime: response.data.remainingMinutes ? (response.data.remainingMinutes * 60).toString() : '300', // Use backend remaining time or default to 5 minutes
          location: 'local',
          browserUrl: response.data.browserUrl,
          desktopUrl: response.data.desktopUrl
        };
        
        console.log(`Created session object for ${service}:`, session);

        await chrome.storage.local.set({ [`${service}Session`]: session });

        // Set up session timeout
        setTimeout(async () => {
          const session = await getCurrentSession(service);
          if (session && session.id) {
            handleStopService(service, session.id).catch(console.error);
          }
        }, settings.sessionTimeout);

        console.log(`Successfully started ${service} service on attempt ${attempt + 1}`);
        return { 
          success: true, 
          sessionId: response.data.sessionId, 
          browserUrl: response.data.browserUrl,
          desktopUrl: response.data.desktopUrl,
          port: response.data.ports?.http || 3000
        };
      } else {
        throw new Error(response.error || 'Failed to start service');
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`Attempt ${attempt + 1} failed for ${service}:`, lastError.message);
      
      if (attempt < maxRetries - 1) {
        const delay = retryDelay * Math.pow(2, attempt);
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  const errorMessage = lastError?.message || 'Unknown error';
  console.error(`All ${maxRetries} attempts failed for ${service}. Last error: ${errorMessage}`);
  throw new Error(`Failed to start ${service} after ${maxRetries} attempts: ${errorMessage}`);
}

// Handle getting service status using new API
async function handleGetServiceStatus(): Promise<any> {
  console.log('Getting service status from backend...');
  
  try {
    const config = await getApiConfig();
    const sessions: Record<string, any> = {};
    
    // Check each service's actual status from backend
    const serviceTypes: ServiceType[] = ['browser', 'desktop', 'viewer'];
    
    for (const service of serviceTypes) {
      try {
        // First, get the local session to see if we have a session ID
        const localSession = await getCurrentSession(service);
        
        if (localSession && localSession.id) {
          console.log(`Checking ${service} session ${localSession.id} on backend...`);
          
          // Check the actual session status on the backend
          let backendResponse;
          switch (service) {
            case 'browser':
              backendResponse = await browserApi.getSessionStatus(localSession.id, config);
              break;
            case 'desktop':
              backendResponse = await desktopApi.getSessionStatus(localSession.id, config);
              break;
            case 'viewer':
              backendResponse = await viewerApi.getSessionStatus(localSession.id, config);
              break;
            default:
              throw new Error(`Unknown service type: ${service}`);
          }
          
          if (backendResponse.success && backendResponse.data) {
            // Session exists and is running on backend
            console.log(`${service} session is running on backend`);
            sessions[service] = {
              ...localSession,
              status: 'running',
              lastUpdated: Date.now(),
              remainingTime: backendResponse.data.remainingTime?.toString()
            };
            
            // Update local storage with the confirmed status
            await chrome.storage.local.set({ [`${service}Session`]: sessions[service] });
          } else {
            // Session doesn't exist on backend anymore
            console.log(`${service} session not found on backend, clearing local session`);
            await chrome.storage.local.remove([`${service}Session`]);
            sessions[service] = null;
          }
        } else {
          // No local session
          console.log(`No local session for ${service}`);
          sessions[service] = null;
        }
              } catch (error) {
          console.error(`Error checking ${service} status:`, error);
          
          // For network errors or backend issues, preserve the local session instead of clearing it
          // This prevents losing session state when there are temporary network issues
          const localSession = await getCurrentSession(service);
          if (localSession && localSession.status === 'running') {
            console.log(`Preserving local session for ${service} due to backend error:`, error instanceof Error ? error.message : String(error));
            sessions[service] = localSession;
          } else {
            // Only clear if we don't have a valid local session
            console.log(`No valid local session for ${service}, setting to null`);
            sessions[service] = null;
          }
        }
    }

    return {
      success: true,
      sessions: {
        browser: sessions.browser,
        desktop: sessions.desktop,
        viewer: sessions.viewer
      }
    };
  } catch (error) {
    console.error('Failed to get service status:', error);
    throw error;
  }
}

// Helper function to get settings
async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(['settings']);
  return result.settings || DEFAULT_SETTINGS;
}

// Helper function to get current session
async function getCurrentSession(service: ServiceType): Promise<ServiceSession | null> {
  const result = await chrome.storage.local.get([`${service}Session`]);
  return result[`${service}Session`] || null;
}

// Function to stop a service using new API
async function handleStopService(service: ServiceType, sessionId: string): Promise<any> {
  console.log(`handleStopService called for ${service} with session ID ${sessionId}`);
  
  // Check if session is already being stopped to prevent double-stop
  if (stoppingSessions.has(sessionId)) {
    console.log(`Session ${sessionId} is already being stopped, returning success`);
    return { success: true, message: 'Session is already being stopped' };
  }
  
  const session = await getCurrentSession(service);
  
  if (!session) {
    console.warn(`No active session found for ${service}`);
    return { success: false, error: 'No active session found', code: 'NO_SESSION' };
  }

  console.log(`Got session for ${service}:`, session);
  
  // Mark session as being stopped
  stoppingSessions.add(sessionId);
  
  try {
    const config = await getApiConfig();
    
    let response;
    switch (service) {
      case 'browser':
        response = await browserApi.stopSession(sessionId, config);
        break;
      case 'desktop':
        response = await desktopApi.stopSession(sessionId, config);
        break;
      case 'viewer':
        response = await viewerApi.stopSession(sessionId, config);
        break;
      default:
        throw new Error(`Unknown service type: ${service}`);
    }

    // Remove the session from local storage immediately after stopping
    await chrome.storage.local.remove([`${service}Session`]);
    
    // If this was a browser session, close the associated tab
    if (service === 'browser') {
      await closeBrowserTab(sessionId);
    }
    
    console.log(`Successfully stopped ${service} session and removed from storage`);
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error in handleStopService:`, errorMessage);
    
    // Check if this is a 404 error (session not found)
    if (errorMessage.includes("404") || errorMessage.includes("Session not found")) {
      console.log(`Session ${sessionId} not found on backend, cleaning up local session`);
      
      // Remove the session from local storage since it doesn't exist on backend
      await chrome.storage.local.remove([`${service}Session`]);
      
      // If this was a browser session, close the associated tab
      if (service === 'browser') {
        await closeBrowserTab(sessionId);
      }
      
      console.log(`Successfully cleaned up local session ${sessionId} after 404 error`);
      return { success: true, message: 'Session was already stopped on backend' };
    }
    
    // For other errors, try to remove the local session anyway
    try {
      await chrome.storage.local.remove([`${service}Session`]);
      console.log(`Removed ${service} session from storage despite error`);
      
      // If this was a browser session, close the associated tab
      if (service === 'browser') {
        await closeBrowserTab(sessionId);
      }
    } catch (storageError) {
      console.error(`Failed to remove ${service} session from storage:`, storageError);
    }
    
    throw new Error(`Failed to stop ${service} session: ${errorMessage}`);
  } finally {
    // Always remove from stopping sessions set
    stoppingSessions.delete(sessionId);
  }
}

// Function to extend a service using new API
async function handleExtendService(service: ServiceType, sessionId: string, additionalSeconds: number): Promise<any> {
  const session = await getCurrentSession(service);
  if (!session) {
    return { success: false, error: 'No active session found', code: 'NO_SESSION' };
  }

  try {
    const config = await getApiConfig();
    
    // Debug logging to see what's being sent
    console.log('DEBUG: handleExtendService', {
      service,
      sessionId,
      additionalSeconds,
      additionalSecondsType: typeof additionalSeconds
    });
    
    let response;
    switch (service) {
      case 'browser':
        response = await browserApi.extendSession(sessionId, additionalSeconds, config);
        break;
      case 'desktop':
        response = await desktopApi.extendSession(sessionId, additionalSeconds, config);
        break;
      case 'viewer':
        response = await viewerApi.extendSession(sessionId, additionalSeconds, config);
        break;
      default:
        throw new Error(`Unknown service type: ${service}`);
    }

    if (response.success && response.data) {
      // Use the actual remaining time from the backend response
      const remainingSeconds = response.data.remainingMinutes * 60; // Convert minutes to seconds
      
      // Update the session with the actual remaining time from backend
      if (session) {
        session.remainingTime = remainingSeconds.toString();
        session.lastUpdated = Date.now();
        await chrome.storage.local.set({ [`${service}Session`]: session });
      }

      return {
        success: true,
        remainingSeconds: remainingSeconds,
        endTime: response.data.expiresAt
      };
    } else {
      throw new Error(response.error || `Failed to extend ${service} session`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to extend ${service} session: ${errorMessage}`);
  }
}

// Function to get remaining time using new API
async function handleGetRemainingTime(service: ServiceType, sessionId: string): Promise<any> {
  const session = await getCurrentSession(service);
  if (!session) {
    return { success: false, error: 'No active session found', code: 'NO_SESSION' };
  }

  try {
    const config = await getApiConfig();
    
    let response;
    switch (service) {
      case 'browser':
        response = await browserApi.getRemainingTime(sessionId, config);
        break;
      case 'desktop':
        response = await desktopApi.getRemainingTime(sessionId, config);
        break;
      case 'viewer':
        response = await viewerApi.getSessionStatus(sessionId, config);
        break;
      default:
        throw new Error(`Unknown service type: ${service}`);
    }

    // Special handling for 404 and 500 responses - these likely mean the session is gone
    if (!response.success && (response.error?.includes("404") || response.error?.includes("500"))) {
      // Also remove the local session since it's gone on the backend
      await chrome.storage.local.remove([`${service}Session`]);
      return {
        success: false,
        error: response.error || 'Session not found',
        code: 'SESSION_NOT_FOUND'
      };
    }

    if (response.success && response.data) {
      // For browser and desktop services, use the remaining_time endpoint
      if (service === 'browser' || service === 'desktop') {
        return {
          success: true,
          remainingSeconds: response.data.remainingSeconds,
          expiresAt: response.data.expiresAt,
          isExpired: response.data.isExpired
        };
      } else {
        // For other services, use the existing session status endpoint
        return {
          success: true,
          remainingSeconds: response.data.remainingTime,
          endTime: response.data.expiresAt
        };
      }
    } else {
      throw new Error(response.error || 'Failed to get remaining time');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get remaining time for ${service} session: ${errorMessage}`);
  }
}

// Function to close browser tab when session is stopped
async function closeBrowserTab(sessionId: string): Promise<void> {
  const tabId = browserSessionTabs.get(sessionId);
  if (tabId) {
    try {
      console.log(`Closing browser tab ${tabId} for session ${sessionId}`);
      await chrome.tabs.remove(tabId);
      
      // Clean up tracking
      browserSessionTabs.delete(sessionId);
      tabToSessionMap.delete(tabId);
      
      console.log(`Successfully closed browser tab ${tabId}`);
    } catch (error) {
      console.error(`Failed to close browser tab ${tabId}:`, error);
      // Tab might already be closed, clean up tracking anyway
      browserSessionTabs.delete(sessionId);
      tabToSessionMap.delete(tabId);
    }
  } else {
    console.log(`No tracked tab found for session ${sessionId}`);
  }
}

// Function to get API configuration with debug logging
async function getApiConfig(): Promise<ApiClientConfig> {
  try {
    const settings = await chrome.storage.local.get(['settings']);
    const defaultSettings = {
      apiUrl: 'http://localhost:4000'
    };
    
    const currentSettings = settings.settings || defaultSettings;
    
    // Debug logging
    console.log('DEBUG: getApiConfig called');
    console.log('DEBUG: settings from storage:', settings);
    console.log('DEBUG: currentSettings:', currentSettings);
    console.log('DEBUG: apiUrl:', currentSettings.apiUrl);
    
    // Ensure we always have a valid baseURL
    let apiUrl = currentSettings.apiUrl;
    
    // If apiUrl is undefined, null, or empty, use default
    if (!apiUrl || apiUrl === 'undefined' || apiUrl === 'null' || apiUrl.trim() === '') {
      console.log('DEBUG: apiUrl is invalid, using default');
      apiUrl = defaultSettings.apiUrl;
      
      // Update the settings to fix the issue
      const updatedSettings = { ...currentSettings, apiUrl: defaultSettings.apiUrl };
      await chrome.storage.local.set({ settings: updatedSettings });
      console.log('DEBUG: Updated settings with valid apiUrl');
    }
    
    const config = {
      baseURL: apiUrl,
      timeout: 10000
    };
    
    console.log('DEBUG: returning config:', config);
    
    return config;
  } catch (error) {
    console.error('ERROR in getApiConfig:', error);
    // Return a fallback configuration
    return {
      baseURL: 'http://localhost:4000',
      timeout: 10000
    };
  }
}

// Test function to debug API connectivity
async function testApiConnectivity() {
  console.log('=== TESTING API CONNECTIVITY ===');
  
  try {
    const config = await getApiConfig();
    console.log('Config received:', config);
    
    if (!config.baseURL) {
      console.error('ERROR: baseURL is undefined!');
      return;
    }
    
    console.log('Testing connection to:', config.baseURL);
    
    // Test health endpoint
    const response = await fetch(`${config.baseURL}/api/v1/health`);
    console.log('Health check response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Health check data:', data);
    } else {
      console.error('Health check failed:', response.statusText);
    }
    
  } catch (error) {
    console.error('API connectivity test failed:', error);
  }
  
  console.log('=== END API CONNECTIVITY TEST ===');
}

// Call the test function when extension starts
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started, testing API connectivity...');
  testApiConnectivity();
});

// Also test when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed, testing API connectivity...');
  setTimeout(testApiConnectivity, 1000); // Wait a bit for initialization
});

// Function to reset and reinitialize extension settings
async function resetExtensionSettings() {
  console.log('Resetting extension settings...');
  
  try {
    // Clear all storage
    await chrome.storage.local.clear();
    console.log('Storage cleared');
    
    // Reinitialize with default settings
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    console.log('Default settings reinitialized:', DEFAULT_SETTINGS);
    
    // Test the configuration
    const config = await getApiConfig();
    console.log('New config after reset:', config);
    
    return true;
  } catch (error) {
    console.error('Failed to reset settings:', error);
    return false;
  }
}

// Add a message handler for resetting settings
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'resetSettings') {
    resetExtensionSettings().then(success => {
      sendResponse({ success });
    });
    return true; // Keep the message channel open for async response
  }
});