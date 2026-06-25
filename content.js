// content.js - YouTube Automation Toolkit (Watch Later & Subscriptions)

let loopTimer = null;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

// Auto-detect mode based on URL
let currentMode = 'watch-later'; // 'watch-later' or 'subscriptions'
let storagePrefix = 'wl'; // 'wl' or 'subs'

if (window.location.href.includes('youtube.com/feed/channels')) {
  currentMode = 'subscriptions';
  storagePrefix = 'subs';
} else {
  currentMode = 'watch-later';
  storagePrefix = 'wl';
}

// Default States
let state = {
  status: 'idle', // 'idle', 'scanning', 'running', 'paused', 'completed'
  removedCount: 0,
  skippedCount: 0,
  totalCount: 0,
  logs: []
};

// Default Configs
let config = {
  interval: currentMode === 'watch-later' ? 800 : 1500, // slower default for subscriptions
  targetText: '',
  autoscroll: true
};

// Common language translations for "Remove from Watch later" (Watch Later mode)
const REMOVE_KEYWORDS = [
  "remove from watch later",
  "remove from watch",
  "aus „später ansehen“ entfernen",
  "quitar de ver más tarde",
  "retirer de à regarder plus tard",
  "remover de assistir mais tarde",
  "rimuovi da guarda più tardi",
  "удалить из плейлиста \"смотреть позже\"",
  "удалить из плейлиста смотреть позже",
  "「後で見る」から削除",
  "나중에 볼 동영상에서 삭제",
  "从“稍后观看”中移除",
  "從「稍後觀看」中移除",
  "remove from"
];

// Helper: sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Get timestamp
function getTimestamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Log event and sync to storage
function logEvent(message, type = 'system') {
  const time = getTimestamp();
  const logEntry = { time, message, type };
  
  state.logs.push(logEntry);
  if (state.logs.length > 100) state.logs.shift(); // Cap logs
  
  saveState();
  notifyPopup();
}

// Sync state to chrome storage
function saveState() {
  const saveObj = {};
  saveObj[`${storagePrefix}_status`] = state.status;
  saveObj[`${storagePrefix}_removedCount`] = state.removedCount;
  saveObj[`${storagePrefix}_skippedCount`] = state.skippedCount;
  saveObj[`${storagePrefix}_totalCount`] = state.totalCount;
  saveObj[`${storagePrefix}_logs`] = state.logs;
  saveObj[`${storagePrefix}_targetText`] = config.targetText;
  chrome.storage.local.set(saveObj);
}

// Load state and config from storage
function loadStateAndConfig(callback) {
  const keys = [
    `${storagePrefix}_status`,
    `${storagePrefix}_removedCount`,
    `${storagePrefix}_skippedCount`,
    `${storagePrefix}_totalCount`,
    `${storagePrefix}_logs`,
    `${storagePrefix}_interval`,
    `${storagePrefix}_targetText`,
    `${storagePrefix}_autoscroll`
  ];
  
  chrome.storage.local.get(keys, (data) => {
    if (data[`${storagePrefix}_status`]) state.status = data[`${storagePrefix}_status`];
    if (data[`${storagePrefix}_removedCount`] !== undefined) state.removedCount = data[`${storagePrefix}_removedCount`];
    if (data[`${storagePrefix}_skippedCount`] !== undefined) state.skippedCount = data[`${storagePrefix}_skippedCount`];
    if (data[`${storagePrefix}_totalCount`] !== undefined) state.totalCount = data[`${storagePrefix}_totalCount`];
    if (data[`${storagePrefix}_logs`]) state.logs = data[`${storagePrefix}_logs`];
    
    if (data[`${storagePrefix}_interval`]) config.interval = data[`${storagePrefix}_interval`];
    if (data[`${storagePrefix}_targetText`]) config.targetText = data[`${storagePrefix}_targetText`];
    if (data[`${storagePrefix}_autoscroll`] !== undefined) config.autoscroll = data[`${storagePrefix}_autoscroll`];
    
    if (callback) callback();
  });
}

