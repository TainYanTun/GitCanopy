import React, { useState, useEffect, useRef } from "react";
import { useToast } from "./ToastContext";
import {
  UserOutlined,
  SendOutlined,
  CopyOutlined,
  CheckOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { MyceliaIcon } from "./MyceliaIcon";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { McpTool, ChatMessage } from "@shared/types";
import { McpStatusPanel } from "./McpStatusPanel";

const formatMentions = (text: string): string => {
  if (!text) return "";
  return text.replace(/(?<!`)(@[\w-]+)(?!`)/g, "`$1`");
};

interface GitLabAgentProps {
  repoPath: string;
  projectName: string;
  currentBranch: string;
}

export const GitLabAgent: React.FC<GitLabAgentProps> = ({
  repoPath,
  projectName,
  currentBranch,
}) => {
  const { showToast } = useToast();
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [availableTools, setAvailableTools] = useState<McpTool[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [gitlabProjectPath, setGitlabProjectPath] = useState<
    string | undefined
  >(undefined);
  const [gitlabProjectId, setGitlabProjectId] = useState<string | undefined>(
    undefined,
  );
  const [showMcpStatus, setShowMcpStatus] = useState(false);
  const [aiProvider, setAiProvider] = useState<string>("Gemini");
  const [workspaceStatus, setWorkspaceStatus] = useState<{ staged: number, unstaged: number, ahead: number, behind: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const fetchWorkspaceContext = async () => {
    try {
      const status = await window.gitcanopyAPI.getStatus(repoPath);
      const staged = status.files.filter(f => f.staged).length;
      const unstaged = status.files.filter(f => !f.staged).length;
      setWorkspaceStatus({ staged, unstaged, ahead: status.ahead, behind: status.behind });
    } catch (e) {
      console.error("Failed to fetch workspace context", e);
    }
  };

  const fetchTools = async () => {
    try {
      const tools = await window.gitcanopyAPI.getAllMcpTools();
      setAvailableTools(tools);
    } catch (e) {
      console.error("Failed to fetch MCP tools", e);
    }
  };

  useEffect(() => {
    fetchTools();
    fetchWorkspaceContext();
    window.gitcanopyAPI
      .getSettings(repoPath)
      .then((s: any) => {
        if (s?.gitlabProjectPath) setGitlabProjectPath(s.gitlabProjectPath);
        if (s?.gitlabProjectId) setGitlabProjectId(s.gitlabProjectId);
        if (s?.aiProvider) {
          const providerMap: Record<string, string> = {
            gemini: "Gemini",
            openai: "OpenAI",
            claude: "Claude",
          };
          setAiProvider(providerMap[s.aiProvider] || "Gemini");
        }
      })
      .catch(() => { });
  }, [repoPath]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [chatHistory, isAgentTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (value.startsWith("@") && !value.includes(" ")) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const getRequiredParams = (tool: McpTool): string[] => {
    if (!tool.inputSchema || !tool.inputSchema.required) return [];
    return tool.inputSchema.required.filter(
      (p: string) =>
        !["projectId", "project_id", "projectPath", "project_path"].includes(p),
    );
  };

  const handleSuggestionClick = (tool: any, isCommand: boolean = false) => {
    if (isCommand) {
      setInputValue(`@${tool.name} `);
    } else {
      const params = getRequiredParams(tool);
      const paramString = params.length > 0 ? params.map(p => `${p}=""`).join(' ') : '';
      const newVal = `@${tool.name} ${paramString}${paramString ? ' ' : ''}`;
      setInputValue(newVal);
      setTimeout(() => {
        if (inputRef.current && params.length > 0) {
          const firstQuotePos = newVal.indexOf('""') + 1;
          inputRef.current.setSelectionRange(firstQuotePos, firstQuotePos);
        }
      }, 0);
    }
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const renderHighlightedInput = () => {
    const tokens = inputValue.split(/(\s+|@\w+|\w+=|"(?:[^"\\]|\\.)*")/g);
    return tokens.map((token, i) => {
      if (!token) return null;
      if (token.startsWith("@")) {
        return <span key={i} className="text-purple-700 dark:text-purple-400">{token}</span>;
      }
      if (token.endsWith("=")) {
        return <span key={i} className="text-pink-700 dark:text-pink-400">{token}</span>;
      }
      if (token.startsWith("\"") && token.endsWith("\"")) {
        return <span key={i} className="text-emerald-700 dark:text-emerald-400">{token}</span>;
      }
      return <span key={i} className="opacity-90 dark:opacity-80">{token}</span>;
    });
  };

  const handleCopy = async (content: string, index: number) => {
    try {
      await window.gitcanopyAPI.copyToClipboard(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      showToast("Copied", "success", 1000);
    } catch (err) {
      showToast("Failed to copy", "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = inputValue.trim();
    if (!prompt || isAgentTyping) return;

    if (prompt === "@clear") {
      setChatHistory([]);
      setInputValue("");
      setShowSuggestions(false);
      return;
    }

    setInputValue("");
    setShowSuggestions(false);
    const userMsg: ChatMessage = {
      role: "user",
      content: prompt,
      timestamp: Date.now(),
    };
    setChatHistory((prev) => [...prev, userMsg]);
    setIsAgentTyping(true);

    try {
      const status = await window.gitcanopyAPI.getStatus(repoPath);
      const context = JSON.stringify({
        project: projectName,
        branch: currentBranch,
        status: status.files,
        ...(gitlabProjectPath && { gitlabProjectPath }),
        ...(gitlabProjectId && { gitlabProjectId }),
      });

      const response = await window.gitcanopyAPI.triggerDuoAgent(
        prompt,
        context,
        chatHistory.slice(-10)
      );

      const agentMsg: ChatMessage = {
        role: "agent",
        content:
          response?.message || "No response received.",
        timestamp: Date.now(),
      };
      setChatHistory((prev) => [...prev, agentMsg]);
    } catch (error: any) {
      showToast(error?.message || "Connection error", "error");
    } finally {
      setIsAgentTyping(false);
      inputRef.current?.focus();
    }
  };

  const clientCommands = [
    { name: "clear", description: "Clear chat history" },
  ];

  const filteredCommands = clientCommands.filter((c) =>
    c.name.toLowerCase().includes(inputValue.substring(1).toLowerCase()),
  );

  const filteredTools = availableTools.filter((t) =>
    t.name.toLowerCase().includes(inputValue.substring(1).toLowerCase()),
  );

  const hasSuggestions = filteredCommands.length > 0 || filteredTools.length > 0;

  const renderInputSection = (isCentered: boolean) => (
    <div className={`w-full max-w-3xl mx-auto relative ${isCentered ? 'scale-100 transition-all duration-500' : ''}`}>
      {showSuggestions && hasSuggestions && (
        <div className="absolute bottom-full left-0 w-full max-h-64 mb-3 bg-zed-surface dark:bg-[#1e2227] border border-zed-border dark:border-white/10 rounded-lg shadow-2xl overflow-hidden z-50 flex flex-col animate-in slide-in-from-bottom-2">
          <div className="px-3 py-1.5 border-b border-zed-border dark:border-white/5 bg-zed-element dark:bg-white/5 flex items-center justify-between">
            <span className="text-[9px] font-mono font-black uppercase tracking-[0.2em] opacity-40 dark:opacity-30">Technical_Modules</span>
            <span className="text-[9px] opacity-30 dark:opacity-20 font-mono tracking-tighter">TAB_SELECT</span>
          </div>
          <div className="overflow-y-auto custom-scrollbar">
            {filteredCommands.map((cmd) => (
              <button key={cmd.name} onClick={() => handleSuggestionClick(cmd, true)} className="w-full text-left px-4 py-2.5 hover:bg-zed-element dark:hover:bg-white/5 flex items-center justify-between group transition-colors">
                <div className="flex flex-col">
                  <span className="text-[12px] font-mono font-bold text-purple-700 dark:text-purple-400">@{cmd.name}</span>
                  <span className="text-[10px] font-sans font-medium opacity-50 dark:opacity-40 tracking-tight">{cmd.description}</span>
                </div>
              </button>
            ))}
            {filteredTools.map((tool) => (
              <button key={tool.name} onClick={() => handleSuggestionClick(tool)} className="w-full text-left px-4 py-2.5 hover:bg-zed-element dark:hover:bg-white/5 flex items-center justify-between group transition-colors">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-mono font-bold text-zed-accent dark:text-zed-dark-accent">@{tool.name}</span>
                    {getRequiredParams(tool).map(p => <span key={p} className="text-[8px] font-mono bg-pink-500/10 text-pink-700 dark:text-pink-400 px-1 rounded-sm border border-pink-500/20">{p}</span>)}
                  </div>
                  <span className="text-[10px] font-sans font-medium opacity-50 dark:opacity-40 truncate tracking-tight">{tool.description || "Git Action"}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <form 
        onSubmit={handleSubmit} 
        className="relative group rounded-xl bg-zed-element/80 dark:bg-white/5 border border-zed-border dark:border-white/10 shadow-xl shadow-black/5 focus-within:border-zed-accent/40 dark:focus-within:border-white/20 transition-all"
      >
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-zed-text dark:text-zed-dark-text opacity-40 group-focus-within:opacity-70 transition-opacity">
          <SendOutlined className="text-xs" />
        </div>

        <div className="absolute inset-0 px-12 py-3 text-[14px] font-sans font-medium tracking-tight pointer-events-none whitespace-pre break-all overflow-hidden flex items-center">
          {renderHighlightedInput()}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={(e) => { if (e.key === "Escape") setShowSuggestions(false); }}
          disabled={isAgentTyping}
          placeholder="Enter command..."
          className="relative w-full bg-transparent px-12 py-4 text-[14px] font-sans font-medium tracking-tight border-none focus:outline-none focus:ring-0 placeholder:opacity-50 dark:placeholder:opacity-30 text-transparent caret-zed-accent dark:caret-zed-dark-accent min-h-[54px] rounded-2xl"
          autoFocus
        />

        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-20 group-focus-within:opacity-40 transition-opacity">
          <kbd className="text-[10px] font-mono font-bold tracking-tight border border-black/10 dark:border-white/10 px-1.5 rounded-md">ENTER</kbd>
        </div>
      </form>
    </div>
  );

  const getWorkspacePulse = () => {
    if (!workspaceStatus) return <span className="animate-pulse opacity-30 dark:opacity-20 font-mono tracking-[0.2em] text-[10px] font-black uppercase">Analysing_Context...</span>;
    
    return (
      <div className="flex flex-col items-center gap-5">
        <div className="flex items-center gap-8 text-[12px] font-mono tracking-wider">
          <div className="flex flex-col items-center">
            <span className={`text-[20px] font-mono font-black tracking-tighter ${workspaceStatus.staged > 0 ? 'text-emerald-600 dark:text-emerald-500' : 'opacity-30 dark:opacity-20'}`}>
              {workspaceStatus.staged.toString().padStart(2, '0')}
            </span>
            <span className="text-[8px] opacity-40 dark:opacity-30 uppercase font-black tracking-[0.3em]">Staged</span>
          </div>
          <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10" />
          <div className="flex flex-col items-center">
            <span className={`text-[20px] font-mono font-black tracking-tighter ${workspaceStatus.unstaged > 0 ? 'text-amber-600 dark:text-amber-500' : 'opacity-30 dark:opacity-20'}`}>
              {workspaceStatus.unstaged.toString().padStart(2, '0')}
            </span>
            <span className="text-[8px] opacity-40 dark:opacity-30 uppercase font-black tracking-[0.3em]">Unstaged</span>
          </div>
          <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10" />
          <div className="flex flex-col items-center">
            <span className={`text-[20px] font-mono font-black tracking-tighter ${workspaceStatus.ahead > 0 || workspaceStatus.behind > 0 ? 'text-zed-accent' : 'opacity-30 dark:opacity-20'}`}>
              {workspaceStatus.ahead}/{workspaceStatus.behind}
            </span>
            <span className="text-[8px] opacity-40 dark:opacity-30 uppercase font-black tracking-[0.3em]">Sync_State</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full bg-zed-bg dark:bg-zed-dark-bg text-[13px] text-zed-text dark:text-zed-dark-text flex flex-col font-sans selection:bg-zed-accent/20 dark:selection:bg-zed-dark-accent/30 relative overflow-hidden transition-colors duration-300">
      {/* Ambient Texture Layer */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04] dark:opacity-[0.03] mix-blend-multiply dark:mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      <McpStatusPanel
        visible={showMcpStatus}
        onClose={() => setShowMcpStatus(false)}
      />

      {/* Zed-style Breadcrumb Header */}
      <div className="flex-shrink-0 h-10 px-4 border-b border-zed-border dark:border-zed-dark-border flex items-center justify-between bg-zed-bg/50 dark:bg-zed-dark-bg/50 backdrop-blur-xl sticky top-0 z-40 transition-colors">
        <div className="flex items-center gap-3 overflow-hidden">
          <RobotOutlined className="text-zed-accent dark:text-zed-dark-accent opacity-80" />
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-tight whitespace-nowrap">
            <span className="opacity-50 dark:opacity-40 uppercase tracking-[0.2em] font-black">Mycelia</span>
            <span className="opacity-30 dark:opacity-20">/</span>
            <span className="opacity-70 dark:opacity-60 tracking-tight">{projectName}</span>
            <span className="opacity-30 dark:opacity-20">/</span>
            <span className="text-zed-accent dark:text-zed-dark-accent font-black tracking-tight">{currentBranch}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowMcpStatus(true)}
            className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/5 transition-colors group"
          >
            <div className={`w-1 h-1 rounded-full ${availableTools.length > 0 ? "bg-emerald-600 dark:bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-600"}`} />
            <span className="text-[9px] font-mono font-black uppercase tracking-[0.2em] opacity-40 dark:opacity-30 group-hover:opacity-70 transition-opacity">MCP_Link</span>
          </button>

          <div className="flex items-center gap-1.5 px-2 py-1">
            <div className={`w-1 h-1 rounded-full ${aiProvider === 'OpenAI' ? 'bg-emerald-500' : aiProvider === 'Claude' ? 'bg-orange-500' : 'bg-purple-500'}`} />
            <span className="text-[9px] font-mono font-black uppercase tracking-[0.2em] opacity-40 dark:opacity-30">{aiProvider}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative z-10">
        <div
          ref={chatScrollRef}
          className="h-full overflow-y-auto scrollbar-hide flex flex-col"
        >
          <div className={`max-w-4xl mx-auto px-10 py-12 w-full ${chatHistory.length === 0 ? 'flex-1 flex flex-col items-center justify-center' : 'space-y-10'}`}>
            {chatHistory.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in duration-1000 w-full space-y-14">
                <div className="text-center space-y-10">
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-[10px] font-mono font-black tracking-[0.7em] uppercase opacity-30 dark:opacity-20">Hybrid_Agent_Core</span>
                    {getWorkspacePulse()}
                  </div>
                </div>

                <div className="w-full">
                  {renderInputSection(true)}
                </div>

                {availableTools.length > 0 && (
                  <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
                    <div className="flex items-center gap-4 px-1 w-full max-w-3xl">
                      <div className="h-[1px] flex-1 bg-black/10 dark:bg-white/10 opacity-30" />
                      <span className="text-[9px] font-mono font-black uppercase tracking-[0.5em] opacity-20 dark:opacity-15">Contextual_Bridge</span>
                      <div className="h-[1px] flex-1 bg-black/10 dark:bg-white/10 opacity-30" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 w-full max-w-3xl">
                      <button 
                        onClick={() => { setInputValue("List open merge requests for this project"); inputRef.current?.focus(); }}
                        className="flex flex-col gap-1 p-4 rounded border border-black/10 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.01] text-left hover:border-zed-accent/50 dark:hover:border-white/10 transition-all group shadow-sm"
                      >
                        <span className="text-[12px] font-mono font-black uppercase tracking-tighter opacity-50 dark:opacity-40 group-hover:opacity-100 transition-opacity">List_MRs</span>
                        <span className="text-[10px] font-sans font-medium opacity-40 dark:opacity-20 tracking-tight group-hover:opacity-60 transition-opacity truncate">Fetch merge requests via GitLab MCP server.</span>
                      </button>
                      <button 
                        onClick={() => { setInputValue("Show current pipeline status"); inputRef.current?.focus(); }}
                        className="flex flex-col gap-1 p-4 rounded border border-black/10 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.01] text-left hover:border-zed-accent/50 dark:hover:border-white/10 transition-all group shadow-sm"
                      >
                        <span className="text-[12px] font-mono font-black uppercase tracking-tighter opacity-50 dark:opacity-40 group-hover:opacity-100 transition-opacity">Pipeline_Status</span>
                        <span className="text-[10px] font-sans font-medium opacity-40 dark:opacity-20 tracking-tight group-hover:opacity-60 transition-opacity truncate">Inspect CI/CD status using hybrid tool-use.</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {chatHistory.map((msg, i) => (
              <div key={i} className="group animate-in fade-in slide-in-from-bottom-1 duration-300">
                <div className="flex items-start gap-5">
                  <div className={`shrink-0 w-6 h-6 flex items-center justify-center mt-1 ${msg.role === 'user' ? 'opacity-20 dark:opacity-10' : 'text-zed-accent dark:text-zed-dark-accent opacity-80 dark:opacity-60'}`}>
                    {msg.role === "user" ? <UserOutlined /> : <MyceliaIcon className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono font-black uppercase tracking-[0.2em] opacity-30 dark:opacity-20">
                        {msg.role === "user" ? "Operator" : "Mycelia"}
                      </span>
                      {msg.role === "agent" && (
                        <button
                          onClick={() => handleCopy(msg.content, i)}
                          className="opacity-0 group-hover:opacity-40 hover:opacity-100 p-1 transition-all"
                        >
                          {copiedIndex === i ? <CheckOutlined className="text-emerald-600 dark:text-emerald-500" /> : <CopyOutlined className="text-[10px]" />}
                        </button>
                      )}
                    </div>
                    <div className="text-[13.5px] font-sans font-medium tracking-tight text-black dark:text-zed-dark-text/90 leading-relaxed markdown-content">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || "");
                            const codeText = String(children).replace(/\n$/, "");
                            const isInline = !className;

                            if (isInline) {
                              return <code className={`px-1.5 py-0.5 font-mono font-bold text-[11px] ${codeText.startsWith('@') ? 'text-purple-700 dark:text-purple-400' : 'text-pink-700 dark:text-pink-400 bg-black/5 dark:bg-white/5'} rounded-sm`} {...props}>{children}</code>;
                            }

                            return (
                              <div className="my-3 overflow-hidden rounded-sm border border-black/10 dark:border-white/5 bg-white dark:bg-black/20">
                                <div className="flex items-center justify-between px-3 py-1 bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/5">
                                  <span className="text-[9px] font-mono font-black uppercase tracking-[0.1em] opacity-40 dark:opacity-30">{match ? match[1] : "code"}</span>
                                  <button onClick={() => { window.gitcanopyAPI.copyToClipboard(codeText); showToast("Copied", "success", 1000); }} className="text-[9px] font-mono font-black uppercase tracking-widest opacity-40 dark:opacity-30 hover:opacity-100 transition-opacity">Copy</button>
                                </div>
                                <pre className="p-3 m-0 overflow-x-auto font-mono text-[12px] leading-relaxed"><code className={className} {...props}>{children}</code></pre>
                              </div>
                            );
                          },
                          table: ({ children }) => <div className="my-4 overflow-x-auto"><table className="w-full text-left border-collapse">{children}</table></div>,
                          th: ({ children }) => <th className="font-mono font-black text-[9px] uppercase tracking-widest opacity-60 dark:opacity-50">{children}</th>,
                          td: ({ children }) => <td className="font-sans font-medium tracking-tight text-[12.5px] opacity-90 dark:opacity-80">{children}</td>,
                        }}
                      >
                        {formatMentions(msg.content)}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isAgentTyping && (
              <div className="flex items-start gap-5 animate-pulse-slow">
                <div className="shrink-0 w-6 h-6 flex items-center justify-center mt-1 text-zed-accent dark:text-zed-dark-accent opacity-40 dark:opacity-30">
                  <MyceliaIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <span className="text-[9px] font-mono font-black uppercase tracking-[0.2em] opacity-25 dark:opacity-15">Mycelia</span>
                  <div className="flex gap-1 py-2">
                    <div className="w-1 h-1 rounded-full bg-zed-accent/40 dark:bg-zed-dark-accent/40 animate-bounce" />
                    <div className="w-1 h-1 rounded-full bg-zed-accent/40 dark:bg-zed-dark-accent/40 animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1 h-1 rounded-full bg-zed-accent/40 dark:bg-zed-dark-accent/40 animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zed-style Integrated Input */}
      {chatHistory.length > 0 && (
        <div className="flex-shrink-0 p-4 pb-6 bg-gradient-to-t from-zed-bg via-zed-bg/95 to-transparent dark:from-zed-dark-bg dark:via-zed-dark-bg/95 border-t border-zed-border/50 dark:border-white/5">
          {renderInputSection(false)}
        </div>
      )}
    </div>
  );
};
