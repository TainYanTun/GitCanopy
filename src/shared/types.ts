// Shared type definitions for GitCanopy application

export type CommitType =
  | "feat"
  | "fix"
  | "docs"
  | "style"
  | "refactor"
  | "perf"
  | "test"
  | "chore"
  | "revert"
  | "other";

export type BranchType =
  | "main"
  | "develop"
  | "feature"
  | "release"
  | "hotfix"
  | "custom";

export interface Author {
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface FileChange {
  status: "A" | "M" | "D" | "R" | "C" | "U"; // Added, Modified, Deleted, Renamed, Copied, Unmerged
  path: string;
  previousPath?: string; // For renamed/copied files
}

export interface CommitParent {
  hash: string;
  shortHash: string;
  author?: Author; // Optional author details
  shortMessage?: string; // Optional short message
}

export interface CommitStats {
  additions: number;
  deletions: number;
  total: number;
}

export interface Commit {
  hash: string;
  shortHash: string;
  parents: string[];
  message: string;
  shortMessage: string;
  type: CommitType;
  author: Author;
  committer: Author;
  timestamp: number;
  isMerge: boolean;
  isSquash: boolean;
  branchName?: string;

  // New properties for detailed view
  parentsDetails?: CommitParent[]; // Detailed parent info
  fileChanges?: FileChange[];
  branches?: string[]; // Branches that contain this commit
  branchTips?: string[]; // Branches that point exactly to this commit
  tags?: string[]; // Tags that point to this commit
  children?: CommitParent[]; // Direct children of this commit (optional, for graph navigation)
  stats?: CommitStats; // Commit statistics (lines added/deleted)
}

export interface Branch {
  name: string;
  type: BranchType;
  objectName: string;
  isHead: boolean;
  isLocal: boolean;
  isRemote: boolean;
  upstream?: string;
  color: string;
  lane: number;
}

export type StashEntry = string;

export interface Repository {
  path: string;
  name: string;
  isValidGit: boolean;
  currentBranch: string;
  headCommit: string;
  branches: Branch[];
  totalCommits: number;
  isRebasing: boolean;
  isMerging: boolean;
  hasConflicts: boolean;
  isDetached: boolean;
}

export interface CommitGraph {
  commits: Commit[];
  branches: Branch[];
  repository: Repository;
  lanes: LaneInfo[];
}

export interface LaneInfo {
  id: number;
  branchName: string;
  color: string;
  startCommit: string;
  endCommit?: string;
}

export interface LaneSegment {
  lane: number;
  x: number;
  startY: number;
  endY: number;
  color: string;
  branchName: string;
}

export interface GraphNode {
  id: string;
  commit: Commit;
  x: number;
  y: number;
  lane: number;
  color: string;
  shape: "circle" | "diamond" | "square";
  size: number;
  children: string[];
  parents: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  color: string;
  type: "normal" | "merge" | "branch";
  points: Array<{ x: number; y: number }>;
}

export interface VisualizationData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  laneSegments: LaneSegment[];
  width: number;
  height: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export interface GitCommandLog {
  id: string;
  command: string;
  args: string[];
  timestamp: number;
  duration: number;
  exitCode: number;
  success: boolean;
}

export interface GitCommand {
  command: string;
  args: string[];
  cwd: string;
}

export interface GitCommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
  maxCommits: number;
  autoRefresh: boolean;
  refreshInterval: number;
  showAuthor: boolean;
  showTimestamp: boolean;
  compactMode: boolean;
  colorBlindMode: boolean;
  recentRepositories?: string[];
  githubToken?: string;
  githubTokenCreated?: number;
  lastSeenVersion?: string;
  aiProvider?: "gemini" | "openai" | "claude";
  aiApiKey?: string;
  openaiApiKey?: string;
  claudeApiKey?: string;
  geminiModel?: string;
  openaiModel?: string;
  claudeModel?: string;
}