// Notify popup if it is open
function notifyPopup() {
  chrome.runtime.sendMessage({
    action: 'STATE_UPDATED',
    mode: currentMode,
    state: {
      status: state.status,
      removedCount: state.removedCount,
      skippedCount: state.skippedCount,
      totalCount: state.totalCount,
      logs: state.logs
    }
  }, () => {
    // Ignore error when popup is closed
    const err = chrome.runtime.lastError;
  });
}

// Update total count estimation
function updateTotalCount() {
  if (currentMode === 'watch-later') {
    const statsElements = document.querySelectorAll(
      'ytd-playlist-byline-renderer span.yt-formatted-string, ytd-playlist-header-renderer #stats span, #stats.ytd-playlist-byline-renderer span'
    );
    for (const el of statsElements) {
      const text = el.textContent.trim().toLowerCase();
      if (text.includes('video') || text.includes('видео') || text.includes('動画') || text.includes('동영상') || /^[0-9,.\s]+$/.test(text)) {
        const numbers = text.replace(/[^0-9]/g, '');
        if (numbers) {
          const count = parseInt(numbers, 10);
          if (count > 0) {
            state.totalCount = count;
            saveState();
            return;
          }
        }
      }
    }
    
    const visibleCount = document.querySelectorAll('ytd-playlist-video-renderer').length;
    if (visibleCount > 0 && state.totalCount < visibleCount) {
      state.totalCount = visibleCount;
      saveState();
    }
  } else {
    const channels = document.querySelectorAll('ytd-channel-renderer');
    const processedInDom = document.querySelectorAll('ytd-channel-renderer[data-automation-processed]').length;
    const calculatedTotal = channels.length + state.removedCount - processedInDom;
    if (calculatedTotal > state.totalCount) {
      state.totalCount = calculatedTotal;
    }
    saveState();
  }
}

// Helper: Check if element is visible on screen
function isElementVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && 
         rect.height > 0 && 
         style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         style.opacity !== 0;
}

// Helper: Find action menu button in video row (Watch Later)
function findActionMenuButton(videoElement) {
  return videoElement.querySelector('button[aria-label="Action menu"]') || 
         videoElement.querySelector('#button.ytd-menu-renderer') ||
         videoElement.querySelector('yt-icon-button.ytd-menu-renderer') ||
         videoElement.querySelector('yt-icon-button.dropdown-trigger');
}

// Helper: Find Subscribed button in channel row (Subscriptions)
function findSubscribedButton(channelElement) {
  const btn = channelElement.querySelector('ytd-subscribe-button-renderer button, #subscribe-button button');
  if (btn) return btn;

  return channelElement.querySelector('[aria-label*="Unsubscribe"], [aria-label*="unsubscribe"], [aria-label*="Abonné"], [aria-label*="suscrito"]');
}

// Helper: Find video title
function getVideoTitle(videoElement) {
  const titleEl = videoElement.querySelector('#video-title');
  return titleEl ? titleEl.textContent.trim() : 'Unknown Title';
}

// Helper: Find channel name
function getChannelName(channelElement) {
  const nameEl = channelElement.querySelector('#title, #channel-title, #text');
  return nameEl ? nameEl.textContent.trim() : 'Unknown Channel';
}

// Helper: Clear processed tracking attributes
function clearProcessedAttributes() {
  const processed = document.querySelectorAll('[data-automation-processed]');
  processed.forEach(el => el.removeAttribute('data-automation-processed'));
}

