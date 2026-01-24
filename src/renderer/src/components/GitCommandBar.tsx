import React, { useState, useRef, useEffect } from "react";
import { useToast } from "./ToastContext";
import { RobotOutlined } from "@ant-design/icons";

interface GitCommandBarProps {
  repoPath: string;
  onCommandExecuted: () => void;
}

export const GitCommandBar: React.FC<GitCommandBarProps> = ({
  repoPath,
  onCommandExecuted,
}) => {
  const { showToast } = useToast();
  const [inputValue, setInputValue] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [suggestedCommand, setSuggestedCommand] = useState<string | null>(null);
  const [errorAnalysis, setErrorAnalysis] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isAnalyzingError, setIsAnalyzingError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus on mount
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isExecuting || suggestedCommand) return;

    setIsExecuting(true);
    setErrorAnalysis(null);
    setLastError(null);
    const query = inputValue.trim();

    try {
      showToast("AI is thinking...", "info", 1500);

      // Get context
      const status = await window.gitcanopyAPI.getStatus(repoPath);
      const branches = await window.gitcanopyAPI.getBranches(repoPath);
      const context = `Current path: ${repoPath}. Branch status: ${status.ahead} ahead, ${status.behind} behind. Existing branches: ${branches.map((b) => b.name).join(", ")}`;

      const result = await window.gitcanopyAPI.translateNaturalLanguageToGit(
        query,
        context,
      );

      if (result === "NOT_A_GIT_COMMAND") {
        showToast("I couldn't translate that to a Git command.", "error");
        setIsExecuting(false);
        return;
      }

      setSuggestedCommand(result);
    } catch (error: any) {
      showToast(error.message || "Error", "error");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleConfirm = async () => {
    if (!suggestedCommand) return;
    setIsExecuting(true);
    setErrorAnalysis(null);
    setLastError(null);
    try {
      showToast(`Executing: ${suggestedCommand}`, "success", 2000);
      const result = await window.gitcanopyAPI.executeRawGitCommand(
        repoPath,
        suggestedCommand,
      );

      if (result.success) {
        onCommandExecuted();
      } else {
        setLastError(result.stderr || "Unknown Git error");
        showToast("Command failed. AI can help analyze the error.", "error");
      }
    } catch (error: any) {
      setLastError(error.message || "Execution error");
      showToast("Execution error", "error");
    } finally {
      setIsExecuting(false);
      setSuggestedCommand(null);
    }
  };

  const handleAnalyzeError = async () => {
    if (!lastError) return;
    setIsAnalyzingError(true);
    try {
      const status = await window.gitcanopyAPI.getStatus(repoPath);
      const context = `Branch: ${status.ahead} ahead, ${status.behind} behind.`;
      const analysis = await window.gitcanopyAPI.analyzeGitError(
        lastError,
        context,
      );
      setErrorAnalysis(analysis);
    } catch (error: any) {
      showToast("Failed to analyze error", "error");
    } finally {
      setIsAnalyzingError(false);
    }
  };

  const handleCancel = () => {
    setSuggestedCommand(null);
    setErrorAnalysis(null);
    setLastError(null);
    setInputValue("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 animate-in fade-in duration-300">
      {/* Immersive Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-[4px]"
        onClick={() => !isExecuting && !isAnalyzingError && onCommandExecuted()}
      />

      <div className="relative w-full max-w-xl -mt-[10vh] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        <div className="bg-white/95 dark:bg-zed-dark-surface/95 backdrop-blur-3xl border border-zed-border/50 dark:border-zed-dark-border/50 focus-within:border-zed-muted/50 rounded-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col transition-all duration-300">
          {!suggestedCommand && !lastError && !errorAnalysis ? (
            <form
              onSubmit={handleSubmit}
              className="flex items-center px-6 py-4 gap-4"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zed-element/50 dark:bg-zed-dark-element/50 shrink-0">
                <RobotOutlined className="text-xl text-zed-muted dark:text-zed-dark-muted animate-pulse-soft" />
              </div>

              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isExecuting}
                placeholder="What can I help you with?"
                className="flex-1 bg-transparent border-none outline-none text-lg font-medium text-zed-text dark:text-white placeholder-zed-muted/20 caret-zed-muted dark:caret-white"
              />
              
              {isExecuting ? (
                <div className="w-5 h-5 border-2 border-zed-text dark:border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <kbd className="flex items-center justify-center h-7 px-2.5 rounded-lg bg-zed-element dark:bg-zed-dark-element border border-zed-border dark:border-zed-dark-border text-[9px] font-bold text-zed-muted dark:text-zed-dark-muted shadow-sm uppercase tracking-tighter">
                    ENTER
                  </kbd>
                </div>
              )}
            </form>
          ) : lastError || errorAnalysis ? (
            <div className="flex flex-col animate-in slide-in-from-top-4 duration-300">
              <div className="px-6 py-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-commit-fix uppercase tracking-[0.2em]">
                      Command Failed
                    </span>
                    {isAnalyzingError && (
                      <div className="w-3 h-3 border-2 border-zed-text dark:border-white border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!errorAnalysis && (
                      <button
                        onClick={handleAnalyzeError}
                        disabled={isAnalyzingError}
                        className="text-[10px] font-bold bg-zed-text dark:bg-white text-zed-bg dark:text-zed-dark-bg px-3 py-1 rounded-lg hover:opacity-90 transition-all flex items-center gap-2"
                      >
                        <RobotOutlined /> ANALYZE WITH AI
                      </button>
                    )}
                    <button
                      onClick={handleCancel}
                      className="text-[10px] font-bold text-zed-muted hover:text-zed-text transition-colors px-2 py-1 rounded"
                    >
                      DISMISS
                    </button>
                  </div>
                </div>

                {lastError && !errorAnalysis && (
                  <div className="bg-commit-fix/5 dark:bg-commit-fix/10 p-4 rounded-xl border border-commit-fix/20 font-mono text-xs text-commit-fix shadow-inner max-h-40 overflow-y-auto custom-scrollbar">
                    {lastError}
                  </div>
                )}

                {errorAnalysis && (
                  <div className="bg-zed-element/50 dark:bg-zed-dark-element/50 p-5 rounded-xl border border-zed-border dark:border-zed-dark-border text-sm leading-relaxed text-zed-text dark:text-zed-dark-text max-h-80 overflow-y-auto custom-scrollbar">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {errorAnalysis.split("\n").map((line, i) => (
                        <p
                          key={i}
                          className={
                            line.startsWith("git")
                              ? "font-mono text-zed-text dark:text-white bg-zed-bg dark:bg-zed-dark-bg p-2 rounded mt-2 border border-zed-border dark:border-zed-dark-border"
                              : "mt-1"
                          }
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col animate-in slide-in-from-right-4 duration-300">
              <div className="px-6 py-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zed-muted dark:text-zed-dark-muted uppercase tracking-[0.2em]">
                    Suggested Command
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      className="text-[10px] font-bold text-zed-muted hover:text-zed-text transition-colors px-2 py-1 rounded"
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={isExecuting}
                      className="text-[10px] font-bold bg-zed-text dark:bg-white text-zed-bg dark:text-zed-dark-bg px-3 py-1 rounded-lg shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
                    >
                      {isExecuting ? (
                        <div className="w-3 h-3 border border-white dark:border-zed-dark-bg border-t-transparent rounded-full animate-spin" />
                      ) : (
                        "CONFIRM"
                      )}
                    </button>
                  </div>
                </div>
                <div className="bg-zed-element dark:bg-zed-dark-element p-4 rounded-xl border border-zed-border dark:border-zed-dark-border font-mono text-sm text-zed-text dark:text-white shadow-inner">
                  <span className="opacity-40 mr-2">$</span>
                  {suggestedCommand}
                </div>
              </div>
            </div>
          )}

          <div className="px-6 py-3 bg-zed-element/20 dark:bg-zed-dark-element/20 border-t border-zed-border/50 dark:border-zed-dark-border/30 flex items-center justify-between">
            <div className="flex gap-2">
              {[
                { label: 'Undo', query: 'undo my last commit but keep changes' },
                { label: 'Branch', query: 'switch to branch ' },
                { label: 'Commit', query: 'amend my last commit' },
                { label: 'Clean', query: 'delete merged local branches' }
              ].map(chip => (
                <button
                  key={chip.label}
                  onClick={() => {
                    setInputValue(chip.query);
                    inputRef.current?.focus();
                  }}
                  className="text-[9px] font-bold text-zed-muted dark:text-zed-dark-muted hover:text-zed-text dark:hover:text-white bg-zed-bg/50 dark:bg-black/20 px-2 py-0.5 rounded-full border border-zed-border/50 dark:border-zed-dark-border/20 transition-all uppercase tracking-widest"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-2 text-[9px] font-bold text-zed-muted/40 uppercase tracking-widest">
              <span>ESC to close</span>
            </div>
          </div>
        </div>

        {/* Subtle Glow Effect */}
        <div className="absolute -inset-1 bg-zed-text/5 dark:bg-white/5 rounded-[2rem] blur-2xl -z-10 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
      </div>
    </div>
  );
};
