import React, { useState, useEffect, useRef, useMemo } from "react";
import { Branch } from "@shared/types";

interface BranchSwitcherModalProps {
  visible: boolean;
  branches: Branch[];
  currentBranch: string;
  onClose: () => void;
  onSelectBranch: (branchName: string) => void;
}

export const BranchSwitcherModal: React.FC<BranchSwitcherModalProps> = ({
  visible,
  branches,
  currentBranch,
  onClose,
  onSelectBranch,
}) => {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter and flatten branches for the list
  const filteredBranches = useMemo(() => {
    const query = search.toLowerCase();
    const sorted = [...branches].sort((a, b) => {
      // Current branch first
      if (a.name === currentBranch) return -1;
      if (b.name === currentBranch) return 1;
      // Then local branches
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;
      // Then alphabetical
      return a.name.localeCompare(b.name);
    });

    return sorted.filter((b) => b.name.toLowerCase().includes(query));
  }, [branches, search, currentBranch]);

  useEffect(() => {
    if (visible) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [visible]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredBranches.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredBranches[selectedIndex]) {
          onSelectBranch(filteredBranches[selectedIndex].name);
          onClose();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, filteredBranches, selectedIndex, onSelectBranch, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!visible) return null;

  return (
    // Backdrop - with blur and centered
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal Container - Zed Style */}
      <div
        className="
          w-[600px] max-h-[500px] flex flex-col
          bg-zed-bg dark:bg-zed-dark-bg
          border border-zed-border dark:border-zed-dark-border
          rounded-lg shadow-2xl
          overflow-hidden
          animate-in zoom-in-95 slide-in-from-top-2 duration-150
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Input Area */}
        <div className="flex items-center gap-3 px-3 py-3 border-b border-zed-border dark:border-zed-dark-border bg-zed-bg dark:bg-zed-dark-bg">
          <svg
            className="w-4 h-4 text-zed-muted shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            className="
               flex-1 bg-transparent border-none p-0
               text-zed-text dark:text-zed-dark-text text-sm font-medium
               placeholder-zed-muted/50 focus:ring-0
             "
            placeholder="Search branches..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          <div className="flex gap-1.5">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-sans font-medium text-zed-muted bg-zed-element dark:bg-zed-dark-element rounded border border-zed-border dark:border-zed-dark-border min-w-[20px] text-center">
              ↵
            </kbd>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-sans font-medium text-zed-muted bg-zed-element dark:bg-zed-dark-element rounded border border-zed-border dark:border-zed-dark-border">
              ESC
            </kbd>
          </div>
        </div>

        {/* Results List */}
        <div
          className="overflow-y-auto flex-1 p-1 bg-zed-bg dark:bg-zed-dark-bg"
          ref={listRef}
        >
          {filteredBranches.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zed-muted">
                No branches found matching {search}
              </p>
            </div>
          ) : (
            filteredBranches.map((branch, index) => (
              <div
                key={branch.name}
                onClick={() => {
                  onSelectBranch(branch.name);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`
                  group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors select-none
                  ${
                    index === selectedIndex
                      ? "bg-zed-element dark:bg-zed-dark-element"
                      : "hover:bg-zed-element/50 dark:hover:bg-zed-dark-element/50"
                  }
                `}
              >
                {/* Branch Icon */}
                <div
                  className={`
                  shrink-0 w-4 h-4 flex items-center justify-center
                  ${index === selectedIndex ? "text-zed-accent" : "text-zed-muted"}
                `}
                >
                  {branch.isRemote ? (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
                  <div className="flex items-center gap-2">
                    {/* Branch Name with highlighting */}
                    <span
                      className={`text-sm font-medium truncate ${index === selectedIndex ? "text-zed-text dark:text-zed-dark-text" : "text-zed-text/80 dark:text-zed-dark-text/80"}`}
                    >
                      {branch.name}
                    </span>

                    {/* Badges */}
                    {branch.name === currentBranch && (
                      <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider bg-zed-accent/10 text-zed-accent border border-zed-accent/20">
                        Current
                      </span>
                    )}
                    {branch.isRemote && (
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-wider bg-zed-surface dark:bg-zed-dark-surface text-zed-muted border border-zed-border dark:border-zed-dark-border">
                        Remote
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info (optional) */}
        {filteredBranches.length > 0 && (
          <div className="px-3 py-1.5 border-t border-zed-border dark:border-zed-dark-border bg-zed-surface dark:bg-zed-dark-surface text-[10px] text-zed-muted flex justify-between">
            <span>{filteredBranches.length} branches</span>
            {selectedIndex >= 0 && filteredBranches[selectedIndex] && (
              <span className="font-mono opacity-75">
                {filteredBranches[selectedIndex].objectName.substring(0, 7)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