// Step runner: Watch Later Deletion
async function executeWatchLaterStep(videos) {
  if (videos.length === 0) {
    if (config.autoscroll) {
      logEvent('Reached end of loaded list. Scrolling to load more...', 'system');
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(1500);
      scheduleNextStep(500);
      return;
    } else {
      state.status = 'completed';
      logEvent('All visible videos processed.', 'success');
      saveState();
      return;
    }
  }

  // Always process the first unprocessed video in the filtered list
  const video = videos[0];
  const videoTitle = getVideoTitle(video);

  const menuBtn = findActionMenuButton(video);
  if (!menuBtn) {
    consecutiveFailures++;
    logEvent(`Failed to find menu button for: "${videoTitle}". Retrying...`, 'warning');
    
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      logEvent(`Skipping "${videoTitle}" due to multiple failures.`, 'error');
      state.skippedCount++;
      video.setAttribute('data-automation-processed', 'true');
      consecutiveFailures = 0;
    }
    
    scheduleNextStep(1000);
    return;
  }

  try {
    menuBtn.click();
  } catch (err) {
    logEvent(`Clicking menu button failed: ${err.message}`, 'error');
    video.setAttribute('data-automation-processed', 'true');
    scheduleNextStep(1000);
    return;
  }

  await sleep(350);

  const menuItems = document.querySelectorAll('ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer');
  
  if (menuItems.length === 0) {
    await sleep(250);
    const retryMenuItems = document.querySelectorAll('ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer');
    if (retryMenuItems.length === 0) {
      consecutiveFailures++;
      logEvent('Menu options failed to render. Retrying...', 'warning');
      document.body.click(); 
      
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        logEvent(`Skipping "${videoTitle}" (dropdown unresponsive).`, 'error');
        state.skippedCount++;
        video.setAttribute('data-automation-processed', 'true');
        consecutiveFailures = 0;
      }
      scheduleNextStep(1000);
      return;
    }
  }

  let removeBtn = null;
  const optionsList = [];
  menuItems.forEach(item => {
    if (isElementVisible(item)) {
      const txt = item.textContent.trim();
      if (txt) optionsList.push(txt);
    }
  });

  if (!config.targetText) {
    state.status = 'scanning';
    saveState();
    notifyPopup();
    
    for (const item of menuItems) {
      if (isElementVisible(item)) {
        const text = item.textContent.trim().toLowerCase();
        const match = REMOVE_KEYWORDS.some(kw => text.includes(kw));
        if (match) {
          config.targetText = item.textContent.trim();
          logEvent(`Auto-detected remove button text: "${config.targetText}"`, 'success');
          state.status = 'running';
          saveState();
          break;
        }
      }
    }
    
    if (!config.targetText) {
      state.status = 'paused';
      logEvent('Could not auto-detect "Remove" option.', 'error');
      logEvent(`Detected menu options: [${optionsList.join(' | ')}]`, 'warning');
      logEvent('Please manually input the "Remove" button label in Configuration.', 'system');
      document.body.click();
      saveState();
      notifyPopup();
      return;
    }
  }

  for (const item of menuItems) {
    if (isElementVisible(item) && item.textContent.trim().toLowerCase() === config.targetText.toLowerCase()) {
      removeBtn = item;
      break;
    }
  }

  if (removeBtn) {
    try {
      removeBtn.click();
      state.removedCount++;
      consecutiveFailures = 0;
      logEvent(`Removed: "${videoTitle}"`, 'success');
      
      // Mark as processed immediately so it's excluded from future queries
      video.setAttribute('data-automation-processed', 'true');
      
      if (state.removedCount % 5 === 0 && config.autoscroll) {
        window.scrollTo(0, document.documentElement.scrollHeight * 0.8);
      }
    } catch (err) {
      logEvent(`Clicking remove button failed: ${err.message}`, 'error');
      video.setAttribute('data-automation-processed', 'true');
    }
  } else {
    logEvent(`Option "${config.targetText}" not found for "${videoTitle}".`, 'warning');
    logEvent(`Available options: [${optionsList.join(' | ')}]`, 'system');
    state.skippedCount++;
    video.setAttribute('data-automation-processed', 'true');
    document.body.click();
  }

  saveState();
  notifyPopup();
  scheduleNextStep(config.interval);
}

