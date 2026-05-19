import React, { useState, useEffect, useCallback, useRef } from "react";
import { GitCommandLog } from "@shared/types";
import { useToast } from "./ToastContext";
import { RobotOutlined, CodeOutlined, SendOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";

interface GitConsoleProps {
  repoPath: string;
}

interface ChatMessage {
  role: "user" | "agent";
  content: string;
  timestamp: number;
}

export const GitConsole: React.FC<GitConsoleProps> = ({ repoPath }) => {
  const { showToast } = useToast();

  // Log State
  const [logs, setLogs] = useState<GitCommandLog[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Common State
  const [inputValue, setInputValue] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const history = await window.gitcanopyAPI.getGitCommandHistory();
      setLogs(history);
    } catch (error) {
      console.error("Failed to fetch git logs:", error);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs]);

  const handleClear = async () => {
    await window.gitcanopyAPI.clearGitCommandHistory();
    setLogs([]);
  };

  const handleCopy = async (log: GitCommandLog) => {
    const fullCommand = `git ${log.args.join(" ")}`;
    try {
      await window.gitcanopyAPI.copyToClipboard(fullCommand);
      setCopiedId(log.id);
      showToast("Command copied to clipboard", "success", 2000);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy command:", error);
      showToast("Failed to copy command", "error", 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isExecuting) return;

    setIsExecuting(true);
    const commandToRun = inputValue.trim();
    setInputValue("");

    try {
      const result = await window.gitcanopyAPI.executeRawGitCommand(
        repoPath,
        commandToRun,
      );

      if (result.success) {
        fetchLogs();
      } else {
        showToast(result.stderr || "Command failed", "error");
      }
    } catch (error: any) {
      showToast(error.message || "Execution error", "error");
    } finally {
      setIsExecuting(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="h-full bg-zed-bg dark:bg-zed-dark-bg selection:bg-zed-accent/30 flex flex-col font-mono text-[11px] animate-in fade-in duration-500">
      {/* Hyper-minimalist Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-2 border-b border-zed-border dark:border-zed-dark-border bg-zed-surface/50 dark:bg-zed-dark-surface/50">
        <div className="flex items-center gap-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zed-accent flex items-center gap-2">
            <CodeOutlined /> System / Git_Logs
          </div>
        </div>

        <button
          onClick={handleClear}
          className="text-[10px] uppercase font-bold tracking-widest text-zed-muted dark:text-zed-dark-text/40 hover:text-commit-fix transition-colors"
        >
          [ Clear_History ]
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto px-6 py-4 space-y-1 custom-scrollbar flex flex-col-reverse"
        >
          {logs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-zed-muted dark:text-zed-dark-text/20 italic">
              Waiting for Git operations...
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="group flex items-start gap-4 py-1 hover:bg-zed-element/30 dark:hover:bg-zed-dark-element/30 rounded px-2 -mx-2 transition-colors"
                >
                  <span className="shrink-0 w-16 text-zed-muted dark:text-zed-dark-text/30 text-[10px] pt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>

                  <span
                    className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${log.success ? "bg-commit-feat/50" : "bg-commit-fix shadow-[0_0_8px_rgba(224,108,117,0.5)]"}`}
                  ></span>

                  <div className="flex-1 flex flex-wrap items-baseline gap-x-2 min-w-0 select-text">
                    <span className="text-zed-accent dark:text-zed-dark-accent font-bold">
                      git
                    </span>
                    <span className="text-zed-text dark:text-zed-dark-text font-medium">
                      {log.args.join(" ")}
                    </span>
                  </div>

                  <div className="shrink-0 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-zed-muted dark:text-zed-dark-text/30 text-[9px] uppercase tracking-tighter">
                      {log.duration}ms
                    </span>
                    <button
                      onClick={() => handleCopy(log)}
                      className={`p-1 rounded hover:bg-zed-element dark:hover:bg-zed-dark-element transition-colors ${copiedId === log.id ? "text-commit-feat" : "text-zed-muted"}`}
                    >
                      {copiedId === log.id ? "COPIED" : "COPY"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Small Compact Minimalist Command Box */}
      <div className="flex-shrink-0 px-6 py-3 border-t border-zed-border/30 dark:border-zed-dark-border/30 bg-zed-bg dark:bg-zed-dark-bg">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <div className="shrink-0 text-zed-accent font-bold text-[10px] select-none">
            {">"}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isExecuting}
            placeholder={"git..."}
            className="flex-1 bg-transparent border-none outline-none text-zed-text dark:text-zed-dark-text placeholder-zed-muted/20 text-[11px] py-0.5"
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isExecuting}
            className="shrink-0 text-zed-muted hover:text-zed-accent disabled:opacity-20 transition-colors"
          >
            <SendOutlined className="text-xs" />
          </button>
        </form>
      </div>
    </div>
  );
};
