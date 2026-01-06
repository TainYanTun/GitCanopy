import React, { useState, useEffect } from 'react';
import { Branch } from '@shared/types';
import { groupBranches, BranchGroup } from '../utils/branch-utils';

interface BranchExplorerProps {
  branches: Branch[];
  currentBranchName: string;
  onBranchSelect?: (branchName: string) => void;
}

export const BranchExplorer: React.FC<BranchExplorerProps> = ({
  branches,
  currentBranchName,
  onBranchSelect,
}) => {
  const [localGroups, setLocalGroups] = useState<BranchGroup[]>([]);
  const [remoteGroups, setRemoteGroups] = useState<BranchGroup[]>([]);
  const [isLocalOpen, setIsLocalOpen] = useState(true);
  const [isRemoteOpen, setIsRemoteOpen] = useState(true);

  useEffect(() => {
    const local = branches.filter((b) => !b.isRemote);
    const remote = branches.filter((b) => b.isRemote);
    setLocalGroups(groupBranches(local, currentBranchName));
    setRemoteGroups(groupBranches(remote, currentBranchName));
  }, [branches, currentBranchName]);

  const toggleLocalFolder = (groupName: string) => {
    setLocalGroups((prevState) =>
      prevState.map((group) =>
        group.name === groupName ? { ...group, isOpen: !group.isOpen } : group,
      ),
    );
  };

  const toggleRemoteFolder = (groupName: string) => {
    setRemoteGroups((prevState) =>
      prevState.map((group) =>
        group.name === groupName ? { ...group, isOpen: !group.isOpen } : group,
      ),
    );
  };

  const renderBranch = (branch: Branch) => (
    <div
      key={`branch-${branch.name}`}
      className={`flex items-center gap-2 px-2 py-1 text-sm rounded select-none transition-colors group/branch cursor-pointer
                  ${
                    branch.name === currentBranchName
                      ? 'bg-zed-accent/20 text-zed-accent'
                      : 'text-zed-text dark:text-zed-dark-text opacity-70 hover:bg-zed-element dark:hover:bg-zed-dark-element hover:opacity-100'
                  }`}
      title={`${branch.name} (Double-click to checkout)`}
      onDoubleClick={() => onBranchSelect?.(branch.name)}
    >
      <svg
        className={`w-3.5 h-3.5 flex-shrink-0 ${
          branch.name === currentBranchName
            ? 'text-zed-accent'
            : 'text-zed-muted dark:text-zed-dark-muted'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 13V7m0 6l-3-3m3 3l3-3"
        />
      </svg>
      <span className="truncate text-xs font-medium">
        {branch.name.split('/').pop()}
      </span>
      {branch.name === currentBranchName && (
        <span className="ml-auto text-[10px] font-mono opacity-80 bg-black/20 px-1 rounded">
          HEAD
        </span>
      )}
    </div>
  );

  const renderFolder = (
    group: BranchGroup,
    toggleFn: (name: string) => void,
  ) => (
    <div key={`folder-${group.name}`} className="space-y-0.5">
      <div
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded cursor-pointer transition-colors text-zed-muted dark:text-zed-dark-muted hover:text-zed-text dark:hover:text-white hover:bg-zed-element dark:hover:bg-zed-dark-element select-none group"
        onClick={() => toggleFn(group.name)}
      >
        <svg
          className={`w-3 h-3 transform transition-transform duration-200 ${
            group.isOpen ? 'rotate-90' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <svg
          className="w-3.5 h-3.5 opacity-70"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
        <span className="truncate font-medium">{group.name}</span>
      </div>
      {group.isOpen && (
        <div className="pl-4 space-y-0.5 border-l border-zed-border dark:border-zed-dark-border ml-2.5">
          {group.branches.map((branch) => renderBranch(branch))}
        </div>
      )}
    </div>
  );

  const SectionHeader = ({
    title,
    isOpen,
    toggle,
  }: {
    title: string;
    isOpen: boolean;
    toggle: () => void;
  }) => (
    <div
      className="flex items-center gap-1 px-1 py-1 mt-2 text-[10px] font-bold text-zed-muted dark:text-zed-dark-muted uppercase tracking-wider cursor-pointer hover:text-zed-text dark:hover:text-zed-dark-text transition-colors select-none"
      onClick={toggle}
    >
      <svg
        className={`w-3 h-3 transform transition-transform duration-200 ${
          isOpen ? 'rotate-90' : ''
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
      {title}
    </div>
  );

  return (
    <div className="space-y-1 select-none">
      <SectionHeader
        title="Local"
        isOpen={isLocalOpen}
        toggle={() => setIsLocalOpen(!isLocalOpen)}
      />
      {isLocalOpen && (
        <div className="pl-0">
          {localGroups.map((group) =>
            group.isFolder
              ? renderFolder(group, toggleLocalFolder)
              : renderBranch(group.branches[0]),
          )}
          {localGroups.length === 0 && (
            <div className="px-4 py-2 text-xs italic text-zed-muted">
              No local branches
            </div>
          )}
        </div>
      )}

      <SectionHeader
        title="Remote"
        isOpen={isRemoteOpen}
        toggle={() => setIsRemoteOpen(!isRemoteOpen)}
      />
      {isRemoteOpen && (
        <div className="pl-0">
          {remoteGroups.map((group) =>
            group.isFolder
              ? renderFolder(group, toggleRemoteFolder)
              : renderBranch(group.branches[0]),
          )}
          {remoteGroups.length === 0 && (
            <div className="px-4 py-2 text-xs italic text-zed-muted">
              No remote branches
            </div>
          )}
        </div>
      )}
    </div>
  );
};
