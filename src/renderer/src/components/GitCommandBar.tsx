import React, { useState, useRef, useEffect } from "react";
import { useToast } from "./ToastContext";

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

    const query = inputValue.trim();

    // 1. Check for direct Git commands or common shorthand
    const commonGitCommands = [
      "status",
      "log",
      "fetch",
      "pull",
      "push",
      "checkout",
      "branch",
      "stash",
      "tag",
      "commit",
      "add",
      "diff",
    ];
    const isDirectGit =
      query.startsWith("git ") ||
      commonGitCommands.includes(query.split(" ")[0]);

    if (isDirectGit) {
      const command = query.startsWith("git ") ? query : `git ${query}`;
      setSuggestedCommand(command);
      return;
    }

    // 2. Otherwise, use AI translation
    setIsExecuting(true);
    setErrorAnalysis(null);
    setLastError(null);

    try {
      // Get context
      const status = await window.gitcanopyAPI.getStatus(repoPath);
      const branches = await window.gitcanopyAPI.getBranches(repoPath);
      const context = `Current path: ${repoPath}. Branch status: ${status.ahead} ahead, ${status.behind} behind. Existing branches: ${branches.map((b) => b.name).join(", ")}`;

      const result = await window.gitcanopyAPI.translateNaturalLanguageToGit(
        query,
        context,
      );

      if (result === "NOT_A_GIT_COMMAND") {
        showToast(
          "I couldn't translate that. Try a direct git command.",
          "error",
        );
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
      const result = await window.gitcanopyAPI.executeRawGitCommand(
        repoPath,
        suggestedCommand,
      );

      if (result.success) {
        showToast(`Executed: ${suggestedCommand}`, "success", 1500);
        onCommandExecuted();
      } else {
        setLastError(result.stderr || "Unknown Git error");
        showToast("Command failed.", "error");
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
        className="absolute inset-0 bg-black/10 dark:bg-black/50 backdrop-blur-[8px]"
        onClick={() => !isExecuting && !isAnalyzingError && onCommandExecuted()}
      />

      <div className="relative w-full max-w-2xl -mt-[12vh] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-zinc-200 dark:border-zinc-800/80 rounded-xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col transition-all duration-300">
          {!suggestedCommand && !lastError && !errorAnalysis ? (
            <form
              onSubmit={handleSubmit}
              className="flex items-center px-6 py-5 gap-4"
            >
              <span className="text-zinc-300 dark:text-zinc-600 font-sans text-2xl select-none leading-none -mt-0.5">
                {">"}
              </span>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isExecuting}
                autoFocus
                placeholder="Describe a task or type a command..."
                className="flex-1 bg-transparent border-none outline-none ring-0 focus:ring-0 text-xl font-sans font-medium tracking-tight text-zinc-800 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-700 caret-zinc-800 dark:caret-zinc-100"
              />

              {isExecuting && (
                <div className="w-5 h-5 border-2 border-zinc-200 dark:border-zinc-700 border-t-zinc-800 dark:border-t-zinc-100 rounded-full animate-spin"></div>
              )}
            </form>
          ) : lastError || errorAnalysis ? (
            <div className="flex flex-col animate-in slide-in-from-top-2 duration-300">
              <div className="px-6 py-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-sans font-bold text-red-500 uppercase tracking-[0.2em]">
                    Execution Error
                  </span>
                  <div className="flex gap-4">
                    {!errorAnalysis && (
                      <button
                        onClick={handleAnalyzeError}
                        disabled={isAnalyzingError}
                        className="text-[10px] font-sans font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                      >
                        {isAnalyzingError ? "ANALYZING..." : "ANALYZE ERROR"}
                      </button>
                    )}
                    <button
                      onClick={handleCancel}
                      className="text-[10px] font-sans font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                    >
                      DISMISS
                    </button>
                  </div>
                </div>

                {lastError && !errorAnalysis && (
                  <div className="font-sans text-[13px] text-red-500/90 break-words whitespace-pre-wrap leading-relaxed bg-red-500/5 dark:bg-red-500/10 p-4 rounded-lg border border-red-500/10">
                    {lastError}
                  </div>
                )}

                {errorAnalysis && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="prose prose-sm dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-400 font-sans text-sm leading-relaxed">
                      {errorAnalysis}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col animate-in slide-in-from-right-2 duration-300">
              <div className="px-6 py-6 flex items-center gap-5">
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-300 dark:text-zinc-600 font-sans text-2xl select-none leading-none -mt-0.5">
                      $
                    </span>
                    <span className="flex-1 font-sans text-xl font-semibold text-zinc-900 dark:text-white break-all tracking-tight">
                      {suggestedCommand}
                    </span>
                  </div>
                  {!inputValue.startsWith("git ") && (
                    <span className="text-[10px] font-sans font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.15em] mt-2 ml-7">
                      AI Suggested Command
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <button
                    onClick={handleConfirm}
                    disabled={isExecuting}
                    className="text-[11px] font-sans font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-lg shadow-xl hover:opacity-90 active:scale-95 transition-all"
                  >
                    CONFIRM
                  </button>
                  <button
                    onClick={handleCancel}
                    className="text-[11px] font-sans font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors px-2"
                  >
                    ESC
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Shadow Depth */}
        <div className="absolute inset-0 bg-black/20 dark:bg-black/40 blur-3xl -z-10 rounded-xl" />
      </div>
    </div>
  );
};