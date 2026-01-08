# Changelog

All notable changes to this project will be documented in this file.

## [1.1.1] - 2026-01-08

### New Features
- **Visual Conflict Resolver:** Added a native, 3-pane conflict resolution interface. Users can now resolve merge conflicts directly within GitCanopy by choosing between "Current", "Incoming", or "Both" changes, with support for manual editing.
- **Git Reflog Explorer:** Implemented a visual "Time Machine" for the repository. View historical actions (commits, checkouts, resets) and perform hard resets to any point in the reflog to recover lost work.
- **Stash Diff Viewer:** You can now inspect exact code changes inside a stash before applying it, with support for both tracked and untracked files.
- **Smart Status Redirection:** Sidebar badges for "Rebase in progress" and "Merge Conflicts" are now clickable, providing a tactical shortcut to the Source Control view.
- **Auto-Expansion & Tactical Highlighting:** Conflicted files are automatically exposed by auto-expanding their parent directories and are highlighted with a pulsing tactical red background.

### Security & Performance
- **Secure Path Resolution:** Hardened the Git service with a strict path validation helper, preventing path traversal attacks in file read/write operations.
- **Memory Safeguards:** Added a 5MB limit for text-based file previews to prevent UI lag or crashes when handling massive data blobs.
- **Optimized Conflict Detection:** Replaced full status polling with a targeted unmerged-file check, significantly improving performance in large repositories.

### Bug Fixes
- **Live Rebase Monitoring:** Fixed a bug where the "Rebase in progress" badge would get stuck. The watcher now explicitly monitors rebase/merge metadata files.
- **Status Refresh Race Condition:** Resolved an issue where the sidebar would briefly show a stale "Conflicted" status after a resolution was completed.

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