import React, { useState, useEffect } from "react";
import { useToast } from "./ToastContext";
import { ConfirmDialog } from "./ConfirmDialog";

interface StashGalleryProps {
  repoPath: string;
  onViewChanges?: () => void;
}

export const StashGallery: React.FC<StashGalleryProps> = ({ repoPath, onViewChanges }) => {
  const { showToast } = useToast();
  const [stashes, setStashes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
    type: "info" | "warning" | "danger";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    type: "info"
  });

  const fetchStashes = async () => {
    setLoading(true);
    try {
      const fetchedStashes = await window.gitcanopyAPI.getStashList(repoPath);
      setStashes(fetchedStashes);
    } catch (error) {
      console.error("Failed to fetch stashes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStashes();
  }, [repoPath]);

  const closeDialog = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  const handleApply = (index: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Apply Stash",
      message: "Are you sure you want to apply this stash to your working directory?",
      confirmText: "Apply Stash",
      type: "info",
      onConfirm: async () => {
        closeDialog();
        try {
          await window.gitcanopyAPI.applyStash(repoPath, index);
          showToast("Stash applied successfully", "success");
          fetchStashes();
        } catch (error: any) {
          const errorMessage = error.message || "";
          if (errorMessage.includes("STASH_CONFLICT")) {
            showToast("Conflicts detected. Redirecting to Changes view...", "warning");
            setTimeout(() => {
              onViewChanges?.();
            }, 1500);
          } else {
            showToast("Failed to apply stash", "error");
          }
          console.error(error);
          fetchStashes();
        }
      }
    });
  };

  const handleDrop = (index: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Drop Stash",
      message: "Are you sure you want to drop this stash? This cannot be undone.",
      confirmText: "Drop Permanently",
      type: "danger",
      onConfirm: async () => {
        closeDialog();
        try {
          await window.gitcanopyAPI.dropStash(repoPath, index);
          showToast("Stash dropped successfully", "success");
          fetchStashes();
        } catch (error) {
          showToast("Failed to drop stash", "error");
          console.error(error);
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-zed-bg dark:bg-zed-dark-bg">
        <div className="w-4 h-4 border-2 border-zed-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-zed-bg dark:bg-zed-dark-bg flex flex-col animate-in fade-in duration-300">
      {/* Header - Zed Style */}
      <div className="px-8 py-6 border-b border-zed-border/30 dark:border-zed-dark-border/30">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-medium text-zed-text dark:text-zed-dark-text tracking-tight">
            Stashes
          </h1>
          <span className="text-[10px] font-bold text-zed-muted uppercase tracking-[0.2em] opacity-40">
            {stashes.length} entries
          </span>
        </div>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {stashes.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center opacity-30">
            <p className="text-xs font-medium tracking-wider uppercase">
              Empty Stack
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zed-border/20 dark:divide-zed-dark-border/20">
            {stashes.map((stash, index) => {
              const parts = stash.split(":");
              const id = parts[0].trim();
              const message =
                parts.slice(2).join(":").trim() || parts[1]?.trim() || stash;
              const branchInfo = parts[1]?.trim() || "unknown";

              return (
                <div
                  key={id}
                  className="group flex items-center gap-6 px-8 py-3 hover:bg-zed-element/30 dark:hover:bg-zed-dark-element/30 transition-colors"
                >
                  <div className="w-8 text-[10px] font-mono text-zed-muted opacity-30 group-hover:opacity-60">
                    {index.toString().padStart(2, "0")}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3">
                      <span className="text-sm text-zed-text dark:text-zed-dark-text truncate font-medium">
                        {message}
                      </span>
                      <span className="text-[10px] font-mono text-zed-accent opacity-70">
                        @{branchInfo.replace("On ", "")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-mono text-zed-muted opacity-30 hidden md:block">
                      {id}
                    </span>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleApply(id)}
                        className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zed-muted hover:text-zed-accent hover:bg-zed-accent/10 transition-all rounded"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => handleDrop(id)}
                        className="p-1.5 text-zed-muted hover:text-commit-fix transition-colors"
                        title="Drop"
                      >
                        <svg
                          className="w-3.5 h-3.5"
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeDialog}
        type={confirmDialog.type}
      />
    </div>
  );
};
