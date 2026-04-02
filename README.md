# ⚡ LPU WiFi Auto-Login

A lightweight, set-it-and-forget-it Chrome Extension that automatically logs you into the Lovely Professional University (LPU) captive portal. Never type your registration number and password again!

## 🌊 How It Works (The Flow)

This extension runs completely invisibly in the background. Once you save your credentials, here is exactly what it does:

1. **The Quick Check:** Whenever you open your browser, it instantly tries to reach Google. If it gets a response, it knows you are already connected and goes back to sleep.
2. **The Stealth Login:** If the internet is blocked by the LPU Portal, the extension secretly fetches the login page, extracts all the randomly generated security tokens, bypasses the CAPTCHA, and logs you in instantly behind the scenes.
3. **The Background Guardian:** While you browse, the extension wakes up on a silent timer (default 30 minutes). It quickly verifies your connection and automatically repeats Step 2 if LPU logs you out, ensuring your internet never drops during an important task.

## 📥 How to Install

Since this is a custom extension, you'll need to install it manually on Google Chrome. It takes less than a minute!

1. **Download the Release:** Go to the [Releases Page](https://github.com/iteshxt/lpu-wifi-automate-login/releases) and download the **v2.2.1 ZIP file**. Extract that folder to your computer.
2. **Open Extensions:** In Google Chrome, type `chrome://extensions/` into your URL address bar and press **Enter**.
3. **Turn on Developer Mode:** In the top right corner of the screen, toggle the **Developer mode** switch so it turns blue.
4. **Load the Extension:** Click the newly appeared **Load unpacked** button in the top left corner.
5. **Select the Folder:** Browse to where you extracted the ZIP, select the inner `chome-extension` folder, and click Open.
6. **Set up & Pin:** Click the puzzle piece icon 🧩 in the top right of your browser and pin the **LPU WiFi** extension. Click it, type in your credentials, and you're done!

---
*Built by [Itesh Tomar](https://iteshxt.me) | [GitHub](https://github.com/iteshxt) - Contributions are always welcome!*
