import * as chokidar from "chokidar";
import { AppEvent } from "../../shared/types";
import { logInfo, logError } from "./logger-service";

export class RepositoryWatcher {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private isPaused = false;

  public pause(): void {
    this.isPaused = true;
    logInfo("Watcher", "Watcher paused");
  }

  public resume(): void {
    this.isPaused = false;
    logInfo("Watcher", "Watcher resumed");
  }

  watchRepository(repoPath: string, callback: (event: AppEvent) => void): void {
    if (this.watchers.has(repoPath)) {
      this.unwatchRepository(repoPath);
    }

    const debounceCallback = (event: AppEvent) => {
      if (this.isPaused) return;

      const key = `${repoPath}:${event.type}`;
      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key)!);
      }

      this.debounceTimers.set(
        key,
        setTimeout(() => {
          callback(event);
          this.debounceTimers.delete(key);
        }, 100),
      ); // 100ms debounce
    };

    try {
      logInfo("Watcher", `Starting chokidar watch on ${repoPath}`);

      const watcher = chokidar.watch(repoPath, {
        persistent: true,
        ignoreInitial: true,
        ignorePermissionErrors: true,
        ignored: (path: string) => {
          // Normalize path for check (although path usually comes as is)
          // Check for node_modules (performance killer #1)
          if (path.includes("node_modules")) return true;

          // Check for .git internals
          if (path.includes(".git")) {
            // Must allow .git folder itself
            if (path.endsWith(".git")) return false;

            // Ignore heavy .git subdirectories
            if (path.includes(".git/objects")) return true;
            if (path.includes(".git/logs")) return true;
            if (path.includes(".git/hooks")) return true;

            // Allow specific important files/dirs
            if (path.includes(".git/HEAD")) return false;
            if (path.includes(".git/ORIG_HEAD")) return false;
            if (path.includes(".git/index")) return false;
            if (path.includes(".git/packed-refs")) return false;
            if (path.includes(".git/refs")) return false;
            if (path.includes(".git/rebase-merge")) return false;
            if (path.includes(".git/rebase-apply")) return false;
            if (path.includes(".git/MERGE_HEAD")) return false;

            // For other .git files, default to allow (e.g. config, description)
            return false;
          }

          // Ignore common build output directories
          if (
            path.includes("/dist/") ||
            path.includes("/build/") ||
            path.includes("/.next/") ||
            path.includes("/out/")
          )
            return true;

          // Ignore lock files
          if (path.endsWith(".lock") || path.endsWith("-lock.json"))
            return true;

          return false;
        },
      });

      watcher.on("all", (eventName, path) => {
        if (!path) return;

        // 1. Handle .git changes
        if (path.includes(".git")) {
          if (path.endsWith("HEAD") || path.endsWith("ORIG_HEAD")) {
            logInfo("Watcher", `Head change detected: ${path}`);
            debounceCallback({
              type: "head-changed",
              newHead: "",
              oldHead: "",
            });
          } else if (path.includes("refs/") || path.endsWith("packed-refs")) {
            logInfo("Watcher", `Refs change detected: ${path}`);
            debounceCallback({
              type: "branches-updated",
              branches: [],
            });
            debounceCallback({
              type: "commits-updated",
              commits: [],
            });
          } else if (
            path.includes("rebase-merge") || 
            path.includes("rebase-apply") || 
            path.endsWith("MERGE_HEAD")
          ) {
            logInfo("Watcher", `Rebase/Merge state change detected: ${path}`);
            debounceCallback({
              type: "repository-changed",
              repository: { path: repoPath } as any,
            });
          } else if (path.endsWith("index")) {
            logInfo("Watcher", `Index change detected`);
            debounceCallback({
              type: "repository-changed",
              repository: { path: repoPath } as any,
            });
            // Index change often implies stage/unstage, so we might want to refresh commits view status
            debounceCallback({
              type: "commits-updated",
              commits: [],
            });
          }
        } else {
          // 2. Handle Working Tree changes
          // Any other change in the working directory
          debounceCallback({
            type: "repository-changed",
            repository: { path: repoPath } as any,
          });
        }
      });

      watcher.on("error", (error) => {
        logError("Watcher", `Chokidar error: ${error}`);
      });

      this.watchers.set(repoPath, watcher);
    } catch (error) {
      logError("Watcher", error);
    }
  }

  async unwatchRepository(repoPath: string): Promise<void> {
    const watcher = this.watchers.get(repoPath);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(repoPath);
      logInfo("Watcher", `Stopped watching ${repoPath}`);
    }
  }

  unwatchAll(): void {
    for (const [repoPath] of this.watchers) {
      this.unwatchRepository(repoPath);
    }
  }
}