// Step runner: Subscription Unsubscribe
async function executeSubscriptionsStep(channels) {
  if (channels.length === 0) {
    if (config.autoscroll) {
      logEvent('Reached end of channel list. Scrolling to load more...', 'system');
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(1500);
      scheduleNextStep(500);
      return;
    } else {
      state.status = 'completed';
      logEvent('All visible subscriptions processed.', 'success');
      saveState();
      return;
    }
  }

  // Always process the first unprocessed channel in the filtered list
  const channel = channels[0];
  const channelName = getChannelName(channel);
  
  // Find Subscribed button
  const subBtn = findSubscribedButton(channel);
  
  if (!subBtn) {
    consecutiveFailures++;
    logEvent(`Failed to find Subscribed button for channel: "${channelName}". Retrying...`, 'warning');
    
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      logEvent(`Skipping channel "${channelName}" (button not found).`, 'error');
      state.skippedCount++;
      channel.setAttribute('data-automation-processed', 'true');
      consecutiveFailures = 0;
    }
    
    scheduleNextStep(1000);
    return;
  }

  // Language-independent state check using YouTube's standard DOM attributes and properties
  const subscribeBtnRenderer = channel.querySelector('ytd-subscribe-button-renderer');
  let isSubscribed = false;
  
  if (subscribeBtnRenderer) {
    const hasSubscribedAttr = subscribeBtnRenderer.hasAttribute('subscribed') && 
                              subscribeBtnRenderer.getAttribute('subscribed') !== 'false';
    const isSubscribedProp = subscribeBtnRenderer.subscribed === true;
    
    if (hasSubscribedAttr || isSubscribedProp) {
      isSubscribed = true;
    }
  }
  
  // Fallback state check by text/aria-label (whether subscribeBtnRenderer is found or not)
  if (!isSubscribed) {
    const ariaLabel = (subBtn.getAttribute('aria-label') || '').toLowerCase();
    const buttonText = (subBtn.textContent || '').trim().toLowerCase();
    if (
      ariaLabel.includes('unsubscribe') || 
      ariaLabel.includes('subscribed') || 
      ariaLabel.includes('abonné') || 
      ariaLabel.includes('suscrito') || 
      ariaLabel.includes('desabonner') || 
      ariaLabel.includes('désabonner') || 
      buttonText.includes('subscribed') ||
      buttonText.includes('unsubscribe') ||
      buttonText.includes('abonné') ||
      buttonText.includes('suscrito') ||
      buttonText.includes('desabonner') || 
      buttonText.includes('désabonner')
    ) {
      isSubscribed = true;
    }
  }

  if (!isSubscribed) {
    logEvent(`Channel "${channelName}" already unsubscribed. Skipping.`, 'system');
    channel.setAttribute('data-automation-processed', 'true');
    scheduleNextStep(100);
    return;
  }

  // Click the Subscribed button
  try {
    subBtn.click();
  } catch (err) {
    logEvent(`Clicking subscribed button failed: ${err.message}`, 'error');
    channel.setAttribute('data-automation-processed', 'true');
    scheduleNextStep(1000);
    return;
  }

  // Wait for either the dropdown menu OR the confirmation dialog to appear (poll for up to 1500ms)
  let menuUnsubscribeBtn = null;
  let confirmBtn = null;
  
  for (let i = 0; i < 15; i++) {
    await sleep(100);
    
    // 1. Check if the intermediate dropdown menu appeared
    const menuItems = document.querySelectorAll('ytd-menu-service-item-renderer, tp-yt-paper-item');
    for (const item of menuItems) {
      if (isElementVisible(item)) {
        const text = (item.textContent || '').trim().toLowerCase();
        // Check for 'unsubscribe' or localized equivalents in the menu item text
        if (
          text.includes('unsubscribe') || 
          text.includes('désabonner') || 
          text.includes('desabonner') || 
          text.includes('anular') ||
          text.includes('deabonnieren') ||
          text.includes('abo beenden')
        ) {
          menuUnsubscribeBtn = item;
          break;
        }
      }
    }
    
    // 2. Also check if the confirm dialog appeared directly (bypassing the menu)
    if (!menuUnsubscribeBtn) {
      const dialogs = document.querySelectorAll('yt-confirm-dialog-renderer, tp-yt-paper-dialog');
      for (const dialog of dialogs) {
        const btns = dialog.querySelectorAll('#confirm-button button, button[aria-label*="Unsubscribe"], button[aria-label*="unsubscribe"], [dialog-confirm], #confirm-button');
        for (const b of btns) {
          if (isElementVisible(b)) {
            confirmBtn = b;
            break;
          }
        }
        if (confirmBtn) break;
      }
    }
    
    if (menuUnsubscribeBtn || confirmBtn) break;
  }
  
  // If we found the dropdown menu button, click it and THEN wait for the confirm dialog
  if (menuUnsubscribeBtn) {
    try {
      menuUnsubscribeBtn.click();
    } catch (err) {
      logEvent(`Clicking unsubscribe from menu failed: ${err.message}`, 'error');
      channel.setAttribute('data-automation-processed', 'true');
      document.body.click();
      scheduleNextStep(1000);
      return;
    }
    
    // Now poll again for the actual confirmation dialog
    confirmBtn = null;
    for (let i = 0; i < 15; i++) {
      await sleep(100);
      const dialogs = document.querySelectorAll('yt-confirm-dialog-renderer, tp-yt-paper-dialog');
      for (const dialog of dialogs) {
        const btns = dialog.querySelectorAll('#confirm-button button, button[aria-label*="Unsubscribe"], button[aria-label*="unsubscribe"], [dialog-confirm], #confirm-button');
        for (const b of btns) {
          if (isElementVisible(b)) {
            confirmBtn = b;
            break;
          }
        }
        if (confirmBtn) break;
      }
      if (confirmBtn) break;
    }
  }
  
  if (!confirmBtn) {
    consecutiveFailures++;
    logEvent('Confirmation dialog failed to appear. Retrying...', 'warning');
    
    // Click away to close any stale hidden dialogs
    document.body.click();
    
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      logEvent(`Skipping channel "${channelName}" (dialog unresponsive).`, 'error');
      state.skippedCount++;
      channel.setAttribute('data-automation-processed', 'true');
      consecutiveFailures = 0;
    }
    
    scheduleNextStep(1000);
    return;
  }

  // Click Unsubscribe inside the confirmation popup
  try {
    // If the button is wrapped in a yt-button-renderer shape, click the inner button if possible
    const clickTarget = confirmBtn.querySelector('button') || confirmBtn;
    
    if (clickTarget.hasAttribute('disabled') || clickTarget.disabled === true) {
      throw new Error('Button is disabled');
    }
    
    clickTarget.click();
    
    state.removedCount++;
    consecutiveFailures = 0;
    logEvent(`Unsubscribed: "${channelName}"`, 'success');
    
    // Mark as processed immediately so it's excluded from future queries
    channel.setAttribute('data-automation-processed', 'true');
    
    if (state.removedCount % 4 === 0 && config.autoscroll) {
      window.scrollTo(0, document.documentElement.scrollHeight * 0.9);
    }
  } catch (err) {
    logEvent(`Clicking unsubscribe confirmation failed: ${err.message}`, 'error');
    channel.setAttribute('data-automation-processed', 'true');
    document.body.click();
  }

  saveState();
  notifyPopup();
  scheduleNextStep(config.interval);
}

