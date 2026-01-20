import React, { useState, useEffect } from "react";
import { Modal } from "antd";
import {
  CheckOutlined,
  SaveOutlined,
  WarningOutlined,
  RobotOutlined,
  VerticalAlignTopOutlined,
} from "@ant-design/icons";
import { useToast } from "./ToastContext";

interface ConflictResolverProps {
  repoPath: string;
  filePath: string;
  visible: boolean;
  onClose: () => void;
  onResolved: () => Promise<void> | void;
}

interface ConflictChunk {
  id: number;
  type: "normal" | "conflict";
  content: string; // For normal
  current?: string; // For conflict (HEAD)
  incoming?: string; // For conflict (Incoming)
  resolved?: string; // The user's choice
  status: "unresolved" | "resolved";
  isAiResolving?: boolean;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
  repoPath,
  filePath,
  visible,
  onClose,
  onResolved,
}) => {
  const { showToast } = useToast();
  const [chunks, setChunks] = useState<ConflictChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseConflictContent = (text: string): ConflictChunk[] => {
    const lines = text.split("\n");
    const result: ConflictChunk[] = [];
    let currentChunk: Partial<ConflictChunk> = {
      id: 0,
      type: "normal",
      content: "",
      status: "resolved",
    };
    let chunkId = 0;
    let state: "normal" | "current" | "incoming" = "normal";

    // Markers
    const START_MARKER = "<<<<<<<";
    const MID_MARKER = "=======";
    const END_MARKER = ">>>>>>>";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith(START_MARKER)) {
        // Push previous normal chunk
        if (currentChunk.content) {
          result.push(currentChunk as ConflictChunk);
        }
        
        // Start new conflict chunk
        chunkId++;
        currentChunk = {
          id: chunkId,
          type: "conflict",
          current: "",
          incoming: "",
          status: "unresolved",
        };
        state = "current";
        continue;
      }

      if (line.startsWith(MID_MARKER) && state === "current") {
        state = "incoming";
        continue;
      }

      if (line.startsWith(END_MARKER) && state === "incoming") {
        // End conflict chunk
        result.push(currentChunk as ConflictChunk);
        
        // Start new normal chunk
        chunkId++;
        currentChunk = {
          id: chunkId,
          type: "normal",
          content: "",
          status: "resolved",
        };
        state = "normal";
        continue;
      }

      // Add content to current state
      if (state === "normal") {
        currentChunk.content += line + "\n";
      } else if (state === "current") {
        currentChunk.current += line + "\n";
      } else if (state === "incoming") {
        currentChunk.incoming += line + "\n";
      }
    }

    // Push final chunk
    if (currentChunk.content || currentChunk.type === "conflict") {
        // Remove trailing newline from the very last normal chunk if it exists
        if (currentChunk.type === "normal" && currentChunk.content?.endsWith("\n")) {
             currentChunk.content = currentChunk.content.slice(0, -1);
        }
        result.push(currentChunk as ConflictChunk);
    }

    return result;
  };

  useEffect(() => {
    if (visible && filePath) {
      setLoading(true);
      setError(null);
      window.gitcanopyAPI
        .getFileContent(repoPath, filePath)
        .then((content) => {
          try {
            const parsed = parseConflictContent(content);
            setChunks(parsed);
          } catch (e) {
            setError("Failed to parse conflict markers.");
          }
        })
        .catch((err) => {
          setError(err.message || "Failed to read file.");
        })
        .finally(() => setLoading(false));
    }
  }, [visible, repoPath, filePath]);

  const handleResolve = (id: number, choice: "current" | "incoming" | "both" | "manual", manualContent?: string) => {
    setChunks((prev) =>
      prev.map((chunk) => {
        if (chunk.id !== id) return chunk;

        let resolvedContent = "";
        if (choice === "current") resolvedContent = chunk.current || "";
        else if (choice === "incoming") resolvedContent = chunk.incoming || "";
        else if (choice === "both") resolvedContent = (chunk.current || "") + (chunk.incoming || "");
        else if (choice === "manual") resolvedContent = manualContent || "";

        return {
          ...chunk,
          resolved: resolvedContent,
          status: "resolved",
        };
      })
    );
  };

  const handleAiResolve = async (chunk: ConflictChunk) => {
    if (!chunk.current || !chunk.incoming) return;
    
    setChunks(prev => prev.map(c => c.id === chunk.id ? { ...c, isAiResolving: true } : c));
    try {
      const resolved = await window.gitcanopyAPI.resolveConflictWithAi(chunk.current, chunk.incoming);
      handleResolve(chunk.id, "manual", resolved);
      showToast("Resolved with AI", "success");
    } catch (err: any) {
      showToast(err.message || "AI Resolution failed", "error");
    } finally {
      setChunks(prev => prev.map(c => c.id === chunk.id ? { ...c, isAiResolving: false } : c));
    }
  };

  const handleSave = async () => {
    if (chunks.some((c) => c.status === "unresolved")) {
      // Should not happen if button disabled, but safe check
      return;
    }

    setSaving(true);
    try {
      const finalContent = chunks.map((c) => 
        c.type === "conflict" ? c.resolved : c.content
      ).join(""); // Logic handles newlines inside chunks

      await window.gitcanopyAPI.resolveConflict(repoPath, filePath, finalContent);
      await onResolved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save resolved file.");
    } finally {
      setSaving(false);
    }
  };

  const remainingConflicts = chunks.filter(c => c.type === "conflict" && c.status === "unresolved").length;

  return (
    <Modal
      title={null}
      footer={null}
      open={visible}
      onCancel={onClose}
      width="95%"
      style={{ top: 20 }}
      closable={false}
      classNames={{
        content: "p-0 overflow-hidden bg-zed-bg dark:bg-zed-dark-bg rounded-lg border border-zed-border dark:border-zed-dark-border shadow-2xl",
        mask: "bg-black/60 backdrop-blur-sm",
      }}
      styles={{
        body: { height: "85vh", padding: "0", display: "flex", flexDirection: "column" },
      }}
    >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zed-border dark:border-zed-dark-border bg-zed-surface dark:bg-zed-dark-surface">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded">
                    <WarningOutlined className="text-red-500 text-lg" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text">{filePath}</h3>
                    <p className="text-[10px] text-zed-muted uppercase tracking-widest font-bold">
                        {remainingConflicts === 0 
                            ? <span className="text-green-500">All conflicts resolved</span> 
                            : <span className="text-red-500">{remainingConflicts} conflicts remaining</span>}
                    </p>
                </div>
            </div>
            <div className="flex gap-3">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold text-zed-muted hover:text-zed-text transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={remainingConflicts > 0 || saving}
                    className={`flex items-center gap-2 px-6 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all shadow-lg ${remainingConflicts === 0
                        ? "bg-zed-accent text-white hover:opacity-90 active:scale-95"
                        : "bg-zed-element dark:bg-zed-dark-element text-zed-muted opacity-50 cursor-not-allowed"}`}
                >
                   {saving ? "Saving..." : <><SaveOutlined /> Complete Merge</>}
                </button>
            </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden bg-zed-bg dark:bg-zed-dark-bg">
            {/* Conflict Minimap/Sidebar */}
            <div className="w-12 border-r border-zed-border dark:border-zed-dark-border bg-zed-surface dark:bg-zed-dark-surface flex flex-col items-center py-4 gap-2">
                {chunks.map((chunk, index) => (
                    chunk.type === "conflict" && (
                        <button
                            key={chunk.id}
                            onClick={() => document.getElementById(`chunk-${chunk.id}`)?.scrollIntoView({ behavior: 'smooth' })}
                            className={`w-3 h-3 rounded-full transition-all ${
                                chunk.status === 'resolved' 
                                    ? 'bg-green-500/40 hover:bg-green-500' 
                                    : 'bg-red-500 animate-pulse'
                            }`}
                            title={`Jump to Conflict ${index + 1}`}
                        />
                    )
                ))}
                <div className="flex-1" />
                <button 
                    onClick={() => document.querySelector('.custom-scrollbar')?.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="text-zed-muted hover:text-zed-text"
                >
                    <VerticalAlignTopOutlined />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-zed-muted animate-pulse">
                        Loading content...
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-red-500 font-bold">
                        {error}
                    </div>
                ) : (
                    chunks.map((chunk) => {
                        if (chunk.type === "normal") {
                            return (
                                <div key={chunk.id} className="whitespace-pre-wrap font-mono text-[11px] text-zed-text/60 dark:text-zed-dark-text/60 px-4 leading-relaxed">
                                    {chunk.content}
                                </div>
                            );
                        }

                        // Conflict Chunk
                        if (chunk.status === "resolved") {
                            return (
                                <div 
                                    key={chunk.id} 
                                    id={`chunk-${chunk.id}`}
                                    className="group relative border-2 border-green-500/20 bg-green-500/5 rounded-lg p-6 transition-all shadow-sm"
                                >
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => setChunks(prev => prev.map(c => c.id === chunk.id ? { ...c, status: "unresolved" } : c))}
                                            className="text-[10px] bg-white dark:bg-zed-dark-bg border border-zed-border px-3 py-1.5 rounded-md shadow-sm hover:text-red-500 font-bold uppercase tracking-wider transition-all"
                                        >
                                            Modify Resolution
                                        </button>
                                    </div>
                                    <div className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500" /> Resolved
                                    </div>
                                    <pre className="whitespace-pre-wrap font-mono text-xs text-zed-text dark:text-zed-dark-text leading-relaxed">
                                        {chunk.resolved}
                                    </pre>
                                </div>
                            );
                        }

                        return (
                            <div 
                                key={chunk.id} 
                                id={`chunk-${chunk.id}`}
                                className="border-2 border-red-500/30 rounded-xl overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200"
                            >
                                {/* Header */}
                                <div className="bg-red-500/10 px-6 py-3 flex justify-between items-center border-b border-red-500/10 backdrop-blur-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-[0.2em]">Conflict Block</span>
                                        <div className="h-1 w-8 bg-red-500/20 rounded-full" />
                                    </div>
                                    <button
                                        onClick={() => handleAiResolve(chunk)}
                                        disabled={chunk.isAiResolving}
                                        className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20"
                                    >
                                        <RobotOutlined className={chunk.isAiResolving ? "animate-spin" : ""} />
                                        {chunk.isAiResolving ? "Thinking..." : "✨ Resolve with AI"}
                                    </button>
                                </div>
                                
                                {/* Split View */}
                                <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-red-500/20 bg-zed-surface dark:bg-zed-dark-surface min-h-[300px]">
                                    {/* Current (Ours) */}
                                    <div className="flex-1 flex flex-col min-w-0 group/ours">
                                        <div className="px-5 py-3 bg-green-500/5 flex justify-between items-center border-b border-green-500/10">
                                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Current Change (HEAD)</span>
                                            <button 
                                                onClick={() => handleResolve(chunk.id, "current")}
                                                className="text-[9px] font-bold uppercase tracking-widest text-green-600 hover:text-green-700 bg-green-500/10 px-3 py-1 rounded"
                                            >
                                                Accept
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-auto p-5 custom-scrollbar bg-green-500/[0.02] font-mono text-[11px] leading-relaxed">
                                            {chunk.current}
                                        </div>
                                    </div>

                                    {/* Incoming (Theirs) */}
                                    <div className="flex-1 flex flex-col min-w-0 group/theirs">
                                        <div className="px-5 py-3 bg-blue-500/5 flex justify-between items-center border-b border-blue-500/10">
                                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Incoming Change</span>
                                            <button 
                                                onClick={() => handleResolve(chunk.id, "incoming")}
                                                className="text-[9px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-700 bg-blue-500/10 px-3 py-1 rounded"
                                            >
                                                Accept
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-auto p-5 custom-scrollbar bg-blue-500/[0.02] font-mono text-[11px] leading-relaxed">
                                            {chunk.incoming}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions Footer */}
                                <div className="bg-zed-bg dark:bg-zed-dark-bg px-6 py-4 flex justify-center gap-6 border-t border-red-500/10">
                                    <button 
                                        onClick={() => handleResolve(chunk.id, "both")}
                                        className="text-[9px] font-bold uppercase tracking-[0.15em] text-zed-muted hover:text-zed-text transition-colors"
                                    >
                                        Keep Both Changes
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    </Modal>
  );
};
