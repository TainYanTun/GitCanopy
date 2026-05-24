import { spawn } from "child_process";
import { app } from "electron";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { LRUCache } from "lru-cache";
import { AuthService } from "./auth-service";
import { logError } from "./logger-service";
import {
  Repository,
  Commit,
  Branch,
  FileChange,
  CommitParent,
  HotFile,
  ContributorStats,
  GitCommandLog,
  CommitFilterOptions,
  WorkingTreeStatus,
  StatusFile,
} from "../../shared/types";

class ReadWriteLock {
  private readers = 0;
  private writeQueue: (() => void)[] = [];
  private readQueue: (() => void)[] = [];
  private writerActive = false;

  async acquireRead(): Promise<() => void> {
    // If a writer is active or writers are waiting, we wait (Write Preference to avoid starvation)
    if (this.writerActive || this.writeQueue.length > 0) {
      await new Promise<void>(resolve => this.readQueue.push(resolve));
    }
    this.readers++;
    return () => this.releaseRead();
  }

  releaseRead() {
    this.readers--;
    this.processQueue();
  }

  async acquireWrite(): Promise<() => void> {
    if (this.writerActive || this.readers > 0) {
      await new Promise<void>(resolve => this.writeQueue.push(resolve));
    }
    this.writerActive = true;
    return () => this.releaseWrite();
  }

  releaseWrite() {
    this.writerActive = false;
    this.processQueue();
  }

  private processQueue() {
    if (this.writerActive) return;

    // Prioritize writers
    if (this.writeQueue.length > 0) {
      if (this.readers === 0) {
        const nextWriter = this.writeQueue.shift();
        if (nextWriter) nextWriter();
      }
    } else if (this.readQueue.length > 0) {
      // No writers waiting, flush all readers
      while (this.readQueue.length > 0) {
        const nextReader = this.readQueue.shift();
        if (nextReader) nextReader();
      }
    }
  }
}

export class GitService {
  private commandHistory: GitCommandLog[] = [];
  private maxHistorySize = 100;
  private avatarCache = new LRUCache<string, string>({ max: 500 });
  private branchesCache = new LRUCache<string, Branch[]>({ max: 10, ttl: 1000 * 60 }); // 60s cache
  private tagsCache = new LRUCache<string, Map<string, string[]>>({ max: 10, ttl: 1000 * 60 }); // 60s cache
  
  private authService: AuthService | null = null;
  private askPassScriptPath: string | null = null;
  private commandLock = new ReadWriteLock();
  private allowedRepositories: Set<string> = new Set();

  constructor(authService?: AuthService) {
    if (authService) {
      this.authService = authService;
    }
  }

  public addAllowedRepository(repoPath: string): void {
    this.allowedRepositories.add(path.resolve(repoPath));
  }

  public setAuthService(authService: AuthService) {
    this.authService = authService;
  }

  private getAskPassScriptPath(): string {
    if (this.askPassScriptPath && fs.existsSync(this.askPassScriptPath)) {
      return this.askPassScriptPath;
    }

    const scriptName = process.platform === 'win32' ? 'askpass.bat' : 'askpass.sh';
    const wrapperPath = path.join(os.tmpdir(), `gitcanopy-${scriptName}`);
    
    // Resolve jsPath based on environment
    let jsPath: string;
    if (app.isPackaged) {
      jsPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist/main/main/scripts/askpass.js');
      if (!fs.existsSync(jsPath)) {
        jsPath = path.join(app.getAppPath(), 'dist/main/main/scripts/askpass.js');
      }
    } else {
      jsPath = path.resolve(__dirname, '../scripts/askpass.js');
    }
    
    let content = '';
    if (process.platform === 'win32') {
      content = `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"${process.execPath}" "${jsPath}" %*`;
    } else {
      content = `#!/bin/sh\nexport ELECTRON_RUN_AS_NODE=1\n"${process.execPath}" "${jsPath}" "$@"`;
    }

    fs.writeFileSync(wrapperPath, content, { mode: 0o755 });
    this.askPassScriptPath = wrapperPath;
    return wrapperPath;
  }

  private getAvatarUrl(email: string): string {
    const cleanEmail = email.trim().toLowerCase();
    if (this.avatarCache.has(cleanEmail)) {
      return this.avatarCache.get(cleanEmail)!;
    }

    // Deterministic color from email hash — no external requests
    const hash = crypto.createHash("md5").update(cleanEmail).digest("hex");
    const hue = parseInt(hash.substring(0, 4), 16) % 360;
    const saturation = 45 + (parseInt(hash.substring(4, 6), 16) % 25); // 45–70%
    const lightness = 35 + (parseInt(hash.substring(6, 8), 16) % 20);  // 35–55%
    const bg = `hsl(${hue},${saturation}%,${lightness}%)`;

    // Initials from the local part of the email (before @)
    const localPart = cleanEmail.split("@")[0] || "?";
    const initials = localPart
      .replace(/[^a-z0-9]/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || localPart[0].toUpperCase();

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/><text x="32" y="32" dy="0.35em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="24" font-weight="600" fill="rgba(255,255,255,0.92)">${initials}</text></svg>`;
    const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

    this.avatarCache.set(cleanEmail, url);
    return url;
  }

  private isWriteCommand(args: string[]): boolean {
    const writeCommands = new Set([
      'add', 'commit', 'checkout', 'merge', 'rebase', 'reset', 
      'stash', 'clean', 'pull', 'push', 'clone', 'fetch', 
      'rm', 'mv', 'revert', 'cherry-pick'
    ]);
    return writeCommands.has(args[0]);
  }

  private async run(args: string[], cwd: string): Promise<string> {
    const isWrite = this.isWriteCommand(args);
    const release = isWrite 
      ? await this.commandLock.acquireWrite() 
      : await this.commandLock.acquireRead();

    try {
      const startTime = Date.now();
      
      // Prepare env
      const env = { ...process.env };
      if (this.authService) {
          env.GIT_ASKPASS = this.getAskPassScriptPath();
          env.GIT_CANOPY_AUTH_SOCK = this.authService.getSocketPath();
          env.GIT_TERMINAL_PROMPT = '0'; // Disable terminal prompt fallback
          
          // Ensure the socket server is running
          await this.authService.start();
      }

      return await new Promise<string>((resolve, reject) => {
        const gitProcess = spawn("git", args, { cwd, env });
        let stdout = "";
        let stderr = "";
        const MAX_BUFFER_SIZE = 20 * 1024 * 1024; // Increased to 20MB for larger diffs

        gitProcess.stdout.on("data", (data) => {
          if (stdout.length + data.length > MAX_BUFFER_SIZE) {
            gitProcess.kill();
            reject(new Error(`Git command output exceeded maximum buffer size of ${MAX_BUFFER_SIZE} bytes`));
            return;
          }
          stdout += data;
        });

        gitProcess.stderr.on("data", (data) => (stderr += data));

        gitProcess.on("close", (code) => {
          const duration = Date.now() - startTime;
          this.logCommand(args, code === 0, code || 0, duration);

          if (code === 0) {
            resolve(stdout);
          } else {
            // If the process was killed due to buffer size, the reject is already handled.
            if (stdout.length <= MAX_BUFFER_SIZE) {
               reject(new Error(stderr || `Git command failed with code ${code}`));
            }
          }
        });

        gitProcess.on("error", (err) => {
          const duration = Date.now() - startTime;
          this.logCommand(args, false, -1, duration);
          reject(err);
        });
      });
    } finally {
      release();
    }
  }

  private logCommand(args: string[], success: boolean, exitCode: number, duration: number) {
    // Sanitize arguments to mask tokens/passwords in URLs
    const sanitizedArgs = args.map(arg => {
      if (arg.includes("://") && arg.includes("@")) {
        return arg.replace(/:\/\/([^:]+):([^@]+)@/, "://***:***@").replace(/:\/\/([^@]+)@/, "://***@");
      }
      return arg;
    });

    const log: GitCommandLog = {
      id: Math.random().toString(36).substring(2, 9),
      command: "git",
      args: sanitizedArgs,
      timestamp: Date.now(),
      duration,
      exitCode,
      success,
    };

    this.commandHistory.unshift(log);
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory.pop();
    }
  }

