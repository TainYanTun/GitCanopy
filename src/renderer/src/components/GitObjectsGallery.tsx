import React, { useState, useEffect } from "react";
import { useToast } from "./ToastContext";
import { ConfirmDialog } from "./ConfirmDialog";
import { CreateTagModal } from "./CreateTagModal";
import { DiffModal } from "./DiffModal";
import { ReflogEntry } from "@shared/types";
import moment from "moment";

interface GitObjectsGalleryProps {
  repoPath: string;
  headCommit: string;
  onViewChanges?: () => void;
  onRefreshRepo?: () => void;
}

type Tab = "reflog" | "tags" | "stashes";

export const GitObjectsGallery: React.FC<GitObjectsGalleryProps> = ({ 
  repoPath, 
  headCommit,
  onViewChanges,
  onRefreshRepo
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("reflog");
  
  // Stash State
  const [stashes, setStashes] = useState<string[]>([]);
  const [loadingStashes, setLoadingStashes] = useState(true);
  const [expandedStash, setExpandedStash] = useState<string | null>(null);
  const [stashFiles, setStashFiles] = useState<Record<string, string[]>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const [selectedStashFile, setSelectedStashFile] = useState<{ id: string, path: string } | null>(null);
  const [stashDiffContent, setStashDiffContent] = useState("");
  
  // Tag State
  const [tags, setTags] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [showCreateTagModal, setShowCreateTagModal] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState("");
  const [deletingTag, setDeletingTag] = useState<string | null>(null);

  // Reflog State
  const [reflog, setReflog] = useState<ReflogEntry[]>([]);
  const [loadingReflog, setLoadingReflog] = useState(false);

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
    onConfirm: () => {
      // Default empty handler
    },
    type: "info"
  });

  const fetchStashes = async () => {
    setLoadingStashes(true);
    try {
      const fetchedStashes = await window.gitcanopyAPI.getStashList(repoPath);
      setStashes(fetchedStashes);
    } catch (error) {
      console.error("Failed to fetch stashes:", error);
    } finally {
      setLoadingStashes(false);
    }
  };

  const fetchTags = async () => {
    setLoadingTags(true);
    try {
      const fetchedTags = await window.gitcanopyAPI.getTags(repoPath);
      setTags(fetchedTags);
    } catch (error) {
      console.error("Failed to fetch tags:", error);
    } finally {
      setLoadingTags(false);
    }
  };

  const fetchReflog = async () => {
    setLoadingReflog(true);
    try {
      const entries = await window.gitcanopyAPI.getReflog(repoPath);
      setReflog(entries);
    } catch (error) {
      console.error("Failed to fetch reflog:", error);
    } finally {
      setLoadingReflog(false);
    }
  };

  useEffect(() => {
    if (activeTab === "reflog") fetchReflog();
    else if (activeTab === "tags") fetchTags();
    else fetchStashes();
  }, [repoPath, activeTab]);

  const closeDialog = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  // --- Stash Handlers ---
  const toggleStash = async (id: string) => {
    if (expandedStash === id) {
      setExpandedStash(null);
      return;
    }

    setExpandedStash(id);
    if (!stashFiles[id]) {
      setLoadingFiles(prev => ({ ...prev, [id]: true }));
      try {
        const files = await window.gitcanopyAPI.getStashFiles(repoPath, id);
        setStashFiles(prev => ({ ...prev, [id]: files }));
      } catch (error) {
        console.error("Failed to fetch stash files:", error);
      } finally {
        setLoadingFiles(prev => ({ ...prev, [id]: false }));
      }
    }
  };

  const handleStashFileClick = async (id: string, path: string) => {
    setSelectedStashFile({ id, path });
    setStashDiffContent("Loading stash diff...");
    try {
      const diff = await window.gitcanopyAPI.getStashFileDiff(repoPath, id, path);
      setStashDiffContent(diff);
    } catch (err) {
      setStashDiffContent("Failed to load stash diff.");
    }
  };

  const handleApplyStash = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Apply Stash",
      message: "Apply this stash to your working directory?",
      confirmText: "Apply",
      type: "info",
      onConfirm: async () => {
        closeDialog();
        try {
          await window.gitcanopyAPI.applyStash(repoPath, id);
          showToast("Stash applied", "success");
          fetchStashes();
          onRefreshRepo?.();
        } catch (error: any) {
          const errorMessage = error.message || "";
          if (errorMessage.includes("STASH_CONFLICT")) {
            showToast("Conflicts detected. Switching to Changes view...", "warning");
            setTimeout(() => onViewChanges?.(), 1500);
          } else {
            showToast("Failed to apply stash", "error");
          }
          fetchStashes();
        }
      }
    });
  };

  const handleDropStash = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Drop Stash",
      message: "Permanently drop this stash? This action cannot be undone.",
      confirmText: "Drop",
      type: "danger",
      onConfirm: async () => {
        closeDialog();
        try {
          await window.gitcanopyAPI.dropStash(repoPath, id);
          showToast("Stash dropped", "success");
          fetchStashes();
        } catch (error) {
          showToast("Failed to drop stash", "error");
        }
      }
    });
  };

  // --- Tag Handlers ---
  const handleDeleteTag = async (tagName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Tag",
      message: `Permanently delete tag '${tagName}'?`,
      confirmText: "Delete",
      type: "danger",
      onConfirm: async () => {
        closeDialog();
        setDeletingTag(tagName);
        try {
          await window.gitcanopyAPI.deleteTag(repoPath, tagName);
          showToast(`Tag '${tagName}' deleted`, "success");
          fetchTags();
          onRefreshRepo?.();
        } catch (error) {
          showToast("Failed to delete tag", "error");
        } finally {
          setDeletingTag(null);
        }
      }
    });
  };

  const handlePushTag = async (tagName: string) => {
    try {
      showToast(`Pushing tag '${tagName}'...`, "info");
      await window.gitcanopyAPI.pushTag(repoPath, tagName);
      showToast(`Tag '${tagName}' pushed`, "success");
    } catch (error) {
      showToast("Push failed", "error");
    }
  };

  // --- Reflog Handlers ---
  const handleRestoreReflog = (entry: ReflogEntry) => {
    setConfirmDialog({
      isOpen: true,
      title: "Restore to Point",
      message: `Warning: This will perform a HARD reset to ${entry.shortHash} (${entry.selector}). Any uncommitted changes will be lost.`,
      confirmText: "Hard Reset",
      type: "danger",
      onConfirm: async () => {
        closeDialog();
        try {
          await window.gitcanopyAPI.resetHard(repoPath, entry.hash);
          showToast(`Repository restored to ${entry.shortHash}`, "success");
          fetchReflog();
          onRefreshRepo?.();
        } catch (error) {
          showToast("Restoration failed", "error");
        }
      }
    });
  };

  const filteredTags = tags.filter(t => t.toLowerCase().includes(tagSearchTerm.toLowerCase()));

  return (
    <div className="h-full w-full bg-zed-bg dark:bg-zed-dark-bg flex flex-col font-sans select-none animate-in fade-in duration-300">
      {/* Header Area */}
      <div className="flex items-center justify-between px-6 h-12 border-b border-zed-border/20 dark:border-zed-dark-border/10 shrink-0">
        <div className="flex items-center gap-6 h-full">
          <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-zed-text dark:text-zed-dark-text opacity-90 mr-2">
            Objects
          </div>
          <div className="flex items-center gap-1 h-full">
            <button
              onClick={() => setActiveTab("reflog")}
              className={`px-3 h-full text-[11px] font-medium transition-all relative flex items-center ${activeTab === "reflog" ? "text-zed-accent" : "text-zed-muted hover:text-zed-text dark:hover:text-zed-dark-text"}`}
            >
              Reflog
              {activeTab === "reflog" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zed-accent" />}
            </button>
            <button
              onClick={() => setActiveTab("tags")}
              className={`px-3 h-full text-[11px] font-medium transition-all relative flex items-center ${activeTab === "tags" ? "text-zed-accent" : "text-zed-muted hover:text-zed-text dark:hover:text-zed-dark-text"}`}
            >
              Tags
              {activeTab === "tags" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zed-accent" />}
            </button>
            <button
              onClick={() => setActiveTab("stashes")}
              className={`px-3 h-full text-[11px] font-medium transition-all relative flex items-center ${activeTab === "stashes" ? "text-zed-accent" : "text-zed-muted hover:text-zed-text dark:hover:text-zed-dark-text"}`}
            >
              Stashes
              {activeTab === "stashes" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zed-accent" />}
            </button>
          </div>
        </div>

        {activeTab === "tags" && (
          <button
            onClick={() => setShowCreateTagModal(true)}
            className="text-[10px] font-bold uppercase tracking-widest text-zed-accent hover:underline decoration-2 underline-offset-4"
          >
            + Create Tag
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-zed-bg dark:bg-zed-dark-bg">
        {activeTab === "reflog" ? (
          /* --- REFLOG MINIMALIST LIST --- */
          <div className="flex flex-col h-full">
            {loadingReflog ? (
              <div className="p-8 flex items-center gap-3 text-[11px] text-zed-muted uppercase font-mono tracking-widest">
                <div className="w-3 h-3 border border-zed-accent border-t-transparent rounded-full animate-spin"></div>
                Replaying history...
              </div>
            ) : reflog.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-zed-muted/20">
                 <div className="text-[10px] font-bold uppercase tracking-[0.3em]">No Reflog</div>
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="px-6 py-2 bg-[#f8f8f8] dark:bg-zed-dark-surface/30 text-[10px] font-bold text-zed-muted/60 dark:text-zed-dark-muted/40 uppercase tracking-widest border-b border-zed-border/10 flex items-center sticky top-0 z-10 backdrop-blur-sm">
                   <div className="w-20">Hash</div>
                   <div className="w-32">Action</div>
                   <div className="flex-1">Description</div>
                   <div className="w-32 text-right">Time</div>
                </div>
                {reflog.map((entry, idx) => (
                  <div key={idx} className="group flex items-center px-6 py-3 border-b border-zed-border/5 dark:border-zed-dark-border/5 hover:bg-zed-element/10 dark:hover:bg-zed-dark-element/10 transition-colors">
                    <div className="w-20 text-[11px] font-mono text-zed-accent opacity-60">{entry.shortHash}</div>
                    <div className="w-32 text-[11px] font-bold text-zed-text dark:text-zed-dark-text uppercase tracking-tighter truncate pr-4">{entry.action}</div>
                    <div className="flex-1 text-[12px] text-zed-text dark:text-zed-dark-text truncate opacity-80">{entry.subject}</div>
                    <div className="w-32 flex items-center justify-end gap-3">
                       <span className="text-[10px] text-zed-muted dark:text-zed-dark-muted opacity-40">{moment.unix(entry.timestamp).fromNow()}</span>
                       <button 
                          onClick={() => handleRestoreReflog(entry)}
                          className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-tighter bg-red-500 text-white rounded-none hover:opacity-90 transition-all"
                       >
                          Restore
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === "tags" ? (
          /* --- TAGS MINIMALIST LIST --- */
          <div className="flex flex-col h-full">
            <div className="px-6 py-4 flex items-center justify-between border-b border-zed-border/10 dark:border-zed-dark-border/5 bg-zed-surface/50 dark:bg-zed-dark-surface/30">
                <input
                  type="text"
                  placeholder="FILTER TAGS..."
                  value={tagSearchTerm}
                  onChange={(e) => setTagSearchTerm(e.target.value)}
                  className="bg-transparent border-none text-[10px] font-mono focus:outline-none w-full placeholder:text-zed-muted/30 text-zed-text dark:text-zed-dark-text tracking-widest uppercase"
                />
            </div>

            {loadingTags ? (
              <div className="p-8 flex items-center gap-3 text-[11px] text-zed-muted uppercase font-mono tracking-widest">
                <div className="w-3 h-3 border border-zed-accent border-t-transparent rounded-full animate-spin"></div>
                Resolving refs...
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-zed-muted/20">
                 <div className="text-[10px] font-bold uppercase tracking-[0.3em]">No Tags</div>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-zed-border/10 dark:divide-zed-dark-border/5">
                {filteredTags.map(tag => (
                  <div key={tag} className="group flex items-center justify-between px-6 py-3 hover:bg-zed-element/10 dark:hover:bg-zed-dark-element/10 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-2 h-2 rounded-full border border-yellow-500/50" />
                      <span className="text-[13px] font-mono text-zed-text dark:text-zed-dark-text tracking-tight">{tag}</span>
                    </div>
                    
                    <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handlePushTag(tag)}
                        className="text-[9px] font-bold uppercase tracking-widest text-zed-muted hover:text-zed-accent flex items-center gap-1.5"
                      >
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                         Push
                      </button>
                      <button 
                        onClick={() => handleDeleteTag(tag)}
                        disabled={deletingTag === tag}
                        className={`text-[9px] font-bold uppercase tracking-widest text-zed-muted hover:text-red-500 ${deletingTag === tag ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                         {deletingTag === tag ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* --- STASHES MINIMALIST LIST --- */
          loadingStashes ? (
            <div className="p-8 flex items-center gap-3 text-[11px] text-zed-muted uppercase font-mono tracking-widest">
              <div className="w-3 h-3 border border-zed-accent border-t-transparent rounded-full animate-spin"></div>
              Querying stashes...
            </div>
          ) : stashes.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-zed-muted/20">
               <div className="text-[10px] font-bold uppercase tracking-[0.3em]">Empty Stack</div>
            </div>
          ) : (
            <div className="flex flex-col">
              {stashes.map((stash, index) => {
                const firstColon = stash.indexOf(":");
                const id = firstColon !== -1 ? stash.substring(0, firstColon).trim() : `stash@{${index}}`;
                const remaining = firstColon !== -1 ? stash.substring(firstColon + 1) : stash;
                const secondColon = remaining.indexOf(":");
                const message = secondColon !== -1 ? remaining.substring(secondColon + 1).trim() : remaining.trim();
                const branchInfo = secondColon !== -1 ? remaining.substring(0, secondColon).trim() : "unknown";

                const isExpanded = expandedStash === id;

                return (
                  <div key={id} className={`border-b border-zed-border/10 dark:border-zed-dark-border/5 transition-colors ${isExpanded ? "bg-zed-element/30 dark:bg-zed-dark-element/20" : "hover:bg-zed-element/10 dark:hover:bg-zed-dark-element/10"}`}>
                    <div
                      className="group flex items-center gap-4 px-6 py-3 cursor-pointer"
                      onClick={() => toggleStash(id)}
                    >
                      <div className="w-4 flex justify-center text-zed-muted opacity-40">
                         <svg className={`w-2.5 h-2.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                      </div>
                      
                      <div className="flex-1 flex items-baseline gap-3 min-w-0">
                        <span className="text-[13px] text-zed-text dark:text-zed-dark-text truncate">{message}</span>
                        <span className="text-[10px] font-mono text-zed-accent opacity-50 shrink-0">@{branchInfo.replace("On ", "")}</span>
                      </div>

                      <div className="flex items-center gap-4">
                         <span className="text-[10px] font-mono text-zed-muted opacity-30">{id}</span>
                         <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleApplyStash(id); }} 
                                className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-tighter text-zed-accent hover:bg-zed-accent/10 rounded-none border border-zed-accent/20"
                            >
                                Apply
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDropStash(id); }} 
                                className="ml-2 p-1 text-zed-muted hover:text-red-500 transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                         </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-14 pb-4 animate-in slide-in-from-top-1 duration-200">
                         {loadingFiles[id] ? (
                            <div className="text-[9px] font-mono text-zed-muted uppercase animate-pulse">Scanning changes...</div>
                         ) : (
                            <div className="space-y-1">
                               <div className="text-[9px] font-bold text-zed-muted/40 uppercase tracking-widest mb-2 border-b border-zed-border/10 pb-1">Modified paths (click to preview)</div>
                               {stashFiles[id]?.map(file => (
                                 <div 
                                    key={file} 
                                    onClick={() => handleStashFileClick(id, file)}
                                    className="text-[11px] font-mono text-zed-text dark:text-zed-dark-text opacity-60 hover:opacity-100 hover:text-zed-accent cursor-pointer flex items-center gap-2"
                                 >
                                    <div className="w-1 h-1 bg-zed-accent/30" />
                                    {file}
                                 </div>
                               ))}
                            </div>
                         )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      <CreateTagModal
        visible={showCreateTagModal}
        onClose={() => setShowCreateTagModal(false)}
        onSuccess={() => { fetchTags(); onRefreshRepo?.(); }}
        repoPath={repoPath}
        headCommit={headCommit}
      />

      {selectedStashFile && (
        <DiffModal
          repoPath={repoPath}
          visible={!!selectedStashFile}
          onClose={() => setSelectedStashFile(null)}
          filePath={selectedStashFile.path}
          diffContent={stashDiffContent}
        />
      )}

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