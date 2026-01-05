import React, { useState, useEffect } from "react";
import { WorkflowRun } from "@shared/types";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  GithubOutlined,
  SyncOutlined,
  ExportOutlined,
  BranchesOutlined,
  DisconnectOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { Modal } from "antd";
import moment from "moment";

interface WorkflowRunsProps {
  repoPath: string;
  currentBranch: string;
}

export const WorkflowRuns: React.FC<WorkflowRunsProps> = ({
  repoPath,
  currentBranch,
}) => {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasToken, setHasToken] = useState(true);
  const [isAuthError, setIsAuthError] = useState(false);
  const [filterByBranch, setFilterByBranch] = useState(true);
  const [isDisconnectModalVisible, setIsDisconnectModalVisible] =
    useState(false);

  const fetchRuns = async () => {
    if (isAuthError) return; // Stop polling if token is dead

    setLoading(true);
    try {
      const settings = await window.gitcanopyAPI.getSettings();
      if (!settings.githubToken) {
        setHasToken(false);
        setLoading(false);
        return;
      }
      setHasToken(true);
      const data = await window.gitcanopyAPI.getWorkflowRuns(
        repoPath,
        currentBranch,
      );
      setRuns(data);
      setIsAuthError(false);
    } catch (err: any) {
      console.error("Failed to fetch runs:", err);
      if (
        err.message?.includes("401") ||
        err.message?.includes("Unauthorized")
      ) {
        setIsAuthError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const settings = await window.gitcanopyAPI.getSettings();
      await window.gitcanopyAPI.saveSettings({
        ...settings,
        githubToken: undefined,
        githubTokenCreated: undefined,
      });
      setHasToken(false);
      setIsAuthError(false);
      setRuns([]);
      setIsDisconnectModalVisible(false);
    } catch (err) {
      console.error("Failed to disconnect:", err);
    }
  };

  useEffect(() => {
    const checkTokenStatus = async () => {
      const settings = await window.gitcanopyAPI.getSettings();
      const tokenExists = !!settings.githubToken;
      if (tokenExists !== hasToken) {
        setHasToken(tokenExists);
        if (tokenExists) {
          setIsAuthError(false);
          fetchRuns();
        }
      }
    };

    fetchRuns();
    const tokenInterval = setInterval(checkTokenStatus, 5000);
    const syncInterval = setInterval(() => {
      if (hasToken && !isAuthError && !loading) fetchRuns();
    }, 15000);

    return () => {
      clearInterval(tokenInterval);
      clearInterval(syncInterval);
    };
  }, [repoPath, currentBranch, hasToken, isAuthError]);

  const getStatusIcon = (status: string, conclusion: string | null) => {
    if (status === "queued" || status === "in_progress")
      return <SyncOutlined spin className="text-blue-500" />;

    if (conclusion === "success")
      return <CheckCircleOutlined className="text-green-500" />;

    if (conclusion === "failure")
      return <CloseCircleOutlined className="text-red-500" />;

    if (conclusion === "cancelled")
      return <StopOutlined className="text-gray-500" />;

    return <WarningOutlined className="text-yellow-500" />;
  };

  if (!hasToken || isAuthError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-zed-bg dark:bg-zed-dark-bg animate-in fade-in">
        <div className="w-12 h-12 rounded-lg bg-zed-element dark:bg-zed-dark-element flex items-center justify-center mb-4">
          {isAuthError ? (
            <WarningOutlined className="text-2xl text-red-500" />
          ) : (
            <GithubOutlined className="text-2xl text-zed-muted opacity-80" />
          )}
        </div>

        <h2 className="text-sm font-semibold mb-2 text-zed-text dark:text-zed-dark-text">
          {isAuthError
            ? "GitHub Connection Failed"
            : "GitHub Connection Required"}
        </h2>

        <p className="text-xs text-zed-muted max-w-sm leading-relaxed mb-6">
          {isAuthError
            ? "Your Personal Access Token is invalid or has expired. Please reconnect to resume CI/CD monitoring."
            : "Link your GitHub account using a Personal Access Token to see live CI/CD status directly in GitCanopy."}
        </p>

        <button
          onClick={handleDisconnect}
          className="px-4 py-2 bg-zed-accent text-white text-[10px] font-bold uppercase tracking-widest rounded-sm hover:opacity-90 transition-all"
        >
          {isAuthError ? "Update Token" : "Connect GitHub"}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zed-bg dark:bg-zed-dark-bg font-sans selection:bg-zed-accent/20">
      {/* View Header - Minimalist */}
      <div className="px-6 py-4 border-b border-zed-border dark:border-zed-dark-border bg-zed-bg dark:bg-zed-dark-bg flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold text-zed-text dark:text-zed-dark-text tracking-tight flex items-center gap-2">
            <GithubOutlined className="opacity-80" />
            ACTIONS
          </div>
          <div className="h-4 w-px bg-zed-border dark:border-zed-dark-border mx-1"></div>
          <div className="flex items-center gap-2 text-xs text-zed-muted dark:text-zed-dark-muted font-mono">
            <BranchesOutlined />
            <span>{currentBranch}</span>
          </div>
          <div className="h-4 w-px bg-zed-border dark:border-zed-dark-border mx-1"></div>
          <div className="flex bg-zed-element/50 dark:bg-zed-dark-element/50 p-0.5 rounded-sm border border-zed-border dark:border-zed-dark-border">
            <button
              onClick={() => setFilterByBranch(true)}
              className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase transition-all ${filterByBranch ? "bg-zed-bg dark:bg-zed-dark-bg text-zed-text dark:text-white shadow-sm" : "text-zed-muted hover:text-zed-text"}`}
            >
              Branch
            </button>
            <button
              onClick={() => setFilterByBranch(false)}
              className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase transition-all ${!filterByBranch ? "bg-zed-bg dark:bg-zed-dark-bg text-zed-text dark:text-white shadow-sm" : "text-zed-muted hover:text-zed-text"}`}
            >
              All
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchRuns}
            disabled={loading}
            className="p-1.5 rounded-sm hover:bg-zed-element dark:hover:bg-zed-dark-element text-zed-muted dark:text-zed-dark-muted hover:text-zed-text dark:hover:text-white transition-all active:scale-95 flex items-center justify-center w-7 h-7"
            title="Refresh"
          >
            <SyncOutlined spin={loading} className="text-[13px] opacity-80" />
          </button>
          <button
            onClick={() => setIsDisconnectModalVisible(true)}
            className="p-1.5 rounded-sm hover:bg-zed-element dark:hover:bg-zed-dark-element text-zed-muted dark:text-zed-dark-muted hover:text-zed-text dark:hover:text-white transition-all active:scale-95 flex items-center justify-center w-7 h-7"
            title="Disconnect GitHub"
          >
            <DisconnectOutlined className="text-[13px] opacity-80" />
          </button>
        </div>
      </div>

      {/* Runs List - Table-like dense layout */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full">
          {runs.filter(
            (r) => !filterByBranch || r.head_branch === currentBranch,
          ).length === 0 && !loading ? (
            <div className="py-32 flex flex-col items-center justify-center opacity-40">
              <GithubOutlined className="text-2xl mb-3 text-zed-muted" />
              <span className="text-xs font-medium text-zed-text dark:text-zed-dark-text">
                No workflows found
              </span>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Optional Header Row for clarity if needed, but minimalist often skips it */}
              <div className="flex items-center px-6 py-2 border-b border-zed-border/50 dark:border-zed-dark-border/50 text-[10px] font-bold uppercase tracking-widest text-zed-muted opacity-50">
                <div className="w-8"></div> {/* Status */}
                <div className="flex-1">Workflow / Commit</div>
                <div className="w-24 text-right">Duration</div>
                <div className="w-32 text-right">Age</div>
                <div className="w-8"></div> {/* Action */}
              </div>

              {runs
                .filter(
                  (r) => !filterByBranch || r.head_branch === currentBranch,
                )
                .map((run) => {
                  const duration = moment.duration(
                    moment(run.updated_at).diff(moment(run.created_at)),
                  );
                  const durationString =
                    duration.asSeconds() < 60
                      ? `${Math.floor(duration.asSeconds())}s`
                      : `${Math.floor(duration.asMinutes())}m ${duration.seconds()}s`;

                  return (
                    <div
                      key={run.id}
                      onClick={() =>
                        window.gitcanopyAPI.openExternal(run.html_url)
                      }
                      className="flex items-center px-6 py-2 border-b border-zed-border/30 dark:border-zed-dark-border/30 hover:bg-zed-element/30 dark:hover:bg-zed-dark-element/30 cursor-pointer group transition-colors text-xs"
                    >
                      {/* Status Icon */}
                      <div className="w-8 shrink-0 flex items-center justify-start">
                        {getStatusIcon(run.status, run.conclusion)}
                      </div>

                      {/* Main Info */}
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zed-text dark:text-zed-dark-text truncate">
                            {run.name}
                          </span>
                          <span className="text-[10px] text-zed-muted opacity-60">
                            #{run.run_number}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-zed-muted text-[10px]">
                          <span className="uppercase font-bold tracking-wider opacity-70">
                            {run.event}
                          </span>
                          <span className="opacity-40">•</span>
                          <span className="font-mono opacity-80">
                            {run.head_sha.substring(0, 7)}
                          </span>
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="w-24 text-right text-zed-muted font-mono text-[10px] opacity-70">
                        {durationString}
                      </div>

                      {/* Age */}
                      <div className="w-32 text-right text-zed-muted dark:text-zed-dark-muted text-[11px] group-hover:text-zed-text dark:group-hover:text-white transition-colors">
                        {moment(run.created_at).fromNow(true)} ago
                      </div>

                      {/* Action */}
                      <div className="w-8 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExportOutlined className="text-zed-muted hover:text-zed-text" />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      <Modal
        title={null}
        open={isDisconnectModalVisible}
        onCancel={() => setIsDisconnectModalVisible(false)}
        footer={null}
        centered
        width={400}
        classNames={{
          content:
            "p-0 overflow-hidden bg-zed-bg dark:bg-zed-dark-surface rounded-lg border border-zed-border dark:border-zed-dark-border shadow-2xl",
        }}
      >
        <div className="p-6">
          <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text uppercase tracking-widest mb-4">
            Disconnect GitHub?
          </h3>

          <p className="text-xs text-zed-muted dark:text-zed-dark-muted mb-8 leading-relaxed">
            This will remove your Personal Access Token from local settings. You
            will need to reconnect to view workflow runs.
          </p>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsDisconnectModalVisible(false)}
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zed-muted hover:text-zed-text transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleDisconnect}
              className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all"
            >
              Disconnect
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
