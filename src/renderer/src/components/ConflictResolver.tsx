import React, { useState, useEffect } from "react";
import { Modal } from "antd";
import {
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
  aiSuggestion?: string;
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
  const [aiInstructions, setAiInstructions] = useState<Record<number, string>>(
    {},
  );

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
      if (
        currentChunk.type === "normal" &&
        currentChunk.content?.endsWith("\n")
      ) {
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

  const handleResolve = (
    id: number,
    choice: "current" | "incoming" | "both" | "manual",
    manualContent?: string,
  ) => {
    setChunks((prev) =>
      prev.map((chunk) => {
        if (chunk.id !== id) return chunk;

        let resolvedContent = "";
        if (choice === "current") resolvedContent = chunk.current || "";
        else if (choice === "incoming") resolvedContent = chunk.incoming || "";
        else if (choice === "both")
          resolvedContent = (chunk.current || "") + (chunk.incoming || "");
        else if (choice === "manual") resolvedContent = manualContent || "";

        return {
          ...chunk,
          resolved: resolvedContent,
          status: "resolved",
        };
      }),
    );
  };

  const handleAiResolve = async (chunk: ConflictChunk) => {
    if (!chunk.current || !chunk.incoming) return;

    setChunks((prev) =>
      prev.map((c) => (c.id === chunk.id ? { ...c, isAiResolving: true } : c)),
    );
    try {
      const instruction = aiInstructions[chunk.id];
      const resolved = await window.gitcanopyAPI.resolveConflictWithAi(
        chunk.current,
        chunk.incoming,
        instruction,
      );

      setChunks((prev) =>
        prev.map((c) =>
          c.id === chunk.id
            ? { ...c, aiSuggestion: resolved, isAiResolving: false }
            : c,
        ),
      );
      showToast("AI Suggestion generated", "success");
    } catch (err: any) {
      let msg = err.message || "AI Resolution failed";
      if (msg.includes("quota") || msg.includes("429")) {
        msg =
          "Gemini API Quota Exceeded. Please check your plan/billing in Google AI Studio.";
      }
      showToast(msg, "error");
      setChunks((prev) =>
        prev.map((c) =>
          c.id === chunk.id ? { ...c, isAiResolving: false } : c,
        ),
      );
    }
  };

  const acceptAiSuggestion = (chunk: ConflictChunk) => {
    if (chunk.aiSuggestion) {
      handleResolve(chunk.id, "manual", chunk.aiSuggestion);
    }
  };

  const discardAiSuggestion = (chunkId: number) => {
    setChunks((prev) =>
      prev.map((c) =>
        c.id === chunkId ? { ...c, aiSuggestion: undefined } : c,
      ),
    );
  };

  const handleSave = async () => {
    if (chunks.some((c) => c.status === "unresolved")) {
      // Should not happen if button disabled, but safe check
      return;
    }

    setSaving(true);
    try {
      const finalContent = chunks
        .map((c) => (c.type === "conflict" ? c.resolved : c.content))
        .join(""); // Logic handles newlines inside chunks

      await window.gitcanopyAPI.resolveConflict(
        repoPath,
        filePath,
        finalContent,
      );
      await onResolved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save resolved file.",
      );
    } finally {
      setSaving(false);
    }
  };

  const remainingConflicts = chunks.filter(
    (c) => c.type === "conflict" && c.status === "unresolved",
  ).length;

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
        content:
          "p-0 overflow-hidden bg-zed-bg dark:bg-zed-dark-bg rounded-lg border border-zed-border dark:border-zed-dark-border shadow-2xl",
        mask: "bg-black/60 backdrop-blur-sm",
      }}
      styles={{
        body: {
          height: "85vh",
          padding: "0",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zed-border dark:border-zed-dark-border bg-zed-surface dark:bg-zed-dark-surface">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded">
            <WarningOutlined className="text-red-500 text-lg" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zed-text dark:text-zed-dark-text">
              {filePath}
            </h3>
            <p className="text-[10px] text-zed-muted uppercase tracking-widest font-bold">
              {remainingConflicts === 0 ? (
                <span className="text-green-500">All conflicts resolved</span>
              ) : (
                <span className="text-red-500">
                  {remainingConflicts} conflicts remaining
                </span>
              )}
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
            className={`flex items-center gap-2 px-6 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all shadow-lg ${
              remainingConflicts === 0
                ? "bg-zed-accent text-white hover:opacity-90 active:scale-95"
                : "bg-zed-element dark:bg-zed-dark-element text-zed-muted opacity-50 cursor-not-allowed"
            }`}
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                <SaveOutlined /> Complete Merge
              </>
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden bg-zed-bg dark:bg-zed-dark-bg">
        {/* Conflict Minimap/Sidebar */}
        <div className="w-12 border-r border-zed-border dark:border-zed-dark-border bg-zed-surface dark:bg-zed-dark-surface flex flex-col items-center py-4 gap-2">
          {chunks.map(
            (chunk, index) =>
              chunk.type === "conflict" && (
                <button
                  key={chunk.id}
                  onClick={() =>
                    document
                      .getElementById(`chunk-${chunk.id}`)
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className={`w-2 h-2 rounded-full transition-all ${
                    chunk.status === "resolved"
                      ? "bg-green-500/30 hover:bg-green-500/60"
                      : "bg-red-500/70 hover:bg-red-500"
                  }`}
                  title={`Jump to Conflict ${index + 1}`}
                />
              ),
          )}
          <div className="flex-1" />
          <button
            onClick={() =>
              document
                .querySelector(".custom-scrollbar")
                ?.scrollTo({ top: 0, behavior: "smooth" })
            }
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
                  <div
                    key={chunk.id}
                    className="whitespace-pre-wrap font-mono text-[11px] text-zed-text/60 dark:text-zed-dark-text/60 px-4 leading-relaxed"
                  >
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
                    className="group relative border border-green-500/10 bg-green-500/[0.02] dark:bg-green-500/[0.01] rounded p-4 transition-all"
                  >
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() =>
                          setChunks((prev) =>
                            prev.map((c) =>
                              c.id === chunk.id
                                ? { ...c, status: "unresolved" }
                                : c,
                            ),
                          )
                        }
                        className="text-[9px] bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border px-2 py-1 rounded text-zed-muted hover:text-red-500 font-medium uppercase tracking-wider transition-all"
                      >
                        Modify
                      </button>
                    </div>
                    <div className="text-[9px] font-medium text-green-600/70 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                      Resolved
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-[11px] text-zed-text/70 dark:text-zed-dark-text/70 leading-relaxed">
                      {chunk.resolved}
                    </pre>
                  </div>
                );
              }

              return (
                <div
                  key={chunk.id}
                  id={`chunk-${chunk.id}`}
                  className="rounded-lg overflow-hidden border border-zed-border dark:border-zed-dark-border shadow-sm mb-6 bg-zed-bg dark:bg-zed-dark-bg"
                >
                  {/* Header */}
                  <div className="bg-red-50/50 dark:bg-red-900/10 px-4 py-2 flex justify-between items-center border-b border-red-100 dark:border-red-900/30">
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest flex items-center gap-2">
                      <WarningOutlined /> Merge Conflict #{chunk.id}
                    </span>
                  </div>

                  {/* Split View */}
                  <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-zed-border dark:divide-zed-dark-border min-h-[150px]">
                    {/* Current (Ours) */}
                    <div className="flex-1 flex flex-col min-w-0 bg-green-50/30 dark:bg-green-900/5">
                      <div className="px-4 py-2 flex justify-between items-center border-b border-green-100/50 dark:border-green-900/20 bg-green-50/50 dark:bg-green-900/10">
                        <span className="text-[9px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider opacity-80">
                          Current Change
                        </span>
                        <button
                          onClick={() => handleResolve(chunk.id, "current")}
                          className="text-[9px] font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 px-2 py-1 rounded transition-colors"
                        >
                          Accept Current
                        </button>
                      </div>
                      <div className="flex-1 overflow-auto p-4 custom-scrollbar font-mono text-[11px] leading-relaxed text-zed-text dark:text-zed-dark-text bg-white/50 dark:bg-black/20">
                        {chunk.current}
                      </div>
                    </div>

                    {/* Incoming (Theirs) */}
                    <div className="flex-1 flex flex-col min-w-0 bg-blue-50/30 dark:bg-blue-900/5">
                      <div className="px-4 py-2 flex justify-between items-center border-b border-blue-100/50 dark:border-blue-900/20 bg-blue-50/50 dark:bg-blue-900/10">
                        <span className="text-[9px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider opacity-80">
                          Incoming Change
                        </span>
                        <button
                          onClick={() => handleResolve(chunk.id, "incoming")}
                          className="text-[9px] font-bold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 px-2 py-1 rounded transition-colors"
                        >
                          Accept Incoming
                        </button>
                      </div>
                      <div className="flex-1 overflow-auto p-4 custom-scrollbar font-mono text-[11px] leading-relaxed text-zed-text dark:text-zed-dark-text bg-white/50 dark:bg-black/20">
                        {chunk.incoming}
                      </div>
                    </div>
                  </div>

                  {/* AI & Actions Section */}
                  <div className="border-t border-zed-border dark:border-zed-dark-border bg-zed-surface dark:bg-zed-dark-surface">
                    {chunk.aiSuggestion ? (
                      <div className="bg-blue-50/50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30">
                        <div className="px-4 py-2 flex items-center justify-between border-b border-blue-100 dark:border-blue-800/20">
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                            <RobotOutlined /> AI Suggestion
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => discardAiSuggestion(chunk.id)}
                              className="px-3 py-1 text-[10px] font-medium text-zed-muted hover:text-red-500 transition-colors"
                            >
                              Discard
                            </button>
                            <button
                              onClick={() => acceptAiSuggestion(chunk)}
                              className="px-3 py-1 bg-zed-accent hover:opacity-90 text-white rounded text-[10px] font-bold transition-all shadow-sm"
                            >
                              Apply Fix
                            </button>
                          </div>
                        </div>
                        <div className="p-4 max-h-[300px] overflow-auto custom-scrollbar font-mono text-[11px] text-zed-text dark:text-zed-dark-text leading-relaxed bg-white/80 dark:bg-[#1e1e1e]">
                          {chunk.aiSuggestion}
                        </div>
                      </div>
                    ) : (
                      <div className="px-6 py-4">
                        <div className="flex items-center gap-3 dark:bg-zed-dark-bg dark:bg-blend-saturation rounded-full border-2 border-zed-border dark:border-zed-dark-border px-4 py-2 focus-within:border-zed-accent/50 transition-all shadow-sm">
                          <RobotOutlined className="text-zed-accent text-sm" />
                          <input
                            type="text"
                            placeholder="Ask AI to resolve (e.g. 'Combine logic from both, keep incoming styles')..."
                            value={aiInstructions[chunk.id] || ""}
                            onChange={(e) =>
                              setAiInstructions((prev) => ({
                                ...prev,
                                [chunk.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAiResolve(chunk);
                            }}
                            className="flex-1 bg-transparent border-none text-xs text-zed-text dark:text-zed-dark-text focus:ring-0 placeholder:text-zed-muted/50 p-0"
                          />
                          <button
                            onClick={() => handleAiResolve(chunk)}
                            disabled={
                              chunk.isAiResolving || !aiInstructions[chunk.id]
                            }
                            className="flex items-center gap-2 px-4 py-1.5 bg-zed-accent text-white rounded-full text-[10px] font-bold transition-all disabled:opacity-50 shadow-sm hover:shadow"
                          >
                            {chunk.isAiResolving ? (
                              <span className="flex items-center gap-2">
                                <RobotOutlined className="animate-spin" />{" "}
                                Thinking...
                              </span>
                            ) : (
                              "Generate Fix"
                            )}
                          </button>
                        </div>
                        <p className="mt-2 text-[9px] text-zed-muted px-4 italic opacity-70">
                          AI will analyze both changes and generate a merged
                          version based on your instructions.
                        </p>
                      </div>
                    )}

                    {/* Manual Actions Footer */}
                    {!chunk.aiSuggestion && (
                      <div className="px-4 py-2 flex justify-center border-t border-zed-border/50 dark:border-zed-dark-border/50 bg-zed-bg/50 dark:bg-zed-dark-bg/50">
                        <button
                          onClick={() => handleResolve(chunk.id, "both")}
                          className="text-[10px] font-bold text-zed-muted hover:text-zed-text transition-colors uppercase tracking-wider"
                        >
                          Keep Both
                        </button>
                      </div>
                    )}
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
