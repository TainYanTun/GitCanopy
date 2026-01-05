import React, { useState, useEffect } from "react";
import { WorkflowRun } from "@shared/types";
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, GithubOutlined, WarningOutlined, RightOutlined } from "@ant-design/icons";
import { Modal } from "antd";
import { useToast } from "./ToastContext";

interface GitHubStatusProps {
  repoPath: string;
  currentBranch: string;
  onOpenActions: () => void;
}

export const GitHubStatus: React.FC<GitHubStatusProps> = ({ repoPath, currentBranch, onOpenActions }) => {
  const { showToast } = useToast();
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isAuthError, setIsAuthError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  const fetchStatus = async () => {
    if (isAuthError) return;
    setLoading(true);
    try {
      const runs = await window.gitcanopyAPI.getWorkflowRuns(repoPath, currentBranch);
      setRuns(runs);
      setIsAuthError(false);
    } catch (err: any) {
      console.error("Failed to fetch workflow runs:", err);
      const msg = err.message || "";
      if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("credentials")) {
        setIsAuthError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const checkToken = async () => {
    try {
      const settings = await window.gitcanopyAPI.getSettings();
      setHasToken(!!settings.githubToken);
      if (settings.githubToken) {
        fetchStatus();
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkToken();
    // Check for token existence every 5 seconds to stay in sync with disconnect actions
    const tokenCheckInterval = setInterval(checkToken, 5000);
    
    // Poll for status every 30 seconds if token exists
    const statusInterval = setInterval(() => {
      if (hasToken) fetchStatus();
    }, 30000);

    return () => {
      clearInterval(tokenCheckInterval);
      clearInterval(statusInterval);
    };
  }, [repoPath, currentBranch, hasToken]);

  const handleSaveToken = async () => {
    const token = tokenInput.trim();
    if (!token) return;

    setIsValidating(true);
    try {
      const isValid = await window.gitcanopyAPI.validateGitHubToken(token);
      
      if (!isValid) {
        showToast("Invalid GitHub Token. Please check your token and scopes.", "error");
        setIsValidating(false);
        return;
      }

      const settings = await window.gitcanopyAPI.getSettings();
      await window.gitcanopyAPI.saveSettings({
        ...settings,
        githubToken: token,
        githubTokenCreated: Date.now()
      });
      
      setHasToken(true);
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
          title={isAuthError ? "GitHub Token is invalid. Click to fix." : "Connect GitHub to see CI status"}
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
            content: "p-0 overflow-hidden bg-zed-bg dark:bg-zed-dark-surface rounded-lg border border-zed-border dark:border-zed-dark-border shadow-2xl",
          }}
        >
          <div className="p-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zed-text dark:text-zed-dark-text mb-4">
              GitHub Authentication
            </h3>
            <p className="text-xs text-zed-muted dark:text-zed-dark-muted mb-6 leading-relaxed">
              Generate a <strong>Personal Access Token</strong> with <code className="bg-zed-element dark:bg-zed-dark-element px-1 rounded font-mono">repo</code> scope to monitor CI/CD status.
            </p>
            
            <div className="space-y-6">
              <input
                type="password"
                placeholder="Paste token (ghp_...)"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveToken()}
                className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border px-3 py-2 text-xs font-mono focus:outline-none focus:border-zed-accent text-zed-text dark:text-zed-dark-text placeholder:opacity-30"
              />
              
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={() => setIsModalOpen(false)}
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
        <div className="flex items-center gap-1.5 px-2 text-zed-muted opacity-50 text-[10px]" title="No workflow runs found for this branch">
            <GithubOutlined /> No Runs
        </div>
      );
  }

  const getStatusIcon = () => {
      if (latestRun.status === "queued" || latestRun.status === "in_progress") return <SyncOutlined spin className="text-blue-500" />;
      if (latestRun.conclusion === "success") return <CheckCircleOutlined className="text-green-500" />;
      if (latestRun.conclusion === "failure") return <CloseCircleOutlined className="text-red-500" />;
      return <WarningOutlined className="text-yellow-500" />;
  };

  const getStatusText = () => {
    if (latestRun.status === "in_progress") return "Running";
    if (latestRun.conclusion === "success") return "Success";
    if (latestRun.conclusion === "failure") return "Failed";
    return latestRun.conclusion || latestRun.status;
  };

  return (
    <a 
        href="#"
        onClick={(e) => {
            e.preventDefault();
            onOpenActions();
        }}
        className="flex items-center gap-1.5 px-2 py-0.5 transition-opacity hover:opacity-70 group cursor-pointer"
        title={`View Actions for: ${latestRun.name} #${latestRun.run_number}`}
    >
        <div className="flex items-center justify-center pt-px">
            {getStatusIcon()}
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider pt-px ${
            latestRun.conclusion === "success" ? "text-green-600 dark:text-green-400" :
            latestRun.conclusion === "failure" ? "text-red-600 dark:text-red-400" :
            "text-zed-text dark:text-zed-dark-text"
        }`}>
            {getStatusText()}
        </span>
        <span className="text-[9px] text-zed-muted opacity-0 group-hover:opacity-60 transition-opacity pt-px">
            #{latestRun.run_number}
        </span>
        <RightOutlined className="text-[8px] text-zed-muted opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 pt-px" />
    </a>
  );
};
