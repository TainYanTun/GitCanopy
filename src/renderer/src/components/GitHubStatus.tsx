import React, { useState, useEffect } from "react";
import { WorkflowRun } from "@shared/types";
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, GithubOutlined, WarningOutlined, RightOutlined } from "@ant-design/icons";
import { Modal, Input, Button } from "antd";

interface GitHubStatusProps {
  repoPath: string;
  currentBranch: string;
  onOpenActions: () => void;
}

export const GitHubStatus: React.FC<GitHubStatusProps> = ({ repoPath, currentBranch, onOpenActions }) => {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const runs = await window.gitcanopyAPI.getWorkflowRuns(repoPath, currentBranch);
      setRuns(runs);
    } catch (err) {
      console.error("Failed to fetch workflow runs:", err);
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
    // Poll every 30 seconds
    const interval = setInterval(() => {
      if (hasToken) fetchStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [repoPath, currentBranch, hasToken]);

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return;
    try {
      const settings = await window.gitcanopyAPI.getSettings();
      await window.gitcanopyAPI.saveSettings({
        ...settings,
        githubToken: tokenInput.trim(),
        githubTokenCreated: Date.now()
      });
      setHasToken(true);
      setIsModalOpen(false);
      setTokenInput("");
      fetchStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const latestRun = runs.length > 0 ? runs[0] : null;

  if (!hasToken) {
    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zed-element dark:hover:bg-zed-dark-element text-zed-muted dark:text-zed-dark-muted transition-colors text-[10px] font-bold uppercase tracking-wider"
          title="Connect GitHub to see CI status"
        >
          <GithubOutlined /> Connect
        </button>
        <Modal
          title="Connect to GitHub"
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
          width={400}
        >
          <div className="flex flex-col gap-4 pt-2">
            <p className="text-sm text-zed-muted">
              Generate a Personal Access Token (Classic) with <code>repo</code> scope to view GitHub Actions status.
            </p>
            <Input.Password
              placeholder="ghp_..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <div className="flex justify-end gap-2">
                <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="primary" onClick={handleSaveToken} disabled={!tokenInput}>Save Token</Button>
            </div>
            <div className="text-xs text-zed-muted opacity-70">
                Your token is stored locally in your settings file.
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
