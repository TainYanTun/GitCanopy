import React, { useState, useEffect, useRef } from "react";
import { useToast } from "./ToastContext";
import {
  UserOutlined,
  SendOutlined,
  CopyOutlined,
  CheckOutlined,
  NodeIndexOutlined,
} from "@ant-design/icons";
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

  const inputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

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
    // Load GitLab project identity and AI provider from settings
    window.gitcanopyAPI
      .getSettings()
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
      .catch(() => {});
  }, []);

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

    // Show suggestions if input starts with @
    if (value.startsWith("@") && !value.includes(" ")) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const getRequiredParams = (tool: McpTool): string[] => {
    if (!tool.inputSchema || !tool.inputSchema.required) return [];
    // Filter out project-related IDs that are automatically injected
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
      // Pre-fill parameters with empty quotes for easier filling
      const paramString = params.length > 0 ? params.map(p => `${p}=""`).join(' ') : '';
      const newVal = `@${tool.name} ${paramString}${paramString ? ' ' : ''}`;
      setInputValue(newVal);
      
      // Smart cursor placement: Move cursor inside the first set of quotes
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
    // Basic regex-based syntax highlighter for the input display
    const tokens = inputValue.split(/(\s+|@\w+|\w+=|"(?:[^"\\]|\\.)*")/g);
    
    return tokens.map((token, i) => {
      if (!token) return null;
      if (token.startsWith("@")) {
        return <span key={i} className="text-purple-500 dark:text-purple-400">{token}</span>;
      }
      if (token.endsWith("=")) {
        return <span key={i} className="text-pink-500 dark:text-pink-400">{token}</span>;
      }
      if (token.startsWith("\"") && token.endsWith("\"")) {
        return <span key={i} className="text-emerald-500 dark:text-emerald-400">{token}</span>;
      }
      return <span key={i} className="text-zed-text dark:text-zed-dark-text opacity-90">{token}</span>;
    });
  };

  const handleCopy = async (content: string, index: number) => {
    try {
      await window.gitcanopyAPI.copyToClipboard(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      showToast("Message copied to clipboard", "success", 1500);
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
      showToast("Chat history cleared", "success", 1500);
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
        chatHistory.slice(-10) // Pass last 10 messages for short-term memory awareness
      );

      const agentMsg: ChatMessage = {
        role: "agent",
        content:
          response?.message || "No response received from Mycelia Agent.",
        timestamp: Date.now(),
      };
      setChatHistory((prev) => [...prev, agentMsg]);
    } catch (error: any) {
      showToast(error?.message || "Agent connection error", "error");
    } finally {
      setIsAgentTyping(false);
      inputRef.current?.focus();
    }
  };

  const clientCommands = [
    {
      name: "clear",
      description: "Clear current chat history and message logs",
    },
  ];

  const filteredCommands = clientCommands.filter((c) =>
    c.name.toLowerCase().includes(inputValue.substring(1).toLowerCase()),
  );

  const filteredTools = availableTools.filter((t) =>
    t.name.toLowerCase().includes(inputValue.substring(1).toLowerCase()),
  );

  const hasSuggestions =
    filteredCommands.length > 0 || filteredTools.length > 0;


  return (
    <div className="h-full w-full bg-zed-bg dark:bg-zed-dark-bg flex flex-col font-sans animate-in fade-in duration-700">
      {/* MCP Modal Overlay */}
      <McpStatusPanel 
        visible={showMcpStatus} 
        onClose={() => setShowMcpStatus(false)} 
      />

      {/* Hyper-minimalist Context Bar */}
      <div className="flex-shrink-0 px-8 py-4 border-b border-zed-border dark:border-zed-dark-border flex items-center justify-between bg-zed-surface/30 dark:bg-zed-dark-surface/30 backdrop-blur-sm relative z-50">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-none bg-gradient-to-tr from-violet-600 via-indigo-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/10">
            <NodeIndexOutlined className="text-lg animate-pulse" />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-400 to-pink-400">
              Mycelia
            </h2>
            <div className="flex items-center gap-2 mt-0.5 opacity-40">
              <span className="text-[9px] font-bold uppercase tracking-widest">
                {projectName}
              </span>
              <span className="text-[9px]">•</span>
              <span className="text-[9px] font-mono">{currentBranch}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-zed-muted dark:text-zed-dark-muted">
          {/* Dynamic AI Status Indicator */}
          <div className="flex items-center gap-1.5">
            <span 
              className={`w-1.5 h-1.5 animate-pulse ${
                aiProvider === 'OpenAI' ? 'bg-emerald-400' : 
                aiProvider === 'Claude' ? 'bg-orange-400' : 
                'bg-purple-400'
              }`}
            ></span>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] select-none opacity-50">
              {aiProvider}
            </span>
          </div>

          {/* Minimalist Divider */}
          <span className="text-[9px] opacity-20 select-none">|</span>

          {/* MCP Status Indicator */}
          <button 
            onClick={() => setShowMcpStatus(true)}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          >
            <span
              className={`w-1.5 h-1.5 ${availableTools.length > 0 ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}
            ></span>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] select-none opacity-50">
              MCP
            </span>
          </button>
        </div>
      </div>

      {/* Chat Workspace */}
      <div className="flex-1 overflow-hidden relative">
        <div
          ref={chatScrollRef}
          className="h-full overflow-y-auto custom-scrollbar flex flex-col"
        >
          <div className={`max-w-4xl mx-auto px-8 py-12 space-y-12 w-full ${chatHistory.length === 0 ? 'flex-1 flex flex-col items-center justify-center' : ''}`}>
            {chatHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center space-y-10 animate-in fade-in zoom-in-95 duration-1000">
                {/* Organic pulsing network SVG visualizer */}
                <div className="relative flex items-center justify-center w-28 h-28">
                  <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-pink-500/20 rounded-none blur-3xl animate-pulse"></div>
                  <svg
                    className="w-24 h-24 text-indigo-400 drop-shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                    viewBox="0 0 100 100"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      d="M50 20 L30 50 L50 80 M50 20 L70 50 L50 80 M30 50 L70 50"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      opacity="0.4"
                    />
                    <path
                      d="M50 20 C 40 35, 35 45, 30 50 C 35 55, 40 65, 50 80 C 60 65, 65 55, 70 50 C 65 45, 60 35, 50 20 Z"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="50"
                      cy="20"
                      r="4.5"
                      fill="#c084fc"
                      className="animate-ping"
                    />
                    <circle cx="50" cy="20" r="3" fill="#c084fc" />
                    <circle cx="30" cy="50" r="3" fill="#818cf8" />
                    <circle cx="70" cy="50" r="3" fill="#ec4899" />
                    <circle cx="50" cy="80" r="3" fill="#6366f1" />
                    <path
                      d="M50 20 C 50 35, 30 35, 30 50 C 30 65, 50 65, 50 80 C 50 65, 70 65, 70 50 C 70 35, 50 35, 50 20 Z"
                      strokeWidth="0.5"
                      opacity="0.3"
                    />
                  </svg>
                </div>

                <div className="text-center space-y-2">
                  <h3 className="text-xs font-black uppercase tracking-[0.4em] text-zed-text dark:text-zed-dark-text opacity-85">
                    Autonomous Repository AI
                  </h3>
                  <p className="text-[10px] tracking-wide text-zed-muted dark:text-zed-dark-muted max-w-sm mx-auto leading-relaxed">
                    Mycelia is interconnected with your local environment
                    and Git actions to automate and inspect
                    your workspace.
                  </p>
                </div>
              </div>
            )}

            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={`flex items-start gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500 group`}
              >
                <div
                  className={`shrink-0 w-8 h-8 rounded-none flex items-center justify-center mt-1 shadow-sm ${msg.role === "user" ? "bg-zed-element dark:bg-zed-dark-element border border-zed-border/30 dark:border-zed-dark-border/30" : "bg-gradient-to-br from-violet-600 to-indigo-600 text-white"}`}
                >
                  {msg.role === "user" ? (
                    <UserOutlined className="text-xs" />
                  ) : (
                    <NodeIndexOutlined className="text-xs" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2 pt-1.5 relative">
                  <div className="flex items-center justify-between">
                    <div className="text-[9px] font-black uppercase tracking-[0.15em] opacity-40">
                      {msg.role === "user" ? "Local Operator" : "Mycelia"}
                    </div>
                    {msg.role === "agent" && (
                      <button
                        onClick={() => handleCopy(msg.content, i)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-zed-element dark:hover:bg-zed-dark-element rounded-none transition-all text-zed-muted hover:text-zed-text"
                        title="Copy to clipboard"
                      >
                        {copiedIndex === i ? (
                          <CheckOutlined className="text-emerald-500" />
                        ) : (
                          <CopyOutlined className="text-[10px]" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="text-[13px] text-zed-text dark:text-zed-dark-text leading-relaxed markdown-content prose dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || "");
                          const codeText = String(children).replace(/\n$/, "");

                          // Check if it's inline code
                          const isInline = !className;

                          if (isInline) {
                            if (codeText.startsWith("@")) {
                              return (
                                <span className="text-purple-500 dark:text-purple-400 font-mono text-[11px] font-bold">
                                  {codeText}
                                </span>
                              );
                            }
                            return (
                              <code
                                className="px-1 py-0.5 rounded-none bg-zed-element/60 dark:bg-zed-dark-element/60 font-mono text-[11px] text-pink-500 dark:text-pink-400"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          }

                          return (
                            <div className="my-4 overflow-hidden rounded-none border border-zed-border/30 dark:border-zed-dark-border/30 bg-zed-element/30 dark:bg-zed-dark-element/30 shadow-md">
                              <div className="flex items-center justify-between px-4 py-1.5 bg-zed-element/60 dark:bg-zed-dark-element/60 border-b border-zed-border/20 dark:border-zed-dark-border/20">
                                <span className="text-[10px] font-bold font-mono uppercase text-zed-muted dark:text-zed-dark-muted">
                                  {match ? match[1] : "code"}
                                </span>
                                <button
                                  onClick={() => {
                                    window.gitcanopyAPI.copyToClipboard(
                                      codeText,
                                    );
                                    showToast("Code copied", "success", 1000);
                                  }}
                                  className="text-[10px] font-bold text-purple-500 hover:text-purple-400 dark:text-purple-400 dark:hover:text-purple-300 transition-colors flex items-center gap-1"
                                >
                                  <CopyOutlined className="text-[9px]" /> Copy
                                </button>
                              </div>
                              <pre className="p-4 m-0 overflow-x-auto font-mono text-xs leading-relaxed bg-transparent">
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              </pre>
                            </div>
                          );
                        },
                        table({ children, ...props }) {
                          return (
                            <div className="w-full overflow-x-auto my-4 rounded-none border border-zed-border/40 dark:border-zed-dark-border/40 bg-zed-element/20 dark:bg-zed-dark-element/20 shadow-sm scrollbar-thin">
                              <table
                                {...props}
                                className="min-w-full m-0 border-none divide-y divide-zed-border/20 dark:divide-zed-dark-border/20"
                              >
                                {children}
                              </table>
                            </div>
                          );
                        },
                      }}
                    >
                      {formatMentions(msg.content)}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

            {isAgentTyping && (
              <div className="flex items-start gap-6 animate-pulse">
                <div className="shrink-0 w-8 h-8 rounded-none bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center mt-1 shadow-sm">
                  <NodeIndexOutlined className="text-xs" />
                </div>
                <div className="flex-1 pt-1.5 space-y-2">
                  <div className="text-[9px] font-black uppercase tracking-[0.15em] opacity-40">
                    Mycelia
                  </div>
                  <div className="flex gap-1.5 pt-2">
                    <div className="w-1.5 h-1.5 rounded-none bg-indigo-500/60 animate-bounce"></div>
                    <div className="w-1.5 h-1.5 rounded-none bg-indigo-500/60 animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 rounded-none bg-indigo-500/60 animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 px-8 py-8 relative bg-gradient-to-t from-zed-bg via-zed-bg to-transparent dark:from-zed-dark-bg dark:via-zed-dark-bg">
        <div className="max-w-4xl mx-auto relative group">
          {/* Suggestions Dropdown */}
          {showSuggestions && hasSuggestions && (
            <div className="absolute bottom-full left-0 w-96 max-h-60 mb-2 bg-zed-surface/95 dark:bg-zed-dark-surface/95 border border-zed-border dark:border-zed-dark-border rounded-md shadow-[0_12px_36px_rgba(0,0,0,0.2)] overflow-y-auto custom-scrollbar z-50 divide-y divide-zed-border/10 dark:divide-zed-dark-border/10">
              {filteredCommands.map((cmd) => (
                <button
                  key={cmd.name}
                  onClick={() => handleSuggestionClick(cmd, true)}
                  className="w-full text-left px-4 py-2.5 hover:bg-zed-element dark:hover:bg-zed-dark-element flex items-center justify-between transition-all group/item border-l-2 border-l-purple-500"
                >
                  <div className="flex flex-col">
                    <span className="text-[11px] font-mono tracking-wide text-purple-500 dark:text-purple-400 group-hover/item:translate-x-0.5 transition-transform">
                      @{cmd.name}
                    </span>
                    <span className="text-[9px] text-zed-muted/70 truncate max-w-[280px] mt-0.5">
                      {cmd.description}
                    </span>
                  </div>
                  <span className="text-[8px] font-mono text-purple-400/40 opacity-0 group-hover/item:opacity-100 transition-all select-none">
                    TAB to insert
                  </span>
                </button>
              ))}
              {filteredTools.map((tool) => {
                const requiredParams = getRequiredParams(tool);
                return (
                  <button
                    key={tool.name}
                    onClick={() => handleSuggestionClick(tool)}
                    className="w-full text-left px-4 py-2.5 hover:bg-zed-element dark:hover:bg-zed-dark-element flex items-center justify-between transition-all group/item border-l-2 border-l-indigo-500"
                  >
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono tracking-wide text-indigo-500 dark:text-indigo-400 group-hover/item:translate-x-0.5 transition-transform">
                          @{tool.name}
                        </span>
                        {requiredParams.length > 0 && (
                          <div className="flex gap-1 overflow-hidden">
                            {requiredParams.map(p => (
                              <span key={p} className="text-[8px] bg-pink-500/10 text-pink-500/70 px-1 rounded-sm font-mono border border-pink-500/10">
                                {p}=
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-zed-muted/70 truncate max-w-[320px] mt-0.5">
                        {tool.description || "MCP Git Action"}
                      </span>
                    </div>
                    <span className="text-[8px] font-mono text-indigo-400/40 opacity-0 group-hover/item:opacity-100 transition-all select-none shrink-0">
                      TAB to insert
                    </span>
                  </button>
                );
              })}
            </div>
          )}


          <form onSubmit={handleSubmit} className="relative">
            {/* Syntax Highlight Overlay */}
            <div 
              className="absolute inset-0 px-5 py-4 text-sm font-sans pointer-events-none whitespace-pre break-all overflow-hidden flex items-center"
              style={{ paddingRight: '3rem' }}
            >
              {renderHighlightedInput()}
            </div>

            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              disabled={isAgentTyping}
              placeholder="Query repository details, or type @ to invoke specific tools..."
              className="w-full bg-zed-element/25 dark:bg-zed-dark-element/25 border border-zed-border dark:border-zed-dark-border rounded-md px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all placeholder:opacity-30 text-transparent caret-zed-text dark:caret-zed-dark-text shadow-sm selection:bg-purple-500/20"
              autoFocus
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isAgentTyping}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-gradient-to-tr from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-20 transition-all flex items-center justify-center shadow-lg shadow-indigo-500/20"
            >
              <SendOutlined className="text-xs text-white" />
            </button>
          </form>
          <div className="absolute -bottom-6 left-2 opacity-30">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zed-muted">
              Press Enter to dispatch request
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

