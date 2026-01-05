# Changelog

All notable changes to this project will be documented in this file.

## [1.0.9] - 2026-01-06

### GitHub Actions Intelligence (New Core Feature)
- **Live Monitoring:** Added a dedicated Actions explorer tab with real-time CI/CD status synchronization.
- **Deep History:** Increased fetch depth to 100 runs to prevent builds and releases from being buried.
- **Intelligent UI:** Integrated search, status filtering, and branch-specific toggles.
- **Descriptive Titles:** Automatically resolves actual commit messages for release workflows.
- **Rich Metadata:** Added explicit labels for Authors, Branches, Tags, and Commit SHAs for every run.

### Core Engine & Stability Fixes
- **Live Working-Tree Sync:** Updated the file-watcher to detect local file edits (saves) immediately, keeping the status view live.
- **Initial Commit Visibility:** Fixed a bug where diffs for the repository's very first commit wouldn't display.
- **Production Path Resolution:** Hardened internal pathing for `preload.js` and `askpass.js` to ensure stability in packaged ASAR environments.
- **Auto-Update Fix:** Resolved an issue where the update service would incorrectly skip checks on macOS.

### UX & Visual Overhaul (Zed Aesthetic)
- **High-Fidelity Components:** Replaced generic popups with custom Zed-inspired themed modals and popovers.
- **Minimalist Header:** Redesigned the top toolbar with an icon-only status indicator and a streamlined layout.
- **Typography Polish:** Refined all font weights and tracking for a lighter, professional "IDE" feel.
- **Layout Stability:** Eliminated UI "wobble" during sync animations using fixed-container sizing.

### Security & Privacy Hardening
- **Encrypted Token Storage:** Implemented Electron `safeStorage` to encrypt GitHub Personal Access Tokens on disk.
- **Path Traversal Protection:** Hardened IPC handlers to prevent unauthorized access to files outside the repository.
- **Git Command Hardening:** Updated all Git service calls to use the `--` separator to prevent flag injection.
- **Protocol Validation:** Restricted external links to strict `http:`/`https:` protocols to prevent malicious command execution.
- **Dependency Audit:** Removed unused `crypto-js` library to reduce attack surface and bundle size.