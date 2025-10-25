/**
 * Popup script for the Disposable Services extension
 */

import { ServiceType, ServiceSession, ExtensionSettings, DesktopMachineType } from '../utils/types';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

class ServiceManager {
  private sessions: Record<ServiceType, ServiceSession>;
  private settings: ExtensionSettings;
  private timerIntervals: Record<ServiceType, number | undefined> = {} as Record<ServiceType, number | undefined>;
  private isInitialized = false;
  private sessionErrorCounts: Record<ServiceType, number> = { browser: 0, desktop: 0, viewer: 0 };

  constructor() {
    // Initialize sessions with default values
    this.sessions = {
      browser: this.createEmptySession(),
      desktop: this.createEmptySession(),
      viewer: this.createEmptySession()
    };

    // Initialize timerIntervals properly
    this.timerIntervals = {
      browser: undefined,
      desktop: undefined,
      viewer: undefined
    };

    // Initialize settings with defaults
    this.settings = {
      apiUrl: 'http://localhost:4000',
      apiKey: '', // No API key needed
      maxRetries: 3,
      retryDelay: 1000,
      sessionTimeout: 300000, // 5 minutes in milliseconds (matches backend default)
      theme: 'light',
      defaultDesktopMachineType: 'ubuntu'
    };

    // Initialize services and set up event listeners
    this.initializeServices().catch(console.error);
    this.setupEventListeners();
    this.startStatusPolling();
  }

  private createEmptySession(): ServiceSession {
    return {
      id: '',
      status: 'stopped',
      startTime: Date.now(),
      lastUpdated: Date.now()
    };
  }

  private async initializeServices() {
    try {
      console.log('Initializing services...');
      
      const result = await chrome.storage.local.get(['browserSession', 'desktopSession', 'viewerSession', 'settings']);
      
      // Update sessions only if they exist in storage
      if (result.browserSession) {
        console.log('Found browser session in storage:', result.browserSession);
        this.sessions.browser = result.browserSession;
      }
      if (result.desktopSession) {
        console.log('Found desktop session in storage:', result.desktopSession);
        this.sessions.desktop = result.desktopSession;
      }
      if (result.viewerSession) {
        console.log('Found viewer session in storage:', result.viewerSession);
        this.sessions.viewer = result.viewerSession;
      }

      // Update settings if available
      if (result.settings) {
        this.settings = { ...this.settings, ...result.settings };
      }

      // Apply theme if available
      if (this.settings.theme) {
        document.body.setAttribute('data-theme', this.settings.theme);
      }

      // Set initial machine type
      const machineTypeSelect = document.getElementById('desktop-machine-type') as HTMLSelectElement;
      if (machineTypeSelect) {
        machineTypeSelect.value = this.settings.defaultDesktopMachineType;
      }

      // Load settings values into the UI
      this.loadSettingsValues();

      // Update UI first with stored data
      this.updateAllUI();

      // Force a status check to sync with backend first (this is the key fix)
      console.log('Performing backend status check...');
      await this.forceStatusCheck();
      
      // Then refresh active session timers from backend
      console.log('Refreshing timers with backend data...');
      await this.refreshActiveSessionTimers();
      
      // Final UI update to ensure everything is in sync
      this.updateAllUI();
      
      this.isInitialized = true;
      
      console.log('Service initialization completed');
    } catch (error) {
      console.error('Failed to initialize services:', error);
      // Ensure UI is updated even if initialization fails
      this.updateAllUI();
      this.isInitialized = true;
    }
  }