// Master execution runner
async function executeStep() {
  if (state.status !== 'running' && state.status !== 'scanning') {
    return;
  }

  updateTotalCount();

  if (currentMode === 'watch-later') {
    const videos = document.querySelectorAll('ytd-playlist-video-renderer:not([data-automation-processed])');
    
    if (videos.length === 0) {
      logEvent('No videos found in view. Checking for more...', 'system');
      
      if (config.autoscroll) {
        window.scrollTo(0, document.documentElement.scrollHeight);
        await sleep(1500);
        
        const retryVideos = document.querySelectorAll('ytd-playlist-video-renderer:not([data-automation-processed])');
        if (retryVideos.length === 0) {
          state.status = 'completed';
          logEvent('Watch Later list is empty! Clean up completed successfully.', 'success');
          saveState();
          return;
        } else {
          executeWatchLaterStep(retryVideos);
          return;
        }
      } else {
        state.status = 'completed';
        logEvent('Reached end of visible playlist. Enable auto-scroll to fetch more.', 'warning');
        saveState();
        return;
      }
    }
    
    executeWatchLaterStep(videos);
  } else {
    const channels = document.querySelectorAll('ytd-channel-renderer:not([data-automation-processed])');
    
    if (channels.length === 0) {
      logEvent('No subscriptions found in view. Checking for more...', 'system');
      
      if (config.autoscroll) {
        window.scrollTo(0, document.documentElement.scrollHeight);
        await sleep(1500);
        
        const retryChannels = document.querySelectorAll('ytd-channel-renderer:not([data-automation-processed])');
        if (retryChannels.length === 0) {
          state.status = 'completed';
          logEvent('No subscriptions found! Unsubscribe completed successfully.', 'success');
          saveState();
          return;
        } else {
          executeSubscriptionsStep(retryChannels);
          return;
        }
      } else {
        state.status = 'completed';
        logEvent('Reached end of visible channel list. Enable auto-scroll to fetch more.', 'warning');
        saveState();
        return;
      }
    }
    
    executeSubscriptionsStep(channels);
  }
}

