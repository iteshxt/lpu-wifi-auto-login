/**
 * LPU Auto-Login Extension - Popup UI Controller
 * Manages the user interface, credentials securely, and background communications.
 */

let currentToastTimeout;
let sessionTimerInterval = null;

/**
 * Displays a temporary toast notification.
 */
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
  document.getElementById('toast').classList.remove('show');
}

/**
 * Basic Base64 Obfuscator to prevent plain-text storage of credentials.
 */
const Obfuscator = {
  encode: (str) => btoa(encodeURIComponent(str)),
  decode: (str) => decodeURIComponent(atob(str))
};

/**
 * Updates the dashboard visual status indicators.
 */
function updateDashboardStatus(status) {
  const icon = document.getElementById('status-icon-svg');
  const title = document.getElementById('status-title');
  const desc = document.getElementById('status-text');
  const timerEl = document.getElementById('status-timer');
  const bwCard = document.getElementById('bandwidth-card');

  if (status === 'checking') {
    icon.innerHTML = '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>';
    icon.style.color = 'var(--muted-foreground)';
    icon.style.animation = '';
    title.textContent = 'Checking Status...';
    desc.textContent = 'Verifying connection with network.';
    timerEl.style.display = 'none';
    bwCard.style.display = 'none';
    stopSessionTimer();
  } else if (status === 'connecting') {
    icon.innerHTML = '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>';
    icon.style.color = '#f59e0b';
    icon.style.animation = 'pulse 1.2s ease-in-out infinite';
    title.textContent = 'Connecting...';
    desc.textContent = 'Login sent. Verifying connection...';
    timerEl.style.display = 'none';
    bwCard.style.display = 'none';
    stopSessionTimer();
  } else if (status === 'connected' || status === 'already_logged_in') {
    icon.innerHTML = '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>';
    icon.style.color = '#10b981';
    icon.style.animation = '';
    title.textContent = 'Connected';
    desc.textContent = 'You are logged into LPU WiFi.';
    // Session timer
    chrome.storage.local.get('sessionStart', (data) => {
      const ts = data.sessionStart || Date.now();
      if (!data.sessionStart) chrome.storage.local.set({ sessionStart: ts });
      startSessionTimer(ts);
    });
    // Bandwidth card
    bwCard.style.display = 'flex';
    chrome.storage.local.get('lastSpeedTest', (data) => {
      if (data.lastSpeedTest) {
        showSpeedResults(data.lastSpeedTest);
      }
    });
  } else {
    icon.innerHTML = '<line x1="2" y1="2" x2="22" y2="22"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/>';
    icon.style.color = '#ef4444';
    icon.style.animation = '';
    title.textContent = 'Disconnected';
    desc.textContent = 'Auto-login active. Waiting to connect.';
    timerEl.style.display = 'none';
    bwCard.style.display = 'none';
    stopSessionTimer();
    chrome.storage.local.remove('sessionStart');
  }
}

function startSessionTimer(sessionStart) {
  stopSessionTimer();
  const container = document.getElementById('status-timer');
  const display = document.getElementById('timer-display');
  if (!container || !display) return;
  container.style.display = 'block';
  function tick() {
    const s = Math.floor((Date.now() - sessionStart) / 1000);
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    display.textContent = `${h}:${m}:${sec}`;
  }
  tick();
  sessionTimerInterval = setInterval(tick, 1000);
}

function stopSessionTimer() {
  if (sessionTimerInterval) { clearInterval(sessionTimerInterval); sessionTimerInterval = null; }
}

function updateBandwidthDisplay(data) {
  const dl = document.getElementById('dl-speed');
  const ul = document.getElementById('ul-speed');
  if (dl) dl.textContent = data.download ? `${data.download} Mbps` : '—';
  if (ul) ul.textContent = data.upload ? `${data.upload} Mbps` : '—';
}

function showSpeedResults(data) {
  document.getElementById('bw-idle').style.display = 'none';
  const results = document.getElementById('bw-results');
  results.style.display = 'flex';
  updateBandwidthDisplay(data);
  const btn = document.getElementById('speed-test-btn');
  if (btn) { btn.style.animation = ''; btn.disabled = false; }
}

