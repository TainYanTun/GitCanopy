import { watch, FSWatcher, existsSync } from 'fs';
import { join } from 'path';
import { AppEvent } from '../../shared/types';
import { logInfo, logError } from './logger-service';

export class RepositoryWatcher {
  private watchers: Map<string, FSWatcher[]> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private isPaused = false;

  public pause(): void {
    this.isPaused = true;
    logInfo('Watcher', 'Watcher paused');
  }

  public resume(): void {
    this.isPaused = false;
    logInfo('Watcher', 'Watcher resumed');
  }

  watchRepository(repoPath: string, callback: (event: AppEvent) => void): void {
    if (this.watchers.has(repoPath)) {
      this.unwatchRepository(repoPath);
    }

    const watchers: FSWatcher[] = [];
    const gitPath = join(repoPath, '.git');

    if (!existsSync(gitPath)) return;

    const debounceCallback = (event: AppEvent) => {
      if (this.isPaused) return;
      
      const key = `${repoPath}:${event.type}`;
      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key)!);
      }

      this.debounceTimers.set(key, setTimeout(() => {
        callback(event);
        this.debounceTimers.delete(key);
      }, 100)); // 100ms debounce
    };

    try {
      logInfo('Watcher', `Starting recursive watch on ${gitPath}`);
      // Watching the .git directory recursively is most reliable on macOS/Windows
      const gitWatcher = watch(gitPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        // Ignore lock files
        if (filename.endsWith('.lock')) return;

        if (filename === 'HEAD' || filename === 'ORIG_HEAD') {
          logInfo('Watcher', `Head change detected: ${filename}`);
          debounceCallback({
            type: 'head-changed',
            newHead: '',
            oldHead: '',
          });
        } else if (filename.startsWith('refs') || filename === 'packed-refs') {
          logInfo('Watcher', `Refs change detected: ${filename}`);
          debounceCallback({
            type: 'branches-updated',
            branches: [],
          });
          // Also trigger commit update because new branches/tags often mean new commits
          debounceCallback({
            type: 'commits-updated',
            commits: []
          });
        } else if (filename === 'index') {
          logInfo('Watcher', `Index change detected (commit/stage)`);
          debounceCallback({
            type: 'repository-changed',
            repository: { path: repoPath } as any
          });
          debounceCallback({
            type: 'commits-updated',
            commits: []
          });
        }
      });
      watchers.push(gitWatcher);

      // ALSO watch the working directory for file changes (to update Status)
      // Note: Recursive watching is supported on macOS and Windows. 
      // On Linux this might need a different strategy (or chokidar), but for now sticking to native.
      logInfo('Watcher', `Starting recursive watch on working tree ${repoPath}`);
      const workTreeWatcher = watch(repoPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        
        // Filter out .git (handled above) and node_modules (noise)
        if (filename.includes('.git') || filename.includes('node_modules')) return;
        
        // Ignore build output directories (common defaults)
        if (filename.includes('dist/') || filename.includes('build/') || filename.includes('.next/')) return;

        // For any other file change in the working tree
        debounceCallback({
          type: 'repository-changed',
          repository: { path: repoPath } as any
        });
      });
      watchers.push(workTreeWatcher);

      this.watchers.set(repoPath, watchers);
    } catch (error) {
      logError('Watcher', error);
      watchers.forEach(watcher => watcher.close());
    }
  }

  unwatchRepository(repoPath: string): void {
    const watchers = this.watchers.get(repoPath);
    if (watchers) {
      watchers.forEach(watcher => watcher.close());
      this.watchers.delete(repoPath);
    }
  }

  unwatchAll(): void {
    for (const [repoPath] of this.watchers) {
      this.unwatchRepository(repoPath);
    }
  }
}
