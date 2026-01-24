import React from "react";
import { Commit } from "@src/shared/types";

interface TimeMachineScrubberProps {
  commits: Commit[];
  currentIndex: number;
  onChange: (index: number) => void;
  onClose: () => void;
}

export const TimeMachineScrubber: React.FC<TimeMachineScrubberProps> = ({
  commits,
  currentIndex,
  onChange,
  onClose,
}) => {
  const [tempIndex, setInternalIndex] = React.useState(currentIndex);
  
  if (commits.length === 0) return null;

  const currentCommit = commits[tempIndex];
  const isDirty = tempIndex !== currentIndex;

  const handleApply = () => {
    onChange(tempIndex);
  };

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-zed-surface/90 dark:bg-zed-dark-surface/90 backdrop-blur-xl border border-zed-border dark:border-zed-dark-border rounded-2xl shadow-2xl p-4 flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-zed-accent uppercase tracking-[0.2em]">Git Time Machine</span>
              <span className="text-[10px] text-zed-muted dark:text-zed-dark-muted px-1.5 py-0.5 bg-zed-element dark:bg-zed-dark-element rounded border border-zed-border dark:border-zed-dark-border font-mono">
                {tempIndex + 1} / {commits.length}
              </span>
              {isDirty && (
                <button 
                  onClick={handleApply}
                  className="text-[9px] font-bold bg-zed-accent text-white px-2 py-0.5 rounded-full shadow-lg animate-pulse hover:scale-105 transition-transform"
                >
                  Travel Here
                </button>
              )}
            </div>
            <span className="text-xs font-semibold text-zed-text dark:text-zed-dark-text truncate max-w-md">
              {currentCommit?.shortMessage}
            </span>
            <span className="text-[10px] text-zed-muted dark:text-zed-dark-muted font-mono opacity-60">
              {currentCommit?.hash.substring(0, 7)} • {new Date(currentCommit?.timestamp * 1000).toLocaleString()}
            </span>
          </div>
          <button 
            onClick={onClose} 
            className="text-[10px] font-bold uppercase tracking-widest text-zed-muted dark:text-zed-dark-muted hover:text-commit-fix dark:hover:text-commit-fix transition-colors px-2 py-1 rounded hover:bg-commit-fix/10"
          >
            [ Exit ]
          </button>
        </div>
        
        <div className="relative pt-2 pb-1">
          <input
            type="range"
            min="0"
            max={commits.length - 1}
            value={tempIndex}
            onChange={(e) => setInternalIndex(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-zed-border dark:bg-zed-dark-border rounded-full appearance-none cursor-pointer accent-zed-accent hover:accent-zed-accent/80 transition-all"
          />
          <div className="flex justify-between mt-2 text-[9px] font-bold text-zed-muted/30 dark:text-zed-dark-muted/20 uppercase tracking-widest">
            <span>{new Date(commits[commits.length - 1].timestamp * 1000).toLocaleDateString()}</span>
            <span>{new Date(commits[0].timestamp * 1000).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