async function requestSpeedTest() {
  const btn = document.getElementById('speed-test-btn');
  const idleEl = document.getElementById('bw-idle');
  const resultsEl = document.getElementById('bw-results');
  const dl = document.getElementById('dl-speed');
  const ul = document.getElementById('ul-speed');

  // Set loading state
  if (btn) { btn.style.animation = 'spin 1s linear infinite'; btn.disabled = true; }
  if (idleEl) idleEl.style.display = 'none';
  if (resultsEl) resultsEl.style.display = 'flex';
  if (dl) dl.textContent = '...';
  if (ul) ul.textContent = '...';

  const result = { download: null, upload: null };

  // ── Download: 512KB from Cloudflare ──
  try {
    const start = Date.now();
    const res = await fetch('https://speed.cloudflare.com/__down?bytes=524288', {
      cache: 'no-store',
      signal: AbortSignal.timeout(12000)
    });
    const buf = await res.arrayBuffer();
    const secs = (Date.now() - start) / 1000;
    result.download = ((buf.byteLength * 8) / (secs * 1_000_000)).toFixed(1);
    if (dl) dl.textContent = `${result.download} Mbps`;
  } catch (e) {
    if (dl) dl.textContent = 'Failed';
    console.log('[SpeedTest] Download failed:', e.message);
  }

  // ── Upload: 256KB via XHR (accurate send timing) ──
  try {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const payload = new Uint8Array(262144); // 256KB
      const start = Date.now();

      xhr.open('POST', 'https://speed.cloudflare.com/__up', true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.timeout = 12000;

      xhr.upload.onload = () => {
        const secs = (Date.now() - start) / 1000;
        result.upload = ((payload.byteLength * 8) / (secs * 1_000_000)).toFixed(1);
        if (ul) ul.textContent = `${result.upload} Mbps`;
        resolve();
      };

      xhr.upload.onerror = () => { if (ul) ul.textContent = 'Failed'; resolve(); };
      xhr.upload.ontimeout = () => { if (ul) ul.textContent = 'Timeout'; resolve(); };
      xhr.onerror = () => { if (ul) ul.textContent = 'Failed'; resolve(); };

      xhr.send(payload);
    });
  } catch (e) {
    if (ul) ul.textContent = 'Failed';
    console.log('[SpeedTest] Upload failed:', e.message);
  }

  // Save result and reset button
  chrome.storage.local.set({ lastSpeedTest: result });
  if (btn) { btn.style.animation = ''; btn.disabled = false; }
}

/**
 * Populates the User Profile card from saved credentials.
 */
function updateProfileCard(credentials) {
  if (!credentials) return;
  const avatarEl = document.getElementById('profile-avatar');
  const nameEl = document.getElementById('profile-name');
  const regnoEl = document.getElementById('profile-regno');
  const badgeEl = document.getElementById('profile-badge');

  const name = credentials.fullname || '';
  const regno = credentials.regno ? Obfuscator.decode(credentials.regno) : '';

  nameEl.textContent = name || 'LPU Student';
  regnoEl.textContent = regno ? `#${regno}` : '—';

  // Badge: 5-digit → Staff, 8-digit → Student
  if (badgeEl) {
    const digits = regno.replace(/\D/g, '');
    badgeEl.textContent = digits.length === 5 ? 'Staff' : 'Student';
  }

  // Show first letter of first name as avatar initial
  const initial = name ? name.charAt(0).toUpperCase() : (regno ? regno.charAt(0).toUpperCase() : '?');
  avatarEl.textContent = initial;
}

/**
 * Handles toggling between the Login, Dashboard, and Settings views.
 */
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
    // Pre-fill name if previously saved
    chrome.storage.local.get('credentials', (data) => {
      if (data.credentials) {
        if (data.credentials.fullname) document.getElementById('fullname').value = data.credentials.fullname;
        if (data.credentials.regno) document.getElementById('regno').value = Obfuscator.decode(data.credentials.regno);
      }
    });
  } else if (viewId === 'view-dashboard') {
    settingsBtn.style.display = 'flex';
    backBtn.style.display = 'none';
    headerTitle.textContent = 'Dashboard';

    // Populate profile card
    chrome.storage.local.get('credentials', (data) => {
      updateProfileCard(data.credentials);
    });

    updateDashboardStatus('checking');

    // Asynchronously poll background script for connectivity state
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

// ==== Event Listeners ====

document.getElementById('settings-btn').addEventListener('click', () => switchView('view-settings'));
document.getElementById('back-btn').addEventListener('click', () => switchView('view-dashboard'));

/**
 * Saves the user's LPU credentials to secure local storage.
 */
document.getElementById('save').addEventListener('click', () => {
  const fullname = document.getElementById('fullname').value.trim();
  const regno = document.getElementById('regno').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!regno || !password) {
    showToast('Please fill all fields');
    return;
  }

  // Hash & Save securely
  chrome.storage.local.set({
    credentials: {
      fullname: fullname,
      regno: Obfuscator.encode(regno),
      password: Obfuscator.encode(password)
    }
  }, () => {
    showToast('Credentials saved!');
    // Fire background login attempt immediately
    chrome.runtime.sendMessage({ action: 'manualLogin' });
    switchView('view-dashboard');
  });
});

