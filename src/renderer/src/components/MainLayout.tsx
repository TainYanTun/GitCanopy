import React, { useState, useEffect } from "react";
import {
  Repository,
  Branch,
  Commit,
  CommitFilterOptions,
} from "@src/shared/types";
import { useTheme } from "./ThemeContext";
import { useToast } from "./ToastContext";
import { BranchExplorer } from "./BranchExplorer";
import { CommitMiniLog } from "./CommitMiniLog";
import { HotFiles } from "./HotFiles";
import { CommitHistory } from "./CommitHistory";
import { Contributors } from "./Contributors";
import { StashGallery } from "./StashGallery";
import { CommitGraph } from "./CommitGraph";
import { CommitDetails } from "./CommitDetails";
import { ChangesView } from "./ChangesView";
import { BranchSwitcherModal } from "./BranchSwitcherModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { HelpView } from "./HelpView";
import { GitConsole } from "./GitConsole";
import { GitHubStatus } from "./GitHubStatus";
import { WorkflowRuns } from "./WorkflowRuns";
import { SyncOutlined } from "@ant-design/icons";

interface MainLayoutProps {
  repository: Repository;
  onCloseRepository: () => void;
  onRefreshRepository?: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  repository,
  onCloseRepository,
  onRefreshRepository,
}) => {
  const { toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [stashes, setStashes] = useState<string[]>([]);
  const [version, setVersion] = useState<string>("");
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [commitFilters, setCommitFilters] = useState<CommitFilterOptions>({});
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isBranchSwitcherOpen, setIsBranchSwitcherOpen] = useState(false);
  const [pendingCheckoutBranch, setPendingCheckoutBranch] = useState<string | null>(null);
  const [showStashConfirm, setShowStashConfirm] = useState(false);
  const PAGE_SIZE = 50;
  const [currentView, setCurrentView] = useState<
    | "graph"
    | "insights"
    | "history"
    | "changes"
    | "contributors"
    | "stashes"
    | "help"
    | "console"
    | "actions"
  >("graph");

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const v = await window.gitcanopyAPI.getAppVersion();
        setVersion(v);
      } catch (e) {
        console.error("Failed to fetch version:", e);
      }
    };
    fetchVersion();
  }, []);

  const refreshData = React.useCallback(async () => {
    try {
      // Reset pagination on full refresh
      setOffset(0);
      setHasMore(true);

      const [fetchedBranches, fetchedCommits, fetchedStashes] =
        await Promise.all([
          window.gitcanopyAPI.getBranches(repository.path),
          window.gitcanopyAPI.getCommits(
            repository.path,
            PAGE_SIZE,
            0,
            commitFilters,
          ),
          window.gitcanopyAPI.getStashList(repository.path),
        ]);
      setBranches(fetchedBranches);
      setCommits(fetchedCommits);
      setStashes(fetchedStashes);

      if (fetchedCommits.length < PAGE_SIZE) {
        setHasMore(false);
      }

      onRefreshRepository?.();
    } catch (error) {
      console.error("Failed to refresh data:", error);
      showToast("Failed to refresh repository data.", "error");
    }
  }, [repository.path, showToast, commitFilters]);

  const loadMoreCommits = async () => {
    if (!hasMore) return;
    try {
      const nextOffset = offset + PAGE_SIZE;
      const newCommits = await window.gitcanopyAPI.getCommits(
        repository.path,
        PAGE_SIZE,
        nextOffset,
        commitFilters,
      );

      if (newCommits.length < PAGE_SIZE) {
        setHasMore(false);
      }

      setCommits((prev) => [...prev, ...newCommits]);
      setOffset(nextOffset);
    } catch (error) {
      console.error("Failed to load more commits:", error);
      showToast("Failed to load more commits", "error");
    }
  };

  const loadAllCommits = async () => {
    try {
      showToast(
        "Loading full repository history... This may take a moment.",
        "info",
      );
      const allCommits = await window.gitcanopyAPI.getCommits(
        repository.path,
        10000, // Large enough limit for "all"
        0,
        commitFilters,
      );
      setCommits(allCommits);
      setHasMore(false);
      showToast(`Loaded ${allCommits.length} commits.`, "success");
    } catch (error) {
      console.error("Failed to load all commits:", error);
      showToast("Failed to load all commits", "error");
    }
  };

  useEffect(() => {
    refreshData();

    let unsubscribeBranches: (() => void) | undefined;
    let unsubscribeCommits: (() => void) | undefined;
    let unsubscribeHead: (() => void) | undefined;
    let unsubscribeMenuSwitcher: (() => void) | undefined;
    let unsubscribeMenuSync: (() => void) | undefined;

    if (window.gitcanopyAPI) {
      unsubscribeBranches = window.gitcanopyAPI.onBranchesUpdated(refreshData);
      unsubscribeCommits = window.gitcanopyAPI.onCommitsUpdated(refreshData);
      unsubscribeHead = window.gitcanopyAPI.onHeadChanged(refreshData);
      
      unsubscribeMenuSwitcher = window.gitcanopyAPI.onMenuOpenBranchSwitcher(() => {
        setIsBranchSwitcherOpen(true);
      });
      
      unsubscribeMenuSync = window.gitcanopyAPI.onMenuSyncRepository(() => {
        refreshData();
        showToast("Syncing repository...", "info");
      });
    }

    return () => {
      unsubscribeBranches?.();
      unsubscribeCommits?.();
      unsubscribeHead?.();
      unsubscribeMenuSwitcher?.();
      unsubscribeMenuSync?.();
    };
  }, [repository.path, repository.currentBranch, refreshData]);

  const handleBranchSelect = async (branchName: string) => {
    if (branchName === repository.currentBranch) return;

    try {
      // 1. Check for uncommitted changes
      const status = await window.gitcanopyAPI.getStatus(repository.path);
      const hasChanges = status.files.some(f => f.status !== 'untracked');

      if (hasChanges) {
        setPendingCheckoutBranch(branchName);
        setShowStashConfirm(true);
        return;
      }

      // 2. No changes? Direct checkout
      await performCheckout(branchName);
    } catch (error) {
      console.error("Status check failed:", error);
      // Fallback to direct checkout attempt if status check fails
      await performCheckout(branchName);
    }
  };

  const performCheckout = async (branchName: string) => {
    if (
      window.gitcanopyAPI &&
      typeof window.gitcanopyAPI.checkoutBranch === "function"
    ) {
      try {
        showToast(`Checking out ${branchName}...`, "info");
        await window.gitcanopyAPI.checkoutBranch(repository.path, branchName);
        showToast(`Checked out ${branchName}`, "success");
        refreshData();
      } catch (error) {
        console.error("Checkout failed:", error);
        showToast(
          `Checkout failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error",
        );
      }
    } else {
      showToast("Checkout feature is currently unavailable.", "info");
    }
  };

  const handleStashAndCheckout = async () => {
    if (!pendingCheckoutBranch) return;
    
    try {
      setShowStashConfirm(false);
      showToast("Stashing changes...", "info");
      await window.gitcanopyAPI.stash(repository.path);
      showToast("Changes stashed", "success");
      
      await performCheckout(pendingCheckoutBranch);
      setPendingCheckoutBranch(null);
    } catch (error) {
      console.error("Stash & Checkout failed:", error);
      showToast("Failed to stash changes", "error");
    }
  };

  const handleCommitSelect = (commit: Commit) => {
    setSelectedCommit(commit);
  };

  const handleFileHistorySelect = (filePath: string) => {
    setCommitFilters({ path: filePath });
    setCurrentView("history");
    showToast(`Filtering history for ${filePath.split("/").pop()}`, "info");
  };

  const clearFilters = () => {
    setCommitFilters({});
    showToast("Cleared all filters", "info");
  };

  const handleFilterChange = (newFilters: CommitFilterOptions) => {
    setCommitFilters(newFilters);
  };

  // Keyboard shortcut for closing the right sidebar and manual refresh
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedCommit(null);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "r") {
        event.preventDefault();
        refreshData();
        showToast("Refreshing repository...", "info");
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "b") {
        event.preventDefault();
        setIsBranchSwitcherOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const renderMainContent = () => {
    switch (currentView) {
      case "graph":
        return (
          <CommitGraph
            commits={commits}
            branches={branches}
            stashes={stashes}
            headCommitHash={repository.headCommit}
            selectedCommitHash={selectedCommit?.hash}
            onCommitSelect={handleCommitSelect}
            onLoadMore={loadMoreCommits}
            hasMore={hasMore}
            onLoadAll={loadAllCommits}
          />
        );
      case "history":
        return (
          <CommitHistory
            repoPath={repository.path}
            commits={commits}
            branches={branches}
            headCommitHash={repository.headCommit}
            onCommitSelect={handleCommitSelect}
            selectedCommitHash={selectedCommit?.hash}
            filters={commitFilters}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
            onLoadMore={loadMoreCommits}
            hasMore={hasMore}
          />
        );
      case "changes":
        return <ChangesView repoPath={repository.path} />;
      case "contributors":
        return (
          <div className="max-w-none w-full h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 scrollbar-hide bg-zed-surface dark:bg-zed-dark-surface">
            <div className="p-12 max-w-6xl mx-auto">
              <div className="mb-10">
                <h1 className="text-2xl font-bold text-zed-text dark:text-zed-dark-text tracking-tight">
                  Team Insights
                </h1>
                <p className="text-sm text-zed-muted dark:text-zed-dark-muted opacity-70">
                  Analysis of contributor activity, development impact, and
                  chronological engagement.
                </p>
              </div>
              <Contributors repoPath={repository.path} />
            </div>
          </div>
        );
      case "insights":
        return (
          <div className="max-w-none w-full h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 scrollbar-hide bg-zed-surface dark:bg-zed-dark-surface">
            <div className="p-12 max-w-5xl mx-auto">
              <div className="mb-10">
                <h1 className="text-2xl font-bold text-zed-text dark:text-zed-dark-text tracking-tight">
                  Repository Insights
                </h1>
                <p className="text-sm text-zed-muted dark:text-zed-dark-muted opacity-70">
                  Analysis of file modification frequency and repository
                  hotspots.
                </p>
              </div>
              <div className="bg-zed-surface dark:bg-zed-dark-surface border border-zed-border dark:border-zed-dark-border relative overflow-hidden shadow-sm">
                <div className="p-1 border-b border-zed-border dark:border-zed-dark-border bg-zed-element/30 dark:bg-zed-dark-element/30 flex items-center justify-between px-4 py-2">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-zed-muted dark:text-zed-dark-muted">
                    Hotspots / Top Modified
                  </h2>
                </div>
                <HotFiles
                  repoPath={repository.path}
                  onFileClick={handleFileHistorySelect}
                  filters={commitFilters}
                />
              </div>
            </div>
          </div>
        );
      case "stashes":
        return (
          <StashGallery 
            repoPath={repository.path} 
            onViewChanges={() => setCurrentView("changes")}
          />
        );
      case "help":
        return <HelpView />;
      case "console":
        return <GitConsole />;
      case "actions":
        return (
          <WorkflowRuns
            repoPath={repository.path}
            currentBranch={repository.currentBranch}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-zed-bg dark:bg-zed-dark-bg text-zed-text dark:text-zed-dark-text overflow-hidden">
      {isBranchSwitcherOpen && (
        <BranchSwitcherModal
          visible={isBranchSwitcherOpen}
          branches={branches}
          currentBranch={repository.currentBranch}
          onClose={() => setIsBranchSwitcherOpen(false)}
          onSelectBranch={handleBranchSelect}
        />
      )}
      <ConfirmDialog
        isOpen={showStashConfirm}
        title="Uncommitted Changes Detected"
        message="You have modified files in your working directory. Switching branches may cause conflicts. Would you like to stash your changes before switching?"
        confirmText="Stash & Checkout"
        cancelText="Cancel"
        type="warning"
        onConfirm={handleStashAndCheckout}
        onCancel={() => {
          setShowStashConfirm(false);
          setPendingCheckoutBranch(null);
        }}
      />
      {/* Title Bar / Toolbar */}
      <div className="h-10 flex items-center justify-between px-4 bg-zed-bg dark:bg-zed-dark-bg border-b border-zed-border dark:border-zed-dark-border select-none shrink-0 draggable">
        <div className="flex items-center gap-3">
          {/* Window Controls Placeholder (Mac) */}
          <div className="w-14 no-drag"></div>

          {/* Sidebar Toggle */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-1.5 rounded hover:bg-zed-element dark:hover:bg-zinc-700 text-zed-muted hover:text-zed-text dark:hover:text-white transition-colors no-drag ${!isSidebarOpen ? "text-zed-accent dark:text-zed-accent" : ""}`}
            title="Toggle Sidebar"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

                    <span className="text-xs font-medium text-zed-muted uppercase tracking-wider pl-2 border-l border-zed-border dark:border-zed-dark-border">
                      {repository.name}
                    </span>
                  </div>
          
                  <div className="flex items-center gap-2 no-drag">
                    <GitHubStatus 
                      repoPath={repository.path} 
                      currentBranch={repository.currentBranch} 
                      onOpenActions={() => setCurrentView("actions")}
                    />
          
                    <button
                      onClick={toggleTheme}            className="p-1.5 rounded hover:bg-zed-element text-zed-muted hover:text-zed-text transition-colors"
            title="Toggle Theme"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </button>

          <button
            onClick={onCloseRepository}
            className="p-1.5 rounded hover:bg-zed-element text-zed-muted hover:text-commit-fix transition-colors"
            title="Close Repository"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (Project Explorer Style) */}
        {isSidebarOpen && (
          <div className="w-60 flex-shrink-0 flex flex-col border-r border-zed-border dark:border-zed-dark-border bg-zed-surface dark:bg-zed-dark-surface animate-slide-in-left">
            <div className="px-3 py-2 text-xs font-bold text-zed-muted dark:text-zed-dark-muted uppercase tracking-wider flex items-center justify-between group">
              <span>Project Info</span>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
              <div className="space-y-1">
                <div className="text-[11px] text-zed-muted uppercase">
                  Repository
                </div>
                <div
                  className="text-sm text-zed-text dark:text-zed-dark-text truncate"
                  title={repository.path}
                >
                  {repository.name}
                </div>
                <div className="text-xs text-zed-muted dark:text-zed-dark-muted font-mono truncate opacity-60">
                  {repository.path}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-zed-muted dark:text-zed-dark-muted uppercase">
                  Status
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-sm text-zed-text dark:text-zed-dark-text">
                    <span
                      className={`w-2 h-2 rounded-full ${repository.isDetached ? "bg-commit-refactor" : "bg-zed-accent"}`}
                    ></span>
                    <button 
                      onClick={() => setIsBranchSwitcherOpen(true)}
                      className="truncate hover:text-zed-accent hover:underline cursor-pointer focus:outline-none"
                      title="Click to switch branch (Cmd+B)"
                    >
                      {repository.currentBranch}
                    </button>
                    {repository.isDetached && (
                      <span className="text-[9px] bg-zed-element dark:bg-zed-dark-element px-1 rounded border border-zed-border dark:border-zed-dark-border opacity-70">
                        DETACHED
                      </span>
                    )}
                  </div>

                  {repository.isRebasing && (
                    <div className="flex items-center gap-2 text-[10px] text-commit-refactor font-bold uppercase tracking-tight bg-commit-refactor/10 px-2 py-1 rounded border border-commit-refactor/20">
                      <svg
                        className="w-3 h-3 animate-spin-slow"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Rebase in progress
                    </div>
                  )}

                  {repository.isMerging && (
                    <div className="flex items-center gap-2 text-[10px] text-commit-fix font-bold uppercase tracking-tight bg-commit-fix/10 px-2 py-1 rounded border border-commit-fix/20">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                      Merge Conflicts
                    </div>
                  )}

                  <div className="text-xs font-mono text-zed-muted dark:text-zed-dark-muted">
                    HEAD: {repository.headCommit.substring(0, 7)}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="px-3 py-2 text-[10px] font-bold text-zed-muted dark:text-zed-dark-muted uppercase tracking-[0.1em] flex items-center justify-between group opacity-50">
                  <span>Branches</span>
                </div>
                <BranchExplorer
                  branches={branches}
                  currentBranchName={repository.currentBranch}
                  onBranchSelect={handleBranchSelect}
                />
              </div>

              <div className="space-y-1">
                <div className="px-3 py-2 text-[10px] font-bold text-zed-muted dark:text-zed-dark-muted uppercase tracking-[0.1em] flex items-center justify-between group opacity-50">
                  <span>Recent</span>
                </div>
                <CommitMiniLog
                  repoPath={repository.path}
                  onCommitSelect={handleCommitSelect}
                />
              </div>
            </div>
          </div>
        )}

        {/* Editor Area (Graph or Insights) */}
        <div className="flex-1 flex flex-col bg-zed-bg dark:bg-zed-dark-bg relative min-w-0">
          {/* Canvas Area */}
          <div className="flex-1 overflow-hidden relative group">
            {renderMainContent()}
          </div>
        </div>

        {/* Right Sidebar for Commit Details */}
        {selectedCommit && (
          <div className="w-80 flex-shrink-0 flex flex-col border-l border-zed-border dark:border-zed-dark-border bg-zed-surface dark:bg-zed-dark-surface animate-slide-in-right z-30">
            <div className="px-3 py-2 text-xs font-bold text-zed-muted dark:text-zed-dark-muted uppercase tracking-wider flex items-center justify-between group">
              <span>Commit Details</span>
              <button
                onClick={() => setSelectedCommit(null)}
                className="p-1.5 rounded hover:bg-zed-element dark:hover:bg-zinc-700 text-zed-muted hover:text-zed-text dark:hover:text-white transition-colors no-drag"
                title="Close Commit Details"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CommitDetails
                commit={selectedCommit}
                repoPath={repository.path}
                onSelectCommit={(hashToSelect) => {
                  const commitToSelect = commits.find(
                    (c) => c.hash === hashToSelect,
                  );
                  if (commitToSelect) {
                    setSelectedCommit(commitToSelect);
                  } else {
                    setSelectedCommit({ hash: hashToSelect } as Commit);
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="h-9 shrink-0 flex items-center justify-between px-3 bg-zed-surface dark:bg-zed-dark-surface border-t border-zed-border dark:border-zed-dark-border text-[11px] text-zed-text dark:text-zed-dark-text select-none py-1 no-drag relative z-20">
        <div className="flex items-center">
          <div
            className={`flex items-center border-r border-zed-border dark:border-zed-dark-border mr-3 transition-all duration-300 ${isSidebarOpen ? "w-[228px] justify-between pr-4" : "w-auto gap-1 pr-2"}`}
          >
            <button
              onClick={() => setCurrentView("graph")}
              className={`p-1.5 rounded-none transition-all duration-200 ${currentView === "graph" ? "bg-zed-element dark:bg-zed-dark-element text-zed-text dark:text-zed-dark-text shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zed-muted/50 dark:text-zed-dark-muted/80 hover:text-zed-text dark:hover:text-zed-dark-text hover:bg-zed-element/50 dark:hover:bg-zed-dark-element"}`}
              title="Graph View"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM6 3v12M18 9a9 9 0 01-9 9"
                />
              </svg>
            </button>
            <button
              onClick={() => setCurrentView("history")}
              className={`p-1.5 rounded-none transition-all duration-200 ${currentView === "history" ? "bg-zed-element dark:bg-zed-dark-element text-zed-text dark:text-zed-dark-text shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zed-muted/50 dark:text-zed-dark-muted/80 hover:text-zed-text dark:hover:text-zed-dark-text hover:bg-zed-element/50 dark:hover:bg-zed-dark-element"}`}
              title="Commit History"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            <button
              onClick={() => setCurrentView("changes")}
              className={`p-1.5 rounded-none transition-all duration-200 ${currentView === "changes" ? "bg-zed-element dark:bg-zed-dark-element text-zed-text dark:text-zed-dark-text shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zed-muted/50 dark:text-zed-dark-muted/80 hover:text-zed-text dark:hover:text-zed-dark-text hover:bg-zed-element/50 dark:hover:bg-zed-dark-element"}`}
              title="Uncommitted Changes"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
            <button
              onClick={() => setCurrentView("insights")}
              className={`p-1.5 rounded-none transition-all duration-200 ${currentView === "insights" ? "bg-zed-element dark:bg-zed-dark-element text-zed-text dark:text-zed-dark-text shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zed-muted/50 dark:text-zed-dark-muted/80 hover:text-zed-text dark:hover:text-zed-dark-text hover:bg-zed-element/50 dark:hover:bg-zed-dark-element"}`}
              title="Insights View"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </button>
            <button
              onClick={() => setIsBranchSwitcherOpen(true)}
              className={`p-1.5 rounded-none transition-all duration-200 text-zed-muted/50 dark:text-zed-dark-muted/80 hover:text-zed-text dark:hover:text-white hover:bg-zed-element/50 dark:hover:bg-zinc-700`}
              title="Switch Branch (Cmd+B)"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </button>
            <button
              onClick={() => setCurrentView("contributors")}
              className={`p-1.5 rounded-none transition-all duration-200 ${currentView === "contributors" ? "bg-zed-element dark:bg-zed-dark-element text-zed-text dark:text-zed-dark-text shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zed-muted/50 dark:text-zed-dark-muted/80 hover:text-zed-text dark:hover:text-zed-dark-text hover:bg-zed-element/50 dark:hover:bg-zed-dark-element"}`}
              title="Contributors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </button>
          </div>

          <button
            onClick={() => {
              refreshData();
              showToast("Refreshing repository data...", "info");
            }}
            className="flex items-center gap-1.5 text-zed-muted dark:text-zed-dark-muted hover:text-zed-text dark:hover:text-zed-dark-text transition-colors group px-1.5 py-0.5 rounded-sm hover:bg-zed-element dark:hover:bg-zed-dark-element"
          >
            <div className="w-3 h-3 flex items-center justify-center">
              <SyncOutlined className="text-[11px] group-active:animate-spin opacity-70 group-hover:opacity-100" />
            </div>
            <span className="font-medium">Sync</span>
          </button>
        </div>
        <div className="flex items-center gap-4 text-zed-muted dark:text-zed-dark-muted">
          <div className="flex items-center gap-1 border-r border-zed-border dark:border-zed-dark-border pr-4 mr-2">
            <button
              onClick={() => setCurrentView("stashes")}
              className={`p-1.5 rounded-none transition-all duration-200 ${currentView === "stashes" ? "bg-zed-element dark:bg-zed-dark-element text-zed-text dark:text-zed-dark-text shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zed-muted/50 dark:text-zed-dark-muted/80 hover:text-zed-text dark:hover:text-zed-dark-text hover:bg-zed-element/50 dark:hover:bg-zed-dark-element"}`}
              title="Stash Gallery"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </button>
            <button
              onClick={() => setCurrentView("console")}
              className={`p-1.5 rounded-none transition-all duration-200 ${currentView === "console" ? "bg-zed-element dark:bg-zed-dark-element text-zed-text dark:text-zed-dark-text shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zed-muted/50 dark:text-zed-dark-muted/80 hover:text-zed-text dark:hover:text-zed-dark-text hover:bg-zed-element/50 dark:hover:bg-zed-dark-element"}`}
              title="Git Console"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </button>
            <button
              onClick={() => setCurrentView("help")}
              className={`p-1.5 rounded-none transition-all duration-200 ${currentView === "help" ? "bg-zed-element dark:bg-zed-dark-element text-zed-text dark:text-zed-dark-text shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zed-muted/50 dark:text-zed-dark-muted/80 hover:text-zed-text dark:hover:text-zed-dark-text hover:bg-zed-element/50 dark:hover:bg-zed-dark-element"}`}
              title="User Guide"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          </div>
          <span>UTF-8</span>
          <span>GitCanopy v{version}</span>
        </div>
      </div>
    </div>
  );
};
