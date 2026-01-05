import React, { useState, useCallback } from "react";
import { Commit, Branch, CommitFilterOptions } from "@shared/types";
import moment from "moment";
import { List } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";

interface CommitHistoryProps {
  repoPath: string;
  commits: Commit[];
  branches: Branch[];
  headCommitHash?: string;
  onCommitSelect: (commit: Commit) => void;
  selectedCommitHash?: string;
  filters: CommitFilterOptions;
  onFilterChange: (filters: CommitFilterOptions) => void;
  onClearFilters: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

const typeInitialMap: Record<string, string> = {
  feat: "F",
  fix: "X",
  docs: "D",
  style: "S",
  refactor: "R",
  perf: "P",
  test: "T",
  chore: "C",
  revert: "V",
};

const typeColorMap: Record<string, string> = {
  feat: "text-commit-feat",
  fix: "text-commit-fix",
  docs: "text-commit-docs",
  style: "text-commit-style",
  refactor: "text-commit-refactor",
  perf: "text-commit-perf",
  test: "text-commit-test",
  chore: "text-commit-chore",
  revert: "text-commit-other",
};

export const CommitHistory: React.FC<CommitHistoryProps> = ({
  commits,
  branches: _branches,
  headCommitHash: _headCommitHash,
  onCommitSelect,
  selectedCommitHash,
  filters,
  onFilterChange,
  onClearFilters,
  onLoadMore,
  hasMore,
}) => {
  const [search, setSearch] = useState(filters.query || "");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Debounce search input to update filters
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (filters.query || "")) {
        onFilterChange({ ...filters, query: search || undefined });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search, onFilterChange, filters]);

  // Sync internal search state if filters.query changes externally
  React.useEffect(() => {
    setSearch(filters.query || "");
  }, [filters.query]);

  const Row = useCallback(
    ({
      index,
      style,
    }: {
      index: number;
      style: React.CSSProperties;
    }): React.ReactElement => {
      const commit = commits[index];
      if (!commit) return <div style={style} />;

      const isSelected = selectedCommitHash === commit.hash;

      return (
        <div
          style={style}
          onClick={() => onCommitSelect(commit)}
          className={`flex items-center hover:bg-zed-element/50 dark:hover:bg-zed-dark-element/50 cursor-pointer transition-colors group border-b border-zed-border/10 dark:border-zed-dark-border/10 ${
            isSelected ? "bg-zed-accent/10 dark:bg-zed-accent/20 border-l-2 border-l-zed-accent" : "pl-[2px]"
          }`}
        >
          <div className="w-12 shrink-0 flex items-center justify-center">
            <div
              className={`w-5 h-5 flex items-center justify-center text-[9px] font-black border border-current rounded-none ${
                typeColorMap[commit.type] || "text-zed-muted"
              }`}
            >
              {typeInitialMap[commit.type] || "O"}
            </div>
          </div>
          <div className="flex-1 min-w-0 px-3 flex items-center gap-2 overflow-hidden">
            <span className={`text-[13px] truncate ${isSelected ? "text-zed-accent font-bold" : "text-zed-text dark:text-zed-dark-text font-medium"}`}>
              {commit.shortMessage}
            </span>
            {commit.tags?.slice(0, 1).map((tag) => (
              <span
                key={tag}
                className="px-1 py-0 text-[8px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border border-yellow-500/20 uppercase font-bold tracking-tight shrink-0"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="w-32 shrink-0 px-4 truncate text-xs text-zed-text dark:text-zed-dark-text opacity-80 font-mono text-right">
            {commit.author.name}
          </div>
          <div className="w-24 shrink-0 px-4 whitespace-nowrap text-[11px] text-zed-muted dark:text-zed-dark-muted font-mono opacity-60 text-right">
            {moment.unix(commit.timestamp).format("MMM D, YY")}
          </div>
          <div className="w-24 shrink-0 px-4 text-right font-mono text-[10px] text-zed-muted/50 group-hover:text-zed-accent transition-colors">
            {commit.shortHash}
          </div>
        </div>
      );
    },
    [commits, selectedCommitHash, onCommitSelect],
  );

  return (
    <div className="flex flex-col h-full bg-zed-bg dark:bg-zed-dark-bg animate-in fade-in duration-300">
      {/* Header - Global Filter Strip */}
      <div className="px-6 py-3 border-b border-zed-border dark:border-zed-dark-border bg-zed-surface dark:bg-zed-dark-surface shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-zed-text dark:text-zed-dark-text">
              History
            </h1>
            
            <div className="h-4 w-px bg-zed-border dark:border-zed-dark-border"></div>

            <div className="relative group max-w-xs flex-1">
                <input
                type="text"
                placeholder="Filter messages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border px-3 py-1 text-xs font-mono focus:outline-none focus:border-zed-accent/50 transition-all text-zed-text dark:text-zed-dark-text placeholder:opacity-20"
                />
            </div>

            <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                showAdvanced
                    ? "bg-zed-accent border-zed-accent text-white"
                    : "bg-zed-element/50 dark:bg-zed-dark-element/50 border-zed-border dark:border-zed-dark-border text-zed-muted hover:text-zed-text"
                }`}
            >
                Advanced
            </button>

            {Object.values(filters).some((v) => !!v) && (
                <button
                onClick={onClearFilters}
                className="text-[9px] uppercase font-black text-commit-fix hover:underline"
                >
                Clear All
                </button>
            )}
          </div>
          
          <div className="text-[10px] font-mono text-zed-muted opacity-40">
            {commits.length} COMMITS
          </div>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-zed-border/30 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-zed-muted opacity-50">Author</label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={filters.author || ""}
                onChange={(e) => onFilterChange({ ...filters, author: e.target.value || undefined })}
                className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border p-1.5 text-[10px] font-mono focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-zed-muted opacity-50">Since</label>
              <input
                type="date"
                value={filters.since || ""}
                onChange={(e) => onFilterChange({ ...filters, since: e.target.value || undefined })}
                className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border p-1.5 text-[10px] font-mono focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-zed-muted opacity-50">Until</label>
              <input
                type="date"
                value={filters.until || ""}
                onChange={(e) => onFilterChange({ ...filters, until: e.target.value || undefined })}
                className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border p-1.5 text-[10px] font-mono focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Commit List Area - Full Width */}
      <div className="flex-1 min-h-0 bg-zed-bg dark:bg-zed-dark-bg">
        <AutoSizer
          Child={({ height, width }: any) => (
            <List
              style={{ height: height || 0, width: width || 0 }}
              rowCount={commits.length}
              rowHeight={40}
              onRowsRendered={({ stopIndex }: { stopIndex: number }) => {
                if (hasMore && onLoadMore && stopIndex >= commits.length - 10) {
                  onLoadMore();
                }
              }}
              rowComponent={Row}
              rowProps={{} as any}
              className="custom-scrollbar"
            />
          )}
        />
        {commits.length === 0 && (
          <div className="h-full flex items-center justify-center text-zed-muted italic font-mono text-xs opacity-30">
            No matching results.
          </div>
        )}
      </div>
    </div>
  );
};

interface FilterBadgeProps {
  label: string;
  value: string;
  onClear: () => void;
}

const _FilterBadge: React.FC<FilterBadgeProps> = ({ label, value, onClear }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-zed-accent/10 border border-zed-accent/30 rounded-none text-xs text-zed-accent font-mono shadow-sm group">
    <span className="opacity-50 font-bold uppercase text-[9px]">{label}:</span>
    <span className="truncate max-w-[200px]">{value}</span>
    <button
      onClick={onClear}
      className="ml-1 p-0.5 hover:bg-commit-fix hover:text-white rounded-full transition-all"
    >
      <svg
        className="w-3 h-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>
);