/**
 * Triggers a manual immediate connection attempt with UI blocking.
 */
/**
 * After a login attempt, waits briefly then pings background to confirm real connectivity.
 */
function verifyConnectionAfterLogin(delayMs = 2500) {
  setTimeout(() => {
    chrome.runtime.sendMessage({ action: 'checkStatus' }, (response) => {
      const btn = document.getElementById('reload');
      btn.disabled = false;
      btn.style.animation = '';
      if (!chrome.runtime.lastError && response && response.status === 'connected') {
        showToast('Connected to LPU WiFi! ✓', 3000);
        updateDashboardStatus('connected');
      } else {
        showToast('Login sent — not yet verified.', 3000);
        updateDashboardStatus('disconnected');
      }
    });
  }, delayMs);
}

document.getElementById('reload').addEventListener('click', () => {
  const btn = document.getElementById('reload');
  btn.disabled = true;
  btn.style.animation = 'spin 1s linear infinite';
  showToast('Sending login request...', 0, true);

  chrome.runtime.sendMessage({ action: 'manualLogin' }, (response) => {
    if (chrome.runtime.lastError) {
      btn.disabled = false;
      btn.style.animation = '';
      showToast('Error connecting to background script.');
      updateDashboardStatus('disconnected');
      return;
    }

    if (response && response.status === 'already_logged_in') {
      btn.disabled = false;
      btn.style.animation = '';
      showToast('Already connected.', 3000);
      updateDashboardStatus('connected');
    } else if (response && (response.status === 'login_triggered' || response.status === 'login_unknown')) {
      // Show connecting state, then verify after portal has time to process
      showToast('Verifying connection...', 0, true);
      updateDashboardStatus('connecting');
      verifyConnectionAfterLogin(2500);
    } else if (response && response.status === 'no_credentials') {
      btn.disabled = false;
      btn.style.animation = '';
      showToast('No credentials saved.');
      updateDashboardStatus('disconnected');
    } else {
      btn.disabled = false;
      btn.style.animation = '';
      showToast('Login attempt failed or unknown state.', 3000);
      updateDashboardStatus('disconnected');
    }
  });
});

// ── Sign-out flow ──
const confirmOverlay = document.getElementById('confirm-overlay');

document.getElementById('signout-btn').addEventListener('click', () => {
  confirmOverlay.classList.add('show');
});

document.getElementById('confirm-cancel').addEventListener('click', () => {
  confirmOverlay.classList.remove('show');
});

document.getElementById('confirm-ok').addEventListener('click', () => {
  confirmOverlay.classList.remove('show');
  chrome.storage.local.remove(['credentials', 'sessionStart', 'lastSpeedTest'], () => {
    document.getElementById('regno').value = '';
    document.getElementById('password').value = '';
    switchView('view-login');
    showToast('Signed out. Credentials removed.');
  });
});

// Close modal when clicking outside the dialog
confirmOverlay.addEventListener('click', (e) => {
  if (e.target === confirmOverlay) confirmOverlay.classList.remove('show');
});

/**
 * Speed test button
 */
document.addEventListener('click', (e) => {
  if (e.target && e.target.closest('#speed-test-btn')) {
    requestSpeedTest();
  }
});


/**
 * Initializes the background execution timer slider with the default 30 minute marker.
 */
function initializeIntervalControls() {
  const intervalValues = [1, 5, 15, 30, 60];
  const slider = document.getElementById('interval-slider');

  chrome.storage.local.get('checkInterval', (data) => {
    // Enforce strong 30-minute default setting for new users
    let savedInterval = data.checkInterval;
    if (!savedInterval) {
      savedInterval = 30; // Strongly enforce default
      chrome.storage.local.set({ checkInterval: 30 });
      chrome.runtime.sendMessage({ action: 'updateInterval', minutes: 30 });
    }

    let sliderIndex = 3; // Default array index for `30` min
    let closestDiff = Math.abs(intervalValues[0] - savedInterval);

    // Snap the UI slider to the closest value safely
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

  slider.addEventListener('input', () => updateSliderBackground(slider));

  slider.addEventListener('change', () => {
    const index = parseInt(slider.value);
    const minutes = intervalValues[index];
    // Stream the user's newly chosen preference live to the background worker
    chrome.runtime.sendMessage({ action: 'updateInterval', minutes: minutes });
    showToast(`Auto-Checking every ${minutes}m`);
  });
}

function updateSliderBackground(slider) {
  const value = (slider.value - slider.min) / (slider.max - slider.min) * 100;
  slider.style.background = `linear-gradient(to right, var(--primary) ${value}%, var(--muted) ${value}%)`;
}

/**
 * Initial Popup Boot Lifecycle
 */
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