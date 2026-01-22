import React, { useState, useEffect } from 'react';
import { Commit } from '@shared/types';
import { useToast } from './ToastContext';
import moment from 'moment';
import { Avatar } from './Avatar';

interface CommitMiniLogProps {
  repoPath: string;
  onCommitSelect?: (commit: Commit) => void;
}

export const CommitMiniLog: React.FC<CommitMiniLogProps> = ({ repoPath, onCommitSelect }) => {
  const { showToast } = useToast();
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentCommits = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedCommits = await window.gitcanopyAPI.getRecentCommits(repoPath);
        setCommits(fetchedCommits);
      } catch (err) {
        console.error("Failed to fetch recent commits:", err);
        setError("Failed to load recent commits.");
        showToast("Failed to load recent commits.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchRecentCommits();

    const handleCommitsUpdated = () => {
        fetchRecentCommits();
    };

    let unsubscribe: (() => void) | undefined;
    if (window.gitcanopyAPI) {
        unsubscribe = window.gitcanopyAPI.onCommitsUpdated(handleCommitsUpdated);
    }

    return () => {
        unsubscribe?.();
    };
  }, [repoPath, showToast]);

  if (loading) {
    return (
      <div className="text-zed-muted dark:text-zed-dark-muted text-xs px-3 py-2">
        Loading commits...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-xs px-3 py-2">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {commits.map((commit) => {
        return (
          <div
            key={commit.hash}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zed-element dark:hover:bg-zed-dark-element cursor-pointer group transition-colors"
            title={`${commit.author.name} - ${commit.shortMessage}`}
            onClick={() => onCommitSelect?.(commit)}
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-zed-element dark:bg-zed-dark-element border border-zed-border dark:border-zed-dark-border flex items-center justify-center overflow-hidden shadow-sm">
              <Avatar 
                src={commit.author.avatarUrl} 
                name={commit.author.name}
                className="w-full h-full object-cover"
                placeholderClassName="w-full h-full flex items-center justify-center bg-zed-element dark:bg-zed-dark-element text-zed-muted dark:text-zed-dark-muted font-bold text-[10px]"
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm truncate text-zed-text dark:text-zed-dark-text group-hover:text-zed-accent transition-colors">
                {commit.shortMessage}
              </div>
              <div className="text-[10px] text-zed-muted dark:text-zed-dark-muted truncate opacity-70">
                {commit.author.name} • {moment.unix(commit.timestamp).fromNow()}
              </div>
            </div>
          </div>
        );
      })}
      {commits.length === 0 && (
        <div className="text-zed-muted dark:text-zed-dark-muted text-xs px-3 py-2">
          No recent commits.
        </div>
      )}
    </div>
  );
};
