// popup.js - Automation Toolkit Controls

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Tabs
  const tabWl = document.getElementById('tab-wl');
  const tabSubs = document.getElementById('tab-subs');
  const tabIndicator = document.getElementById('tab-indicator');
  
  // Elements
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  const pageWarning = document.getElementById('page-warning');
  const warningTitle = document.getElementById('warning-title');
  const warningDesc = document.getElementById('warning-desc');
  const btnGotoPage = document.getElementById('btn-goto-page');
  
  const labelRemoved = document.getElementById('label-removed');
  const statRemoved = document.getElementById('stat-removed');
  const statSkipped = document.getElementById('stat-skipped');
  const statRemaining = document.getElementById('stat-remaining');
  
  const labelProgress = document.getElementById('label-progress');
  const progressPercent = document.getElementById('progress-percent');
  const progressBar = document.getElementById('progress-bar');
  
  const btnStart = document.getElementById('btn-start');
  const btnStartLabel = document.getElementById('btn-start-label');
  const btnPause = document.getElementById('btn-pause');
  const btnStop = document.getElementById('btn-stop');
  
  const inputInterval = document.getElementById('input-interval');
  const valInterval = document.getElementById('val-interval');
  const labelTargetText = document.getElementById('label-target-text');
  const inputTargetText = document.getElementById('input-target-text');
  const settingHintText = document.getElementById('setting-hint-text');
  const inputAutoscroll = document.getElementById('input-autoscroll');
  
  const logConsole = document.getElementById('log-console');
  const btnClearLogs = document.getElementById('btn-clear-logs');

  let activeTabId = null;
  let activeTabUrl = '';
  let currentMode = 'watch-later'; // 'watch-later' or 'subscriptions'

  // Default states for both modes
  const defaults = {
    activeMode: 'watch-later',
    
    // Watch Later State
    wl_removedCount: 0,
    wl_skippedCount: 0,
    wl_totalCount: 0,
    wl_status: 'idle',
    wl_logs: [],
    wl_interval: 800,
    wl_targetText: '',
    wl_autoscroll: true,

    // Subscriptions State
    subs_removedCount: 0,
    subs_skippedCount: 0,
    subs_totalCount: 0,
    subs_status: 'idle',
    subs_logs: [],
    subs_interval: 1500, // slower default for safety on subs
    subs_targetText: '',
    subs_autoscroll: true
  };

  // Get active tab URL and ID
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs && tabs[0]) {
    activeTabId = tabs[0].id;
    activeTabUrl = tabs[0].url || '';
  }

  // Load and apply initial states
  chrome.storage.local.get(Object.keys(defaults), (data) => {
    const state = { ...defaults, ...data };
    currentMode = state.activeMode;
    
    // Set active tab buttons in UI
    if (currentMode === 'subscriptions') {
      tabWl.classList.remove('active');
      tabSubs.classList.add('active');
    } else {
      tabWl.classList.add('active');
      tabSubs.classList.remove('active');
    }
    
    setTimeout(updateTabIndicator, 50); // Small delay to let fonts render
    
    // Load state
    loadModeData(currentMode);
  });

  // Handle Tab Switch
  tabWl.addEventListener('click', () => switchMode('watch-later'));
  tabSubs.addEventListener('click', () => switchMode('subscriptions'));
  window.addEventListener('resize', updateTabIndicator);

  // Switch Mode Logic
  function switchMode(mode) {
    if (currentMode === mode) return;
    currentMode = mode;
    
    if (currentMode === 'watch-later') {
      tabWl.classList.add('active');
      tabSubs.classList.remove('active');
    } else {
      tabWl.classList.remove('active');
      tabSubs.classList.add('active');
    }
    updateTabIndicator();
    chrome.storage.local.set({ activeMode: currentMode });
    
    loadModeData(currentMode);
  }

  // Position and width the tab underline indicator
  function updateTabIndicator() {
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab && tabIndicator) {
      tabIndicator.style.left = `${activeTab.offsetLeft}px`;
      tabIndicator.style.width = `${activeTab.offsetWidth}px`;
    }
  }

  // Load configuration and data for the selected mode
  function loadModeData(mode) {
    chrome.storage.local.get(Object.keys(defaults), (data) => {
      const state = { ...defaults, ...data };
      
      const isWL = mode === 'watch-later';
      const prefix = isWL ? 'wl' : 'subs';

      // Update Labels & Dynamic UI content
      labelRemoved.textContent = isWL ? 'Removed' : 'Unsubscribed';
      labelProgress.textContent = isWL ? 'Cleanup Progress' : 'Unsubscribe Progress';
      labelTargetText.textContent = isWL ? 'Remove Button Label' : 'Confirm Button Label';
      inputTargetText.placeholder = isWL ? 'Remove from Watch later' : 'Unsubscribe';
      
      settingHintText.textContent = isWL
        ? 'The extension will auto-detect this, but you can override it if you use a non-English YouTube locale.'
        : 'The script clicks "Unsubscribe" in the confirmation dialog. Override if needed for other locales.';

      // Apply settings to sliders & inputs
      inputInterval.value = state[`${prefix}_interval`];
      valInterval.textContent = `${state[`${prefix}_interval`]}ms`;
      inputTargetText.value = state[`${prefix}_targetText`];
      inputAutoscroll.checked = state[`${prefix}_autoscroll`];

      // Verify page URL
      checkUrlMatch();

      // Render logs
      renderLogs(state[`${prefix}_logs`]);

      // Apply Stats
      const modeState = {
        status: state[`${prefix}_status`],
        removedCount: state[`${prefix}_removedCount`],
        skippedCount: state[`${prefix}_skippedCount`],
        totalCount: state[`${prefix}_totalCount`],
      };
      updateStatsUI(modeState);

      // Ping content script to sync active state
      if (isPageValid()) {
        pingContentScript();
      }
    });
  }

  // Verify page validity based on current mode
  function isPageValid() {
    if (currentMode === 'watch-later') {
      return activeTabUrl.includes('youtube.com/playlist?list=WL');
    } else {
      return activeTabUrl.includes('youtube.com/feed/channels');
    }
  }

  function checkUrlMatch() {
    const isValid = isPageValid();
    
    if (isValid) {
      pageWarning.classList.add('hidden');
      enableControls();
    } else {
      pageWarning.classList.remove('hidden');
      
      if (currentMode === 'watch-later') {
        warningTitle.textContent = 'Not on Watch Later Page';
        warningDesc.textContent = 'Please open YouTube\'s Watch Later playlist page to run this tool.';
        btnGotoPage.textContent = 'Go to Watch Later';
      } else {
        warningTitle.textContent = 'Not on Subscriptions Page';
        warningDesc.textContent = 'Please open YouTube\'s Subscriptions Manager page to run this tool.';
        btnGotoPage.textContent = 'Go to Subscriptions';
      }
      
      disableControls();
    }
  }

  // Go to Correct Page Button
  btnGotoPage.addEventListener('click', () => {
    const url = currentMode === 'watch-later'
      ? 'https://www.youtube.com/playlist?list=WL'
      : 'https://www.youtube.com/feed/channels';
      
    chrome.tabs.update(activeTabId, { url }, () => {
      window.close(); // close popup to display active tab navigation
    });
  });

  // Action Delay Slider
  inputInterval.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    valInterval.textContent = `${val}ms`;
    saveModeSetting('interval', val);
    sendConfigUpdate();
  });

  // Target Text input
  inputTargetText.addEventListener('input', (e) => {
    saveModeSetting('targetText', e.target.value);
    sendConfigUpdate();
  });

  // Auto-scroll checkbox
  inputAutoscroll.addEventListener('change', (e) => {
    saveModeSetting('autoscroll', e.target.checked);
    sendConfigUpdate();
  });

  // Start Button Click
  btnStart.addEventListener('click', () => {
    if (!isPageValid()) return;
    
    btnStart.disabled = true;
    btnPause.disabled = false;
    btnStop.disabled = false;
    
    sendMessageToContent({
      action: 'START',
      mode: currentMode,
      config: {
        interval: parseInt(inputInterval.value),
        targetText: inputTargetText.value,
        autoscroll: inputAutoscroll.checked
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        addModeLog('Error: Content script not responding. Please refresh YouTube page.', 'error');
        btnStart.disabled = false;
        btnPause.disabled = true;
        btnStop.disabled = true;
      }
    });
  });

  // Pause Button Click
  btnPause.addEventListener('click', () => {
    sendMessageToContent({ action: 'PAUSE', mode: currentMode });
  });

  // Stop Button Click
  btnStop.addEventListener('click', () => {
    sendMessageToContent({ action: 'STOP', mode: currentMode });
  });

  // Clear Logs
  btnClearLogs.addEventListener('click', () => {
    logConsole.innerHTML = '';
    const data = {};
    data[`${currentMode === 'watch-later' ? 'wl' : 'subs'}_logs`] = [];
    chrome.storage.local.set(data);
  });

  // Listen for progress updates from Content Script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'STATE_UPDATED' && message.mode === currentMode) {
      updateStatsUI(message.state);
      if (message.state.logs) {
        renderLogs(message.state.logs);
      }
    }
  });

  // Helper: Ping content script to sync UI
  function pingContentScript() {
    sendMessageToContent({ action: 'PING', mode: currentMode }, (response) => {
      if (chrome.runtime.lastError) {
        addModeLog('System: Script inactive. Press "Start" to initialize on this tab.', 'system');
        updateStatusBadge('idle');
      } else if (response && response.status) {
        updateStatusBadge(response.status);
        if (response.status === 'running' || response.status === 'scanning') {
          btnStart.disabled = true;
          btnPause.disabled = false;
          btnStop.disabled = false;
        } else if (response.status === 'paused') {
          btnStart.disabled = false;
          btnStartLabel.textContent = 'Resume';
          btnPause.disabled = true;
          btnStop.disabled = false;
        } else {
          resetControlButtons();
        }
      }
    });
  }

  // Helper: Disable controls
  function disableControls() {
    btnStart.disabled = true;
    btnPause.disabled = true;
    btnStop.disabled = true;
    inputInterval.disabled = true;
    inputTargetText.disabled = true;
    inputAutoscroll.disabled = true;
  }

  // Helper: Enable controls
  function enableControls() {
    btnStart.disabled = false;
    btnPause.disabled = true;
    btnStop.disabled = true;
    inputInterval.disabled = false;
    inputTargetText.disabled = false;
    inputAutoscroll.disabled = false;
  }

  // Helper: Reset button labels/disabled state
  function resetControlButtons() {
    btnStart.disabled = false;
    btnStartLabel.textContent = 'Start';
    btnPause.disabled = true;
    btnStop.disabled = true;
  }

  // Helper: Send message to active content script
  function sendMessageToContent(message, callback) {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, message, (response) => {
      if (callback) callback(response);
    });
  }

  // Helper: Send config updates to content script
  function sendConfigUpdate() {
    if (!isPageValid()) return;
    sendMessageToContent({
      action: 'UPDATE_CONFIG',
      mode: currentMode,
      config: {
        interval: parseInt(inputInterval.value),
        targetText: inputTargetText.value,
        autoscroll: inputAutoscroll.checked
      }
    });
  }

  // Helper: Save setting for active mode to chrome.storage
  function saveModeSetting(key, value) {
    const data = {};
    const prefix = currentMode === 'watch-later' ? 'wl' : 'subs';
    data[`${prefix}_${key}`] = value;
    chrome.storage.local.set(data);
  }

  // Helper: Update stats UI elements
  function updateStatsUI(state) {
    statRemoved.textContent = state.removedCount;
    statSkipped.textContent = state.skippedCount;
    
    const remaining = state.totalCount > 0 ? Math.max(0, state.totalCount - state.removedCount) : '--';
    statRemaining.textContent = remaining;

    // Calculate progress percentage
    let percentage = 0;
    if (state.totalCount > 0) {
      percentage = Math.round((state.removedCount / state.totalCount) * 100);
      percentage = Math.min(100, Math.max(0, percentage));
    }
    
    progressPercent.textContent = `${percentage}%`;
    progressBar.style.width = `${percentage}%`;

    // Status Badge
    updateStatusBadge(state.status);

    // Adjust button states based on running state
    if (state.status === 'running' || state.status === 'scanning') {
      btnStart.disabled = true;
      btnPause.disabled = false;
      btnStop.disabled = false;
    } else if (state.status === 'paused') {
      btnStart.disabled = false;
      btnStartLabel.textContent = 'Resume';
      btnPause.disabled = true;
      btnStop.disabled = false;
    } else {
      resetControlButtons();
    }
  }

  // Helper: Update Status Badge
  function updateStatusBadge(status) {
    statusBadge.className = `status-pill status-${status}`;
    statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  }

  // Helper: Render logs
  function renderLogs(logs) {
    logConsole.innerHTML = '';
    if (!logs || logs.length === 0) {
      logConsole.innerHTML = '<div class="log-line system">Console cleared. Waiting for events...</div>';
      return;
    }

    logs.forEach(log => {
      const line = document.createElement('div');
      line.className = `log-line ${log.type || 'system'}`;
      line.textContent = `[${log.time}] ${log.message}`;
      logConsole.appendChild(line);
    });

    logConsole.scrollTop = logConsole.scrollHeight;
  }

  // Helper: Add log for current mode
  function addModeLog(message, type = 'system') {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.textContent = `[${time}] ${message}`;
    logConsole.appendChild(line);
    logConsole.scrollTop = logConsole.scrollHeight;

    const logKey = `${currentMode === 'watch-later' ? 'wl' : 'subs'}_logs`;
    chrome.storage.local.get([logKey], (data) => {
      const currentLogs = data[logKey] || [];
      currentLogs.push({ time, message, type });
      if (currentLogs.length > 100) currentLogs.shift();
      const saveObj = {};
      saveObj[logKey] = currentLogs;
      chrome.storage.local.set(saveObj);
    });
  }
});
