import React, { useState, useEffect, useCallback, useMemo } from "react";
import { WorkingTreeStatus, StatusFile } from "@shared/types";
import {
  CloudUploadOutlined,
  SendOutlined,
  PlusOutlined,
  MinusOutlined,
  UndoOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  CheckCircleOutlined,
  FileImageOutlined,
  FileMarkdownOutlined,
  CodeOutlined,
  FileOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { DiffModal } from "./DiffModal";
import { ConflictResolver } from "./ConflictResolver";
import { useToast } from "./ToastContext";
import { ConfirmDialog } from "./ConfirmDialog";

import { List } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";

interface ChangesViewProps {
  repoPath: string;
}

interface GroupedFiles {
  [dir: string]: StatusFile[];
}

type FlatItem =
  | { type: "directory"; dir: string; fileCount: number }
  | { type: "file"; file: StatusFile; isStaged: boolean };

export const ChangesView: React.FC<ChangesViewProps> = ({ repoPath }) => {
  const { showToast } = useToast();
  const [status, setStatus] = useState<WorkingTreeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<StatusFile | null>(null);
  const [diffContent, setDiffContent] = useState<string>("");
  const [isDiffVisible, setIsDiffVisible] = useState(false);
  const [commitSummary, setCommitSummary] = useState("");
  const [commitDescription, setCommitDescription] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(["."]));
  const [conflictFile, setConflictFile] = useState<StatusFile | null>(null);
  
  // Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {
      // Default empty handler
    },
  });

  const fetchStatus = useCallback(async () => {
    try {
      const data = await window.gitcanopyAPI.getStatus(repoPath);
      setStatus(data);
    } catch (error) {
      console.error("Failed to fetch status:", error);
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => {
    fetchStatus();
    const unsubscribeRepo =
      window.gitcanopyAPI.onRepositoryChanged(fetchStatus);
    const unsubscribeHead = window.gitcanopyAPI.onHeadChanged(fetchStatus);
    const unsubscribeCommits =
      window.gitcanopyAPI.onCommitsUpdated(fetchStatus);
    return () => {
      unsubscribeRepo();
      unsubscribeHead();
      unsubscribeCommits();
    };
  }, [fetchStatus]);

  useEffect(() => {
    if (status) {
      const newExpanded = new Set(expandedDirs);
      let changed = false;
      
      status.files.forEach(file => {
        if (file.status === "conflicted") {
          const parts = file.path.split("/");
          if (parts.length > 1) {
            const dir = parts.slice(0, -1).join("/");
            if (!newExpanded.has(dir)) {
              newExpanded.add(dir);
              changed = true;
            }
          }
        }
      });

      if (changed) {
        setExpandedDirs(newExpanded);
      }
    }
  }, [status]);

  const groupFiles = (files: StatusFile[]): GroupedFiles => {
    return files.reduce((acc, file) => {
      const parts = file.path.split("/");
      const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
      if (!acc[dir]) acc[dir] = [];
      acc[dir].push(file);
      return acc;
    }, {} as GroupedFiles);
  };

  const stagedGrouped = useMemo(
    () => groupFiles(status?.files.filter((f) => f.staged) || []),
    [status],
  );
  const unstagedGrouped = useMemo(
    () => groupFiles(status?.files.filter((f) => !f.staged) || []),
    [status],
  );

  const flattenGroups = useCallback((grouped: GroupedFiles, isStaged: boolean): FlatItem[] => {
    const flat: FlatItem[] = [];
    Object.entries(grouped)
      .sort()
      .forEach(([dir, files]) => {
        flat.push({ type: "directory", dir, fileCount: files.length });
        if (expandedDirs.has(dir)) {
          files.forEach((file) => {
            flat.push({ type: "file", file, isStaged });
          });
        }
      });
    return flat;
  }, [expandedDirs]);

  const flatUnstaged = useMemo(() => flattenGroups(unstagedGrouped, false), [unstagedGrouped, flattenGroups]);
  const flatStaged = useMemo(() => flattenGroups(stagedGrouped, true), [stagedGrouped, flattenGroups]);

  const toggleDir = (dir: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(dir)) newExpanded.delete(dir);
    else newExpanded.add(dir);
    setExpandedDirs(newExpanded);
  };

  const handleFileClick = async (file: StatusFile) => {
    if (file.status === "conflicted") {
      setConflictFile(file);
      return;
    }
    
    setSelectedFile(file);
    setIsDiffVisible(true);
    setDiffContent("Loading diff...");
    try {
      const diff = await window.gitcanopyAPI.getDiff(
        repoPath,
        file.staged ? "HEAD" : "",
        file.path,
      );
      setDiffContent(diff);
    } catch (_err) {
      setDiffContent("Failed to load diff.");
    }
  };

  const handleStage = async (file: StatusFile, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.gitcanopyAPI.stageFile(repoPath, file.path);
      fetchStatus();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to stage file",
        "error",
      );
    }
  };

  const handleUnstage = async (file: StatusFile, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.gitcanopyAPI.unstageFile(repoPath, file.path);
      fetchStatus();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to unstage file",
        "error",
      );
    }
  };

  const handleStageAll = async () => {
    try {
      await window.gitcanopyAPI.stageAll(repoPath);
      fetchStatus();
      showToast("All changes staged", "success");
    } catch (_err) {
      showToast("Failed to stage all changes", "error");
    }
  };

  const handleUnstageAll = async () => {
    try {
      await window.gitcanopyAPI.unstageAll(repoPath);
      fetchStatus();
      showToast("All changes unstaged", "info");
    } catch (_err) {
      showToast("Failed to unstage all changes", "error");
    }
  };

  const handleDiscard = async (file: StatusFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      title: "Discard Changes",
      message: `Are you sure you want to discard all changes to ${file.path}? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await window.gitcanopyAPI.discardChanges(repoPath, file.path);
          fetchStatus();
        } catch (_err) {
          showToast("Failed to discard changes", "error");
        }
      }
    });
  };

  const handleCommit = async () => {
    if (!commitSummary.trim()) return;
    setIsCommitting(true);
    try {
      const fullMessage = commitDescription.trim()
        ? `${commitSummary.trim()}\n\n${commitDescription.trim()}`
        : commitSummary.trim();

      await window.gitcanopyAPI.commit(repoPath, fullMessage);
      setCommitSummary("");
      setCommitDescription("");
      showToast("Committed", "success");
      fetchStatus();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Commit failed", "error");
    } finally {
      setIsCommitting(false);
    }
  };

  const handlePush = async () => {
    setIsPushing(true);
    try {
      await window.gitcanopyAPI.push(repoPath);
      showToast("Pushed successfully", "success");
      fetchStatus();
    } catch (_err) {
      showToast("Push failed", "error");
    } finally {
      setIsPushing(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!hasStaged) {
      showToast("Please stage changes first.", "warning");
      return;
    }
    setGeneratingAi(true);
    try {
      const { summary, description } = await window.gitcanopyAPI.generateCommitMessage(repoPath);
      setCommitSummary(summary);
      setCommitDescription(description);
      showToast("Commit message generated!", "success");
    } catch (error: any) {
      console.error(error);
      let msg = error.message || "Unknown error";
      if (msg.includes("quota") || msg.includes("429")) {
        msg = "Gemini API Quota Exceeded. Please check your plan/billing in Google AI Studio.";
      }
      
      if (msg.includes("API Key")) {
         showToast("Please set your AI API Key in Settings.", "error");
      } else {
         showToast(msg, "error");
      }
    } finally {
      setGeneratingAi(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center h-full bg-zed-bg dark:bg-zed-dark-bg">
        <div className="text-[10px] font-mono animate-pulse uppercase tracking-widest opacity-50">
          Indexing...
        </div>
      </div>
    );
  }

  const hasStaged = Object.keys(stagedGrouped).length > 0;
  const hasUnstaged = Object.keys(unstagedGrouped).length > 0;

  return (
    <div className="h-full flex flex-col bg-[#fcfcfc] dark:bg-zed-dark-bg text-zed-text dark:text-zed-dark-text font-sans selection:bg-zed-accent/20">
      {/* Slim Header */}
      <div className="h-11 flex-shrink-0 flex items-center justify-between px-4 border-b border-zed-border dark:border-zed-dark-border bg-[#f6f6f6] dark:bg-zed-dark-bg">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
            Source Control
          </span>
          {status && (status.ahead > 0 || status.behind > 0) && (
            <div className="flex gap-1">
              {status.ahead > 0 && (
                <span className="text-[9px] bg-zed-accent px-1.5 rounded-sm text-white">
                  ↑{status.ahead}
                </span>
              )}
              {status.behind > 0 && (
                <span className="text-[9px] bg-commit-fix px-1.5 rounded-sm text-white">
                  ↓{status.behind}
                </span>
              )}
            </div>
          )}
        </div>
        {status && status.ahead > 0 && (
          <button
            onClick={handlePush}
            disabled={isPushing}
            className="h-6 px-3 text-[9px] font-bold uppercase tracking-wider bg-zed-accent text-white rounded-sm hover:opacity-90 disabled:opacity-30 transition-all flex items-center gap-2"
          >
            <CloudUploadOutlined /> {isPushing ? "Pushing..." : "Sync Changes"}
          </button>
        )}
      </div>

      {/* Split Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Unstaged Column */}
        <div className="flex-1 flex flex-col border-r border-zed-border dark:border-zed-dark-border">
          <div className="h-9 flex items-center justify-between px-3 bg-[#f0f0f0] dark:bg-zed-dark-bg border-b border-zed-border dark:border-zed-dark-border">
            <h2 className="text-[10px] font-bold uppercase tracking-widest opacity-80 flex items-center gap-2">
              <FileTextOutlined className="text-[8px]" /> Changes
            </h2>
            {hasUnstaged && (
              <button
                onClick={handleStageAll}
                className="text-[9px] font-bold text-zed-accent hover:underline"
              >
                Stage All
              </button>
            )}
          </div>
          <div className="flex-1 overflow-hidden relative">
            {hasUnstaged ? (
              <AutoSizer
                Child={({ height, width }: any) => (
                  <List<ChangesRowProps>
                    key={repoPath}
                    style={{ height: height || 0, width: width || 0 }}
                    rowCount={flatUnstaged.length}
                    rowHeight={(index) => (flatUnstaged[index].type === "directory" ? 28 : 34)}
                    overscanCount={10}
                    rowComponent={ChangesRow as any}
                    rowProps={{
                      items: flatUnstaged,
                      onToggle: toggleDir,
                      onFileClick: handleFileClick,
                      onAction: handleStage,
                      onDiscard: handleDiscard,
                      expandedDirs,
                    }}
                    className="custom-scrollbar"
                  />
                )}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-30">
                <CheckCircleOutlined className="text-2xl mb-2" />
                <span className="text-[10px] uppercase font-bold tracking-widest">
                  Tree Clean
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Staged Column */}
        <div className="flex-1 flex flex-col bg-[#fafafa] dark:bg-zed-dark-bg">
          <div className="h-9 flex items-center justify-between px-3 bg-[#f0f0f0] dark:bg-zed-dark-bg border-b border-zed-border dark:border-zed-dark-border">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-500 flex items-center gap-2">
              <PlusOutlined className="text-[8px]" /> Staged
            </h2>
            {hasStaged && (
              <button
                onClick={handleUnstageAll}
                className="text-[9px] font-bold opacity-60 hover:opacity-100 transition-opacity"
              >
                Unstage All
              </button>
            )}
          </div>
          <div className="flex-1 overflow-hidden relative">
            {hasStaged ? (
              <AutoSizer
                Child={({ height, width }: any) => (
                  <List<ChangesRowProps>
                    key={repoPath}
                    style={{ height: height || 0, width: width || 0 }}
                    rowCount={flatStaged.length}
                    rowHeight={(index) => (flatStaged[index].type === "directory" ? 28 : 34)}
                    overscanCount={10}
                    rowComponent={ChangesRow as any}
                    rowProps={{
                      items: flatStaged,
                      onToggle: toggleDir,
                      onFileClick: handleFileClick,
                      onAction: handleUnstage,
                      onDiscard: handleDiscard,
                      expandedDirs,
                      isStaged: true,
                    }}
                    className="custom-scrollbar"
                  />
                )}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20">
                <span className="text-[10px] uppercase font-bold tracking-widest italic">
                  Nothing Staged
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Commit Bar (inline: Summary + Commit) */}
      <div className="p-4 bg-[#f6f6f6] dark:bg-zed-dark-surface border-t border-zed-border dark:border-zed-dark-border">
        <div className="max-w-5xl mx-auto flex gap-4 items-start">
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row w-full items-start gap-4">
              <input
                type="text"
                placeholder="Summary (required)"
                value={commitSummary}
                onChange={(e) => setCommitSummary(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleCommit();
                  }
                }}
                className="flex-1 bg-white dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border px-3 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-zed-accent/50 dark:focus:ring-zed-dark-accent/50 placeholder:opacity-30 text-zed-text dark:text-zed-dark-text rounded shadow-sm"
              />
              <button
                onClick={handleAiGenerate}
                disabled={generatingAi}
                className={`h-8 w-8 flex items-center justify-center rounded border border-zed-border dark:border-zed-dark-border transition-all ${
                  generatingAi
                    ? "bg-zed-surface dark:bg-zed-dark-surface opacity-50 text-green-400 cursor-not-allowed" 
                    : !hasStaged
                      ? "bg-zed-surface/50 dark:bg-zed-dark-surface/50 text-green-400/40 hover:bg-zed-surface cursor-pointer"
                      : "bg-zed-surface dark:bg-zed-dark-surface text-green-600 hover:border-zed-accent/30 shadow-sm active:scale-95"
                }`}
                title={!hasStaged ? "Stage changes to generate message" : "Generate Commit Message with AI"}
              >
                <RobotOutlined className={generatingAi ? "animate-spin" : ""} />
              </button>
              <button
                onClick={handleCommit}
                disabled={isCommitting || !hasStaged || !commitSummary.trim()}
                className={`h-8 px-4 py-2 rounded font-bold uppercase tracking-widest text-[10px] transition-all ${
                  isCommitting || !hasStaged || !commitSummary.trim()
                    ? "bg-zed-element/50 dark:bg-zed-dark-element/50 text-zed-muted opacity-50 cursor-not-allowed"
                    : "bg-zed-text dark:bg-white text-zed-bg dark:text-black hover:opacity-90 active:scale-95 shadow-lg"
                }`}
              >
                {isCommitting ? (
                  "..."
                ) : (
                  <>
                    Commit <SendOutlined className="text-[9px]" />
                  </>
                )}
              </button>
            </div>
            <textarea
              placeholder="Description (optional context...)"
              value={commitDescription}
              onChange={(e) => setCommitDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleCommit();
                }
              }}
              className="w-full bg-white dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border p-3 text-[12px] font-bold focus:outline-none focus:ring-1 focus:ring-zed-accent/50 dark:focus:ring-zed-dark-accent/50 placeholder:opacity-30 text-zed-text dark:text-zed-dark-text resize-y min-h-[180px] max-h-[360px] overflow-auto font-sans rounded shadow-sm"
              rows={3}
            />
            <div className="text-[9px] opacity-40 font-mono flex justify-between px-1">
            </div>
          </div>
        </div>
      </div>

      {selectedFile && (
        <DiffModal
          repoPath={repoPath}
          visible={isDiffVisible}
          onClose={() => setIsDiffVisible(false)}
          filePath={selectedFile.path}
          diffContent={diffContent}
        />
      )}

      {conflictFile && (
        <ConflictResolver
          repoPath={repoPath}
          filePath={conflictFile.path}
          visible={!!conflictFile}
          onClose={() => setConflictFile(null)}
          onResolved={async () => {
            // Small delay to ensure FS/Git is ready
            await new Promise(resolve => setTimeout(resolve, 200));
            await fetchStatus();
            showToast("Conflict resolved and staged", "success");
          }}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        type="danger"
        confirmText="Discard Changes"
      />
    </div>
  );
};

interface ChangesRowProps {
  items: FlatItem[];
  onToggle: (dir: string) => void;
  onFileClick: (f: StatusFile) => void;
  onAction: (f: StatusFile, e: React.MouseEvent) => void;
  onDiscard: (f: StatusFile, e: React.MouseEvent) => void;
  expandedDirs: Set<string>;
  isStaged?: boolean;
}

const ChangesRow = ({
  index,
  style,
  items,
  onToggle,
  onFileClick,
  onAction,
  onDiscard,
  expandedDirs,
  isStaged,
}: {
  index: number;
  style: React.CSSProperties;
  ariaAttributes: any;
} & ChangesRowProps): React.ReactElement => {
  const item = items[index];
  if (!item) return <div style={style} />;

  if (item.type === "directory") {
    const isExpanded = expandedDirs.has(item.dir);
    return (
      <div style={style} className="px-2">
        <div
          onClick={() => onToggle(item.dir)}
          className="flex items-center gap-2 py-1 px-2 hover:bg-zed-element/40 dark:hover:bg-zed-dark-element/40 cursor-pointer rounded-sm group transition-colors"
        >
          <span className="text-zed-muted opacity-60 text-[10px]">
            {isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
          </span>
          <FolderOpenOutlined className="text-[11px] text-zed-accent/70" />
          <span className="text-[11px] font-bold opacity-70 truncate flex-1">
            {item.dir}
          </span>
          <span className="text-[9px] font-mono opacity-40 px-1.5 bg-zed-element dark:bg-zed-dark-element rounded">
            {item.fileCount}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={style} className="pl-6 pr-2">
      <FileRow
        file={item.file}
        onClick={() => onFileClick(item.file)}
        onAction={(e) => onAction(item.file, e)}
        onDiscard={(e) => onDiscard(item.file, e)}
        actionIcon={isStaged ? <MinusOutlined /> : <PlusOutlined />}
        actionTitle={isStaged ? "Unstage" : "Stage"}
        isStaged={isStaged}
      />
    </div>
  );
};

const FileRow: React.FC<{
  file: StatusFile;
  onClick: () => void;
  onAction: (e: React.MouseEvent) => void;
  onDiscard: (e: React.MouseEvent) => void;
  actionIcon: React.ReactNode;
  actionTitle: string;
  isStaged?: boolean;
}> = ({
  file,
  onClick,
  onAction,
  onDiscard,
  actionIcon,
  actionTitle,
  isStaged,
}) => {
  const statusConfig = {
    added: { char: "A", color: "text-green-500" },
    modified: { char: "M", color: "text-yellow-500" },
    deleted: { char: "D", color: "text-red-500" },
    renamed: { char: "R", color: "text-blue-500" },
    untracked: { char: "U", color: "text-zed-muted" },
    conflicted: { char: "!", color: "text-red-600 font-bold animate-pulse" },
  };

  const config = statusConfig[file.status];
  const fileName = file.path.split("/").pop() || "";
  const extension = fileName.split(".").pop()?.toLowerCase();

  const getFileIcon = () => {
    if (["png", "jpg", "jpeg", "gif", "svg", "ico", "icns"].includes(extension || "")) {
      return <FileImageOutlined className="text-purple-500/70" />;
    }
    if (["md", "txt", "log"].includes(extension || "")) {
      return <FileMarkdownOutlined className="text-blue-400/70" />;
    }
    if (["ts", "tsx", "js", "jsx", "json", "html", "css", "py", "go", "rs"].includes(extension || "")) {
      return <CodeOutlined className="text-zed-accent/70" />;
    }
    return <FileOutlined className="text-zed-muted/50" />;
  };

  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-3 py-1.5 px-2 rounded cursor-pointer transition-all border border-transparent 
        ${file.status === 'conflicted' 
          ? 'bg-red-500/10 dark:bg-red-500/20 border-red-500/30 animate-pulse-slow' 
          : 'hover:bg-zed-element/60 dark:hover:bg-zed-dark-element/60 hover:border-zed-border/30 dark:hover:border-zed-dark-border/30'
        }`}
    >
      <span
        className={`w-4 text-[10px] font-mono font-bold text-center ${config.color}`}
      >
        {config.char}
      </span>
      <span className="text-[11px] flex-shrink-0 flex items-center justify-center">
        {getFileIcon()}
      </span>
      <span className="text-xs font-medium text-zed-text dark:text-zed-dark-text flex-1 truncate">
        {fileName}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onAction}
          className="p-1 text-[10px] hover:text-zed-accent transition-colors"
          title={actionTitle}
        >
          {actionIcon}
        </button>
        {!isStaged && (
          <button
            onClick={onDiscard}
            className="p-1 text-[10px] hover:text-red-500 transition-colors"
            title="Discard"
          >
            <UndoOutlined />
          </button>
        )}
      </div>
    </div>
  );
};
