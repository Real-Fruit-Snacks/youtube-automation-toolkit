<div align="center">
  <h1>YouTube Automation Toolkit</h1>
  <p><strong>A premium Chrome Extension to bulk-manage your YouTube account.</strong></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![Manifest V3](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/)
  [![Chrome Extension](https://img.shields.io/badge/Platform-Chrome-orange.svg)]()
</div>

<br />

The **YouTube Automation Toolkit** is a powerful Chrome Extension (Manifest V3) designed to clean up your YouTube account effortlessly. It features a beautiful dark slate, glassmorphic UI offering two automated tools:

1. **Watch Later Cleaner:** Bulk-remove all videos from your YouTube "Watch Later" playlist with a single click.
2. **Subscriptions Manager:** Mass-unsubscribe from all channels automatically, intelligently navigating YouTube's dynamic UI.

---

## 🌟 Key Features

- **Premium UI/UX:** Dual-mode tabbed layout with a glassmorphic sliding indicator. Custom icons, live stats counters, a gradient progress bar, and monospaced console logs.
- **Background Execution:** Automation loops run in the active YouTube tab context. You can safely close the extension popup without stopping the automation. Reopening the popup instantly syncs progress.
- **Smart DOM Automation:**
  - **Watch Later:** Automatically finds video dropdown menus and clicks the "Remove from Watch later" button. 
  - **Subscriptions:** Automatically clicks the channel "Subscribed" button, seamlessly handles the new YouTube dropdown notification menus, waits for the native confirm dialog, and clicks "Unsubscribe". 
- **Language Agnostic:** Uses standard IDs and attributes to work across different regions and languages, with built-in fallbacks.
- **Custom Configuration:**
  - **Action Delay Slider:** Set the speed delay (400ms - 3000ms) between clicks to avoid YouTube rate limits.
  - **Label Customization:** Override button text if you use a non-English locale or if YouTube pushes an A/B test with new wording.
  - **Auto-Scroll Toggle:** Automatically scrolls down to lazy-load more items as lists shrink.
- **Fail-Safe Mechanisms:** If an item fails to process (e.g., unavailable/deleted videos or UI lags), the extension safely skips it after 3 attempts to prevent infinite loops.

---

## 🚀 Installation (Developer Mode)

Since this extension interacts deeply with YouTube's DOM, it is provided as an unpacked developer extension.

1. Download the latest release `.zip` from the [Releases](#) tab and extract it, or clone this repository.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the extracted `youtube-automation-toolkit` folder.
6. Pin the extension to your Chrome toolbar for easy access!

---

## 📖 How to Use

### Mode 1: Watch Later Cleaner
1. Navigate to your YouTube **Watch Later** playlist: `https://www.youtube.com/playlist?list=WL`
2. Open the extension popup and select the **Watch Later** tab.
3. Click **Start**. The console will log video removals as they happen.

### Mode 2: Subscriptions Manager
1. Navigate to your YouTube **Subscriptions Manager** page: `https://www.youtube.com/feed/channels`
2. Open the extension popup and click the **Subscriptions** tab.
3. Click **Start**. The extension will automatically scroll, click "Subscribed", navigate any intermediate menus, and confirm the unsubscription.

---

## ⚙️ Configuration Settings

To customize the automation, expand the **Configuration** section in the popup:

- **Action Delay (ms):** The delay between operations.
  - *Watch Later:* Recommended `800ms - 1000ms`.
  - *Subscriptions:* Recommended `1200ms - 1800ms` (Unsubscribing requires multiple dialog renders and is more sensitive to rate limits).
- **Label Override:** If YouTube updates its wording, input the exact wording of the delete/confirm buttons here.
- **Auto-Scroll Page:** Check this so the script can scroll to lazy-load more videos/channels when it reaches the bottom of the page.

---

## 🛠️ Troubleshooting

- **YouTube is showing rate limits/errors:** YouTube might temporarily restrict account actions if you unsubscribe or delete too fast. Pause the process, increase the **Action Delay** slider to `1500ms` or higher, wait a minute, and click resume.
- **The script is stuck or not responding:** Reload the YouTube tab (`F5`) to re-initialize the automation context, then reopen the popup and click **Start** again.

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
