import React, { useState, useEffect } from "react";
import {
  NodeIndexOutlined,
  CheckCircleFilled,
  ExclamationCircleFilled,
  ToolOutlined,
  CloudServerOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { McpServerStatus, McpTool } from "@shared/types";

interface McpStatusPanelProps {
  visible: boolean;
  onClose: () => void;
}

export const McpStatusPanel: React.FC<McpStatusPanelProps> = ({ visible, onClose }) => {
  const [servers, setServers] = useState<McpServerStatus[]>([]);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [serverList, toolList] = await Promise.all([
        window.gitcanopyAPI.getMcpServers(),
        window.gitcanopyAPI.getAllMcpTools(),
      ]);
      setServers(serverList);
      setTools(toolList);
    } catch (error) {
      console.error("Failed to fetch MCP status:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchData();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[-1] animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      <div className="w-[600px] max-h-[80vh] bg-zed-surface dark:bg-zed-dark-surface border border-zed-border dark:border-zed-dark-border shadow-2xl rounded-lg overflow-hidden flex flex-col font-sans animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-zed-border dark:border-zed-dark-border bg-zed-bg dark:bg-zed-dark-bg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <NodeIndexOutlined className="text-indigo-500 text-lg" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-zed-text dark:text-zed-dark-text">
                MCP Infrastructure
              </h3>
              <p className="text-[10px] text-zed-muted font-medium uppercase tracking-tight opacity-60">
                Model Context Protocol Active
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
              <button 
                  onClick={fetchData}
                  className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400 uppercase tracking-widest transition-colors"
              >
                  Refresh
              </button>
              <button 
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-zed-muted hover:text-zed-text"
              >
                  <CloseOutlined />
              </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 bg-zed-surface dark:bg-zed-dark-surface">
          {/* Servers Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 opacity-60">
              <CloudServerOutlined className="text-xs" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Active Servers</span>
            </div>
            
            {loading ? (
              <div className="py-2 space-y-2">
                <div className="h-12 bg-zed-element/20 dark:bg-zed-dark-element/20 animate-pulse rounded-md"></div>
              </div>
            ) : servers.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-zed-border dark:border-zed-dark-border rounded-lg">
                  <span className="text-xs text-zed-muted italic">No MCP servers connected</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {servers.map((server) => (
                  <div key={server.id} className="p-4 bg-zed-bg dark:bg-zed-dark-bg border border-zed-border/40 dark:border-zed-dark-border/40 rounded-lg flex items-center justify-between group shadow-sm hover:border-indigo-500/30 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zed-text dark:text-zed-dark-text">{server.name}</span>
                      <span className="text-[9px] text-zed-muted uppercase tracking-tight font-mono mt-0.5">{server.id}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-indigo-500">{server.toolCount} tools</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${server.status === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          <span className="text-[9px] uppercase tracking-tighter opacity-50 font-black">{server.status}</span>
                        </div>
                      </div>
                      {server.status === 'connected' ? (
                          <CheckCircleFilled className="text-emerald-500 text-xs" />
                      ) : (
                          <ExclamationCircleFilled className="text-rose-500 text-xs" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tools Summary */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 opacity-60">
              <ToolOutlined className="text-xs" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Global Capabilities ({tools.length})</span>
            </div>
            
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-zed-border/10 dark:border-zed-dark-border/10 pt-4">
              {tools.map(tool => (
                  <div key={tool.name} className="flex flex-col gap-0.5 px-3 py-2 hover:bg-zed-element dark:hover:bg-zed-dark-element transition-colors rounded group">
                      <span className="text-[11px] font-mono font-bold text-pink-500 dark:text-pink-400 group-hover:text-pink-400">@{tool.name}</span>
                      <span className="text-[10px] text-zed-muted leading-relaxed line-clamp-2">
                          {tool.description || "Experimental Git action"}
                      </span>
                  </div>
              ))}
              {tools.length === 0 && !loading && (
                  <div className="col-span-2 py-4 text-xs text-zed-muted italic text-center">
                      No tools discovered
                  </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-zed-bg/50 dark:bg-zed-dark-bg/50 border-t border-zed-border dark:border-zed-dark-border flex items-center justify-between">
            <p className="text-[9px] text-zed-muted leading-relaxed uppercase tracking-wider opacity-60 font-bold">
              Secure Stdio Transport Protocol v2024-11-05
            </p>
            <button 
              onClick={onClose}
              className="px-6 py-2 bg-zed-element dark:bg-zed-dark-element hover:opacity-80 text-[10px] font-bold uppercase tracking-widest transition-all rounded"
            >
              Acknowledge
            </button>
        </div>
      </div>
    </div>
  );
};
