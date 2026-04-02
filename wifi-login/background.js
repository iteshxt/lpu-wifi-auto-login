/**
 * LPU Auto-Login Extension - Background Service Worker
 * Orchestrates silent background auth, connectivity checks, and interval management.
 */

const LOGIN_URL = 'https://internet.lpu.in/24online/webpages/client.jsp';
const AUTH_URL = 'https://internet.lpu.in/24online/servlet/E24onlineHTTPClient';
let CHECK_INTERVAL = 1; // Default fallback, overwritten by initializeInterval()

let loginInProgress = false;

/**
 * Simple utility to decode stored credentials.
 */
const Obfuscator = {
    decode: (str) => {
        try {
            return decodeURIComponent(atob(str));
        } catch {
            return str; // Fallback for plain text
        }
    }
};

/**
 * Listen for messages from the popup UI.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'manualLogin') {
        performLogin(true).then(status => sendResponse({ status }));
        return true; 
    } else if (message.action === 'checkStatus') {
        checkConnectionStatus().then(status => sendResponse({ status }));
        return true;
    } else if (message.action === 'updateInterval') {
        const minutes = parseInt(message.minutes);
        CHECK_INTERVAL = minutes;
        chrome.storage.local.set({ checkInterval: minutes });
        chrome.alarms.create('checkConnection', { periodInMinutes: minutes });
        sendResponse({ status: 'updated' });
    } else if (message.action === 'runSpeedTest') {
        runSpeedTest().then(result => sendResponse(result));
        return true;
    }
});

/**
 * Trigger background checks based on the configured alarm interval.
 */
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkConnection') {
        performLogin();
    }
});

/**
 * Core Authentication Routine
 * Evaluates connectivity and forces a captive portal login sequence if required.
 * Note: LOGIN_URL is mandatory to scrape the dynamic anti-CSRF tokens LPU generates.
 */
