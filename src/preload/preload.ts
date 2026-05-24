import { contextBridge, ipcRenderer } from "electron";
import type {
  GitCanopyAPI,
  Repository,
  Commit,
  Branch,
  StashEntry,
  AppSettings,
  GitCommandLog,
  CommitFilterOptions,
} from "../shared/types";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const gitcanopyAPI: GitCanopyAPI = {
  // Repository operations
  selectRepository: (): Promise<Repository | null> =>
    ipcRenderer.invoke("select-repository"),

  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke("select-directory"),

  getRepository: (path: string) => ipcRenderer.invoke("get-repository", path),
  getStatus: (repoPath: string) => ipcRenderer.invoke("get-status", repoPath),
  clone: (url: string, targetPath: string) =>
    ipcRenderer.invoke("clone", url, targetPath),
  cloneToParent: (url: string, parentPath: string) =>
    ipcRenderer.invoke("clone-to-parent", url, parentPath),
  stageFile: (repoPath: string, filePath: string) =>
    ipcRenderer.invoke("stage-file", repoPath, filePath),
  stageAll: (repoPath: string) => ipcRenderer.invoke("stage-all", repoPath),
  unstageFile: (repoPath: string, filePath: string) =>
    ipcRenderer.invoke("unstage-file", repoPath, filePath),
  unstageAll: (repoPath: string) => ipcRenderer.invoke("unstage-all", repoPath),
  discardChanges: (repoPath: string, filePath: string) =>
    ipcRenderer.invoke("discard-changes", repoPath, filePath),
  commit: (repoPath: string, message: string) =>
    ipcRenderer.invoke("commit", repoPath, message),
  push: (repoPath: string) => ipcRenderer.invoke("push", repoPath),
  forcePush: (repoPath: string) => ipcRenderer.invoke("force-push", repoPath),
  resetHard: (repoPath: string, target: string) =>
    ipcRenderer.invoke("reset-hard", repoPath, target),

  // Git data operations
  getCommits: (
    repoPath: string,
    limit?: number,
    offset?: number,
    options?: CommitFilterOptions,
  ): Promise<Commit[]> =>
    ipcRenderer.invoke("get-commits", repoPath, limit, offset, options),

  getRecentCommits: (repoPath: string): Promise<Commit[]> =>
    ipcRenderer.invoke("get-recent-commits", repoPath),

  getBranches: (repoPath: string): Promise<Branch[]> =>
    ipcRenderer.invoke("get-branches", repoPath),

  getCurrentHead: (repoPath: string): Promise<string> =>
    ipcRenderer.invoke("get-current-head", repoPath),

  checkoutBranch: (repoPath: string, branchName: string): Promise<void> =>
    ipcRenderer.invoke("checkout-branch", repoPath, branchName),

  getStashList: (repoPath: string): Promise<StashEntry[]> =>
    ipcRenderer.invoke("get-stash-list", repoPath),

  getStashFiles: (repoPath: string, index: string): Promise<string[]> =>
    ipcRenderer.invoke("git:get-stash-files", repoPath, index),

  getStashFileDiff: (repoPath: string, index: string, filePath: string): Promise<string> =>
    ipcRenderer.invoke("git:get-stash-file-diff", repoPath, index, filePath),

  stash: (repoPath: string): Promise<void> =>
    ipcRenderer.invoke("git:stash", repoPath),

  applyStash: (repoPath: string, index: string): Promise<void> =>
    ipcRenderer.invoke("git:apply-stash", repoPath, index),

  dropStash: (repoPath: string, index: string): Promise<void> =>
    ipcRenderer.invoke("git:drop-stash", repoPath, index),

  // Tag operations
  createTag: (repoPath: string, tagName: string, commitHash?: string, message?: string): Promise<void> =>
    ipcRenderer.invoke("git:create-tag", repoPath, tagName, commitHash, message),

  deleteTag: (repoPath: string, tagName: string): Promise<void> =>
    ipcRenderer.invoke("git:delete-tag", repoPath, tagName),

  pushTag: (repoPath: string, tagName: string): Promise<void> =>
    ipcRenderer.invoke("git:push-tag", repoPath, tagName),

  getTags: (repoPath: string): Promise<string[]> =>
    ipcRenderer.invoke("git:get-tags", repoPath),

  getReflog: (repoPath: string, limit?: number): Promise<any[]> =>
    ipcRenderer.invoke("get-reflog", repoPath, limit),

  getCommitDetails: (repoPath: string, commitHash: string): Promise<Commit> =>
    ipcRenderer.invoke("get-commit-details", repoPath, commitHash),

  getDiff: (repoPath: string, commitHash: string, filePath: string) =>
    ipcRenderer.invoke("git:get-diff", repoPath, commitHash, filePath),
  getFileContent: (repoPath: string, filePath: string) =>
    ipcRenderer.invoke("git:get-file-content", repoPath, filePath),
  resolveConflict: (repoPath: string, filePath: string, content: string) =>
    ipcRenderer.invoke("git:resolve-conflict", repoPath, filePath, content),
  mergeBranch: (repoPath: string, branchName: string) =>
    ipcRenderer.invoke("git:merge-branch", repoPath, branchName),
  squash: (repoPath: string, commitHashes: string[]) =>
    ipcRenderer.invoke("squash", repoPath, commitHashes),

  // AI
  generateCommitMessage: (repoPath: string) =>
    ipcRenderer.invoke("generate-commit-message", repoPath),
  resolveConflictWithAi: (current: string, incoming: string, context?: string) =>
    ipcRenderer.invoke("resolve-conflict-with-ai", current, incoming, context),
  explainDiff: (diff: string) =>
    ipcRenderer.invoke("git:explain-diff", diff),
  translateNaturalLanguageToGit: (query: string, context: string) =>
    ipcRenderer.invoke("translate-natural-language-to-git", query, context),
  analyzeGitError: (error: string, context: string) =>
    ipcRenderer.invoke("git:analyze-error", error, context),
  auditSecurity: (repoPath: string) =>
    ipcRenderer.invoke("git:audit-security", repoPath),
  triggerDuoAgent: (prompt: string, context: string, history?: any[]) =>
    ipcRenderer.invoke("git:trigger-duo-agent", prompt, context, history),
  checkDuoAgentStatus: () =>
    ipcRenderer.invoke("git:check-duo-agent-status"),
  createGitLabIssue: (title: string, description: string) =>
    ipcRenderer.invoke("git:create-gitlab-issue", title, description),

  getHotFiles: (repoPath: string, limit?: number, options?: CommitFilterOptions) =>
    ipcRenderer.invoke("git:get-hot-files", repoPath, limit, options),
  getWorkRhythm: (repoPath: string) =>
    ipcRenderer.invoke("git:get-work-rhythm", repoPath),
  getContributors: (repoPath: string) =>
    ipcRenderer.invoke("git:get-contributors", repoPath),
  getTeamPulse: (stats: any[]) =>
    ipcRenderer.invoke("git:get-team-pulse", stats),
  getGitCommandHistory: (
    limit?: number,
    offset?: number,
  ): Promise<GitCommandLog[]> =>
    ipcRenderer.invoke("get-git-command-history", limit, offset),
  clearGitCommandHistory: (): Promise<void> =>
    ipcRenderer.invoke("clear-git-command-history"),
  getFileDataUrl: (repoPath: string, filePath: string): Promise<string | null> =>
    ipcRenderer.invoke("get-file-data-url", repoPath, filePath),

  // GitHub Integration
  getWorkflowRuns: (repoPath: string, branchName?: string) => 
    ipcRenderer.invoke("get-workflow-runs", repoPath, branchName),
  validateGitHubToken: (token: string) => 
    ipcRenderer.invoke("validate-github-token", token),

  // File system operations
  watchRepository: (repoPath: string): Promise<void> =>
    ipcRenderer.invoke("watch-repository", repoPath),

  unwatchRepository: (repoPath: string): Promise<void> =>
    ipcRenderer.invoke("unwatch-repository", repoPath),

  // Settings
  getSettings: (repoPath?: string): Promise<AppSettings> => ipcRenderer.invoke("get-settings", repoPath),

  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke("save-settings", settings),

  getGlobalConfig: (key: string): Promise<string> =>
    ipcRenderer.invoke("git:get-global-config", key),

  setGlobalConfig: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke("git:set-global-config", key, value),

  getLocalConfig: (repoPath: string, key: string): Promise<string> =>
    ipcRenderer.invoke("git:get-local-config", repoPath, key),

  setLocalConfig: (repoPath: string, key: string, value: string): Promise<void> =>
    ipcRenderer.invoke("git:set-local-config", repoPath, key, value),

  clearRecentRepositories: (): Promise<void> =>
    ipcRenderer.invoke("clear-recent-repositories"),

  executeRawGitCommand: (repoPath: string, command: string) =>
    ipcRenderer.invoke("execute-raw-git-command", repoPath, command),

  getInitialRepo: (): Promise<string | null> =>
    ipcRenderer.invoke("get-initial-repo"),

  getAppVersion: (): Promise<string> => ipcRenderer.invoke("get-app-version"),

  // Event listeners
  onRepositoryChanged: (callback: (event: any) => void): (() => void) => {
    const wrappedCallback = (_: any, event: any) => callback(event);
    ipcRenderer.on("repository-changed", wrappedCallback);
    return () => {
      ipcRenderer.removeListener("repository-changed", wrappedCallback);
    };
  },

  onCommitsUpdated: (callback: (event: any) => void): (() => void) => {
    const wrappedCallback = (_: any, event: any) => callback(event);
    ipcRenderer.on("commits-updated", wrappedCallback);
    return () => {
      ipcRenderer.removeListener("commits-updated", wrappedCallback);
    };
  },

  onBranchesUpdated: (callback: (event: any) => void): (() => void) => {
    const wrappedCallback = (_: any, event: any) => callback(event);
    ipcRenderer.on("branches-updated", wrappedCallback);
    return () => {
      ipcRenderer.removeListener("branches-updated", wrappedCallback);
    };
  },

  onHeadChanged: (callback: (event: any) => void): (() => void) => {
    const wrappedCallback = (_: any, event: any) => callback(event);
    ipcRenderer.on("head-changed", wrappedCallback);
    return () => {
      ipcRenderer.removeListener("head-changed", wrappedCallback);
    };
  },

  onMenuOpenRepository: (callback: () => void): (() => void) => {
    const wrappedCallback = () => callback();
    ipcRenderer.on("menu:open-repository", wrappedCallback);
    return () => {
      ipcRenderer.removeListener("menu:open-repository", wrappedCallback);
    };
  },

  onMenuOpenBranchSwitcher: (callback: () => void): (() => void) => {
    const wrappedCallback = () => callback();
    ipcRenderer.on("menu:open-branch-switcher", wrappedCallback);
    return () => {
      ipcRenderer.removeListener("menu:open-branch-switcher", wrappedCallback);
    };
  },

  onMenuSyncRepository: (callback: () => void): (() => void) => {
    const wrappedCallback = () => callback();
    ipcRenderer.on("menu:sync-repository", wrappedCallback);
    return () => {
      ipcRenderer.removeListener("menu:sync-repository", wrappedCallback);
    };
  },

  onPushCompleted: (callback: () => void): (() => void) => {
    const wrappedCallback = () => callback();
    ipcRenderer.on("push-completed", wrappedCallback);
    return () => {
      ipcRenderer.removeListener("push-completed", wrappedCallback);
    };
  },

  onCloneProgress: (callback: (progress: string) => void): (() => void) => {
    const wrappedCallback = (_: any, progress: string) => callback(progress);
    ipcRenderer.on("clone-progress", wrappedCallback);
    return () => {
      ipcRenderer.removeListener("clone-progress", wrappedCallback);
    };
  },

  // Utility functions
  showItemInFolder: (path: string): Promise<void> =>
    ipcRenderer.invoke("show-item-in-folder", path),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("open-external", url),

  copyToClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke("copy-to-clipboard", text),

  // Auth
  submitAuth: (answer: string): Promise<void> => ipcRenderer.invoke("auth-submit", answer),
  cancelAuth: (): Promise<void> => ipcRenderer.invoke("auth-cancel"),
  onAuthRequest: (callback: (event: { prompt: string }) => void): (() => void) => {
    const wrappedCallback = (_: any, event: any) => callback(event);
    ipcRenderer.on("auth-request", wrappedCallback);
    return () => {
      ipcRenderer.removeListener("auth-request", wrappedCallback);
    };
  },
  
  reviewCode: (repoPath: string) => ipcRenderer.invoke("git:review-code", repoPath),

  // MCP
  connectMcpServer: (config: any) => ipcRenderer.invoke("mcp:connect-server", config),
  getAllMcpTools: () => ipcRenderer.invoke("mcp:get-all-tools"),
  getMcpServers: () => ipcRenderer.invoke("mcp:get-servers"),
  callMcpTool: (toolName: string, args: any) => ipcRenderer.invoke("mcp:call-tool", toolName, args),
};

// Expose the API to the renderer process
try {
  contextBridge.exposeInMainWorld("gitcanopyAPI", gitcanopyAPI);
} catch (error) {
  console.error("Failed to expose gitcanopyAPI:", error);
}

// Prevent the renderer process from accessing Node.js APIs
try {
  Object.freeze(gitcanopyAPI);
} catch (error) {
  console.error("Failed to freeze gitcanopyAPI:", error);
}
