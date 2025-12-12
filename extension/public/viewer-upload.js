document.addEventListener('DOMContentLoaded', () => {
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const selectedFileName = document.getElementById('selected-file-name');
  const startViewerBtn = document.getElementById('start-viewer-btn');
  const errorMessage = document.getElementById('error-message');
  
  let selectedFile = null;

  // Handle file selection
  fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      selectedFile = files[0];
      selectedFileName.textContent = selectedFile.name;
      startViewerBtn.disabled = false;
      errorMessage.style.display = 'none';
    }
  });

  // Handle drag and drop events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => {
      uploadArea.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => {
      uploadArea.classList.remove('drag-over');
    }, false);
  });

  uploadArea.addEventListener('drop', (e) => {
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      fileInput.files = droppedFiles;
      selectedFile = droppedFiles[0];
      selectedFileName.textContent = selectedFile.name;
      startViewerBtn.disabled = false;
      errorMessage.style.display = 'none';
    }
  }, false);

  // Handle button click to start viewer
  startViewerBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      errorMessage.textContent = 'Please select a file first.';
      errorMessage.style.display = 'block';
      return;
    }

    try {
      // Show loading state
      startViewerBtn.disabled = true;
      startViewerBtn.innerHTML = '<span class="spinner"></span> Starting...';
      errorMessage.style.display = 'none';
      
      // Get the settings with API key
      const settings = await new Promise((resolve) => {
        chrome.storage.local.get(['settings'], resolve);
      });
      
      const apiKey = settings?.settings?.apiKey || '';
      
      // Create a FormData object to send the file directly
      const formData = new FormData();
      formData.append('document', selectedFile); // 'document' matches the parameter name in FastAPI
      
      // Get the correct port for viewer service
      const port = 8002; // Viewer service port
      
      // Start the viewer service by directly uploading the file to the backend
      const response = await fetch(`http://localhost:${port}/api/viewer/start-session`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey
        },
        body: formData // Send the file directly
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to start viewer: ${response.status} ${response.statusText}. ${errorData}`);
      }
      
      const data = await response.json();
      
      // Navigate to the web UI port that was returned by the API
      window.location.href = `http://localhost:${data.vnc_port}`;
      
    } catch (error) {
      console.error('Error starting viewer:', error);
      errorMessage.textContent = error instanceof Error ? error.message : 'An unknown error occurred';
      errorMessage.style.display = 'block';
      startViewerBtn.disabled = false;
      startViewerBtn.textContent = 'Start Viewer';
    }
  });
});