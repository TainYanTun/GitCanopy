import React, { useState, useEffect } from "react";
import { WorkflowRun } from "@shared/types";
import {
  SyncOutlined,
  WarningOutlined,
  GithubOutlined,
  RightOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import { Modal, Popover } from "antd";
import { useToast } from "./ToastContext";
import moment from "moment";

interface GitHubStatusProps {
  repoPath: string;
  currentBranch: string;
  onOpenActions: () => void;
}

export const GitHubStatus: React.FC<GitHubStatusProps> = ({
  repoPath,
  currentBranch,
  onOpenActions,
}) => {
  const { showToast } = useToast();
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isAuthError, setIsAuthError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  const fetchStatus = async () => {
    if (isAuthError) return;
    setLoading(true);
    try {
      const fetchedRuns = await window.gitcanopyAPI.getWorkflowRuns(
        repoPath,
        undefined, // Fetch all runs to include tags and releases
      );
      setRuns(fetchedRuns);
      setIsAuthError(false);
    } catch (err: any) {
      console.error("Failed to fetch workflow runs:", err);
      const msg = err.message || "";
      if (
        msg.includes("401") ||
        msg.includes("Unauthorized") ||
        msg.includes("credentials")
      ) {
        setIsAuthError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const checkToken = async () => {
    try {
      const settings = await window.gitcanopyAPI.getSettings();
      const tokenExists = !!settings.githubToken;
      setHasToken(tokenExists);
      if (tokenExists) {
        fetchStatus();
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkToken();
    
    const unlisten = window.gitcanopyAPI.onRepositoryChanged(() => {
      if (hasToken && !isAuthError) fetchStatus();
    });

    // Smart Refresh: Sync when window gets focus
    const handleFocus = () => {
      if (hasToken && !isAuthError) fetchStatus();
    };
    window.addEventListener("focus", handleFocus);

    // Dynamic Polling: Fast (5s) if a build is active, Slow (30s) if idle
    const poll = async () => {
      if (!hasToken || isAuthError || loading) return;
      
      await fetchStatus();
      
      // Look at the most recent run to determine next interval
      const latest = runs[0];
      const isRunning = latest?.status === "in_progress" || latest?.status === "queued";
      
      // Clear and reschedule
      clearInterval(statusInterval);
      statusInterval = setInterval(poll, isRunning ? 5000 : 30000);
    };

    let statusInterval = setInterval(poll, 10000);
    const tokenCheckInterval = setInterval(checkToken, 5000);

    return () => {
      unlisten();
      window.removeEventListener("focus", handleFocus);
      clearInterval(tokenCheckInterval);
      clearInterval(statusInterval);
    };
  }, [repoPath, currentBranch, hasToken, isAuthError, runs[0]?.status]);

  const handleSaveToken = async () => {
    const token = tokenInput.trim();
    if (!token) return;

    setIsValidating(true);
    try {
      const isValid = await window.gitcanopyAPI.validateGitHubToken(token);

      if (!isValid) {
        showToast(
          "Invalid GitHub Token. Please check your token and scopes.",
          "error",
        );
        setIsValidating(false);
        return;
      }

      const settings = await window.gitcanopyAPI.getSettings();
      await window.gitcanopyAPI.saveSettings({
        ...settings,
        githubToken: token,
        githubTokenCreated: Date.now(),
      });

      setHasToken(true);
      setIsAuthError(false);
      setIsModalOpen(false);
      setTokenInput("");
      showToast("GitHub connected successfully", "success");
      fetchStatus();
    } catch (e) {
      showToast("Connection failed. Check your internet or token.", "error");
    } finally {
      setIsValidating(false);
    }
  };

  const latestRun = runs.length > 0 ? runs[0] : null;

  const renderPopoverContent = () => (
    <div className="w-72 bg-zed-bg dark:bg-zed-dark-bg text-zed-text dark:text-zed-dark-text p-1">
      <div className="px-3 py-2 border-b border-zed-border dark:border-zed-dark-border flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-zed-muted">
          Recent Actions
        </span>
        {loading && <SyncOutlined spin className="text-[10px] opacity-50" />}
      </div>

      <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
        {runs.slice(0, 5).map((run) => (
          <div
            key={run.id}
            onClick={() => window.gitcanopyAPI.openExternal(run.html_url)}
            className="flex items-start gap-3 p-2 hover:bg-zed-element/50 dark:hover:bg-zed-dark-element/50 rounded cursor-pointer group transition-colors"
          >
            <div className="pt-0.5 shrink-0">
              {run.status === "in_progress" ? (
                <SyncOutlined spin className="text-blue-500 text-xs" />
              ) : run.conclusion === "success" ? (
                <PlayCircleOutlined className="text-green-500 text-xs" />
              ) : run.conclusion === "failure" ? (
                <PlayCircleOutlined className="text-red-500 text-xs" />
              ) : (
                <PlayCircleOutlined className="text-yellow-500 text-xs" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold truncate leading-tight group-hover:text-zed-accent transition-colors">
                {run.display_title}
              </div>
              <div className="flex items-center gap-2 mt-1 opacity-60 text-[9px] font-medium uppercase tracking-tighter">
                <span>{run.name}</span>
                <span>•</span>
                <span>{moment(run.created_at).fromNow(true)}</span>
              </div>
            </div>
          </div>
        ))}
        {runs.length === 0 && !loading && (
          <div className="py-8 text-center text-[10px] text-zed-muted italic opacity-50">
            No runs found.
          </div>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-zed-border dark:border-zed-dark-border">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsPopoverOpen(false);
            onOpenActions();
          }}
          className="w-full py-1.5 text-[10px] font-black uppercase tracking-widest text-zed-accent hover:bg-zed-accent/10 transition-colors rounded flex items-center justify-center gap-2"
        >
          View Full Actions Tab <RightOutlined className="text-[8px]" />
        </button>
      </div>
    </div>
  );

  if (!hasToken || isAuthError) {
    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-[10px] font-bold uppercase tracking-wider ${
            isAuthError
              ? "text-red-500 hover:bg-red-500/10"
              : "text-zed-muted dark:text-zed-dark-muted hover:bg-zed-element dark:hover:bg-zed-dark-element"
          }`}
          title={
            isAuthError
              ? "GitHub Token is invalid. Click to fix."
              : "Connect GitHub to see CI status"
          }
        >
          {isAuthError ? <WarningOutlined /> : <GithubOutlined />}
          {isAuthError ? "Fix Connection" : "Connect"}
        </button>
        <Modal
          title={null}
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
          centered
          width={400}
          classNames={{
            content:
              "p-0 overflow-hidden bg-zed-bg dark:bg-zed-dark-surface rounded-lg border border-zed-border dark:border-zed-dark-border shadow-2xl",
          }}
        >
          <div className="p-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zed-text dark:text-zed-dark-text mb-4">
              GitHub Authentication
            </h3>
            <p className="text-xs text-zed-muted dark:text-zed-dark-muted mb-6 leading-relaxed">
              Generate a <strong>Personal Access Token</strong> with{" "}
              <code className="bg-zed-element dark:bg-zed-dark-element px-1 rounded font-mono">
                repo
              </code>{" "}
              scope to monitor CI/CD status.
            </p>

            <div className="space-y-6">
              <input
                type="password"
                placeholder="Paste token (ghp_...)"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveToken()}
                className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border px-3 py-2 text-xs font-mono focus:outline-none focus:border-zed-accent text-zed-text dark:text-zed-dark-text placeholder:opacity-30"
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zed-muted dark:text-zed-dark-muted hover:text-zed-text dark:hover:text-zed-dark-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveToken}
                  disabled={!tokenInput.trim() || isValidating}
                  className="px-4 py-1.5 bg-zed-accent hover:opacity-90 text-white text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isValidating && <SyncOutlined spin className="text-[8px]" />}
                  {isValidating ? "Checking..." : "Save Token"}
                </button>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zed-border/30 dark:border-zed-dark-border/30">
              <span className="text-[9px] text-zed-muted uppercase tracking-widest opacity-50">
                Security: Stored locally in settings.json
              </span>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  if (loading && !latestRun) {
    return (
      <div className="flex items-center gap-1.5 px-2 text-zed-muted opacity-50 text-[10px]">
        <SyncOutlined spin /> Checking...
      </div>
    );
  }

  if (!latestRun) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 text-zed-muted opacity-50 text-[10px]"
        title="No workflow runs found for this branch"
      >
        <GithubOutlined /> No Runs
      </div>
    );
  }

  const getStatusIcon = () => {
    if (latestRun.status === "queued" || latestRun.status === "in_progress")
      return <SyncOutlined spin className="text-blue-500" />;

    if (latestRun.conclusion === "success")
      return <PlayCircleOutlined className="text-green-500" />;
    if (latestRun.conclusion === "failure")
      return <PlayCircleOutlined className="text-red-500" />;

    return <PlayCircleOutlined className="text-yellow-500" />;
  };

  return (
    <Popover
      content={renderPopoverContent()}
      trigger="click"
      open={isPopoverOpen}
      onOpenChange={setIsPopoverOpen}
      placement="bottomLeft"
      overlayClassName="github-status-popover"
      color="transparent"
    >
      <div
        className="flex items-center gap-1 px-1.5 py-0.5 transition-opacity hover:opacity-70 group cursor-pointer"
        title={`GitHub Actions: ${latestRun.name} #${latestRun.run_number}`}
      >
        <div className="flex items-center justify-center pt-px text-xs">
          {getStatusIcon()}
        </div>
        <RightOutlined className="text-[7px] text-zed-muted opacity-40 group-hover:opacity-100 transition-opacity rotate-90 mt-0.5" />
      </div>
    </Popover>
  );
};
