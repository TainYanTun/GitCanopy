import React, { useState, useEffect } from "react";
import { HotFile, CommitFilterOptions } from "@shared/types";

interface HotFilesProps {
  repoPath: string;
  onFileClick?: (path: string) => void;
  filters?: CommitFilterOptions;
}

export const HotFiles: React.FC<HotFilesProps> = ({ repoPath, onFileClick, filters }) => {
  const [hotFiles, setHotFiles] = useState<HotFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHotFiles = async () => {
      setLoading(true);
      try {
        const files = await window.gitcanopyAPI.getHotFiles(repoPath, 24, filters);
        setHotFiles(files);
      } catch (error) {
        console.error("Failed to fetch hot files:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHotFiles();
  }, [repoPath, filters]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-24 bg-zed-element/30 dark:bg-zed-dark-element/30 rounded-none border border-zed-border dark:border-zed-dark-border animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0.5 bg-zed-border/50 dark:bg-zed-dark-border/50 border border-zed-border dark:border-zed-dark-border overflow-hidden rounded-none shadow-2xl">
      {hotFiles.map((file, index) => {
        const filename = file.path.split("/").pop();
        const dir = file.path.split("/").slice(0, -1).join("/") || "/";

        return (
          <div
            key={file.path}
            onClick={() => {
              if (onFileClick) {
                onFileClick(file.path);
              } else {
                // Construct path manually since we can't use path.join in renderer
                const separator = repoPath.includes("\\") ? "\\" : "/";
                const cleanRepoPath = repoPath.endsWith(separator) ? repoPath.slice(0, -1) : repoPath;
                const fullPath = `${cleanRepoPath}${separator}${file.path.replace(/\//g, separator)}`;
                window.gitcanopyAPI.showItemInFolder(fullPath);
              }
            }}
            title={onFileClick ? "Click to view file history" : "Click to reveal in file manager"}
            className="group relative bg-zed-surface dark:bg-zed-dark-surface p-4 flex flex-col justify-between hover:bg-zed-element dark:hover:bg-zed-dark-element transition-all duration-200 cursor-pointer border-r border-b border-zed-border/30 dark:border-zed-dark-border/30 last:border-r-0"
          >
            <div className="space-y-1 relative z-10">
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold tracking-tight text-zed-text dark:text-zed-dark-text truncate pr-4">
                  {filename}
                </span>
                <span
                  className={`text-xs font-mono font-bold ${index < 3 ? "text-zed-accent" : "text-zed-muted dark:text-zed-dark-muted"}`}
                >
                  {file.count}
                </span>
              </div>
              <div className="text-[10px] text-zed-muted dark:text-zed-dark-muted truncate opacity-60 group-hover:opacity-100 transition-opacity">
                {dir}
              </div>
            </div>

            {/* Subtle number background */}
            <div className="absolute right-3 bottom-1 text-5xl font-bold text-zed-muted/5 dark:text-zed-dark-muted/5 pointer-events-none select-none leading-none">
              {index + 1}
            </div>
          </div>
        );
      })}
    </div>
  );
};
