# macOS Installation Guide

GitCanopy is currently an independently developed open-source tool. Because the application is not yet digitally signed with an Apple Developer Certificate, macOS Gatekeeper will block it from running by default.

While we recommend building from source for maximum security, if you wish to use the pre-built `.dmg`, follow the workaround below.

## ⚠️ The Workaround

If you see a message saying **"GitCanopy is damaged and can't be opened"** or **"Apple cannot check it for malicious software"**, follow these steps:

### Method 1: The Standard "Open" Bypass
1.  Open your **Applications** folder in Finder.
2.  Locate **GitCanopy.app**.
3.  **Right-Click** (or Control-Click) the app icon and select **Open**.
4.  A dialog will appear with an "Open" button. Click it to confirm you trust the application.
5.  You will only need to do this once.

### Method 2: The Terminal Fix (If Method 1 fails)
If macOS insists the app is "damaged," it is likely just a quarantine flag. Open your Terminal and run from root directory:

```bash
sudo xattr -cr /Applications/GitCanopy.app
```

## ⛔ Downsides & Risks

Using unsigned software on macOS comes with several limitations:

1.  **Security Risk:** macOS cannot verify that the binary hasn't been tampered with. Only download GitCanopy from the [official GitHub repository](https://github.com/TainYanTun/GitCanopy).
2.  **No Auto-Updates:** The built-in auto-update feature (`UpdateService`) is disabled for unsigned apps on macOS to prevent security breaches. You will need to manually download new versions from GitHub.
3.  **Installation Friction:** You must manually bypass Gatekeeper for every major version update.
4.  **System Permissions:** You may be prompted multiple times for permissions (like folder access or Git execution) because the app lacks a verified identity.

## 🛠 Better Alternative: Build from Source
If you are a developer, we highly recommend running the app in development mode or building it locally. This bypasses all security warnings:

```bash
git clone https://github.com/TainYanTun/GitCanopy.git
cd GitCanopy
bun install
bun run build
bun run electron
```
