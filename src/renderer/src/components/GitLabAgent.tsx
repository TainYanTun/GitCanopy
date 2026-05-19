import React, { useState, useEffect, useRef } from "react";
import { useToast } from "./ToastContext";
import { RobotOutlined, UserOutlined, SendOutlined, InfoCircleOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";

interface GitLabAgentProps {
  repoPath: string;
  projectName: string;
  currentBranch: string;
}

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}

export const GitLabAgent: React.FC<GitLabAgentProps> = ({ repoPath, projectName, currentBranch }) => {
  const { showToast } = useToast();
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [chatHistory, isAgentTyping]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = inputValue.trim();
    if (!prompt || isAgentTyping) return;

    setInputValue("");
    const userMsg: ChatMessage = { role: 'user', content: prompt, timestamp: Date.now() };
    setChatHistory(prev => [...prev, userMsg]);
    setIsAgentTyping(true);

    try {
      // Get context (e.g. current status/diff)
      const status = await window.gitcanopyAPI.getStatus(repoPath);
      const context = JSON.stringify({
        project: projectName,
        branch: currentBranch,
        status: status.files
      });
      
      const response = await window.gitcanopyAPI.triggerDuoAgent(prompt, context);
      
      const agentMsg: ChatMessage = { 
        role: 'agent', 
        content: response.message, 
        timestamp: Date.now() 
      };
      setChatHistory(prev => [...prev, agentMsg]);
    } catch (error: any) {
      showToast(error.message || "Agent connection error", "error");
    } finally {
      setIsAgentTyping(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="h-full w-full bg-zed-bg dark:bg-zed-dark-bg flex flex-col font-sans animate-in fade-in duration-700">
      {/* Hyper-minimalist Context Bar */}
      <div className="flex-shrink-0 px-8 py-4 border-b border-zed-border dark:border-zed-dark-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded bg-zed-accent/10 flex items-center justify-center text-zed-accent">
            <RobotOutlined className="text-lg" />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zed-text dark:text-zed-dark-text">GitLab Agent</h2>
            <div className="flex items-center gap-2 mt-0.5 opacity-40">
              <span className="text-[9px] font-bold uppercase tracking-widest">{projectName}</span>
              <span className="text-[9px]">•</span>
              <span className="text-[9px] font-mono">{currentBranch}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity cursor-help">
          <InfoCircleOutlined className="text-xs" />
          <span className="text-[9px] font-bold uppercase tracking-widest">MCP Server Active</span>
        </div>
      </div>

      {/* Chat Workspace */}
      <div className="flex-1 overflow-hidden relative">
        <div 
          ref={chatScrollRef}
          className="h-full overflow-y-auto custom-scrollbar"
        >
          <div className="max-w-3xl mx-auto px-8 py-12 space-y-12">
            {chatHistory.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center space-y-6 opacity-20">
                <RobotOutlined className="text-6xl stroke-thin" />
                <div className="text-center space-y-2">
                  <p className="text-xs font-black uppercase tracking-[0.4em]">Autonomous Repository Agent</p>
                  <p className="text-[10px] tracking-wide">Ready to manage issues, merge requests, and project health.</p>
                </div>
              </div>
            )}
            
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex items-start gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                <div className={`shrink-0 w-8 h-8 rounded flex items-center justify-center mt-1 ${msg.role === 'user' ? 'bg-zed-element dark:bg-zed-dark-element' : 'bg-zed-accent text-white'}`}>
                  {msg.role === 'user' ? <UserOutlined className="text-xs" /> : <RobotOutlined className="text-xs" />}
                </div>
                <div className="flex-1 min-w-0 space-y-2 pt-1.5">
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-30">
                    {msg.role === 'user' ? 'Local User' : 'GitLab Agent'}
                  </div>
                  <div className="text-[13px] text-zed-text dark:text-zed-dark-text leading-relaxed prose dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-zed-element/50 prose-pre:border prose-pre:border-zed-border/30">
                    {msg.role === 'agent' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                  </div>
                </div>
              </div>
            ))}

            {isAgentTyping && (
              <div className="flex items-start gap-6 animate-pulse">
                <div className="shrink-0 w-8 h-8 rounded bg-zed-accent text-white flex items-center justify-center mt-1">
                  <RobotOutlined className="text-xs" />
                </div>
                <div className="flex-1 pt-1.5 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-30">GitLab Agent</div>
                  <div className="flex gap-1.5 pt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-zed-accent/40 animate-bounce"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-zed-accent/40 animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-zed-accent/40 animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 px-8 py-8">
        <div className="max-w-3xl mx-auto relative group">
          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isAgentTyping}
              placeholder="Assign a task to the agent..."
              className="w-full bg-zed-element/30 dark:bg-zed-dark-element/30 border border-zed-border dark:border-zed-dark-border rounded-lg px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent/50 transition-all placeholder:opacity-20"
              autoFocus
            />
            <button 
              type="submit" 
              disabled={!inputValue.trim() || isAgentTyping}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded bg-zed-text dark:text-zed-bg flex items-center justify-center hover:opacity-90 disabled:opacity-10 transition-all"
            >
              <SendOutlined className="text-xs text-white dark:text-zinc-900" />
            </button>
          </form>
          <div className="absolute -bottom-6 left-2 opacity-20 group-hover:opacity-40 transition-opacity">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Press Enter to dispatch mission</span>
          </div>
        </div>
      </div>
    </div>
  );
};