export interface WorkflowRunStep {
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion:
    | "success"
    | "failure"
    | "cancelled"
    | "skipped"
    | "timed_out"
    | "action_required"
    | "neutral"
    | null;
  number: number;
}

export interface WorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: "queued" | "in_progress" | "completed";
  conclusion:
    | "success"
    | "failure"
    | "cancelled"
    | "skipped"
    | "timed_out"
    | "action_required"
    | "neutral"
    | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_number: number;
  event: string;
  display_title: string;
  head_commit?: {
    id: string;
    message: string;
    timestamp: string;
    author: {
      name: string;
      email: string;
    };
  };
  actor: {
    login: string;
  };
}

export interface TooltipData {
  commit: Commit;
  x: number;
  y: number;
  visible: boolean;
}

export interface ZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

// Events
export interface RepositoryChangedEvent {
  type: "repository-changed";
  repository: Repository;
}

export interface CommitsUpdatedEvent {
  type: "commits-updated";
  commits: Commit[];
}

export interface BranchesUpdatedEvent {
  type: "branches-updated";
  branches: Branch[];
}

export interface HeadChangedEvent {
  type: "head-changed";
  newHead: string;
  oldHead: string;
}

export type AppEvent =
  | RepositoryChangedEvent
  | CommitsUpdatedEvent
  | BranchesUpdatedEvent
  | HeadChangedEvent;

export interface HotFile {
  path: string;
  count: number;
}

export interface ContributorStats {
  name: string;
  email: string;
  avatarUrl: string;
  commitCount: number;
  additions: number;
  deletions: number;
  firstCommit: number;
  lastCommit: number;
  activity: number[]; // Array of commit counts across time buckets
}

// API interfaces for IPC communication
export interface CommitFilterOptions {
  path?: string;
  author?: string;
  since?: string;
  until?: string;
  query?: string;
}

export interface StatusFile {
  path: string;
  status:
    | "added"
    | "modified"
    | "deleted"
    | "renamed"
    | "untracked"
    | "conflicted";
  staged: boolean;
}

export interface WorkingTreeStatus {
  files: StatusFile[];
  ahead: number;
  behind: number;
}

export interface ReflogEntry {
  selector: string;
  hash: string;
  shortHash: string;
  action: string;
  subject: string;
  timestamp: number;
}

export interface GitCanopyAPI {
  // Repository operations
  selectRepository: () => Promise<Repository | null>;
  selectDirectory: () => Promise<string | null>;
  getRepository: (path: string) => Promise<Repository>;
  getStatus: (repoPath: string) => Promise<WorkingTreeStatus>;
  clone: (url: string, targetPath: string) => Promise<void>;
  cloneToParent: (url: string, parentPath: string) => Promise<string>;
  stageFile: (repoPath: string, filePath: string) => Promise<void>;
  unstageFile: (repoPath: string, filePath: string) => Promise<void>;
  discardChanges: (repoPath: string, filePath: string) => Promise<void>;
  stageAll: (repoPath: string) => Promise<void>;
  unstageAll: (repoPath: string) => Promise<void>;
  commit: (repoPath: string, message: string) => Promise<void>;
  push: (repoPath: string) => Promise<void>;
  resetHard: (repoPath: string, target: string) => Promise<void>;

  // Git data operations
  getCommits: (
    repoPath: string,
    limit?: number,
    offset?: number,
    options?: CommitFilterOptions,
  ) => Promise<Commit[]>;
  getRecentCommits: (repoPath: string) => Promise<Commit[]>;
  getBranches: (repoPath: string) => Promise<Branch[]>;
  getCurrentHead: (repoPath: string) => Promise<string>;
  checkoutBranch: (repoPath: string, branchName: string) => Promise<void>;
  getStashList: (repoPath: string) => Promise<StashEntry[]>;
  getStashFiles: (repoPath: string, index: string) => Promise<string[]>;
  getStashFileDiff: (
    repoPath: string,
    index: string,
    filePath: string,
  ) => Promise<string>;
  stash: (repoPath: string) => Promise<void>;
  applyStash: (repoPath: string, index: string) => Promise<void>;
  dropStash: (repoPath: string, index: string) => Promise<void>;

