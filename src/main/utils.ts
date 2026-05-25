import { app } from 'electron';
import { existsSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Check if Git is installed
export const checkGitInstallation = async (): Promise<boolean> => {
  try {
    await execAsync('git --version');
    return true;
  } catch {
    return false;
  }
};

// Check if running in development mode
export const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Get user data directory
export const getUserDataPath = (): string => {
  return app.getPath('userData');
};

// Get app data directory with subdirectory
export const getAppDataPath = (subDir?: string): string => {
  const userDataPath = getUserDataPath();
  const appDataPath = join(userDataPath, 'GitCanopy');

  if (!existsSync(appDataPath)) {
    mkdirSync(appDataPath, { recursive: true });
  }

  if (subDir) {
    const fullPath = join(appDataPath, subDir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
    return fullPath;
  }

  return appDataPath;
};

// Sanitize file name for safe storage
export const sanitizeFileName = (fileName: string): string => {
  return fileName.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
};

// Format bytes to human readable string
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Debounce function for rate limiting
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
};

// Throttle function for rate limiting
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Check if a path is a valid directory
export const isValidDirectory = (path: string): boolean => {
  try {
    const stats = statSync(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
};

// Safe JSON parse with fallback
export const safeJsonParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
};

// Get relative time string
export const getRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp * 1000; // Git timestamps are in seconds

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
};

// Validate email format
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate short hash from string
export const generateShortHash = (str: string, length: number = 7): string => {
  return str.substring(0, length);
};

// Color utilities for consistent theming
export const colors = {
  commit: {
    feat: '#10b981',
    fix: '#ef4444',
    docs: '#3b82f6',
    style: '#8b5cf6',
    refactor: '#f59e0b',
    perf: '#06b6d4',
    test: '#84cc16',
    chore: '#6b7280',
    other: '#9ca3af',
  },
  branch: {
    main: '#1f2937',
    develop: '#059669',
    feature: '#2563eb',
    release: '#dc2626',
    hotfix: '#ea580c',
    custom: '#7c3aed',
  },
} as const;

// Get commit type color
export const getCommitTypeColor = (type: string): string => {
  return colors.commit[type as keyof typeof colors.commit] || colors.commit.other;
};

// Get branch type color
export const getBranchTypeColor = (type: string): string => {
  return colors.branch[type as keyof typeof colors.branch] || colors.branch.custom;
};

// Log with timestamp
export const logWithTimestamp = (level: 'info' | 'warn' | 'error', message: string, ...args: any[]): void => {
  const timestamp = new Date().toISOString();
  console[level](`[${timestamp}] ${message}`, ...args);
};

// Ensure common binary paths are in the PATH environment variable
// This is essential for Electron apps on macOS to find 'git', 'npx', etc.
export const getEnvWithFixedPath = () => {
  const env = { ...process.env };
  if (process.platform === 'darwin') {
    const commonPaths = [
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
      '/opt/homebrew/bin',
      '/opt/local/bin'
    ];
    const currentPath = env.PATH || '';
    const uniquePaths = new Set([...currentPath.split(':'), ...commonPaths]);
    env.PATH = Array.from(uniquePaths).filter(Boolean).join(':');
  }
  return env;
};
