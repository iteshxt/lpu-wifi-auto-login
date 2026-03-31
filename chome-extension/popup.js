let currentToastTimeout;

function showToast(message, duration = 3000, showLoader = false) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  const loaderEl = document.getElementById('toast-loader');
  
  msgEl.textContent = message;
  loaderEl.style.display = showLoader ? 'inline-block' : 'none';
  toast.classList.add('show');
  
  if (currentToastTimeout) clearTimeout(currentToastTimeout);
  
  if (duration > 0) {
    currentToastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }
}

function hideToast() {
  const toast = document.getElementById('toast');
  toast.classList.remove('show');
}

// Security: simple base64 obfuscation wrapper
const Obfuscator = {
  encode: (str) => btoa(encodeURIComponent(str)),
  decode: (str) => decodeURIComponent(atob(str))
};

function updateDashboardStatus(status) {
  const icon = document.getElementById('status-icon-svg');
  const title = document.getElementById('status-title');
  const desc = document.getElementById('status-text');
  
  if (status === 'checking') {
    icon.innerHTML = '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>';
    icon.style.color = 'var(--muted-foreground)';
    title.textContent = 'Checking Status...';
    desc.textContent = 'Verifying connection with network.';
  } else if (status === 'connected' || status === 'already_logged_in') {
    icon.innerHTML = '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>';
    icon.style.color = '#10b981'; // green
    title.textContent = 'Connected';
    desc.textContent = 'You are logged into LPU WiFi.';
  } else {
    icon.innerHTML = '<line x1="2" y1="2" x2="22" y2="22"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/>';
    icon.style.color = '#ef4444'; // red
    title.textContent = 'Disconnected';
    desc.textContent = 'Auto-login active. Not connected yet.';
  }
}

function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  
  const settingsBtn = document.getElementById('settings-btn');
  const backBtn = document.getElementById('back-btn');
  const headerTitle = document.getElementById('header-title');
  
  if (viewId === 'view-login') {
    settingsBtn.style.display = 'none';
    backBtn.style.display = 'none';
    headerTitle.textContent = 'LPU WiFi Connect';
  } else if (viewId === 'view-dashboard') {
    settingsBtn.style.display = 'flex';
    backBtn.style.display = 'none';
    headerTitle.textContent = 'Dashboard';
    
    // Check status dynamically
    updateDashboardStatus('checking');
    chrome.runtime.sendMessage({ action: 'checkStatus' }, (response) => {
      if (!chrome.runtime.lastError && response) {
        updateDashboardStatus(response.status);
      } else {
        updateDashboardStatus('error');
      }
    });
  } else if (viewId === 'view-settings') {
    settingsBtn.style.display = 'none';
    backBtn.style.display = 'flex';
    headerTitle.textContent = 'Settings';
  }
}

document.getElementById('settings-btn').addEventListener('click', () => {
  switchView('view-settings');
});

document.getElementById('back-btn').addEventListener('click', () => {
  switchView('view-dashboard');
});

document.getElementById('save').addEventListener('click', () => {
  const regno = document.getElementById('regno').value;
  const password = document.getElementById('password').value;

  if (!regno || !password) {
    showToast('Please fill all fields');
    return;
  }

  // Obfuscate before saving
  chrome.storage.local.set({
    credentials: { 
      regno: Obfuscator.encode(regno), 
      password: Obfuscator.encode(password) 
    }
  }, () => {
    showToast('Credentials saved!');
    
    // Trigger login right after saving
    chrome.runtime.sendMessage({ action: 'manualLogin' });
    
    switchView('view-dashboard');
  });
});

document.getElementById('reload').addEventListener('click', () => {
  const btn = document.getElementById('reload');
  btn.disabled = true;
  btn.textContent = 'Checking...';
  showToast('Connecting to LPU WiFi...', 0, true);
  
  chrome.runtime.sendMessage({ action: 'manualLogin' }, (response) => {
    btn.disabled = false;
    btn.textContent = 'Refresh Connection';
    
    if (chrome.runtime.lastError) {
      showToast('Error connecting to background script.');
      updateDashboardStatus('error');
      return;
    }
    
    if (response && response.status === 'already_logged_in') {
      showToast('Already connected.');
      updateDashboardStatus('connected');
    } else if (response && response.status === 'login_triggered') {
      showToast('Login attempt sent.');
      updateDashboardStatus('connected');
    } else {
      showToast('Done.');
      updateDashboardStatus(response ? response.status : 'disconnected');
    }
  });
});

document.getElementById('reset').addEventListener('click', () => {
  if (confirm('Remove saved credentials? Auto-login will be disabled permanently until saved again.')) {
    chrome.storage.local.remove('credentials', () => {
      document.getElementById('regno').value = '';
      document.getElementById('password').value = '';
      switchView('view-login');
      showToast('Credentials removed.');
    });
  }
});

document.getElementById('logout-wifi').addEventListener('click', () => {
  const btn = document.getElementById('logout-wifi');
  btn.disabled = true;
  btn.textContent = 'Disconnecting...';
  showToast('Logging out of LPU WiFi...', 0, true);
  
  chrome.runtime.sendMessage({ action: 'logoutWifi' }, (response) => {
    btn.disabled = false;
    btn.textContent = 'Disconnect WiFi';
    
    if (chrome.runtime.lastError) {
      showToast('Error connecting to background script.');
      return;
    }
    
    showToast('Successfully disconnected.');
    updateDashboardStatus('disconnected');
    
    // Refresh status to be absolutely sure
    setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'checkStatus' }, (res) => {
          if (!chrome.runtime.lastError && res) updateDashboardStatus(res.status);
        });
    }, 2000);
  });
});

// Setup Slider
function initializeIntervalControls() {
  const intervalValues = [1, 5, 15, 30, 60];
  const slider = document.getElementById('interval-slider');
  
  chrome.storage.local.get('checkInterval', (data) => {
    const savedInterval = data.checkInterval || 5;
    let sliderIndex = 0;
    let closestDiff = Math.abs(intervalValues[0] - savedInterval);
    
    for (let i = 1; i < intervalValues.length; i++) {
      const diff = Math.abs(intervalValues[i] - savedInterval);
      if (diff < closestDiff) {
        closestDiff = diff;
        sliderIndex = i;
      }
    }
    
    slider.value = sliderIndex;
    updateSliderBackground(slider);
  });
  
  slider.addEventListener('input', () => {
    updateSliderBackground(slider);
  });
  
  slider.addEventListener('change', () => {
    const index = parseInt(slider.value);
    const minutes = intervalValues[index];
    chrome.runtime.sendMessage({ action: 'updateInterval', minutes: minutes });
    showToast(`Checked every ${minutes}m`);
  });
}

function updateSliderBackground(slider) {
  const value = (slider.value - slider.min) / (slider.max - slider.min) * 100;
  slider.style.background = `linear-gradient(to right, var(--primary) ${value}%, var(--muted) ${value}%)`;
}

// Initial initialization
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get('credentials', (data) => {
    if (data.credentials && data.credentials.regno && data.credentials.password) {
      switchView('view-dashboard');
    } else {
      switchView('view-login');
    }
  });
  
  initializeIntervalControls();
});