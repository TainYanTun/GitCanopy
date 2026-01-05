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
  SearchOutlined,
} from "@ant-design/icons";
import { Modal } from "antd";
import moment from "moment";
import { useToast } from "./ToastContext";

interface WorkflowRunsProps {
  repoPath: string;
  currentBranch: string;
}

export const WorkflowRuns: React.FC<WorkflowRunsProps> = ({
  repoPath,
  currentBranch,
}) => {
  const { showToast } = useToast();
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [hasToken, setHasToken] = useState(true);
  const [isAuthError, setIsAuthError] = useState(false);
  const [filterByBranch, setFilterByBranch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tokenInput, setTokenInput] = useState("");
  const [isDisconnectModalVisible, setIsDisconnectModalVisible] =
    useState(false);
  const [isConnectModalVisible, setIsConnectModalVisible] = useState(false);

  const fetchRuns = async () => {
    if (isAuthError) return;

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
      setIsConnectModalVisible(false);
      setTokenInput("");
      showToast("GitHub connected successfully", "success");
      fetchRuns();
    } catch (e) {
      showToast("Connection failed. Check your internet or token.", "error");
    } finally {
      setIsValidating(false);
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

  const getStatusColor = (status: string, conclusion: string | null) => {
    if (status === "queued" || status === "in_progress") return "bg-blue-500";
    if (conclusion === "success") return "bg-green-500";
    if (conclusion === "failure") return "bg-red-500";
    return "bg-zed-muted/30";
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
          onClick={() => setIsConnectModalVisible(true)}
          className="px-4 py-2 bg-zed-accent text-white text-[10px] font-bold uppercase tracking-widest rounded-sm hover:opacity-90 transition-all"
        >
          {isAuthError ? "Update Token" : "Connect GitHub"}
        </button>

        {/* Connect Modal */}
        <Modal
          title={null}
          open={isConnectModalVisible}
          onCancel={() => setIsConnectModalVisible(false)}
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
                  onClick={() => setIsConnectModalVisible(false)}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zed-muted hover:text-zed-text transition-colors"
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
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zed-bg dark:bg-zed-dark-bg font-sans selection:bg-zed-accent/20">
      {/* View Header - Refined Minimalist */}
      <div className="px-6 py-3 border-b border-zed-border dark:border-zed-dark-border bg-zed-bg dark:bg-zed-dark-bg flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 pr-2 border-r border-zed-border/50 dark:border-zed-dark-border/50">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-zed-text dark:text-zed-dark-text flex items-center gap-2">
              <GithubOutlined className="opacity-80 text-xs" />
              ACTIONS
            </div>
          </div>

          {/* Context & Toggles Group */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 h-6 text-[10px] leading-none text-zed-muted dark:text-zed-dark-muted font-mono bg-zed-element/30 dark:bg-zed-dark-element/30 px-2 rounded-sm border border-zed-border/30">
              <BranchesOutlined className="text-[9px] leading-none shrink-0" />
              <span className="leading-none">{currentBranch}</span>
            </div>

            <div className="flex bg-zed-element/50 dark:bg-zed-dark-element/50 p-0.5 rounded-sm border border-zed-border dark:border-zed-dark-border">
              <button
                onClick={() => setFilterByBranch(true)}
                className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase transition-all ${filterByBranch ? "bg-zed-bg dark:bg-zed-dark-bg text-zed-text dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zed-muted hover:text-zed-text"}`}
              >
                Branch
              </button>
              <button
                onClick={() => setFilterByBranch(false)}
                className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase transition-all ${!filterByBranch ? "bg-zed-bg dark:bg-zed-dark-bg text-zed-text dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zed-muted hover:text-zed-text"}`}
              >
                All
              </button>
            </div>
          </div>

          <div className="h-4 w-px bg-zed-border dark:border-zed-dark-border mx-1"></div>

          {/* Search Bar */}
          <div className="flex items-center h-6 gap-2 bg-zed-bg dark:bg-zed-dark-bg px-2 rounded-sm border border-zed-border dark:border-zed-dark-border focus-within:border-zed-accent/50 transition-all shadow-inner">
            <SearchOutlined className="text-[10px] text-zed-muted opacity-40 shrink-0" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-[10px] font-mono text-zed-text dark:text-zed-dark-text w-28 placeholder:opacity-20 tracking-tight h-full"
            />
          </div>

          <div className="h-4 w-px bg-zed-border dark:border-zed-dark-border mx-1"></div>

          {/* Status Filter Toggles */}
          <div className="flex items-center gap-1.5">
            <div className="flex bg-zed-element/50 dark:bg-zed-dark-element/50 p-0.5 rounded-sm border border-zed-border dark:border-zed-dark-border">
              {["all", "success", "failure", "in_progress"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-0.5 rounded-sm text-[9px] font-bold uppercase transition-all ${statusFilter === s ? "bg-zed-bg dark:bg-zed-dark-bg text-zed-text dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zed-muted hover:text-zed-text"}`}
                >
                  {s === "in_progress" ? "Active" : s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Account Group */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsDisconnectModalVisible(true)}
            className="p-1.5 rounded-sm hover:bg-zed-element dark:hover:bg-zed-dark-element text-zed-muted dark:text-zed-dark-muted hover:text-zed-text dark:hover:text-white transition-all active:scale-95 flex items-center justify-center w-7 h-7"
            title="Disconnect GitHub"
          >
            <DisconnectOutlined className="text-[13px] opacity-80" />
          </button>
        </div>
      </div>

      {/* Runs List */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full">
          {runs.filter((r) => {
            const matchesBranch =
              !filterByBranch || r.head_branch === currentBranch;
            const matchesSearch =
              searchQuery === "" ||
              r.display_title
                .toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
              r.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus =
              statusFilter === "all" ||
              (statusFilter === "in_progress"
                ? r.status === "in_progress"
                : r.conclusion === statusFilter);
            return matchesBranch && matchesSearch && matchesStatus;
          }).length === 0 && !loading ? (
            <div className="py-32 flex flex-col items-center justify-center opacity-40">
              <GithubOutlined className="text-2xl mb-3 text-zed-muted" />
              <span className="text-xs font-medium text-zed-text dark:text-zed-dark-text">
                No workflows found
              </span>
            </div>
          ) : (
            <div className="flex flex-col">
              {runs
                .filter((r) => {
                  const matchesBranch =
                    !filterByBranch || r.head_branch === currentBranch;
                  const matchesSearch =
                    searchQuery === "" ||
                    r.display_title
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase()) ||
                    r.name.toLowerCase().includes(searchQuery.toLowerCase());
                  const matchesStatus =
                    statusFilter === "all" ||
                    (statusFilter === "in_progress"
                      ? r.status === "in_progress"
                      : r.conclusion === statusFilter);
                  return matchesBranch && matchesSearch && matchesStatus;
                })
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
                      className="flex items-center px-6 py-3 border-b border-zed-border/30 dark:border-zed-dark-border/30 hover:bg-zed-element/20 dark:hover:bg-zed-dark-element/20 cursor-pointer group transition-colors relative"
                    >
                      {/* Status Strip */}
                      <div className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full ${getStatusColor(run.status, run.conclusion)} opacity-60`} />

                      {/* Status Icon */}
                      <div className="w-8 shrink-0 flex items-center justify-start ml-2">
                        {getStatusIcon(run.status, run.conclusion)}
                      </div>

                      {/* Activity Info */}
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <div className="text-sm font-medium text-zed-text dark:text-zed-dark-text truncate leading-snug">
                          {run.display_title}
                        </div>
                        <div className="flex items-center gap-2 text-zed-muted dark:text-zed-dark-muted text-[10px] opacity-60">
                          <span className="font-bold uppercase tracking-tight">
                            {run.name} #{run.run_number}
                          </span>
                          <span>•</span>
                          <span>by {run.actor.login}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <BranchesOutlined className="text-[8px]" />
                            {run.head_branch}
                          </span>
                          <span>•</span>
                          <span className="font-mono">
                            {run.head_sha.substring(0, 7)}
                          </span>
                        </div>
                      </div>

                      {/* Timing Content */}
                      <div className="flex items-center gap-8 text-right shrink-0">
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="text-[10px] font-mono text-zed-text dark:text-zed-dark-text opacity-80">
                            {durationString}
                          </div>
                          <div className="text-[10px] text-zed-muted dark:text-zed-dark-muted">
                            {moment(run.created_at).fromNow()}
                          </div>
                        </div>
                        <div className="w-6 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExportOutlined className="text-zed-muted hover:text-zed-text text-xs" />
                        </div>
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
          <h3 className="text-[10px] font-bold text-zed-text dark:text-zed-dark-text uppercase tracking-widest mb-4">
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
