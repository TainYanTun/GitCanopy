# GitCanopy Development Log

This document tracks the features and fixes implemented in the GitCanopy codebase.

## [2026-05-26] - Mycelia AI Agent Integration (v1.3.0)

### Features

- **Mycelia AI Agent:** Introduced a native AI assistant designed to bridge the local Git workspace with external platforms.
  - **Model Context Protocol (MCP):** Implemented full support for MCP, allowing the agent to discover and execute tools from external servers.
  - **GitLab MCP Integration:** Added native support for GitLab operations (Issues, MRs, CI/CD) via the GitLab MCP server.
  - **Agentic Reasoning:** Integrated an LLM-based reasoning loop that determines the optimal tool path for natural language prompts.
  - **Short-term Memory:** Added conversation context management to enable multi-turn dialogues.
- **Agent UI Pane:** Created a dedicated sidebar panel for interacting with Mycelia.
  - **Markdown Rendering:** AI responses are beautifully formatted using professional Markdown.
  - **Loading Feedback:** Integrated high-fidelity spinners and skeleton loaders for asynchronous agent tasks.

### Technical Improvements

- **MCP Service:** Developed a new core service to manage the lifecycle of MCP server connections (stdio/http).
- **AI Service Expansion:** Added `runAgentCycle` and `summarizeAgentResult` to handle complex agentic workflows and tool output summarization.
- **IPC Handlers:** Expanded the bridge with `triggerDuoAgent` and `checkDuoAgentStatus`.

## [2026-01-08] - Integrated Conflict Resolution

### Features

- **Conflict Resolution UI:** Designed and implemented a dedicated modal for resolving merge conflicts.
  - **Visual Markers:** Parses standard git conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
  - **3-Pane Interface:** Displays "Current (HEAD)", "Incoming", and the "Result" side-by-side (or stacked).
  - **Action Buttons:** "Accept Current", "Accept Incoming", "Keep Both", and "Undo" for each conflict chunk.
  - **Manual Editing:** Allows users to manually refine the resolved text before saving.
- **Workflow Integration:**
  - Integrated directly into the `ChangesView`. Files with "conflicted" status now open the Resolver instead of the standard Diff view.
  - **Auto-Stage:** Automatically stages the file (`git add`) upon successful resolution.

### Technical Improvements

- **Backend Services:** Added `getFileContent` and `resolveConflict` to `GitService` to handle raw file I/O safely.
- **Race Condition Fix:** Implemented an asynchronous delay in the UI refresh logic to ensure the file system and Git status are synchronized after a resolution operation.

## [2026-01-07] - Feature & UI Overhaul

### Fixes

- **Corrected Commit Count:** Fixed an issue where the history view incorrectly reported the total commit count.
  - Added `getTotalCommits` to `GitService` using `git rev-list --all --count`.
  - Updated `CommitHistory` to display the true total count when no filters are active and match count when filtering.

### Features

- **Tag Management:** Added full support for Git tags.
  - **Create Tag:** New modal for creating annotated or lightweight tags at any commit.
  - **Delete Tag:** Support for removing local tags.
  - **Push Tag:** One-click pushing of specific tags to the remote origin.
  - **List Tags:** Comprehensive list view with search/filtering capabilities.
- **Unified Git Objects View:** Created a new "Objects" gallery that combines **Stashes** and **Tags** into a single, tabbed interface, accessible via the status bar.

### UI/UX Refinements

- **Zed-Minimalist Aesthetic:** Refactored the interface to align with the "Zed" hyper-minimalist style.
  - Focused on monospace typography for technical data.
  - Compact, high-density layouts with zero rounded corners.
  - Subtle, high-contrast indicators and hover states.
  - Reduced visual noise by removing redundant borders and excessive padding.
- **Sidebar Cleanup:** Moved Tag and Stash management out of the primary sidebar and into the unified Objects view to keep the workspace focused on the repository structure.

## [2026-01-07] - Interactive Rebase & Workflow

### Features

- **Visual Interactive Rebase:** Added a dedicated interface for performing interactive rebases.
  - **Trigger:** "Interactive Rebase" button added to `CommitDetails` view.
  - **Reordering:** Native drag-and-drop to reorder commits in the rebase todo.
  - **Action Support:** Full support for `pick`, `reword`, `edit`, `squash`, `fixup`, and `drop`.
  - **Automation:** Implemented a background sequence editor to automate the application of rebase actions.
  - **Conflict Awareness:** The UI remains responsive and provides feedback if the rebase process encounters conflicts.

### Technical Improvements

- **Automated Git Sequence Editor:** Implemented a temporary script-based editor to handle `git rebase -i` programmatically from within Electron.
- **IPC Expansion:** Added `startInteractiveRebase`, `continueRebase`, and `abortRebase` to the application bridge.
