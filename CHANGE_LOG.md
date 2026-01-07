# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-01-07

### Performance & Engine Optimization
- **Enhanced Concurrency:** Implemented a Read-Write Lock system for Git operations, allowing parallel read commands (diffs/logs) while safely serializing write operations.
- **High-Performance Watcher:** Upgraded to `chokidar` with optimized ignore patterns for `node_modules` and Git internals, drastically reducing CPU usage in large repositories.
- **Large Repo Support:** Doubled the internal Git output buffer to 20MB to prevent crashes when processing large diffs or extensive histories.

### New Features & UX Improvements
- **Stash Content Preview:** Added the ability to inspect files within a stash before applying it, preventing "blind applies."
- **Instant CI/CD Sync:** Successful push operations now trigger an immediate refresh of GitHub Actions, eliminating polling delays.
- **Integrated UI Dialogs:** Replaced native browser popups with themed custom confirmation dialogs for a cohesive "Zed" aesthetic.
- **Spotlight Branch Switcher:** Added a fast, searchable branch switcher accessible via `CmdOrCtrl+B`.
- **Safe-Checkout Flow:** Implemented a robust checkout process that validates working tree state before switching, preventing accidental data loss.
- **Intelligent Redirects:** Added automatic UI redirection to the "Changes" view when stash/pop operations encounter conflicts.

### Bug Fixes
- **GitHub Actions:** Resolved false-negative status reports and improved parsing for non-standard remote Git URLs.
- **Process Stability:** Fixed minor race conditions in the repository watcher during rapid sequential Git operations.

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