  // Tag operations
  createTag: (
    repoPath: string,
    tagName: string,
    commitHash?: string,
    message?: string,
  ) => Promise<void>;
  deleteTag: (repoPath: string, tagName: string) => Promise<void>;
  pushTag: (repoPath: string, tagName: string) => Promise<void>;
  getTags: (repoPath: string) => Promise<string[]>;

  getReflog: (repoPath: string, limit?: number) => Promise<ReflogEntry[]>;
  getCommitDetails: (repoPath: string, commitHash: string) => Promise<Commit>;
  getDiff: (
    repoPath: string,
    commitHash: string,
    filePath: string,
  ) => Promise<string>;
  getHotFiles: (
    repoPath: string,
    limit?: number,
    options?: CommitFilterOptions,
  ) => Promise<HotFile[]>;
  getWorkRhythm: (repoPath: string) => Promise<Record<string, number>>;
  getTeamPulse: (stats: any[]) => Promise<string>;
  getContributors: (repoPath: string) => Promise<ContributorStats[]>;
  getGitCommandHistory: (
    limit?: number,
    offset?: number,
  ) => Promise<GitCommandLog[]>;
  clearGitCommandHistory: () => Promise<void>;
  getFileDataUrl: (
    repoPath: string,
    filePath: string,
  ) => Promise<string | null>;
  getFileContent: (repoPath: string, filePath: string) => Promise<string>;
  resolveConflict: (
    repoPath: string,
    filePath: string,
    content: string,
  ) => Promise<void>;

  // AI
  generateCommitMessage: (repoPath: string) => Promise<{ summary: string; description: string }>;
  resolveConflictWithAi: (current: string, incoming: string, context?: string) => Promise<string>;
  explainDiff: (diff: string) => Promise<string>;

  // GitHub Integration
  getWorkflowRuns: (
    repoPath: string,
    branchName?: string,
  ) => Promise<WorkflowRun[]>;
  validateGitHubToken: (token: string) => Promise<boolean>;

  // File system operations
  watchRepository: (repoPath: string) => Promise<void>;
  unwatchRepository: (repoPath: string) => Promise<void>;

  // Settings
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  getGlobalConfig: (key: string) => Promise<string>;
  setGlobalConfig: (key: string, value: string) => Promise<void>;
  clearRecentRepositories: () => Promise<void>;

  getInitialRepo: () => Promise<string | null>;
  getAppVersion: () => Promise<string>;

  // Events
  onRepositoryChanged: (
    callback: (event: RepositoryChangedEvent) => void,
  ) => () => void;
  onCommitsUpdated: (
    callback: (event: CommitsUpdatedEvent) => void,
  ) => () => void;
  onBranchesUpdated: (
    callback: (event: BranchesUpdatedEvent) => void,
  ) => () => void;
  onHeadChanged: (callback: (event: HeadChangedEvent) => void) => () => void;
  onMenuOpenRepository: (callback: () => void) => () => void;
  onMenuOpenBranchSwitcher: (callback: () => void) => () => void;
  onMenuSyncRepository: (callback: () => void) => () => void;
  onPushCompleted: (callback: () => void) => () => void;

  // Utility
  showItemInFolder: (path: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  copyToClipboard: (text: string) => Promise<void>;

  // Auth
  submitAuth: (answer: string) => Promise<void>;
  cancelAuth: () => Promise<void>;
  onAuthRequest: (callback: (event: { prompt: string }) => void) => () => void;
  
  reviewCode: (repoPath: string) => Promise<CodeReviewResult>;
}

export interface CodeReviewResult {
  score: number;
  summary: string;
  issues: Array<{
    type: 'security' | 'bug' | 'optimization' | 'style';
    file: string;
    message: string;
    severity: 'high' | 'medium' | 'low';
  }>;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    gitcanopyAPI: GitCanopyAPI;
  }
}

export {};
