const LOGIN_URL = 'https://internet.lpu.in/24online/webpages/client.jsp';
const LOGOUT_URL = 'https://internet.lpu.in/24online/servlet/E24onlineHTTPClient';
let CHECK_INTERVAL = 5; // in minutes

let loginInProgress = false;

// Obfuscator
const Obfuscator = {
  decode: (str) => {
    try {
      return decodeURIComponent(atob(str));
    } catch {
      return str; // Fallback for plain text stored previously
    }
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'manualLogin') {
        performLogin(true).then(status => {
            sendResponse({ status });
        });
        return true; // Keep message channel open for async response
    } else if (message.action === 'checkStatus') {
        checkConnectionStatus().then(status => sendResponse({ status }));
        return true;
    } else if (message.action === 'logoutWifi') {
        performLogout().then(status => sendResponse({ status }));
        return true;
    } else if (message.action === 'updateInterval') {
        const minutes = parseInt(message.minutes);
        CHECK_INTERVAL = minutes;
        
        chrome.storage.local.set({ checkInterval: minutes });
        chrome.alarms.create('checkConnection', { periodInMinutes: minutes });
        
        console.log(`Check interval updated to ${minutes} minutes`);
        sendResponse({ status: 'updated' });
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkConnection') {
        performLogin();
    }
});

async function performLogin(isManual = false) {
    if (loginInProgress) {
        return 'in_progress';
    }
    
    loginInProgress = true;
    
    if (isManual) {
        chrome.alarms.get('checkConnection', (alarm) => {
            if (!alarm) initializeInterval();
        });
    }
    
    try {
        const data = await chrome.storage.local.get('credentials');
        if (!data.credentials) {
            loginInProgress = false;
            return 'no_credentials';
        }

        const regno = Obfuscator.decode(data.credentials.regno);
        const password = Obfuscator.decode(data.credentials.password);

        try {
            const response = await fetch('http://clients3.google.com/generate_204', { 
                cache: "no-store", 
                method: 'GET',
                signal: AbortSignal.timeout(3000) 
            });
            if (response.status === 204) {
                console.log('Already logged in');
                loginInProgress = false;
                return 'already_logged_in';
            }
        } catch(e) {
            // Fetch failed, maybe offline or captive portal redirects
        }

        return new Promise((resolve) => {
            chrome.tabs.create({ url: LOGIN_URL, active: false }, async (tab) => {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        function: loginToWifi,
                        args: [regno, password]
                    });

                    setTimeout(() => {
                        chrome.tabs.get(tab.id, function(tabInfo) {
                            if (!chrome.runtime.lastError) {
                                chrome.tabs.remove(tab.id);
                            }
                            loginInProgress = false;
                            resolve('login_triggered');
                        });
                    }, 2500);
                } catch (error) {
                    console.error('Script execution error:', error);
                    loginInProgress = false;
                    resolve('error');
                }
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        loginInProgress = false;
        return 'error';
    }
}

async function checkConnectionStatus() {
    try {
        const response = await fetch('http://clients3.google.com/generate_204', { 
            cache: "no-store", 
            method: 'GET',
            signal: AbortSignal.timeout(3000) 
        });
        if (response.status === 204) {
            return 'connected';
        }
        return 'disconnected';
    } catch(e) {
        return 'disconnected';
    }
}

function loginToWifi(regno, password) {
    document.querySelector('#agreepolicy')?.click();
    const uname = document.querySelector('input[name="username"]');
    const pwd = document.querySelector('input[name="password"]');
    if (uname) uname.value = regno;
    if (pwd) pwd.value = password;
    document.querySelector('#loginbtn')?.click();
}

async function performLogout() {
    chrome.alarms.clear('checkConnection');

    return new Promise((resolve) => {
        chrome.tabs.create({ url: LOGOUT_URL, active: false }, async (tab) => {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: logoutOfWifi
                });

                setTimeout(() => {
                    chrome.tabs.get(tab.id, function() {
                        if (!chrome.runtime.lastError) {
                            chrome.tabs.remove(tab.id);
                        }
                        resolve('logged_out');
                    });
                }, 2000);
            } catch (error) {
                console.error('Logout script execution error:', error);
                resolve('error');
            }
        });
    });
}

function logoutOfWifi() {
    const form = document.querySelector('form');
    const logoutBtn = document.querySelector('input[name="logout"]');
    
    if (form && logoutBtn) {
        // Many 24online captive portals have broken SSL certificates for their internal 10.10.0.1 IP
        // Forcing HTTP avoids the 'Your connection is not private' (NET::ERR_CERT_COMMON_NAME_INVALID) error
        if (form.action && form.action.includes('https://10.10.0.1')) {
            form.action = form.action.replace('https://10.10.0.1', 'http://10.10.0.1');
        }
        
        // The onclick attribute triggers validateLogout() which often shoots a confirm() dialog.
        // Alert/Confirm dialogs freeze background tabs indefinitely, so we bypass it.
        logoutBtn.removeAttribute('onclick');
        
        form.submit();
    }
}

async function initializeInterval() {
    try {
        const data = await chrome.storage.local.get('checkInterval');
        CHECK_INTERVAL = data.checkInterval ? parseInt(data.checkInterval) : 5;
        
        if (!data.checkInterval) {
            chrome.storage.local.set({ checkInterval: CHECK_INTERVAL });
        }
        
        chrome.alarms.create('checkConnection', { periodInMinutes: CHECK_INTERVAL });
    } catch (error) {
        chrome.alarms.create('checkConnection', { periodInMinutes: 5 });
    }
}

// Check when extension is first loaded
performLogin();
initializeInterval();