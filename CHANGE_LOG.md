# Changelog

All notable changes to this project will be documented in this file.

## [1.3.2] - 2026-05-26

### Bug Fixes
- **Critical Runtime Fix**: Disabled manual chunk splitting for Ant Design and React. This resolves a `TypeError` where Ant Design failed to detect the React version due to chunk initialization order.

## [1.3.1] - 2026-05-26

### Bug Fixes
- **Runtime Stability**: Resolved a critical `TypeError` in the Ant Design bundle by optimizing component initialization and import structures.
- **Dependency Optimization**: Replaced experimental virtualization in the MCP panel with a stable high-performance grid to prevent bundle-splitting conflicts.

## [1.3.0] - 2026-05-24

### Mycelia AI Agent (New Core Feature)
- **Integrated AI Agent:** Introduced Mycelia, a native AI assistant designed to bridge your local Git workspace with external tools and platforms.
- **Model Context Protocol (MCP):** Full support for MCP, allowing Mycelia to automate cross-platform workflows, inspect system states, and execute advanced repository operations.
- **GitLab MCP Integration:** Native support for the official GitLab MCP server. Link your GitLab account to query/create issues, manage merge requests, and trigger CI/CD pipelines directly from the agent pane.
- **Agentic Reasoning:** Mycelia uses LLM-based reasoning to determine the optimal tool path and execute complex tasks in response to natural language prompts.
- **Beautiful Markdown Summaries:** AI-powered formatting that transforms raw JSON tool outputs into elegant, structured reports.
- **Short-term Memory:** Mycelia maintains conversation context to provide relevant assistance throughout your active session.

## [1.2.2] - 2026-01-27

### Interaction Engine
- **Marquee Selection (Select Mode):** Introduced precision bulk selection in the commit graph. Hold Left-click and drag in Select Mode to group multiple commits.
- **Squash Commits:** Added support for squashing multiple selected commits into a single staged change, enabling a cleaner repository history.
- **Polymorphic Drag-to-Merge:** Merging can now be initiated by dragging either the branch label or the commit node itself.
- **Enhanced Keyboard Shortcuts:** Added `V` (Select Mode), `H` (Pan Mode), `Esc` (Clear Selection), and `Cmd+C` (Copy Hashes).

### Remote Synchronization
- **Safe Force Push:** Added support for `--force-with-lease`. The UI now automatically offers a red "Force Push" option when local history has diverged from remote.
- **Remote Intelligence:** GitCanopy now dynamically identifies the correct upstream (origin, upstream, etc.) instead of assuming 'origin'.
- **Auto-Fetch Integration:** Performing a Force Push now automatically triggers a background fetch to prevent "stale info" errors.
- **Contextual UI Labels:** Synchronize buttons now explicitly name the branch being targeted (e.g., "Publish feature/login").

### Data Clarity & UX
- **Branch Noise Reduction:** Commit Details now intelligently categorizes branches into "Primary" and "Ancestors" (collapsed by default).
- **Origin Tracking:** The Commit History list now displays the inferred branch of origin for every commit.
- **Hyper-Minimalist UI:** Refined with 0.5px borders, invisible scrollbars, and sharp 1px selection rings.
- **Copiable Error Toasts:** All error notifications now feature a "Copy Error" button and selectable text.

### Bug Fixes
- **Hook Order Fix:** Resolved a React error in the Commit Details panel.
- **Performance:** Implemented Set-equality checks in the marquee logic to prevent redundant React re-renders.

## [1.2.1] - 2026-01-25

### AI Command Center (v2)
- **Minimalist Text Interface:** Completely redesigned the command palette (`Cmd+J`) into a sleek, text-first interface using a "Zinc" glassmorphism aesthetic.
- **Hybrid Execution Engine:** Now supports **Direct Execution** for standard Git commands (skipping AI translation for zero latency) while retaining AI capabilities for natural language intents.
- **Smart Context:** The input bar intelligently detects if you are typing a command or a request, adapting its behavior and UI feedback instantly.

### Security Hardening
- **Strict Command Whitelist:** Implemented a rigorous whitelist for the `executeRawGitCommand` interface. Only safe, standard Git subcommands are allowed.
- **Injection Prevention:** Explicitly blocked dangerous configuration flags (e.g., `-c`, `--config`, `--exec-path`) to prevent arbitrary code execution via Git configuration overrides.
- **Input Sanitization:** Enhanced argument parsing to safely handle quotes and spacing, preventing shell injection vectors.

### Performance
- **Zero-Latency Path:** Standard Git commands (e.g., `git status`, `git push`) now bypass the AI service entirely, executing immediately.
- **Optimized Data Fetching:** The Command Center now reuses cached branch data from the main application state, eliminating redundant IPC calls and reducing UI lag.

## [1.2.0] - 2026-01-21

### AI & Automation
- **Quality Review:** Added an intelligent pre-commit reviewer. Gemini analyzes staged changes and provides a quality score (0-100) with categorized feedback on logic, bugs, and performance.
- **AI-Powered Commit Generation:** Introduced `AiService` to automatically generate semantic commit messages based on staged changes using Gemini, OpenAI, or Claude.
- **Smart Conflict Resolution:** Added AI-assisted merge conflict resolution with a dedicated UI. Users can now provide specific instructions to guide the AI's merging decisions.
- **Secure Key Management:** Implemented secure storage for AI API keys (Gemini, OpenAI, Claude) and GitHub Personal Access Tokens in the application settings.

### Performance
- **Virtualized Changes View:** Implemented `react-window` virtualization for unstaged and staged file lists, significantly improving responsiveness for repositories with thousands of changes.
- **Large File Protection:** Added a 1MB limit for untracked file diff previews to prevent UI freezes.
- **Optimized Conflict Parser:** Improved the conflict parser in `ConflictResolver` to correctly handle trailing newlines and complex chunks.

### UI/UX Improvements
- **Markdown Rendering:** Integrated `react-markdown` to properly parse and render Markdown content within the application (e.g., in commit descriptions or help views).
- **Refined Conflict UI:** Comprehensive visual polish across the `ConflictResolver`, `ChangesView`, and `DiffModal` components for a more consistent "Zed-like" aesthetic.
- **GitHub Integration Settings:** Added a dedicated configuration section for GitHub Personal Access Tokens to enable private repository features.

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