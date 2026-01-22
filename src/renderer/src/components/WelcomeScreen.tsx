import React, { useEffect, useState, useRef } from "react";
import {
  FolderOpenOutlined,
  PlusCircleOutlined,
  LoadingOutlined,
  ArrowRightOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useToast } from "./ToastContext";

interface WelcomeScreenProps {
  onSelectRepository: (path?: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onSelectRepository,
}) => {
  const { showToast } = useToast();
  const [recentRepos, setRecentRepositories] = useState<string[]>([]);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState<string>("0");
  const [showCloneInput, setShowCloneInput] = useState(false);
  const [cloneUrl, setCloneUrl] = useState("");
  const [version, setVersion] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let unsubscribeProgress: (() => void) | undefined;
    
    if (isCloning) {
      unsubscribeProgress = window.gitcanopyAPI.onCloneProgress((progress) => {
        setCloneProgress(progress);
      });
    }

    return () => {
      unsubscribeProgress?.();
    };
  }, [isCloning]);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const settings = await window.gitcanopyAPI.getSettings();
        setRecentRepositories(settings.recentRepositories || []);
      } catch (err) {
        console.error("Failed to load recent repos:", err);
      }
    };
    const fetchVersion = async () => {
      try {
        const v = await window.gitcanopyAPI.getAppVersion();
        setVersion(v);
      } catch (e) {
        console.error("Failed to fetch version:", e);
      }
    };
    fetchRecent();
    fetchVersion();
  }, []);

  useEffect(() => {
    if (showCloneInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCloneInput]);

  const executeClone = async () => {
    if (!cloneUrl.trim()) return;

    try {
      showToast("Select destination folder", "info");
      const parentPath = await window.gitcanopyAPI.selectDirectory();

      if (!parentPath) return;

      setIsCloning(true);
      setShowCloneInput(false);
      showToast("Cloning repository...", "info");

      const repoPath = await window.gitcanopyAPI.cloneToParent(
        cloneUrl,
        parentPath,
      );

      showToast("Clone successful", "success");
      onSelectRepository(repoPath);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Clone failed", "error");
      setIsCloning(false);
    }
  };

  return (
    <div className="h-full w-full bg-zed-bg dark:bg-zed-dark-bg flex flex-col font-sans overflow-hidden relative">
      {/* Subtle Background Elements */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05] dark:opacity-[0.1]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Fake Title Bar */}
      <div className="h-9 border-b border-zed-border dark:border-zed-dark-border shrink-0 flex items-center px-4 bg-zed-bg dark:bg-zed-dark-bg relative z-10 draggable">
        <div className="w-16 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zed-muted dark:text-zed-dark-muted">
          GitCanopy / Home
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center p-12 relative z-10">
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-24 animate-in fade-in duration-500">
          {/* Action Column */}
          <div className="flex flex-col space-y-12 text-zed-text dark:text-zed-dark-text">
            <div className="space-y-2">
              <h1 className="text-5xl font-black tracking-tighter pb-2">
                GitCanopy<span className="text-zed-accent">_</span>
              </h1>
              <p className="text-xs font-mono opacity-60 uppercase tracking-widest">
                Professional Git Interface
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-[9px] font-black uppercase tracking-[0.3em] opacity-30">
                Start
              </h2>
              <div className="grid grid-cols-1 gap-2">
                {!showCloneInput ? (
                  <>
                    <button
                      onClick={() => onSelectRepository()}
                      className="group flex items-center gap-3 px-4 py-3 w-full border border-zed-border dark:border-zed-dark-border bg-zed-bg dark:bg-zed-dark-bg hover:bg-zed-surface dark:hover:bg-zed-dark-surface hover:border-zed-accent dark:hover:border-zed-dark-accent transition-all duration-100"
                    >
                      <FolderOpenOutlined className="text-base text-zed-muted group-hover:text-zed-accent transition-colors" />
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-zed-text dark:text-zed-dark-text group-hover:text-zed-accent transition-colors">
                          Open Repository
                        </span>
                        <span className="text-[10px] font-mono text-zed-muted dark:text-zed-dark-muted opacity-60">
                          local filesystem
                        </span>
                      </div>
                      <span className="ml-auto text-[10px] font-mono text-zed-muted opacity-40 group-hover:opacity-100 transition-opacity">
                        ⌘O
                      </span>
                    </button>

                    <button
                      onClick={() => setShowCloneInput(true)}
                      disabled={isCloning}
                      className="group flex items-center gap-3 px-4 py-3 w-full border border-zed-border dark:border-zed-dark-border bg-zed-bg dark:bg-zed-dark-bg hover:bg-zed-surface dark:hover:bg-zed-dark-surface hover:border-zed-accent dark:hover:border-zed-dark-accent transition-all duration-100 disabled:opacity-50"
                    >
                      {isCloning ? (
                        <LoadingOutlined className="text-base text-zed-accent" />
                      ) : (
                        <PlusCircleOutlined className="text-base text-zed-muted group-hover:text-zed-accent transition-colors" />
                      )}
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-zed-text dark:text-zed-dark-text group-hover:text-zed-accent transition-colors">
                          {isCloning ? "Cloning Repository" : "Clone Repository"}
                        </span>
                        <span className="text-[10px] font-mono text-zed-muted dark:text-zed-dark-muted opacity-60">
                          https://...
                        </span>
                      </div>
                      {isCloning && (
                        <span className="ml-auto text-[10px] font-mono font-bold text-zed-accent animate-pulse">
                          {cloneProgress}%
                        </span>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="p-4 bg-zed-surface dark:bg-zed-dark-surface border border-zed-accent dark:border-zed-dark-accent shadow-lg animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zed-accent">
                        Clone Remote
                      </span>
                      <button
                        onClick={() => setShowCloneInput(false)}
                        className="ml-auto text-zed-muted hover:text-zed-text"
                      >
                        <CloseOutlined className="text-xs" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        placeholder="https://github.com/user/repo.git"
                        value={cloneUrl}
                        onChange={(e) => setCloneUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && executeClone()}
                        className="flex-1 bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-zed-accent text-zed-text dark:text-zed-dark-text"
                      />
                      <button
                        onClick={executeClone}
                        className="bg-zed-accent text-white px-3 py-1.5 hover:opacity-90 transition-opacity"
                      >
                        <ArrowRightOutlined />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-8 border-t border-zed-border dark:border-zed-dark-border flex items-center gap-6">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.gitcanopyAPI.openExternal(
                    "https://github.com/TainYanTun/GitCanopy/blob/main/documentation.md",
                  );
                }}
                className="text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 hover:text-zed-accent transition-all"
              >
                Docs
              </a>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.gitcanopyAPI.openExternal(
                    "https://github.com/TainYanTun/GitCanopy",
                  );
                }}
                className="text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 hover:text-zed-accent transition-all"
              >
                Source
              </a>
            </div>
          </div>

          {/* Recent Column */}
          <div className="flex flex-col space-y-4 text-zed-text dark:text-zed-dark-text">
            <h2 className="text-[9px] font-black uppercase tracking-[0.3em] opacity-30">
              Recent Workspaces
            </h2>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-4">
              {recentRepos.length > 0 ? (
                recentRepos.slice(0, 5).map((path) => {
                  const name = path.split(/[\\/]/).pop();
                  return (
                    <button
                      key={path}
                      onClick={() => onSelectRepository(path)}
                      className="group w-full flex flex-col items-start py-3 px-4 hover:bg-zed-element dark:hover:bg-zed-dark-element border border-transparent hover:border-zed-border/20 dark:hover:border-zed-dark-border/20 transition-all text-left"
                    >
                      <span className="text-sm font-bold group-hover:text-zed-accent transition-colors">
                        {name}
                      </span>
                      <span className="text-[10px] font-mono opacity-40 truncate w-full">
                        {path}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="h-32 flex items-center justify-center border border-dashed border-zed-border/20 dark:border-zed-dark-border/20 bg-zed-surface/30 dark:bg-zed-dark-surface/30">
                  <span className="text-[10px] font-mono opacity-30 uppercase tracking-widest">
                    No recent projects
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div className="h-7 border-t border-zed-border dark:border-zed-dark-border bg-zed-surface dark:bg-zed-dark-surface shrink-0 flex items-center px-4 justify-between relative z-10">
        <div className="text-[9px] font-mono text-zed-muted dark:text-zed-dark-muted uppercase tracking-widest opacity-60">
          Build {version}-Stable
        </div>
        <div className="flex gap-4 text-[9px] font-mono text-zed-muted dark:text-zed-dark-muted uppercase tracking-widest opacity-60">
          <span>{navigator.platform}</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
};
