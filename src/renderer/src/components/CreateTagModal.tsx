import React, { useState } from "react";
import { useToast } from "./ToastContext";

interface CreateTagModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  repoPath: string;
  headCommit: string;
}

export const CreateTagModal: React.FC<CreateTagModalProps> = ({
  visible,
  onClose,
  onSuccess,
  repoPath,
  headCommit,
}) => {
  const { showToast } = useToast();
  const [tagName, setTagName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [commitHash, setCommitHash] = useState(headCommit);

  if (!visible) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) {
      showToast("Tag name is required", "error");
      return;
    }

    setLoading(true);
    try {
      await window.gitcanopyAPI.createTag(
        repoPath,
        tagName.trim(),
        commitHash.trim() || undefined,
        message.trim() || undefined
      );
      showToast(`Tag '${tagName}' created`, "success");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to create tag:", error);
      showToast(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-zed-surface dark:bg-zed-dark-surface border border-zed-border dark:border-zed-dark-border shadow-2xl animate-in zoom-in-95 duration-150 rounded-none">
        <div className="px-5 h-10 flex justify-between items-center border-b border-zed-border/20 dark:border-zed-dark-border/10">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zed-muted">
            New Tag
          </h2>
          <button
            onClick={onClose}
            className="text-zed-muted hover:text-zed-text transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-zed-muted opacity-50">
              Identifier
            </label>
            <input
              type="text"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="e.g. v1.0.0"
              className="w-full px-3 py-1.5 bg-zed-bg dark:bg-zed-dark-bg border border-zed-border/30 dark:border-zed-dark-border/20 text-xs focus:outline-none focus:border-zed-accent transition-all text-zed-text dark:text-zed-dark-text font-mono"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-zed-muted opacity-50">
              Reference Hash
            </label>
            <input
              type="text"
              value={commitHash}
              onChange={(e) => setCommitHash(e.target.value)}
              placeholder={headCommit}
              className="w-full px-3 py-1.5 bg-zed-bg dark:bg-zed-dark-bg border border-zed-border/30 dark:border-zed-dark-border/20 text-xs focus:outline-none focus:border-zed-accent transition-all text-zed-text dark:text-zed-dark-text font-mono opacity-80"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-zed-muted opacity-50">
              Annotation
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional message..."
              rows={2}
              className="w-full px-3 py-1.5 bg-zed-bg dark:bg-zed-dark-bg border border-zed-border/30 dark:border-zed-dark-border/20 text-xs focus:outline-none focus:border-zed-accent transition-all text-zed-text dark:text-zed-dark-text resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-8 text-[10px] font-bold uppercase tracking-widest text-white bg-zed-accent hover:bg-zed-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Creating..." : "Confirm"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-8 text-[10px] font-bold uppercase tracking-widest text-zed-muted hover:text-zed-text hover:bg-zed-element/50 transition-colors border border-zed-border/30"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};