// Helper: Schedule next action in loop
function scheduleNextStep(delay) {
  if (loopTimer) clearTimeout(loopTimer);
  loopTimer = setTimeout(executeStep, delay);
}

// Start Process
function startProcess(startConfig) {
  if (startConfig) {
    config = { ...config, ...startConfig };
  }
  
  if (state.status === 'running') return;
  
  // Clear any processed tracking attributes for a fresh run
  clearProcessedAttributes();
  
  state.status = 'running';
  logEvent(`Automation started in ${currentMode === 'watch-later' ? 'Watch Later' : 'Subscriptions'} mode.`, 'system');
  
  saveState();
  notifyPopup();
  
  executeStep();
}

// Pause Process
function pauseProcess() {
  state.status = 'paused';
  if (loopTimer) clearTimeout(loopTimer);
  logEvent('Automation paused.', 'warning');
  saveState();
  notifyPopup();
}

// Stop/Reset Process
function stopProcess() {
  state.status = 'idle';
  if (loopTimer) clearTimeout(loopTimer);
  state.removedCount = 0;
  state.skippedCount = 0;
  consecutiveFailures = 0;
  
  // Clear any processed tracking attributes
  clearProcessedAttributes();
  
  logEvent('Automation stopped and reset.', 'system');
  saveState();
  notifyPopup();
}

// Message listener from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'PING' && message.mode === currentMode) {
    sendResponse({ status: state.status });
    return true;
  }

  if (message.action === 'START' && message.mode === currentMode) {
    loadStateAndConfig(() => {
      startProcess(message.config);
      sendResponse({ status: state.status });
    });
    return true;
  }

  if (message.action === 'PAUSE' && message.mode === currentMode) {
    pauseProcess();
    sendResponse({ status: state.status });
    return true;
  }

  if (message.action === 'STOP' && message.mode === currentMode) {
    stopProcess();
    sendResponse({ status: state.status });
    return true;
  }

  if (message.action === 'UPDATE_CONFIG' && message.mode === currentMode) {
    if (message.config) {
      config = { ...config, ...message.config };
      saveState();
    }
    sendResponse({ status: 'ok' });
    return true;
  }
});

// Auto-initialize on page load
loadStateAndConfig(() => {
  if (state.status === 'running') {
    executeStep();
  }
});