async function performLogin(isManual = false) {
    if (loginInProgress) return 'in_progress';
    loginInProgress = true;

    if (isManual) {
        chrome.alarms.get('checkConnection', (alarm) => {
            if (!alarm) initializeInterval();
        });
    }

    try {
        // 1. Retrieve & Decode Credentials
        const data = await chrome.storage.local.get('credentials');
        if (!data.credentials || !data.credentials.regno || !data.credentials.password) {
            loginInProgress = false;
            return 'no_credentials';
        }

        const regno = Obfuscator.decode(data.credentials.regno);
        const password = Obfuscator.decode(data.credentials.password);

        // 2. Pre-flight Connectivity Check (bypasses portal entirely if already online)
        try {
            const response = await fetch('http://clients3.google.com/generate_204', {
                cache: "no-store",
                method: 'GET',
                signal: AbortSignal.timeout(1000)
            });
            if (response.status === 204) {
                // Mark session start if not already tracking
                chrome.storage.local.get('sessionStart', (d) => {
                    if (!d.sessionStart) chrome.storage.local.set({ sessionStart: Date.now() });
                });
                loginInProgress = false;
                return 'already_logged_in';
            }
        } catch (e) {
             // 204 failed, we are trapped behind the captive portal
        }

        console.log(`[LPU Login] Fetching portal page: ${LOGIN_URL}`);

        // 3. Fetch Portal HTML (Crucial step to extract dynamically generated variables)
        const getRes = await fetch(LOGIN_URL, { cache: "no-store", method: 'GET' });
        const html = await getRes.text();

        // Failsafe: if portal already shows logout button, we're already authed
        if (html.includes('value="Logout"') || html.includes('name="logout"')) {
            console.log('[LPU Login] Portal indicates already authenticated. Skipping login.');
            loginInProgress = false;
            return 'already_logged_in';
        }

        // 4. Scrape all required hidden inputs injected by the network appliance
        const params = new URLSearchParams();
        const inputTagRegex = /<input\s+([^>]+)>/gi;
        let match;

        while ((match = inputTagRegex.exec(html)) !== null) {
            const attrs = match[1];
            const nameMatch = attrs.match(/name=["']([^"']+)["']/i);
            const valueMatch = attrs.match(/value=["']([^"']*)["']/i);
            if (nameMatch && valueMatch) {
                params.set(nameMatch[1], valueMatch[1]);
            }
        }

        // 5. Append Credentials & Bypasses
        const formattedRegno = regno.includes('@lpu.com') ? regno : `${regno}@lpu.com`;
        console.log(`[LPU Login] Submitting credentials for: ${formattedRegno}`);

        params.set('mode', '191');
        params.delete('logout');
        params.set('username', formattedRegno);
        params.set('password', password);
        params.set('loginotp', 'false');
        params.set('logincaptcha', 'false');
        params.set('registeruserotp', 'false');
        params.set('registercaptcha', 'false');

        // 6. Submit Authentication Payload
        console.log(`[LPU Login] POST → ${AUTH_URL}`);
        const postRes = await fetch(AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        const postBody = await postRes.text();
        console.log(`[LPU Login] POST response: HTTP ${postRes.status}, body length: ${postBody.length} chars`);

        // 7. Validate Response
        // Note: LPU's portal returns HTTP 200 with an EMPTY body on successful login.
        // We cannot do an immediate ping here because the portal needs ~1-2s to activate
        // the session — a premature ping returns 200 (still intercepted), not 204.
        // The popup's verifyConnectionAfterLogin() handles the delayed connectivity check.
        let finalStatus;
        if (postBody.includes('value="Logout"') || postBody.includes('Successfully Logged in')) {
            console.log('[LPU Login] Portal confirmed login via response body.');
            finalStatus = 'login_triggered';
        } else if (postBody.includes('Invalid') || postBody.includes('Failure') || postBody.includes('Expired')) {
            console.log('[LPU Login] Portal returned failure message in response body.');
            finalStatus = 'login_failed';
        } else {
            // Empty body = portal accepted credentials (LPU's portal behaviour).
            // Treat as triggered; popup will verify connectivity after a delay.
            console.log(`[LPU Login] Response body empty/inconclusive (${postBody.length} chars). Treating as login_triggered — popup will verify.`);
            finalStatus = 'login_triggered';
        }

        console.log(`[LPU Login] Final status: ${finalStatus}`);
        loginInProgress = false;
        return finalStatus;

    } catch (error) {
        console.error('Login Error:', error);
        loginInProgress = false;
        return 'error';
    }
}

/**
 * Quick ping to determine actual internet connectivity strictly for the UI popup.
 */
async function checkConnectionStatus() {
    try {
        const response = await fetch('http://clients3.google.com/generate_204', {
            cache: "no-store",
            method: 'GET',
            signal: AbortSignal.timeout(1000)
        });
        return response.status === 204 ? 'connected' : 'disconnected';
    } catch {
        return 'disconnected';
    }
}

/**
 * Retrieves the user's preferred polling interval and schedules the alarm.
 */
async function initializeInterval() {
    try {
        const data = await chrome.storage.local.get('checkInterval');
        CHECK_INTERVAL = data.checkInterval ? parseInt(data.checkInterval) : 1;

        if (!data.checkInterval) {
            chrome.storage.local.set({ checkInterval: CHECK_INTERVAL });
        }

        chrome.alarms.create('checkConnection', { periodInMinutes: CHECK_INTERVAL });
    } catch {
        chrome.alarms.create('checkConnection', { periodInMinutes: 1 });
    }
}

/**
 * Speed Test — Download (256KB) + Upload (128KB) via Cloudflare
 */
async function runSpeedTest() {
    const result = { download: null, upload: null };

    // Download
    try {
        const start = Date.now();
        const res = await fetch('https://speed.cloudflare.com/__down?bytes=262144', {
            cache: 'no-store',
            signal: AbortSignal.timeout(10000)
        });
        const buf = await res.arrayBuffer();
        const secs = (Date.now() - start) / 1000;
        result.download = ((buf.byteLength * 8) / (secs * 1_000_000)).toFixed(1);
    } catch (e) {
        console.log('[SpeedTest] Download failed:', e.message);
    }

    // Upload
    try {
        const payload = new Uint8Array(131072);
        const start = Date.now();
        await fetch('https://speed.cloudflare.com/__up', {
            method: 'POST',
            body: payload,
            cache: 'no-store',
            headers: { 'Content-Type': 'application/octet-stream' },
            signal: AbortSignal.timeout(10000)
        });
        const secs = (Date.now() - start) / 1000;
        result.upload = ((131072 * 8) / (secs * 1_000_000)).toFixed(1);
    } catch (e) {
        console.log('[SpeedTest] Upload failed:', e.message);
    }

    chrome.storage.local.set({ lastSpeedTest: result });
    return result;
}

/**
 * Bootstrapping Listeners
 */
chrome.runtime.onStartup.addListener(() => {
    performLogin();
    initializeInterval();
});

chrome.runtime.onInstalled.addListener(() => {
    performLogin();
    initializeInterval();
});