  // Add this method to the ServiceManager class
  private async cleanupStaleSessions() {
    for (const serviceType of Object.keys(this.sessions) as ServiceType[]) {
      const session = this.sessions[serviceType];
      if (session?.status === 'running' && session.port) {
        try {
          // Try to access the service - if it fails, the container is probably gone
          const url = `http://localhost:${session.port}/health-check`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000);
          
          try {
            await fetch(url, { signal: controller.signal });
            console.log(`Service ${serviceType} is still accessible at port ${session.port}`);
          } catch (fetchError) {
            console.log(`Service ${serviceType} is not responding - cleaning up stale session`);
            await this.handleExpiredSession(serviceType);
          } finally {
            clearTimeout(timeoutId);
          }
        } catch (error) {
          console.error(`Error checking ${serviceType} service:`, error);
        }
      }
    }
  }

  // Add this new method to refresh timers when popup opens
  private async refreshActiveSessionTimers() {
    console.log('Refreshing active session timers...');
    for (const serviceType of Object.keys(this.sessions) as ServiceType[]) {
      const session = this.sessions[serviceType];
      if (session?.status === 'running' && session.id) {
        console.log(`Refreshing timer for ${serviceType} session ${session.id}`);
        try {
          const response = await new Promise<any>((resolve, reject) => {
            chrome.runtime.sendMessage({ 
              action: `get${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}RemainingTime`,
              sessionId: session.id 
            }, (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              resolve(response);
            });
          });

          if (response?.success && response?.remainingSeconds !== undefined) {
            // Update remaining time in the session object
            this.sessions[serviceType].remainingTime = response.remainingSeconds.toString();
            await chrome.storage.local.set({ [`${serviceType}Session`]: this.sessions[serviceType] });
            
            // Restart timer with current time from the backend
            const remainingSeconds = parseInt(response.remainingSeconds);
            if (!isNaN(remainingSeconds) && remainingSeconds > 0) {
              console.log(`Updated ${serviceType} timer with ${remainingSeconds} seconds remaining`);
              
              // Update UI with fresh timer data
              const timerElement = document.getElementById(`${serviceType}-timer`);
              if (timerElement) {
                const minutes = Math.floor(remainingSeconds / 60);
                const seconds = remainingSeconds % 60;
                timerElement.textContent = `${minutes}m ${seconds}s remaining`;
                
                // Add warning class if needed
                if (remainingSeconds < 300 && !timerElement.classList.contains('timer-warning')) {
                  timerElement.classList.add('timer-warning');
                }
              }
              
              // Start the timer with the exact time from backend
              this.startSessionTimer(serviceType, remainingSeconds);
            } else if (remainingSeconds <= 0) {
              console.log(`${serviceType} session has expired (0 or negative time)`);
              await this.handleExpiredSession(serviceType);
            }
          } else if (response?.error && (
            response.error.includes("404") || 
            response.error.includes("500") ||
            response.error.includes("Session not found")
          )) {
            // Session is no longer valid on the backend - mark as stopped
            console.log(`Session ${session.id} for ${serviceType} is no longer valid on the backend`);
            await this.handleExpiredSession(serviceType);
          } else {
            console.log(`No valid remaining time data for ${serviceType}, checking if session is still running`);
            // Try to get session status to see if it's still running
            try {
              const statusResponse = await new Promise<any>((resolve) => {
                chrome.runtime.sendMessage({ action: 'getServiceStatus' }, resolve);
              });
              
              if (statusResponse?.success && statusResponse.sessions?.[serviceType]?.status === 'running') {
                console.log(`${serviceType} session is still running, using stored time or default`);
                // Use stored time if available, otherwise use default
                const storedTime = session.remainingTime ? parseInt(session.remainingTime) : 300;
                if (storedTime > 0) {
                  this.startSessionTimer(serviceType, storedTime);
                } else {
                  this.startSessionTimer(serviceType, 300); // 5 minutes default
                }
              } else {
                console.log(`${serviceType} session is not running, marking as stopped`);
                await this.handleExpiredSession(serviceType);
              }
            } catch (statusError) {
              console.error(`Failed to check ${serviceType} status:`, statusError);
              // Use stored time as fallback
              const storedTime = session.remainingTime ? parseInt(session.remainingTime) : 300;
              if (storedTime > 0) {
                this.startSessionTimer(serviceType, storedTime);
              }
            }
          }
        } catch (error) {
          console.error(`Failed to refresh timer for ${serviceType}:`, error);
          // If we get an error, try to use stored time
          const storedTime = session.remainingTime ? parseInt(session.remainingTime) : 300;
          if (storedTime > 0) {
            console.log(`Using stored time for ${serviceType}: ${storedTime} seconds`);
            this.startSessionTimer(serviceType, storedTime);
          } else {
            console.log(`No stored time for ${serviceType}, using default`);
            this.startSessionTimer(serviceType, 300);
          }
        }
      }
    }
  }

  // Force a status check to sync with backend
  private async forceStatusCheck() {
    try {
      console.log('Performing force status check to sync with backend...');
      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getServiceStatus' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      });

      if (response?.success && response.sessions) {
        let hasChanges = false;
        console.log('Backend status response:', response.sessions);
        
        Object.entries(response.sessions).forEach(([service, session]) => {
          if (service in this.sessions && session && typeof session === 'object') {
            // Only update if we have a valid session from backend
            if ('id' in session && 'status' in session && session.id && session.status) {
              const currentSession = this.sessions[service as ServiceType];
              const newStatus = session.status as 'stopped' | 'starting' | 'running' | 'error';
              
              // Update session with backend data
              if (currentSession.status !== newStatus || currentSession.id !== session.id) {
                console.log(`Syncing ${service} session with backend: status=${newStatus}, id=${session.id}`);
                hasChanges = true;
                this.sessions[service as ServiceType] = {
                  ...currentSession,
                  id: session.id as string,
                  status: newStatus,
                  lastUpdated: Date.now(),
                  remainingTime: (session as any).remainingTime || currentSession.remainingTime
                };
                
                // Update storage with the new session data
                chrome.storage.local.set({ [`${service}Session`]: this.sessions[service as ServiceType] }).catch(console.error);
              } else {
                console.log(`${service} session status unchanged: ${newStatus}`);
              }
            } else if (session === null) {
              // Backend reports no session, but we might have one locally
              const currentSession = this.sessions[service as ServiceType];
              // Only clear if we have a running session that the backend doesn't know about
              // This prevents clearing sessions due to temporary network issues
              if (currentSession.status === 'running' && currentSession.id) {
                console.log(`Backend reports no ${service} session, but preserving local session to prevent data loss`);
                // Don't clear the session immediately - let the timer polling handle expiration
                // This prevents losing session state when there are temporary network issues
              } else if (currentSession.status !== 'stopped') {
                console.log(`Backend reports no ${service} session, clearing local session`);
                hasChanges = true;
                this.sessions[service as ServiceType] = this.createEmptySession();
                chrome.storage.local.set({ [`${service}Session`]: this.sessions[service as ServiceType] }).catch(console.error);
              }
            }
          }
        });
        
        // Update UI if there were changes
        if (hasChanges) {
          console.log('Session state changed, updating UI...');
          this.updateAllUI();
        } else {
          console.log('No session state changes detected');
        }
      } else {
        console.log('No valid response from backend status check');
      }
    } catch (error) {
      console.error('Failed to force status check:', error);
      // Fallback: use local sessions if backend check fails
      console.log('Using local session data as fallback');
    }
  }

  private setupEventListeners() {
    // Browser service
    document.getElementById('browser-start')?.addEventListener('click', () => this.startService('browser'));
    document.getElementById('browser-retry')?.addEventListener('click', () => this.retryService('browser'));
    document.getElementById('browser-stop')?.addEventListener('click', () => this.stopService('browser'));
    document.getElementById('browser-extend')?.addEventListener('click', () => this.extendService('browser'));

    // Desktop service
    document.getElementById('desktop-start')?.addEventListener('click', () => this.startService('desktop'));
    document.getElementById('desktop-retry')?.addEventListener('click', () => this.retryService('desktop'));
    document.getElementById('desktop-stop')?.addEventListener('click', () => this.stopService('desktop'));
    document.getElementById('desktop-extend')?.addEventListener('click', () => this.extendService('desktop'));
    
    // Machine type selector
    const machineTypeSelect = document.getElementById('desktop-machine-type') as HTMLSelectElement;
    machineTypeSelect?.addEventListener('change', (event) => {
      const select = event.target as HTMLSelectElement;
      this.settings.defaultDesktopMachineType = select.value as DesktopMachineType;
      chrome.storage.local.set({ settings: this.settings }).catch(console.error);
    });

    // Viewer service
    document.getElementById('viewer-start')?.addEventListener('click', () => this.startService('viewer'));
    document.getElementById('viewer-retry')?.addEventListener('click', () => this.retryService('viewer'));
    document.getElementById('viewer-stop')?.addEventListener('click', () => this.stopService('viewer'));
    document.getElementById('viewer-extend')?.addEventListener('click', () => this.extendService('viewer'));

    // Settings button
    document.getElementById('settingsBtn')?.addEventListener('click', () => {
      this.openSettings();
    });

    // Modal close button
    document.getElementById('closeModal')?.addEventListener('click', () => {
      this.closeModal();
    });

    // Modal overlay click to close
    document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('modalOverlay')) {
        this.closeModal();
      }
    });

    // Settings form controls
    const sessionDuration = document.getElementById('sessionDuration') as HTMLInputElement;
    if (sessionDuration) {
      sessionDuration.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const valueElement = document.getElementById('sessionDurationValue');
        if (valueElement) {
          valueElement.textContent = target.value;
        }
        this.saveSettings();
      });
    }

    const enableNotifications = document.getElementById('enableNotifications') as HTMLInputElement;
    if (enableNotifications) {
      enableNotifications.addEventListener('change', () => {
        this.saveSettings();
      });
    }

    const autoStart = document.getElementById('autoStart') as HTMLInputElement;
    if (autoStart) {
      autoStart.addEventListener('change', () => {
        this.saveSettings();
      });
    }

    const defaultDistro = document.getElementById('defaultDistro') as HTMLSelectElement;
    if (defaultDistro) {
      defaultDistro.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const machineTypeSelect = document.getElementById('desktop-machine-type') as HTMLSelectElement;
        if (machineTypeSelect) {
          machineTypeSelect.value = target.value;
        }
        this.saveSettings();
      });
    }

    const showWarnings = document.getElementById('showWarnings') as HTMLInputElement;
    if (showWarnings) {
      showWarnings.addEventListener('change', () => {
        this.saveSettings();
      });
    }

    // Keyboard navigation
    document.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'Enter':
          const activeButton = document.activeElement as HTMLButtonElement;
          if (activeButton?.classList.contains('primary-btn') && !activeButton.disabled) {
            activeButton.click();
          }
          break;
        case 'Escape':
          this.closeModal();
          break;
      }
    });

    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    console.log("Event listeners setup completed");
  }

  private updateUI(service: ServiceType) {
    const session = this.sessions[service];
    const statusElement = document.getElementById(`${service}-status`) as HTMLSpanElement;
    const startButton = document.getElementById(`${service}-start`) as HTMLButtonElement;
    const retryButton = document.getElementById(`${service}-retry`) as HTMLButtonElement;
    const messageElement = document.getElementById(`${service}-message`) as HTMLDivElement;
    
    // Get session control elements
    const sessionControlsElement = document.getElementById(`${service}-session-controls`) as HTMLDivElement;
    const stopButton = document.getElementById(`${service}-stop`) as HTMLButtonElement;
    const extendButton = document.getElementById(`${service}-extend`) as HTMLButtonElement;
    const timerElement = document.getElementById(`${service}-timer`) as HTMLDivElement;

    if (!statusElement || !startButton || !retryButton || !messageElement) {
      console.warn(`Missing required UI elements for ${service}`);
      return;
    }

    // Update status display
    statusElement.textContent = session.status.charAt(0).toUpperCase() + session.status.slice(1);
    statusElement.className = `status-badge ${session.status}`;

    // Reset all buttons to default state
    startButton.disabled = false;
    retryButton.style.display = 'none';
    messageElement.style.display = 'none';
    
    // Hide session controls by default
    if (sessionControlsElement) {
      sessionControlsElement.style.display = 'none';
    }

    switch (session.status) {
      case 'stopped':
        console.log(`Updating UI for ${service}: status=stopped, showing start button`);
        const stoppedBtnText = startButton.querySelector('.btn-text');
        if (stoppedBtnText) {
          stoppedBtnText.textContent = `Start ${service.charAt(0).toUpperCase() + service.slice(1)}`;
        }
        startButton.style.display = 'block';
        startButton.disabled = false;
        
        // Ensure session controls are hidden for stopped services
        if (sessionControlsElement) {
          sessionControlsElement.style.display = 'none';
        }
        if (stopButton) {
          stopButton.style.display = 'none';
        }
        if (extendButton) {
          extendButton.style.display = 'none';
        }
        if (timerElement) {
          timerElement.style.display = 'none';
        }
        break;
        
      case 'starting':
        startButton.disabled = true;
        startButton.innerHTML = '<span class="loading-spinner"></span> Launching...';
        messageElement.style.display = 'block';
        messageElement.innerHTML = `${service.charAt(0).toUpperCase() + service.slice(1)} is launching, please wait...`;
        messageElement.className = 'status';
        
        // For browser service, show session controls even during starting state
        // since the session is actually running on the backend
        if (service === 'browser' && session.id) {
          if (sessionControlsElement) {
            sessionControlsElement.style.display = 'block';
            
            // Enable stop and extend buttons
            if (stopButton) {
              stopButton.disabled = false;
              stopButton.textContent = 'Stop Session';
              stopButton.style.display = 'block';
            }
            if (extendButton) {
              extendButton.disabled = false;
              extendButton.textContent = 'Extend (+5m)';
              extendButton.style.display = 'block';
            }
            
            // Show timer if available
            if (timerElement) {
              timerElement.style.display = 'block';
              if (session.remainingTime) {
                const remainingSeconds = parseInt(session.remainingTime);
                if (!isNaN(remainingSeconds)) {
                  const minutes = Math.floor(remainingSeconds / 60);
                  const seconds = remainingSeconds % 60;
                  timerElement.textContent = `${minutes}m ${seconds}s remaining`;
                  this.startSessionTimer(service, remainingSeconds);
                }
              } else {
                timerElement.textContent = 'Session active';
              }
            }
          }
        }
        break;
        
      case 'running':
        startButton.disabled = true;
        startButton.style.display = 'none'; // Hide start button when running
        
        // For desktop service, show which machine is running
        if (service === 'desktop' && session.machineType) {
          const machineDisplayName = {
            'ubuntu': 'Ubuntu Desktop',
            'debian': 'Debian Desktop',
            'fedora': 'Fedora Desktop',
            'alpine': 'Alpine Desktop',
            'arch': 'Arch Desktop'
          }[session.machineType] || session.machineType;
          
          const runningBtnText = startButton.querySelector('.btn-text');
          if (runningBtnText) {
            runningBtnText.textContent = `${machineDisplayName} Running`;
          }
        } else {
          const runningBtnText = startButton.querySelector('.btn-text');
          if (runningBtnText) {
            runningBtnText.textContent = `${service.charAt(0).toUpperCase() + service.slice(1)} Running`;
          }
        }
        
        // Show session information
        messageElement.style.display = 'block';
        
        // Enhanced message with session information
        let infoMessage = `${service.charAt(0).toUpperCase() + service.slice(1)} session is active`;
        
        if (session.backendStartTime) {
          const startTime = new Date(session.backendStartTime);
          infoMessage += `<br>Started: ${startTime.toLocaleString()}`;
        }
        
        if (session.location) {
          infoMessage += `<br>Location: ${session.location}`;
        }
        
        messageElement.innerHTML = infoMessage;
        messageElement.className = 'status success';
        
        // Show session controls for running services
        if (sessionControlsElement) {
          sessionControlsElement.style.display = 'block';
          
          // Enable stop and extend buttons
          if (stopButton) {
            stopButton.disabled = false;
            stopButton.textContent = 'Stop Session';
            stopButton.style.display = 'block';
          }
          if (extendButton) {
            extendButton.disabled = false;
            extendButton.textContent = 'Extend (+5m)';
            extendButton.style.display = 'block';
          }
          
          // Update timer if we have remaining time info
          if (timerElement) {
            timerElement.style.display = 'block';
            if (session.remainingTime) {
              const remainingSeconds = parseInt(session.remainingTime);
              if (!isNaN(remainingSeconds)) {
                const minutes = Math.floor(remainingSeconds / 60);
                const seconds = remainingSeconds % 60;
                timerElement.textContent = `${minutes}m ${seconds}s remaining`;
                
                // Add warning class if needed
                if (remainingSeconds < 300 && !timerElement.classList.contains('timer-warning')) {
                  timerElement.classList.add('timer-warning');
                }
                
                // Start countdown timer
                this.startSessionTimer(service, remainingSeconds);
              }
            } else {
              // If no remaining time, show default message
              timerElement.textContent = 'Session active';
            }
          }
        }
        break;
        
      case 'error':
        const errorBtnText = startButton.querySelector('.btn-text');
        if (errorBtnText) {
          errorBtnText.textContent = `Start ${service.charAt(0).toUpperCase() + service.slice(1)}`;
        }
        startButton.style.display = 'block';
        startButton.disabled = false;
        messageElement.style.display = 'block';
        messageElement.innerHTML = `Error: ${session.error}`;
        messageElement.className = 'status error';
        retryButton.style.display = 'block';
        
        // Hide session controls for error state
        if (sessionControlsElement) {
          sessionControlsElement.style.display = 'none';
        }
        break;
    }
    
    console.log(`Updated UI for ${service}: status=${session.status}, controls visible=${sessionControlsElement?.style.display === 'block'}`);
  }

  private updateAllUI() {
    (Object.keys(this.sessions) as ServiceType[]).forEach(service => this.updateUI(service));
  }

  private async startService(service: ServiceType, retryCount = 0): Promise<void> {
    try {
      const startButton = document.getElementById(`${service}-start`) as HTMLButtonElement;
      const messageElement = document.getElementById(`${service}-message`) as HTMLDivElement;

      // Special handling for viewer service - open upload page instead of starting directly
      if (service === 'viewer') {
        // Immediately disable the button to prevent multiple clicks
        if (startButton.disabled) {
          return; // Exit early if button is already disabled (prevents double execution)
        }
        
        startButton.disabled = true;
        
        // Use a unique ID to track if a viewer tab is already being opened
        const viewerTabFlag = 'viewerTabOpening';
        
        // Check if we're already in the process of opening a tab
        if (sessionStorage.getItem(viewerTabFlag)) {
          console.log('Already opening a viewer tab, ignoring duplicate request');
          
          // Re-enable button after a delay
          setTimeout(() => {
            startButton.disabled = false;
          }, 1000);
          
          return;
        }
        
        // Set the flag to prevent duplicate tabs
        sessionStorage.setItem(viewerTabFlag, 'true');
        
        // Log the URL for debugging
        const url = chrome.runtime.getURL('viewer-upload.html');
        console.log('Opening viewer upload page at:', url);
        
        // Small timeout to ensure the UI has time to update
        setTimeout(() => {
          // Open the upload interface in a new tab
          chrome.tabs.create({ url });
          
          // Clear the flag after a delay
          setTimeout(() => {
            sessionStorage.removeItem(viewerTabFlag);
            startButton.disabled = false;
          }, 1000);
        }, 100);
        
        return;
      }

      // Show loading state and prevent double-clicking
      startButton.disabled = true;
      startButton.innerHTML = '<span class="spinner"></span> Starting...';
      messageElement.style.display = 'block';
      messageElement.innerHTML = `Preparing your disposable ${service}...`;
      messageElement.className = 'status';
      
      // Add a flag to prevent multiple simultaneous requests
      const requestKey = `${service}_start_request`;
      if (sessionStorage.getItem(requestKey)) {
        console.log(`Start request already in progress for ${service}`);
        startButton.disabled = false;
        startButton.innerHTML = 'Start Browser';
        return;
      }
      sessionStorage.setItem(requestKey, 'true');
      
      // Add a timeout to clear the flag in case of issues (30 seconds)
      setTimeout(() => {
        sessionStorage.removeItem(requestKey);
      }, 30000);

      // Get machine type for desktop service
      const machineType = service === 'desktop' 
        ? (document.getElementById('desktop-machine-type') as HTMLSelectElement).value as DesktopMachineType
        : undefined;

      console.log(`Starting ${service} service with machine type:`, machineType);
      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage({ 
          action: `start${service.charAt(0).toUpperCase() + service.slice(1)}Service`,
          machineType // Include machine type in the message
        }, (response) => {
          console.log(`${service} service response:`, response);
          if (chrome.runtime.lastError) {
            console.error(`${service} service error:`, chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      });

      if (response?.success) {
        console.log(`Service ${service} started successfully with session ID: ${response.sessionId}`);
        
        // Store session info right away
        this.sessions[service] = {
          id: response.sessionId,
          status: 'starting', // Will be updated to 'running' after delay
          port: response.port,
          startTime: Date.now(),
          lastUpdated: Date.now(),
          machineType: service === 'desktop' ? machineType : undefined,
          browserUrl: response.browserUrl, // Store the browser URL
          desktopUrl: response.desktopUrl // Store the desktop URL
        };
        await chrome.storage.local.set({ [`${service}Session`]: this.sessions[service] });
        
        // Update UI to show loading state
        this.updateUI(service);
        
        console.log(`Session created for ${service}:`, this.sessions[service]);

        if (response.browserUrl || response.desktopUrl) {
          // Update session info
          this.sessions[service].browserUrl = response.browserUrl;
          this.sessions[service].desktopUrl = response.desktopUrl;
          chrome.storage.local.set({ [`${service}Session`]: this.sessions[service] });
          
          // Update UI to show starting state
          this.updateUI(service);
          
          // Clear the request flag on success
          sessionStorage.removeItem(`${service}_start_request`);
          
          // Open the tab after a delay to allow container to be ready
          // Desktop containers need more time to start up than browser containers
          const delay = service === 'desktop' ? 8000 : 2000; // 8 seconds for desktop, 2 for browser
          setTimeout(() => {
            // Update to running state after delay
            this.sessions[service].status = 'running';
            this.sessions[service].lastUpdated = Date.now();
            chrome.storage.local.set({ [`${service}Session`]: this.sessions[service] });
            
            // Update UI to show running state
            this.updateUI(service);
            
            // Start session timer with actual remaining time from backend
            const remainingSeconds = response.remainingMinutes ? response.remainingMinutes * 60 : 300; // Use backend time or default to 5 minutes
            this.startSessionTimer(service, remainingSeconds);
            
            const urlToOpen = response.desktopUrl || response.browserUrl;
            chrome.tabs.create({ url: urlToOpen }, (tab) => {
              console.log(`${service} tab opened for session`);
              
              // Track this tab for automatic cleanup
              if (tab.id && response.sessionId) {
                // Send message to background script to track this tab based on service type
                const trackingAction = service === 'desktop' ? 'trackDesktopTab' : 'trackBrowserTab';
                chrome.runtime.sendMessage({
                  action: trackingAction,
                  sessionId: response.sessionId,
                  tabId: tab.id
                });
              }
            });
          }, delay);
        } else {
          // Handle case where URL is missing
          this.sessions[service].status = 'error';
          this.sessions[service].error = `Missing ${service === 'desktop' ? 'desktopUrl' : 'browserUrl'} in service response`;
          chrome.storage.local.set({ [`${service}Session`]: this.sessions[service] });
          this.updateUI(service);
          
          // Clear the request flag on error
          sessionStorage.removeItem(`${service}_start_request`);
        }
      } else {
        throw new Error(response?.error || `Failed to start ${service} session`);
      }
    } catch (error) {
      // Clear the request flag on error
      sessionStorage.removeItem(`${service}_start_request`);
      
      if (retryCount < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        setTimeout(() => this.startService(service, retryCount + 1), delay);
      } else {
        this.sessions[service] = {
          ...this.sessions[service],
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          lastUpdated: Date.now()
        };
        await chrome.storage.local.set({ [`${service}Session`]: this.sessions[service] });
        this.updateUI(service);
      }
    }
  }

  private async retryService(service: ServiceType) {
    this.sessions[service] = this.createEmptySession();
    this.updateUI(service);
    await this.startService(service);
  }

  private startStatusPolling() {
    // Main status polling
    setInterval(async () => {
      try {
        const response = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({ action: 'getServiceStatus' }, resolve);
        });

        if (response?.success && response.sessions) {
          let hasChanges = false;
          Object.entries(response.sessions).forEach(([service, session]) => {
            if (service in this.sessions && session && typeof session === 'object') {
              // Only update if we have a valid session from backend
              if ('id' in session && 'status' in session && session.id && session.status) {
                const currentSession = this.sessions[service as ServiceType];
                const newStatus = session.status as 'stopped' | 'starting' | 'running' | 'error';
                
                // Only update if status actually changed
                if (currentSession.status !== newStatus) {
                  console.log(`Status changed for ${service}: ${currentSession.status} -> ${newStatus}`);
                  
                  // Allow status changes, including to 'stopped' when backend confirms session is stopped
                  hasChanges = true;
                  this.sessions[service as ServiceType] = {
                    ...currentSession, // Keep local UI state
                    id: session.id as string,
                    status: newStatus,
                    lastUpdated: Date.now()
                  };
                  
                  // If session is stopped, clear timer
                  if (newStatus === 'stopped') {
                    if (this.timerIntervals && this.timerIntervals[service as ServiceType]) {
                      clearInterval(this.timerIntervals[service as ServiceType]);
                      this.timerIntervals[service as ServiceType] = undefined;
                    }
                  }
                }
              }
            }
          });
          
          // Only update UI if there were actual changes
          if (hasChanges) {
            this.updateAllUI();
          }
        }
      } catch (error) {
        console.error('Failed to check service status:', error);
        // Don't update UI on error to prevent flickering
      }
    }, 8000);
    
    // Timer polling to update remaining time
    setInterval(async () => {
      try {
        for (const serviceType of Object.keys(this.sessions) as ServiceType[]) {
          const session = this.sessions[serviceType];
          if (session?.status === 'running' && session.id) {
            const response = await new Promise<any>((resolve) => {
              chrome.runtime.sendMessage({ 
                action: `get${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}RemainingTime`,
                sessionId: session.id 
              }, resolve);
            });

            if (response?.success && response?.remainingSeconds !== undefined) {
              // Update remaining time without changing UI
              this.sessions[serviceType].remainingTime = response.remainingSeconds.toString();
              await chrome.storage.local.set({ [`${serviceType}Session`]: this.sessions[serviceType] });
              
              // Check if session has expired (0 or negative seconds)
              const remainingSeconds = parseInt(response.remainingSeconds);
              if (remainingSeconds <= 0) {
                console.log(`${serviceType} session has expired, immediately handling expiration`);
                await this.immediateSessionExpiration(serviceType);
              } else {
                // Restart timer with new time
                this.startSessionTimer(serviceType, remainingSeconds);
              }
            } else if (response?.error && (
              response.error.includes("404") || 
              response.error.includes("500") ||
              response.error.includes("Session not found")
            )) {
              // Increment error count for this service
              this.sessionErrorCounts[serviceType]++;
              console.log(`Session ${session.id} for ${serviceType} returned error: ${response.error} (error count: ${this.sessionErrorCounts[serviceType]})`);
              
              // Only mark as expired after 3 consecutive errors to prevent false positives
              if (this.sessionErrorCounts[serviceType] >= 3) {
                console.log(`Session ${session.id} for ${serviceType} has ${this.sessionErrorCounts[serviceType]} consecutive errors, marking as expired`);
                await this.handleExpiredSession(serviceType);
                this.sessionErrorCounts[serviceType] = 0; // Reset error count
              }
            } else {
              // Reset error count on successful response
              this.sessionErrorCounts[serviceType] = 0;
            }
          }
        }
      } catch (error) {
        console.error('Failed to update remaining time:', error);
      }
    }, 10000); // Check every 10 seconds (more frequent)
  }

  // Add this new method to handle session timer countdown
  private startSessionTimer(service: ServiceType, initialSeconds: number) {
    // Clear any existing timer for this service
    if (this.timerIntervals[service]) {
      clearInterval(this.timerIntervals[service]);
      this.timerIntervals[service] = undefined;
    }
    
    let remainingSeconds = initialSeconds;
    const timerElement = document.getElementById(`${service}-timer`) as HTMLDivElement;
    
    if (!timerElement) return;
    
    this.timerIntervals[service] = window.setInterval(() => {
      remainingSeconds--;
      
      if (remainingSeconds <= 0) {
        if (this.timerIntervals[service]) {
          clearInterval(this.timerIntervals[service]);
          this.timerIntervals[service] = undefined;
        }
        remainingSeconds = 0;
        
        console.log(`Session timer expired for ${service}, immediately stopping container and closing tab`);
        
        // Immediately stop the container and close the tab when timer reaches zero
        this.immediateSessionExpiration(service);
      }
      
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      timerElement.textContent = `${minutes}m ${seconds}s remaining`;
      
      // Add warning class when less than 5 minutes remain
      if (remainingSeconds < 300 && !timerElement.classList.contains('timer-warning')) {
        timerElement.classList.add('timer-warning');
      }
    }, 1000);
  }

  // New method to handle immediate session expiration
  private async immediateSessionExpiration(service: ServiceType) {
    console.log(`Immediate session expiration for ${service}`);
    
    const session = this.sessions[service];
    if (!session || !session.id) {
      console.log(`No active session found for ${service}`);
      return;
    }

    try {
      // Immediately stop the container on the backend
      console.log(`Stopping container for ${service} session ${session.id}`);
      await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: `stop${service.charAt(0).toUpperCase() + service.slice(1)}Service`,
          sessionId: session.id
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      });

      console.log(`Successfully stopped ${service} container`);
      
      // Handle expired session (this will also close the tab via background script)
      await this.handleExpiredSession(service);
      
    } catch (error) {
      console.error(`Failed to immediately stop ${service} container:`, error);
      // Fallback to normal expired session handling
      await this.handleExpiredSession(service);
    }
  }

  // Handle expired session: reset session, update storage, clear timer, and update UI
  private async handleExpiredSession(service: ServiceType) {
    console.log(`Handling expired session for ${service}`);
    
    // Get the session ID before resetting the session
    const sessionId = this.sessions[service].id;
    
    // Clear timer if it exists
    if (this.timerIntervals && this.timerIntervals[service]) {
      clearInterval(this.timerIntervals[service]);
      this.timerIntervals[service] = undefined;
    }

    // Reset session state
    this.sessions[service] = this.createEmptySession();
    
    // Update storage to reflect stopped state
    await chrome.storage.local.set({ [`${service}Session`]: this.sessions[service] });
    
    // If this was a browser session, notify background script to close the tab
    if (service === 'browser' && sessionId) {
      chrome.runtime.sendMessage({
        action: 'sessionExpired',
        service: 'browser',
        sessionId: sessionId
      });
    }
    
    // Force a backend check to ensure we're in sync
    try {
      await this.forceStatusCheck();
    } catch (error) {
      console.error(`Failed to sync with backend after session expiration for ${service}:`, error);
    }

    // Update UI to reflect stopped state
    this.updateUI(service);
    
    console.log(`Session ${service} marked as stopped and UI updated`);
  }

  // Helper method to show notifications without duplicates
  private showNotification(service: ServiceType, type: 'success' | 'error', message: string) {
    const serviceElement = document.getElementById(`${service}-service`);
    if (!serviceElement) return;

    // Remove any existing notifications first
    const existingNotifications = serviceElement.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    // Create new notification
    const notificationEl = document.createElement('div');
    notificationEl.className = `notification ${type}`;
    notificationEl.innerHTML = `
      <strong>${message.split('.')[0]}.</strong>
      <br>
      <small>${message.split('.')[1] || ''}</small>
    `;
    
    // Insert at the beginning of the service element
    if (serviceElement.firstChild) {
      serviceElement.insertBefore(notificationEl, serviceElement.firstChild);
    } else {
      serviceElement.appendChild(notificationEl);
    }
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notificationEl.parentNode) {
        notificationEl.style.opacity = '0';
        setTimeout(() => {
          if (notificationEl.parentNode) {
            notificationEl.remove();
          }
        }, 500);
      }
    }, 5000);
  }

  // Add these methods to stop and extend sessions
  private async extendService(service: ServiceType, minutes: number = 5) {
    console.log(`extendService called for ${service}`);

    try {
      const session = this.sessions[service];
      if (!session || !session.id) {
        console.error(`Cannot extend ${service}: No active session found`);
        return;
      }

      // Disable the extend button to prevent double-clicks
      const extendButton = document.getElementById(`${service}-extend`) as HTMLButtonElement;
      if (extendButton) {
        extendButton.disabled = true;
        extendButton.textContent = 'Extending...';
      }

      // Calculate additional seconds (5 minutes = 300 seconds)
      const additionalSeconds = minutes * 60;

      // Debug logging to see what's being calculated
      console.log('DEBUG: extendService', {
        service,
        minutes,
        additionalSeconds,
        additionalSecondsType: typeof additionalSeconds
      });

      // Send extend request to background script
      const response = await new Promise<any>((resolve, reject) => {
        const message = {
          action: `extend${service.charAt(0).toUpperCase() + service.slice(1)}Service`,
          sessionId: session.id,
          additionalSeconds: additionalSeconds  // Include this parameter
        };
        
        console.log('Sending extend message:', message);
        
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      });

      if (response?.success && response?.remainingSeconds) {
        // Update session with new remaining time from backend
        this.sessions[service].remainingTime = response.remainingSeconds.toString();
        await chrome.storage.local.set({ [`${service}Session`]: this.sessions[service] });
        
        // Update the timer with the new total remaining time from backend
        const newTotalRemainingSeconds = parseInt(response.remainingSeconds);
        if (!isNaN(newTotalRemainingSeconds) && newTotalRemainingSeconds > 0) {
          this.extendSessionTimer(service, newTotalRemainingSeconds);
        }
        
        // Re-enable the extend button
        const extendButton = document.getElementById(`${service}-extend`) as HTMLButtonElement;
        if (extendButton) {
          extendButton.disabled = false;
          extendButton.textContent = 'Extend (+5m)';
        }
        
        // Show success message with remaining time
        const remainingMinutes = Math.round(newTotalRemainingSeconds / 60);
        this.showNotification(service, 'success', `${service.charAt(0).toUpperCase() + service.slice(1)} session extended successfully. Session now has ${remainingMinutes} minutes remaining.`);
      } else {
        throw new Error(response?.error || `Failed to extend ${service} session`);
      }
    } catch (error) {
      console.error(`Failed to extend ${service}:`, error);
      
      // Re-enable the extend button
      const extendButton = document.getElementById(`${service}-extend`) as HTMLButtonElement;
      if (extendButton) {
        extendButton.disabled = false;
        extendButton.textContent = 'Extend (+5m)';
      }
      
      // Show error notification
      this.showNotification(service, 'error', `Failed to extend ${service}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // New method to extend timer without restarting the countdown
  private extendSessionTimer(service: ServiceType, newTotalRemainingSeconds: number) {
    console.log(`Extending ${service} timer to ${newTotalRemainingSeconds} seconds total`);
    
    const timerElement = document.getElementById(`${service}-timer`) as HTMLDivElement;
    if (!timerElement) return;
    
    // Clear existing timer
    if (this.timerIntervals[service]) {
      clearInterval(this.timerIntervals[service]);
      this.timerIntervals[service] = undefined;
    }
    
    // Start new timer with the total remaining time from backend
    let remainingSeconds = newTotalRemainingSeconds;
    
    // Update the display immediately
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    timerElement.textContent = `${minutes}m ${seconds}s remaining`;
    
    // Add warning class when less than 5 minutes remain
    if (remainingSeconds < 300 && !timerElement.classList.contains('timer-warning')) {
      timerElement.classList.add('timer-warning');
    }
    
    // Start the countdown timer
    this.timerIntervals[service] = window.setInterval(() => {
      remainingSeconds--;
      
      if (remainingSeconds <= 0) {
        if (this.timerIntervals[service]) {
          clearInterval(this.timerIntervals[service]);
          this.timerIntervals[service] = undefined;
        }
        remainingSeconds = 0;
        
        console.log(`Session timer expired for ${service}, immediately stopping container and closing tab`);
        
        // Immediately stop the container and close the tab when timer reaches zero
        this.immediateSessionExpiration(service);
      }
      
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      timerElement.textContent = `${minutes}m ${seconds}s remaining`;
      
      // Add warning class when less than 5 minutes remain
      if (remainingSeconds < 300 && !timerElement.classList.contains('timer-warning')) {
        timerElement.classList.add('timer-warning');
      }
    }, 1000);
  }

  private async stopService(service: ServiceType) {
    console.log(`stopService called for ${service}`);
    
    try {
      const session = this.sessions[service];
      if (!session || !session.id) {
        console.error(`Cannot stop ${service}: No active session found`);
        return;
      }
      
      console.log(`Stopping ${service} session ${session.id}`);
      
      // Disable the stop button to prevent double-clicks
      const stopButton = document.getElementById(`${service}-stop`) as HTMLButtonElement;
      if (stopButton) {
        stopButton.disabled = true;
        stopButton.textContent = 'Stopping...';
      } else {
        console.warn(`Stop button element for ${service} not found when trying to disable it`);
      }
      
      // Find and close any open tabs for this service
      if (session.port) {
        const url = `http://localhost:${session.port}`;
        
        try {
          console.log(`Looking for tabs with URL: ${url}/*`);
          // Query all tabs matching our service URL
          const tabs = await new Promise<chrome.tabs.Tab[]>(resolve => {
            chrome.tabs.query({ url: `${url}/*` }, resolve);
          });
          
          console.log(`Found ${tabs.length} tabs for service ${service}`);
          
          // Close each tab
          for (const tab of tabs) {
            if (tab.id) {
              await new Promise<void>(resolve => {
                chrome.tabs.remove(tab.id!, () => resolve());
              });
            }
          }
        } catch (tabError) {
          console.error(`Error closing tabs for ${service}:`, tabError);
        }
      }
      
      console.log(`Sending stop message for ${service} with session ID ${session.id}`);
      
      // Store the port before we reset the session
      const sessionPort = session.port;
      
      // Send stop request to background script
      await new Promise<void>((resolve, reject) => {
        const message = {
          action: `stop${service.charAt(0).toUpperCase() + service.slice(1)}Service`,
          sessionId: session.id
        };
        
        console.log('Sending message to background script:', message);
        
        chrome.runtime.sendMessage(message, response => {
          console.log(`Received response for stop ${service}:`, response);
          
          if (chrome.runtime.lastError) {
            console.error(`Chrome runtime error:`, chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (!response?.success && response?.code !== 'SESSION_NOT_FOUND') {
            console.error(`Failed to stop ${service}:`, response?.error || 'Unknown error');
            reject(new Error(response?.error || 'Failed to stop service'));
            return;
          }
          
          console.log(`Successfully stopped ${service} session`);
          resolve();
        });
      });
      
      console.log(`Resetting ${service} session state`);
      
      // Reset session and update UI
      this.sessions[service] = this.createEmptySession();
      await chrome.storage.local.set({ [`${service}Session`]: this.sessions[service] });
      
      // Clear timer if it exists
      if (this.timerIntervals && this.timerIntervals[service]) {
        clearInterval(this.timerIntervals[service]);
        this.timerIntervals[service] = undefined;
      }
      
      // Update UI to reflect stopped state
      this.updateUI(service);
      
      // Show success message
      this.showNotification(service, 'success', `${service.charAt(0).toUpperCase() + service.slice(1)} session stopped successfully. Please close any open tabs pointing to this service.`);
    } catch (error) {
      console.error(`Failed to stop ${service}:`, error);
      
      // Re-enable the stop button
      const stopButton = document.getElementById(`${service}-stop`) as HTMLButtonElement;
      if (stopButton) {
        stopButton.disabled = false;
        stopButton.textContent = 'Stop Session';
      }
      
      // Show error notification
      this.showNotification(service, 'error', `Failed to stop ${service}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private toggleTheme() {
    const currentTheme = this.settings.theme;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    this.settings.theme = newTheme;
    document.body.setAttribute('data-theme', newTheme);
    chrome.storage.local.set({ settings: this.settings }).catch(console.error);
    
    // Update theme icon
    this.updateThemeIcon();
  }

  private updateThemeIcon() {
    const themeBtn = document.getElementById('theme-toggle');
    if (!themeBtn) return;

    const icon = themeBtn.querySelector('svg');
    if (!icon) return;

    if (this.settings.theme === 'dark') {
      // Sun icon for light mode toggle
      icon.innerHTML = `
        <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      `;
    } else {
      // Moon icon for dark mode toggle
      icon.innerHTML = `
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      `;
    }
  }

  private openSettings() {
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
      modalOverlay.classList.add('active');
    }
  }

  private closeModal() {
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
      modalOverlay.classList.remove('active');
    }
  }

  private saveSettings() {
    const settings = {
      enableNotifications: (document.getElementById('enableNotifications') as HTMLInputElement)?.checked ?? true,
      autoStart: (document.getElementById('autoStart') as HTMLInputElement)?.checked ?? false,
      sessionDuration: Number.parseInt((document.getElementById('sessionDuration') as HTMLInputElement)?.value ?? '5'),
      defaultDistro: (document.getElementById('defaultDistro') as HTMLSelectElement)?.value ?? 'ubuntu',
      showWarnings: (document.getElementById('showWarnings') as HTMLInputElement)?.checked ?? true,
    };

    chrome.storage.local.set({ settings: settings }).catch(console.error);
  }

  private loadSettingsValues() {
    chrome.storage.local.get(['settings'], (result) => {
      if (result.settings) {
        const settings = result.settings;
        
        if (settings.enableNotifications !== undefined) {
          (document.getElementById('enableNotifications') as HTMLInputElement).checked = settings.enableNotifications;
        }
        if (settings.autoStart !== undefined) {
          (document.getElementById('autoStart') as HTMLInputElement).checked = settings.autoStart;
        }
        if (settings.sessionDuration !== undefined) {
          (document.getElementById('sessionDuration') as HTMLInputElement).value = settings.sessionDuration;
          const valueElement = document.getElementById('sessionDurationValue');
          if (valueElement) {
            valueElement.textContent = settings.sessionDuration;
          }
        }
        if (settings.defaultDistro !== undefined) {
          (document.getElementById('defaultDistro') as HTMLSelectElement).value = settings.defaultDistro;
          const machineTypeSelect = document.getElementById('desktop-machine-type') as HTMLSelectElement;
          if (machineTypeSelect) {
            machineTypeSelect.value = settings.defaultDistro;
          }
        }
        if (settings.showWarnings !== undefined) {
          (document.getElementById('showWarnings') as HTMLInputElement).checked = settings.showWarnings;
        }
      }
    });
  }
}

export default new ServiceManager();