  getCommandHistory(limit?: number, offset?: number): GitCommandLog[] {
    if (limit === undefined && offset === undefined) {
      return this.commandHistory;
    }
    
    const start = offset || 0;
    const end = limit !== undefined ? start + limit : this.commandHistory.length;
    
    return this.commandHistory.slice(start, end);
  }

  clearCommandHistory(): void {
    this.commandHistory = [];
  }

  async getHotFiles(repoPath: string, limit = 10, options?: CommitFilterOptions): Promise<HotFile[]> {
    try {
      // Build log command with filters
      const args = ["log", "--all", "-n", "5000", "--format=", "--name-only"];
      
      if (options) {
        if (options.author) args.push(`--author=${options.author}`);
        if (options.since) args.push(`--since=${options.since}`);
        if (options.until) args.push(`--until=${options.until}`);
        if (options.query) args.push(`--grep=${options.query}`, "--regexp-ignore-case");
      }

      const output = await this.run(args, repoPath);
      
      const counts: Record<string, number> = {};
      const lines = output.split('\n');
      
      for (const line of lines) {
        const path = line.trim();
        if (path) {
          counts[path] = (counts[path] || 0) + 1;
        }
      }

      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([path, count]) => ({ path, count }));
    } catch (error) {
      return [];
    }
  }

  async getWorkRhythm(repoPath: string): Promise<Record<string, { count: number, lastTimestamp: number }>> {
    try {
      // Get timestamps for all commits (limited to 5000 for performance)
      const output = await this.run(
        ["log", "--all", "-n", "5000", "--pretty=format:%ct"],
        repoPath
      );
      
      const rhythm: Record<string, { count: number, lastTimestamp: number }> = {};
      const lines = output.split('\n');
      
      for (const line of lines) {
        const timestamp = parseInt(line.trim(), 10);
        if (!isNaN(timestamp)) {
          const date = new Date(timestamp * 1000);
          const day = date.getDay(); // 0-6
          const hour = date.getHours(); // 0-23
          const key = `${day}-${hour}`;
          
          if (!rhythm[key]) {
            rhythm[key] = { count: 0, lastTimestamp: timestamp };
          }
          
          rhythm[key].count++;
          rhythm[key].lastTimestamp = Math.max(rhythm[key].lastTimestamp, timestamp);
        }
      }
      
      return rhythm;
    } catch (error) {
      return {};
    }
  }

  async getContributors(repoPath: string): Promise<ContributorStats[]> {
    try {
      // Use git log to get stats per author
      // LIMIT history to last 5000 commits to prevent performance issues
      const output = await this.run(
        ["log", "--all", "-n", "5000", "--pretty=format:%an|%ae|%ct", "--shortstat"], 
        repoPath
      );
      
      const lines = output.split('\n');
      const statsMap = new Map<string, ContributorStats>();
      
      let currentAuthor: { name: string, email: string, timestamp: number } | null = null;
      
      // First pass: find project-wide bounds
      const allTimestamps = lines
        .filter(l => l.includes('|'))
        .map(l => parseInt(l.split('|')[2], 10));
      
      if (allTimestamps.length === 0) return [];

      // Use reduce instead of spread to avoid RangeError on large arrays (>~10k elements)
      let projectStart = Infinity;
      let projectEnd = -Infinity;
      for (const ts of allTimestamps) {
        if (ts < projectStart) projectStart = ts;
        if (ts > projectEnd) projectEnd = ts;
      }
      const duration = projectEnd - projectStart || 1;

      for (const line of lines) {
        if (line.includes('|')) {
          const [name, email, timestampStr] = line.split('|');
          const timestamp = parseInt(timestampStr, 10);
          currentAuthor = { name, email, timestamp };

          if (!statsMap.has(email)) {
            // getAvatarUrl is called once per unique email, not per commit
            statsMap.set(email, {
              name,
              email,
              avatarUrl: this.getAvatarUrl(email),
              commitCount: 0,
              additions: 0,
              deletions: 0,
              firstCommit: timestamp,
              lastCommit: timestamp,
              activity: new Array(20).fill(0)
            });
          }

          const stats = statsMap.get(email)!;
          stats.commitCount++;
          if (timestamp < stats.firstCommit) stats.firstCommit = timestamp;
          if (timestamp > stats.lastCommit) stats.lastCommit = timestamp;

          // Assign to bucket
          const bucketIndex = Math.min(
            19,
            Math.floor(((timestamp - projectStart) / duration) * 20)
          );
          stats.activity[bucketIndex]++;
        } else if (line.includes('insertion') || line.includes('deletion')) {
          if (currentAuthor) {
            const stats = statsMap.get(currentAuthor.email)!;
            const addMatch = line.match(/(\d+) insertion/);
            const delMatch = line.match(/(\d+) deletion/);

            if (addMatch) stats.additions += parseInt(addMatch[1], 10);
            if (delMatch) stats.deletions += parseInt(delMatch[1], 10);
          }
        }
      }
      
      return Array.from(statsMap.values()).sort((a, b) => b.commitCount - a.commitCount);
    } catch (error) {
      return [];
    }
  }
  async getStatus(repoPath: string): Promise<WorkingTreeStatus> {
    try {
      // Get branch status (ahead/behind)
      const branchOutput = await this.run(["status", "-sb"], repoPath);
      const aheadMatch = branchOutput.match(/ahead (\d+)/);
      const behindMatch = branchOutput.match(/behind (\d+)/);
      
      const ahead = aheadMatch ? parseInt(aheadMatch[1], 10) : 0;
      const behind = behindMatch ? parseInt(behindMatch[1], 10) : 0;
      
      // Check if branch tracks a remote (contains "...")
      // e.g. "## main...origin/main" vs "## feature-branch"
      const firstLine = branchOutput.split('\n')[0];
      const hasRemote = firstLine.includes("...");
      const isDetached = firstLine.includes("HEAD (no branch)");

      // Get file status
      const output = await this.run(["status", "--porcelain=v1"], repoPath);
      const lines = output.split("\n").filter(Boolean);
      
      const files: StatusFile[] = lines.map(line => {
        const xy = line.substring(0, 2);
        const rawPath = line.substring(3);
        
        // Handle renamed files: "old -> new"
        let finalPath = rawPath;
        if (xy[0] === "R" || xy[1] === "R") {
          const parts = rawPath.split(" -> ");
          finalPath = parts[parts.length - 1]; // Use the 'new' path
        }
        
        // Remove quotes if git returned a quoted path (usually for spaces)
        finalPath = finalPath.replace(/^"(.*)"$/, "$1");

        const staged = xy[0] !== " " && xy[0] !== "?";
        
        let status: StatusFile["status"] = "modified";
        if (xy.includes("U") || xy === "DD" || xy === "AA") status = "conflicted";
        else if (xy[0] === "?" || xy[1] === "?") status = "untracked";
        else if (xy[0] === "A" || xy[1] === "A") status = "added";
        else if (xy[0] === "D" || xy[1] === "D") status = "deleted";
        else if (xy[0] === "R" || xy[1] === "R") status = "renamed";

        return { path: finalPath, status, staged };
      });

      return { files, ahead, behind, hasRemote, isDetached };
    } catch (error) {
      logError("GitService", `Failed to get status: ${error}`);
      return { files: [], ahead: 0, behind: 0, hasRemote: false, isDetached: false };
    }
  }

  async stageFile(repoPath: string, filePath: string): Promise<void> {
    if (this.isSensitiveFile(filePath)) {
      throw new Error(`SECURITY: Staging sensitive files like secrets or configuration is blocked to prevent accidental leakage. Please add '${filePath}' to your .gitignore.`);
    }
    await this.run(["add", "--", filePath], repoPath);
  }

  async stageAll(repoPath: string): Promise<void> {
    // Check if any files to be staged are sensitive
    const status = await this.getStatus(repoPath);
    const sensitiveFiles = status.files.filter(f => !f.staged && this.isSensitiveFile(f.path));
    
    if (sensitiveFiles.length > 0) {
      throw new Error(`SECURITY: Sensitive files detected (${sensitiveFiles.map(f => f.path).join(", ")}). 'Stage All' is blocked to prevent accidental leakage. Please stage files individually or update your .gitignore.`);
    }
    
    await this.run(["add", "."], repoPath);
  }

  private isSensitiveFile(filePath: string): boolean {
    const filename = path.basename(filePath).toLowerCase();
    
    // Environment files
    if (filename === ".env" || filename.startsWith(".env.")) return true;
    
    // Auth/Credential files
    const sensitiveNames = [
      ".npmrc", ".yarnrc", ".pypirc", 
      "credentials", "config", "key.json", "secret.json",
      "auth.json", "passwd", "shadow"
    ];
    if (sensitiveNames.includes(filename)) return true;

    // Keys and certs
    const sensitiveExts = [
      ".pem", ".key", ".pub", ".crt", ".p12", ".pfx", 
      ".asc", ".gpg", ".sig", ".signature"
    ];
    if (sensitiveExts.some(ext => filename.endsWith(ext))) return true;

    // SSH
    if (filename.includes("id_rsa") || filename.includes("id_ed25519") || filename.includes("known_hosts")) return true;

    return false;
  }

  async clone(url: string, targetPath: string, progressCallback?: (progress: string) => void): Promise<void> {
    const parentDir = path.dirname(targetPath);
    const repoName = path.basename(targetPath);
    
    const args = ["clone", "--progress", "--", url, repoName];
    const release = await this.commandLock.acquireWrite();

    try {
      const startTime = Date.now();
      const env = { ...process.env };
      if (this.authService) {
          env.GIT_ASKPASS = this.getAskPassScriptPath();
          env.GIT_CANOPY_AUTH_SOCK = this.authService.getSocketPath();
          env.GIT_TERMINAL_PROMPT = '0';
          await this.authService.start();
      }

      return await new Promise<void>((resolve, reject) => {
        const gitProcess = spawn("git", args, { cwd: parentDir, env });
        let stderr = "";

        gitProcess.stderr.on("data", (data) => {
          const chunk = data.toString();
          stderr += chunk;
          
          if (progressCallback) {
            // Parse progress: 'Receiving objects:  10%' or 'Resolving deltas:  50%'
            const lines = chunk.split(/[\r\n]/);
            for (const line of lines) {
              const match = line.match(/(\d+)%/);
              if (match) {
                progressCallback(match[1]);
              }
            }
          }
        });

        gitProcess.on("close", (code) => {
          const duration = Date.now() - startTime;
          this.logCommand(args, code === 0, code || 0, duration);
          if (code === 0) resolve();
          else reject(new Error(stderr || `Clone failed with code ${code}`));
        });

        gitProcess.on("error", reject);
      });
    } finally {
      release();
    }
  }

  async cloneToParent(url: string, parentPath: string, progressCallback?: (progress: string) => void): Promise<string> {
    // 1. Extract repo name
    const cleanUrl = url.replace(/\/$/, '').replace(/\.git$/, '');
    const repoName = cleanUrl.split('/').pop() || 'repository';
    
    // 2. Resolve full path
    const targetPath = path.join(parentPath, repoName);
    
    // 3. Check if exists
    if (fs.existsSync(targetPath)) {
        throw new Error(`Destination '${repoName}' already exists in selected folder.`);
    }
    
    // 4. Clone with progress
    await this.clone(url, targetPath, progressCallback);
    
    // 5. Verify existence
    if (!fs.existsSync(targetPath)) {
        throw new Error(`Clone operation completed but directory was not created: ${targetPath}`);
    }
    
    return targetPath;
  }

  async unstageFile(repoPath: string, filePath: string): Promise<void> {
    await this.run(["reset", "HEAD", "--", filePath], repoPath);
  }

  async unstageAll(repoPath: string): Promise<void> {
    await this.run(["reset", "HEAD"], repoPath);
  }

  async discardChanges(repoPath: string, filePath: string): Promise<void> {
    // For untracked files, we should probably delete them? 
    // Usually 'discard' means git checkout for tracked and rm for untracked.
    // Let's check status first or just try checkout.
    try {
      await this.run(["checkout", "--", filePath], repoPath);
    } catch (_err) {
      // If checkout fails, maybe it's untracked
      await this.run(["clean", "-f", "--", filePath], repoPath);
    }
  }

  async commit(repoPath: string, message: string): Promise<void> {
    if (!message.trim()) throw new Error("Commit message cannot be empty");
    await this.runWithRetry(["commit", "-m", message], repoPath);
  }

  async push(repoPath: string): Promise<void> {
    try {
      await this.run(["push"], repoPath);
    } catch (error: any) {
      const message = error.message || "";
      // Check for "no upstream branch" error
      if (message.includes("no upstream branch") || message.includes("set-upstream")) {
        const currentBranch = await this.getCurrentBranch(repoPath);
        if (currentBranch && currentBranch !== "HEAD" && currentBranch !== "Detached") {
          // Identify the best remote to push to
          const remote = await this.getBestRemote(repoPath);
          await this.run(["push", "--set-upstream", remote, currentBranch], repoPath);
          return;
        }
      }
      throw error;
    }
  }

  async forcePush(repoPath: string): Promise<void> {
    const remote = await this.getBestRemote(repoPath);

    // 1. Fetch first to update remote-tracking branches (avoids 'stale info' error)
    // We only fetch from the specific remote we are interested in
    await this.run(["fetch", remote], repoPath);

    // 2. Use --force-with-lease which is now safe since we just fetched
    await this.run(["push", "--force-with-lease", remote], repoPath);
  }

  /**
   * Helper to find the most appropriate remote.
   * Prefers 'origin', then 'upstream', then the first available remote.
   */
  private async getBestRemote(repoPath: string): Promise<string> {
    try {
      const output = await this.run(["remote"], repoPath);
      const remotes = output.trim().split("\n").filter(Boolean);
      
      if (remotes.length === 0) {
        throw new Error("No remotes configured for this repository. Add a remote first.");
      }

      if (remotes.includes("origin")) return "origin";
      if (remotes.includes("upstream")) return "upstream";
      return remotes[0];
    } catch (e: any) {
      if (e.message?.includes("No remotes configured")) throw e;
      return "origin"; // Last resort fallback
    }
  }

  async resetHard(repoPath: string, target: string): Promise<void> {
    await this.run(["reset", "--hard", target], repoPath);
  }

  async getRepository(repoPath: string): Promise<Repository> {
    // 0. Check if directory exists
    if (!fs.existsSync(repoPath)) {
      throw new Error(`Directory does not exist: ${repoPath}`);
    }

    // Verify it's a Git repository
    try {
      await this.run(["rev-parse", "--is-inside-work-tree"], repoPath);
    } catch (error) {
       logError("GitService", `Validation failed for ${repoPath}: ${error}`);
       throw new Error(`Not a valid Git repository: ${repoPath}`);
    }

    const name = repoPath.split("/").pop() || "Unknown";
    
    // Parallel detection of states and data
    const [currentBranch, headCommit, branches, isRebasing, isMerging, isDetached, totalCommits, conflictOutput] = await Promise.all([
      this.getCurrentBranch(repoPath),
      this.getCurrentHead(repoPath),
      this.getBranches(repoPath),
      this.checkIsRebasing(repoPath),
      this.checkIsMerging(repoPath),
      this.checkIsDetached(repoPath),
      this.getTotalCommits(repoPath),
      // Optimization: Only check for unmerged files instead of full status
      this.run(["diff", "--name-only", "--diff-filter=U"], repoPath).catch(() => "")
    ]);

    const hasConflicts = conflictOutput.trim().length > 0;

    return {
      path: repoPath,
      name,
      isValidGit: true,
      currentBranch,
      headCommit,
      branches,
      totalCommits,
      isRebasing,
      isMerging,
      isDetached,
      hasConflicts
    };
  }

  private async getTotalCommits(repoPath: string): Promise<number> {
    try {
      const output = await this.run(["rev-list", "--all", "--count"], repoPath);
      return parseInt(output.trim(), 10) || 0;
    } catch {
      return 0;
    }
  }

  private async checkIsRebasing(repoPath: string): Promise<boolean> {
    try {
      const [mergePath, applyPath] = await Promise.all([
        this.run(["rev-parse", "--git-path", "rebase-merge"], repoPath),
        this.run(["rev-parse", "--git-path", "rebase-apply"], repoPath)
      ]);
      return fs.existsSync(mergePath.trim()) || fs.existsSync(applyPath.trim());
    } catch {
      // Fallback to manual check if git command fails
      const gitPath = path.join(repoPath, '.git');
      return fs.existsSync(path.join(gitPath, 'rebase-merge')) || 
             fs.existsSync(path.join(gitPath, 'rebase-apply'));
    }
  }

  private async checkIsMerging(repoPath: string): Promise<boolean> {
    try {
      const mergeHeadPath = await this.run(["rev-parse", "--git-path", "MERGE_HEAD"], repoPath);
      return fs.existsSync(mergeHeadPath.trim());
    } catch {
      const gitPath = path.join(repoPath, '.git');
      return fs.existsSync(path.join(gitPath, 'MERGE_HEAD'));
    }
  }

  private async checkIsDetached(repoPath: string): Promise<boolean> {
    try {
      await this.run(["symbolic-ref", "-q", "HEAD"], repoPath);
      return false; // Symbolic ref exists, so not detached
    } catch {
      return true; // Command failed, likely detached
    }
  }

  async getCommits(
    repoPath: string,
    limit = 100,
    offset = 0,
    options?: CommitFilterOptions
  ): Promise<Commit[]> {
    const args = [
      "log",
      "--all",
      "--pretty=format:%H|%P|%an|%ae|%ct|%s|%D",
      `--skip=${offset}`,
      `-n`,
      `${limit}`
    ];

    if (options) {
      if (options.author) {
        args.push(`--author=${options.author}`);
      }
      if (options.since) {
        args.push(`--since=${options.since}`);
      }
      if (options.until) {
        args.push(`--until=${options.until}`);
      }
      if (options.query) {
        args.push(`--grep=${options.query}`, "--regexp-ignore-case");
      }
      if (options.path) {
        args.push("--", options.path);
      }
    }

    try {
      const [branches, tagMap] = await Promise.all([
        this.getBranches(repoPath),
        this.getTags(repoPath)
      ]);

      const branchMap = new Map<string, string>();
      branches.forEach((branch) => {
        branchMap.set(branch.objectName, branch.name);
      });

      const output = await this.run(args, repoPath);
      return this.parseCommits(output, branchMap, tagMap);
    } catch {
      return [];
    }
  }

  async getTags(repoPath: string): Promise<Map<string, string[]>> {
    if (this.tagsCache.has(repoPath)) {
      return this.tagsCache.get(repoPath)!;
    }
    try {
      const output = await this.run(
        ["show-ref", "--tags", "--dereference"],
        repoPath
      );
      const tagMap = new Map<string, string[]>();
      output.split('\n').forEach(line => {
        if (!line) return;
        const [hash, ref] = line.split(' ');
        const tagName = ref.replace('refs/tags/', '').replace('^{}', '');
        const list = tagMap.get(hash) || [];
        if (!list.includes(tagName)) {
            list.push(tagName);
            tagMap.set(hash, list);
        }
      });
      this.tagsCache.set(repoPath, tagMap);
      return tagMap;
    } catch {
      return new Map();
    }
  }

  async getBranches(repoPath: string): Promise<Branch[]> {
    if (this.branchesCache.has(repoPath)) {
      return this.branchesCache.get(repoPath)!;
    }
    try {
      const output = await this.run(
        ["branch", "-a", "--format=%(refname:short)|%(objectname)"],
        repoPath
      );
      const branches = this.parseBranches(output);
      this.branchesCache.set(repoPath, branches);
      return branches;
    } catch {
      return [];
    }
  }

  async getCurrentHead(repoPath: string): Promise<string> {
    try {
      const output = await this.run(["rev-parse", "HEAD"], repoPath);
      return output.trim();
    } catch {
      return "";
    }
  }

  async checkoutBranch(repoPath: string, branchName: string): Promise<void> {
    try {
      await this.runWithRetry(["checkout", branchName], repoPath);
    } catch (error) {
      logError("GitService", `Failed to checkout branch ${branchName}: ${error}`);
      throw error;
    }
  }

  async mergeBranch(repoPath: string, branchName: string): Promise<void> {
    try {
      await this.runWithRetry(["merge", branchName], repoPath);
    } catch (error: any) {
      logError("GitService", `Failed to merge branch ${branchName}: ${error}`);
      // Propagate the error so the UI can show it (e.g. conflicts)
      throw error;
    }
  }

  async getStashList(repoPath: string): Promise<string[]> {
    try {
      const output = await this.run(["stash", "list", "--pretty=format:%gd: %gs"], repoPath);
      return output.trim().split("\n").filter((line) => line.length > 0);
    } catch (error) {
      return [];
    }
  }

  async getStashFiles(repoPath: string, index: string): Promise<string[]> {
    try {
      // 1. Try modern command (includes tracked + untracked)
      try {
        const output = await this.run(["stash", "show", "--include-untracked", "--name-only", index], repoPath);
        const files = output.trim().split("\n").filter(Boolean);
        if (files.length > 0) return Array.from(new Set(files));
      } catch (e) {
        // Fallback if --include-untracked is not supported
      }

      // 2. Fallback: Combine tracked and untracked manually
      const [trackedOutput, untrackedOutput] = await Promise.all([
        this.run(["stash", "show", "--name-only", index], repoPath).catch(() => ""),
        // The 3rd parent (index^3) of a stash commit contains untracked files
        this.run(["ls-tree", "-r", `${index}^3`, "--name-only"], repoPath).catch(() => "")
      ]);

      const combined = [
        ...trackedOutput.trim().split("\n"),
        ...untrackedOutput.trim().split("\n")
      ].filter(Boolean);

      return Array.from(new Set(combined));
    } catch (error) {
      logError("GitService", `Failed to get stash files for ${index}: ${error}`);
      return [];
    }
  }

  async getStashFileDiff(repoPath: string, index: string, filePath: string): Promise<string> {
    try {
      // Stash is a commit with potentially 3 parents:
      // Parent 1 (index^1): Original commit
      // Parent 2 (index^2): Staged changes
      // Parent 3 (index^3): Untracked changes
      
      // Try to get diff from the tracked changes first (standard stash show)
      try {
        const diff = await this.run(["stash", "show", "-p", index, "--", filePath], repoPath);
        if (diff.trim()) return diff;
      } catch (e) {
        // Fallback if standard stash show fails (e.g. untracked file)
      }

      // If no tracked diff, check if it's in the untracked parent (index^3)
      try {
         // To see untracked files in a stash, we diff index^3 against its first parent (index^1)
         const diff = await this.run(["diff", `${index}^1`, `${index}^3`, "--", filePath], repoPath);
         return diff;
      } catch (e) {
         return "Could not load diff for this stashed file.";
      }
    } catch (error) {
      return `Error loading stash diff: ${error}`;
    }
  }

  async getReflog(repoPath: string, limit = 100): Promise<any[]> {
    try {
      const output = await this.run(
        ["reflog", `-n`, `${limit}`, "--pretty=format:%gD|%H|%gs|%ct"],
        repoPath
      );
      
      return output.trim().split("\n").filter(Boolean).map(line => {
        const [selector, hash, actionSubject, timestamp] = line.split("|");
        // Split action and subject (e.g. "checkout: moving from main to dev")
        const colonIndex = actionSubject.indexOf(":");
        const action = colonIndex !== -1 ? actionSubject.substring(0, colonIndex) : actionSubject;
        const subject = colonIndex !== -1 ? actionSubject.substring(colonIndex + 1).trim() : "";
        
        return {
          selector,
          hash,
          shortHash: hash.substring(0, 7),
          action,
          subject,
          timestamp: parseInt(timestamp, 10)
        };
      });
    } catch (error) {
      logError("GitService", `Failed to get reflog: ${error}`);
      return [];
    }
  }

  async stash(repoPath: string): Promise<void> {
    await this.runWithRetry(["stash", "push", "-m", `Auto-stash before checkout: ${new Date().toLocaleString()}`], repoPath);
  }

  private async runWithRetry(args: string[], cwd: string, retries = 10, delay = 500): Promise<string> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.run(args, cwd);
      } catch (error: any) {
        const message = error.message || "";
        const isLockError = message.includes("index.lock") || message.includes("could not write index") || message.includes("Unable to create");
        
        if (isLockError && i < retries - 1) {
          console.log(`[GitService] Index locked, retrying command '${args[0]} ${args[1]}' (${i + 1}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error("Git command failed after retries");
  }

  async applyStash(repoPath: string, index: string): Promise<void> {
    const isConflictMessage = (msg: string) => {
      const lower = msg.toLowerCase();
      return lower.includes("conflict") || 
             lower.includes("merge conflict") || 
             lower.includes("unmerged") ||
             lower.includes("fix conflicts");
    };

    try {
      await this.runWithRetry(["stash", "apply", "--index", index], repoPath);
    } catch (error: any) {
      const message = error.message || "";
      if (isConflictMessage(message)) {
        throw new Error("STASH_CONFLICT: Stash applied with merge conflicts. Please resolve them in your editor.");
      }
      
      // Fallback: try without --index
      try {
        await this.runWithRetry(["stash", "apply", index], repoPath);
      } catch (innerError: any) {
        const innerMessage = innerError.message || "";
        if (isConflictMessage(innerMessage)) {
          throw new Error("STASH_CONFLICT: Stash applied with merge conflicts. Please resolve them in your editor.");
        }
        
        // If it's code 1 and we got here, it's very likely a conflict even if the message is weird
        if (innerMessage.includes("failed with code 1")) {
           throw new Error("STASH_CONFLICT: Stash applied with merge conflicts. Please resolve them in your editor.");
        }
        
        throw innerError;
      }
    }
  }

  async dropStash(repoPath: string, index: string): Promise<void> {
    await this.run(["stash", "drop", "--", index], repoPath);
  }

  async createTag(repoPath: string, tagName: string, commitHash?: string, message?: string): Promise<void> {
    const args = ["tag", tagName];
    if (message) {
      args.push("-m", message);
      args.push("-a"); // Annotated tag
    }
    if (commitHash) {
      args.push(commitHash);
    }
    await this.run(args, repoPath);
  }

  async deleteTag(repoPath: string, tagName: string): Promise<void> {
    await this.run(["tag", "-d", tagName], repoPath);
  }

  async pushTag(repoPath: string, tagName: string): Promise<void> {
    await this.run(["push", "origin", tagName], repoPath);
  }

  async getTagsList(repoPath: string): Promise<string[]> {
    try {
      // Returns list of tags sorted by creatordate (newest first)
      const output = await this.run(["tag", "--sort=-creatordate"], repoPath);
      return output.trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  async getGlobalConfig(key: string): Promise<string> {
    try {
      const output = await this.run(["config", "--global", "--get", key], process.cwd());
      return output.trim();
    } catch {
      return "";
    }
  }

  async setGlobalConfig(key: string, value: string): Promise<void> {
    await this.run(["config", "--global", key, value], process.cwd());
  }


  async getCommitDetails(repoPath: string, commitHash: string): Promise<Commit> {
    const args = ["show", "--pretty=format:%H|%P|%an|%ae|%ad|%s", "--numstat", "--date=raw", commitHash];
    const tagArgs = ["tag", "--contains", commitHash];
    const branchArgs = ["branch", "--contains", commitHash, "--format=%(refname:short)"];
    const tipArgs = ["branch", "--points-at", commitHash, "--format=%(refname:short)"];

    try {
      const [output, tagsOutput, branchesOutput, tipsOutput] = await Promise.all([
        this.run(args, repoPath),
        this.run(tagArgs, repoPath).catch(() => ""),
        this.run(branchArgs, repoPath).catch(() => ""),
        this.run(tipArgs, repoPath).catch(() => "")
      ]);

      const commit = this.parseDetailedCommit(output, tagsOutput, branchesOutput);
      
      // Mark which branches are tips
      const tips = tipsOutput.trim().split("\n").filter(Boolean);
      if (tips.length > 0) {
        (commit as any).branchTips = tips;
      }

      return commit;
    } catch (error) {
      logError("GitService", `Failed to get commit details for ${commitHash}: ${error}`);
      throw error;
    }
  }

  private parseDetailedCommit(
    output: string,
    tagsOutput: string,
    branchesOutput: string,
  ): Commit {
    const lines = output.trim().split("\n");
    const [headerLine, ...restLines] = lines;
    const [hash, parentsHashes, authorName, authorEmail, authorTimestamp, subject] = headerLine.split("|");

    // Parse file changes and stats
    let additions = 0;
    let deletions = 0;
    const fileChanges: FileChange[] = [];
    let parsingFiles = false;

    for (const line of restLines) {
      if (line.match(/^\d+\t\d+\t.+/)) { // Numstat line
        parsingFiles = true;
        const [added, deleted, filePath] = line.split('\t');
        additions += parseInt(added);
        deletions += parseInt(deleted);
        fileChanges.push({ status: 'M', path: filePath }); // Assuming 'M' for simplicity, actual status needs more parsing
      } else if (parsingFiles && line.startsWith('--- a/')) {
          // This marks the start of diff, we can stop parsing numstat
          break;
      }
    }

    const parentsDetails: CommitParent[] = parentsHashes
      .split(" ")
      .filter(Boolean)
      .map((pHash) => ({
        hash: pHash,
        shortHash: pHash.substring(0, 7),
      }));

    const tags = tagsOutput.trim().split('\n').filter(Boolean);
    const branches = branchesOutput.trim().split('\n').filter(Boolean);

    return {
      hash,
      shortHash: hash.substring(0, 7),
      parents: parentsHashes.split(" ").filter(Boolean),
      message: subject, // subject is usually the first line
      shortMessage: subject.split('\n')[0],
      type: this.getCommitType(subject), // Re-using existing helper
      author: {
        name: authorName,
        email: authorEmail,
        avatarUrl: this.getAvatarUrl(authorEmail),
      },
      committer: {
        name: authorName,
        email: authorEmail,
        avatarUrl: this.getAvatarUrl(authorEmail),
      }, // Assuming committer is same for now
      timestamp: parseInt(authorTimestamp.split(' ')[0]), // git show --date=raw gives "timestamp timezone", we only need timestamp
      isMerge: parentsHashes.split(" ").filter(Boolean).length > 1,
      isSquash: false, // Cannot determine from 'git show' easily without more complex logic
      parentsDetails,
      fileChanges,
      branches,
      tags,
      stats: {
        additions,
        deletions,
        total: additions + deletions,
      },
    };
  }


  async getRemoteUrl(repoPath: string, remoteName: string = "origin"): Promise<string> {
    try {
      const output = await this.run(["remote", "get-url", remoteName], repoPath);
      return output.trim();
    } catch {
      return "";
    }
  }

  async getDiff(repoPath: string, commitHash: string, filePath: string): Promise<string> {
    try {
      // 1. Handle Untracked / Unstaged / Staged / Commit Diffs
      let args: string[] = [];
      const EMPTY_TREE_HASH = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
      
      // Normalize path: empty string becomes '.' for Git
      const targetPath = filePath || ".";
      
      if (!commitHash) {
        // Unstaged or Untracked
        const status = await this.run(["status", "--porcelain", "--", targetPath], repoPath);
        if (status.startsWith("??") && filePath) { // Only handle as untracked if a specific file is targeted
          // Untracked: Show as all additions
          try {
            const fullPath = this.validatePath(repoPath, filePath);
            const stats = await fs.promises.stat(fullPath);
            const MAX_DIFF_SIZE = 1024 * 1024; // 1MB limit for untracked diff preview

            if (stats.size > MAX_DIFF_SIZE) {
                return `File is too large to display diff (${(stats.size / 1024 / 1024).toFixed(2)}MB).`;
            }

            const isBinary = await this.isBinaryFile(fullPath);
            if (isBinary) return "BINARY_FILE";
            
            const content = await fs.promises.readFile(fullPath, 'utf8');
            return content.split('\n').map(line => `+${line}`).join('\n');
          } catch (e) {
            return "Error reading untracked file.";
          }
        } else {
          // Tracked but unstaged
          args = ["diff", "--", targetPath];
        }
      } else if (commitHash === "HEAD") {
        // Staged changes
        args = ["diff", "--cached", "--", targetPath];
      } else {
        // Commit changes: Diff between commit and its parent
        args = ["diff", `${commitHash}^`, commitHash, "--", targetPath];
      }

      // 2. Helper to execute diff with binary check
      const executeDiff = async (diffArgs: string[]): Promise<string> => {
        if (diffArgs.length > 0 && diffArgs[0] === "diff") {
          // Check binary first using numstat
          const checkArgs = [...diffArgs];
          const numstatIdx = checkArgs.indexOf("--");
          if (numstatIdx !== -1) {
            checkArgs.splice(numstatIdx, 0, "--numstat");
          } else {
            checkArgs.push("--numstat");
          }
          
          try {
            const statsOutput = await this.run(checkArgs, repoPath);
            if (statsOutput) {
              const parts = statsOutput.split("\t");
              if (parts[0] === "-" || parts[1] === "-") {
                return "BINARY_FILE";
              }
            }
          } catch (e: any) {
            // If invalid revision, we MUST fail here so we can fallback
            if (e.message?.includes("unknown revision") || e.message?.includes("bad revision")) {
              throw e;
            }
          }
        }
        return await this.run(diffArgs, repoPath);
      };

      // 3. Run with Fallback for Root Commit
      try {
        const diff = await executeDiff(args);
        return diff || "No changes detected.";
      } catch (error: any) {
        // Check if failure is due to missing parent (root commit)
        if (commitHash && args.includes(`${commitHash}^`) && 
            (error.message?.includes("unknown revision") || error.message?.includes("bad revision"))) {
            
            // Fallback: Diff against empty tree
            const rootArgs = ["diff", EMPTY_TREE_HASH, commitHash, "--", filePath];
            return await executeDiff(rootArgs);
        }
        throw error;
      }
    } catch (error) {
      logError("GitService", `Failed to get diff for ${filePath} at ${commitHash || 'working tree'}: ${error}`);
      return `Error loading diff: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  async getStagedDiff(repoPath: string): Promise<string> {
    try {
      // --no-color to get raw text for AI
      // --diff-algorithm=minimal to make it slightly more compact
      const diff = await this.run(["diff", "--cached", "--no-color", "--diff-algorithm=minimal"], repoPath);
      return diff;
    } catch (error) {
      logError("GitService", `Failed to get staged diff: ${error}`);
      return "";
    }
  }

  async getFileContent(repoPath: string, filePath: string): Promise<string> {
    try {
      const fullPath = this.validatePath(repoPath, filePath);
      
      // Performance: Prevent reading massive files into memory
      const stats = await fs.promises.stat(fullPath);
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB limit for text content
      if (stats.size > MAX_SIZE) {
        throw new Error(`File is too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Manual resolution required.`);
      }

      const content = await fs.promises.readFile(fullPath, "utf8");
      return content;
    } catch (error) {
      logError("GitService", `Failed to read file ${filePath}: ${error}`);
      throw error;
    }
  }

  async resolveConflict(repoPath: string, filePath: string, content: string): Promise<void> {
    try {
      const fullPath = this.validatePath(repoPath, filePath);
      await fs.promises.writeFile(fullPath, content, "utf8");
      await this.stageFile(repoPath, filePath);
    } catch (error) {
      logError("GitService", `Failed to resolve conflict for ${filePath}: ${error}`);
      throw error;
    }
  }

  private validatePath(repoPath: string, filePath: string): string {
    const absoluteRepoPath = path.resolve(repoPath);
    const absoluteFilePath = path.resolve(repoPath, filePath);

    // Security Check: Ensure repoPath is explicitly allowed
    if (this.allowedRepositories.size > 0 && !this.allowedRepositories.has(absoluteRepoPath)) {
      throw new Error(`Security Violation: Repository path '${repoPath}' is not authorized.`);
    }

    if (!absoluteFilePath.startsWith(absoluteRepoPath)) {
      throw new Error("Security Violation: Path traversal attempt detected.");
    }
    return absoluteFilePath;
  }

  private async isBinaryFile(fullPath: string): Promise<boolean> {
    try {
      const buffer = Buffer.alloc(8000);
      const fd = await fs.promises.open(fullPath, 'r');
      const { bytesRead } = await fd.read(buffer, 0, 8000, 0);
      await fd.close();
      
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async getCurrentBranch(repoPath: string): Promise<string> {
    try {
      const output = await this.run(["symbolic-ref", "--short", "HEAD"], repoPath);
      return output.trim();
    } catch {
      try {
        // Fallback for detached HEAD: show short hash
        const output = await this.run(["rev-parse", "--short", "HEAD"], repoPath);
        return output.trim() || "Detached";
      } catch {
        return "Unknown";
      }
    }
  }

  private parseCommits(
    output: string,
    branchMap: Map<string, string>,
    tagMap: Map<string, string[]>,
  ): Commit[] {
    if (!output.trim()) return [];

    const lines = output.trim().split("\n");
    
    // We'll process from newest to oldest, but we need to track active branches
    // for commits that don't have explicit decorations.
    const activeBranchMap = new Map<string, string>();

    return lines.map((line) => {
      const parts = line.split("|");
      const [hash, parents, author, email, timestamp, subject, decoration] = parts;

      let branchName = branchMap.get(hash);

      if (!branchName && decoration) {
        const refs = decoration.split(", ").map(r => r.trim());
        for (const ref of refs) {
          const match = ref.match(/^(?:HEAD -> )?(.+)$/);
          if (match) {
            const name = match[1].replace(/^origin\//, "").replace(/^remotes\/origin\//, "");
            if (!name.includes("tag: ") && !name.includes("HEAD")) {
              branchName = name;
              break;
            }
          }
        }
      }

      // If we found a branch tip, all its ancestors (until a merge or another tip)
      // belong to this branch. In a simple log, the next commit is usually the parent.
      if (branchName) {
          const parentHashes = parents ? parents.split(" ") : [];
          parentHashes.forEach(p => activeBranchMap.set(p, branchName!));
      } else {
          // Inherit branch from child
          branchName = activeBranchMap.get(hash);
          const parentHashes = parents ? parents.split(" ") : [];
          if (branchName) {
              parentHashes.forEach(p => activeBranchMap.set(p, branchName!));
          }
      }

      return {
        hash,
        shortHash: hash.substring(0, 7),
        parents: parents ? parents.split(" ") : [],
        message: subject,
        shortMessage: subject.split("\n")[0],
        type: this.getCommitType(subject),
        author: {
          name: author,
          email,
          avatarUrl: this.getAvatarUrl(email),
        },
        committer: {
          name: author,
          email,
          avatarUrl: this.getAvatarUrl(email),
        },
        timestamp: parseInt(timestamp),
        isMerge: parents ? parents.split(" ").length > 1 : false,
        isSquash: false,
        branchName,
        tags: tagMap.get(hash) || [],
      };
    });
  }

  private parseBranches(output: string): Branch[] {
    if (!output.trim()) return [];

    return output
      .trim()
      .split("\n")
      .map((line, index) => {
        const [name, objectName] = line.split("|");
        const isRemote = name.startsWith("remotes/");
        return {
          name: name.replace(/^remotes\/[^/]+\//, ""), // remove remote prefix
          type: this.getBranchType(name),
          objectName,
          isHead: false, // Will be determined later
          isLocal: !isRemote,
          isRemote,
          color: this.getBranchColor(name),
          lane: index,
        };
      });
  }

  private getCommitType(message: string): any {
    if (message.toLowerCase().startsWith("revert")) return "revert";

    const match = message.match(/^(\w+)(?:\(.+\))?:/);
    if (!match) return "other";

    const type = match[1].toLowerCase();
    const validTypes = [
      "feat",
      "fix",
      "docs",
      "style",
      "refactor",
      "perf",
      "test",
      "chore",
      "revert",
    ];
    return validTypes.includes(type) ? type : "other";
  }

  private getBranchType(name: string): any {
    // Clean name by removing remotes/ and origin/ prefixes for classification
    const cleanName = name
      .replace(/^remotes\//, "")
      .replace(/^origin\//, "")
      .replace(/^[^/]+\//, (match) => {
        // If it still looks like a remote (e.g., 'upstream/'), remove it
        const commonRemotes = ["origin/", "upstream/", "github/"];
        return commonRemotes.includes(match) ? "" : match;
      });

    if (cleanName === "main" || cleanName === "master") return "main";
    if (cleanName === "develop" || cleanName === "dev") return "develop";
    if (cleanName.startsWith("feature/")) return "feature";
    if (cleanName.startsWith("release/")) return "release";
    if (cleanName.startsWith("hotfix/")) return "hotfix";
    return "custom";
  }

  private getBranchColor(name: string): string {
    const type = this.getBranchType(name);
    
    // Fixed colors for primary branches
    if (type === "main") return "#1f2937";
    if (type === "develop") return "#059669";
    if (type === "hotfix") return "#ea580c";
    if (type === "release") return "#dc2626";

    // Dynamic colors for features and custom branches to make them distinguishable
    const palette = [
      "#2563eb", // blue
      "#7c3aed", // violet
      "#db2777", // pink
      "#0891b2", // cyan
      "#4f46e5", // indigo
      "#9333ea", // purple
      "#22c55e", // green
      "#eab308", // yellow
      "#f97316", // orange
    ];

    // Simple hash to pick a stable color from the palette
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % palette.length;
    return palette[index];
  }

  async executeRawCommand(repoPath: string, command: string): Promise<{ success: boolean; stdout: string; stderr: string }> {
    // Basic sanitization: split by spaces but respect quotes
    const args = command.trim().split(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(arg => arg.replace(/^"|"$/g, ''));
    
    // If command starts with 'git', remove it
    if (args[0] === 'git') {
      args.shift();
    }

    if (args.length === 0) {
      return { success: false, stdout: '', stderr: 'Empty command' };
    }

    // 1. Security: Command Whitelist (Strictly block aliases and dangerous subcommands)
    const ALLOWED_COMMANDS = new Set([
      "status", "log", "fetch", "pull", "push", "checkout", "branch", 
      "stash", "tag", "commit", "add", "diff", "reset", "restore", 
      "switch", "merge", "rebase", "cherry-pick", "revert", "clean", 
      "remote", "show", "rev-parse", "ls-files", "ls-tree"
    ]);

    const subcommand = args[0];
    if (!ALLOWED_COMMANDS.has(subcommand)) {
      return { 
        success: false, 
        stdout: '', 
        stderr: `Security Error: Command '${subcommand}' is not allowed.` 
      };
    }

    // 2. Security: Block configuration overrides and aliases
    const hasDangerousFlags = args.some(arg => 
      arg === '-c' || arg.startsWith('--config') || 
      arg.startsWith('--exec-path') || arg.startsWith('--work-tree') ||
      arg.startsWith('--git-dir')
    );

    if (hasDangerousFlags) {
      return { 
        success: false, 
        stdout: '', 
        stderr: `Security Error: Global flag overrides are blocked.` 
      };
    }

    try {
      const stdout = await this.run(args, repoPath);
      return { success: true, stdout, stderr: '' };
    } catch (error: any) {
      return { success: false, stdout: '', stderr: error.message || 'Unknown error' };
    }
  }

  async squash(repoPath: string, commitHashes: string[]): Promise<void> {
    if (commitHashes.length < 2) {
      throw new Error("Select at least 2 commits to squash.");
    }

    try {
      // 1. Get detailed info for all selected commits to find the oldest one
      const commitDetails = await Promise.all(
        commitHashes.map(hash => this.getCommitDetails(repoPath, hash))
      );

      // Sort by timestamp ascending (oldest first)
      commitDetails.sort((a, b) => a.timestamp - b.timestamp);

      const oldestCommit = commitDetails[0];
      const newestCommit = commitDetails[commitDetails.length - 1];

      // 2. Security/Sanity Check: Ensure the current HEAD is the tip of the selection
      // (or at least that the selection is a logical range on the current branch)
      const currentHead = await this.getCurrentHead(repoPath);
      
      // In a real 'Squash', we usually squash into the parent of the oldest commit.
      // We'll use a soft reset approach which is safe and intuitive for a GUI.
      
      const parentOfOldest = oldestCommit.parents[0];
      if (!parentOfOldest) {
        throw new Error("Cannot squash the root commit.");
      }

      // 3. Perform the soft reset to the parent of the oldest selected commit.
      // This effectively 'uncommits' everything after that parent but keeps changes STAGED.
      // IMPORTANT: If current HEAD is NOT the newest commit in selection, 
      // we should probably warn or checkout the newest one first.
      if (currentHead !== newestCommit.hash) {
         // Optionally checkout the newest commit first to ensure we capture all changes
         await this.run(["checkout", newestCommit.hash], repoPath);
      }

      await this.run(["reset", "--soft", parentOfOldest], repoPath);
      
      // The changes are now staged. The UI will pick this up and show them in 'Changes' view.
    } catch (error: any) {
      logError("GitService", `Squash failed: ${error}`);
      throw error;
    }
  }
}
