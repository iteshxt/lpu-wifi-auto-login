# ⚡ LPU WiFi Auto-Login Extension

A comprehensive browser extension designed to autonomously bypass the Lovely Professional University (LPU) captive portal. Never type your registration number and password again!

## 🌐 Google Chrome Extension
Our sleek, highly optimized browser extension built completely from the ground up with a premium Shadcn-inspired dark mode UI. 

### ✨ Features
- **True Background Polling**: Uses Chrome's native `chrome.alarms` API to seamlessly check your connection status at custom intervals (1m to 1hr). 
- **Definitive Status Checks**: Pings `clients3.google.com/generate_204` just like Android/iOS native captive portal detectors to guarantee you are truly online without false negatives.
- **Smart Disconnect**: Explicitly supports logging out of the network via a single click, elegantly jumping over the broken Captive Portal SSL (`10.10.0.1`) security warnings entirely behind the scenes.
- **Dynamic Visual Badging**: The UI dynamically morphs between "Checking...", Red "Disconnected" states, and Green "Connected" states instantly, responding live to your actual network traffic.
- **Credential Storage**: Safely obfuscates your LPU credentials in Chrome's isolated local storage.

### 📥 Installation Walkthrough
1. **Download the Source:** Clone this repository or download it as a ZIP and extract it to your local drive.
2. **Open Extensions Page:** In Google Chrome, type `chrome://extensions/` into your address bar and press Enter.
3. **Enable Developer Mode:** In the top right corner of the extensions page, toggle the switch that says **Developer mode** to ON.
4. **Load Unpacked:** Click the **Load unpacked** button that appears in the top left corner.
5. **Select Folder:** Navigate to where you extracted the repository, and select the specific `chome-extension` folder.
6. **Set up & Pin It:** The extension icon will now appear in your browser. Click the puzzle icon in the top right to pin it to your toolbar. Click the extension, enter your credentials into the Dashboard once, and enjoy endless automated connectivity!

---
*Built by [Itesh Tomar](https://iteshxt.me) | [GitHub](https://github.com/iteshxt) - Contributions are always welcome!*
