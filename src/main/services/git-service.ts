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

export class GitService {
  private commandHistory: GitCommandLog[] = [];
  private maxHistorySize = 100;
  private avatarCache = new LRUCache<string, string>({ max: 500 });
  private branchesCache = new LRUCache<string, Branch[]>({ max: 10, ttl: 1000 * 30 }); // 30s cache
  private tagsCache = new LRUCache<string, Map<string, string[]>>({ max: 10, ttl: 1000 * 60 }); // 60s cache
  
  private authService: AuthService | null = null;
  private askPassScriptPath: string | null = null;

  constructor(authService?: AuthService) {
    if (authService) {
      this.authService = authService;
    }
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
      // In production, scripts are usually in Resources/app.asar.unpacked or similar
      jsPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist/main/main/scripts/askpass.js');
      if (!fs.existsSync(jsPath)) {
        // Fallback to ASAR internal
        jsPath = path.join(app.getAppPath(), 'dist/main/main/scripts/askpass.js');
      }
    } else {
      // In dev mode (built with tsc)
      // Current file: src/main/services/git-service.ts -> dist/main/main/services/git-service.js
      // Target: dist/main/main/scripts/askpass.js
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

    const hash = crypto
      .createHash("md5")
      .update(cleanEmail)
      .digest("hex");
    const url = `https://www.gravatar.com/avatar/${hash}?s=64&d=identicon`;
    
    this.avatarCache.set(cleanEmail, url);
    return url;
  }

  private async run(args: string[], cwd: string): Promise<string> {
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

    return new Promise((resolve, reject) => {
      const gitProcess = spawn("git", args, { cwd, env });
      let stdout = "";
      let stderr = "";
      const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB limit

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
          // Only reject here if it wasn't already rejected.
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
      
      const projectStart = Math.min(...allTimestamps);
      const projectEnd = Math.max(...allTimestamps);
      const duration = projectEnd - projectStart || 1;

      for (const line of lines) {
        if (line.includes('|')) {
          const [name, email, timestampStr] = line.split('|');
          const timestamp = parseInt(timestampStr, 10);
          currentAuthor = { name, email, timestamp };
          
          if (!statsMap.has(email)) {
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
          stats.firstCommit = Math.min(stats.firstCommit, timestamp);
          stats.lastCommit = Math.max(stats.lastCommit, timestamp);

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

      return { files, ahead, behind };
    } catch (error) {
      logError("GitService", `Failed to get status: ${error}`);
      return { files: [], ahead: 0, behind: 0 };
    }
  }

  async stageFile(repoPath: string, filePath: string): Promise<void> {
    await this.run(["add", "--", filePath], repoPath);
  }

  async stageAll(repoPath: string): Promise<void> {
    await this.run(["add", "."], repoPath);
  }

  async clone(url: string, targetPath: string): Promise<void> {
    const parentDir = path.dirname(targetPath);
    const repoName = path.basename(targetPath);
    // Use -- to separate URL from potentially malicious repo names starting with -
    await this.run(["clone", "--", url, repoName], parentDir);
  }

  async cloneToParent(url: string, parentPath: string): Promise<string> {
    // 1. Extract repo name
    const cleanUrl = url.replace(/\/$/, '').replace(/\.git$/, '');
    const repoName = cleanUrl.split('/').pop() || 'repository';
    
    // 2. Resolve full path
    const targetPath = path.join(parentPath, repoName);
    
    // 3. Check if exists
    if (fs.existsSync(targetPath)) {
        throw new Error(`Destination '${repoName}' already exists in selected folder.`);
    }
    
    // 4. Clone
    await this.clone(url, targetPath);
    
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
    await this.run(["commit", "-m", message], repoPath);
  }

  async push(repoPath: string): Promise<void> {
    await this.run(["push"], repoPath);
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
    const [currentBranch, headCommit, branches, isRebasing, isMerging, isDetached] = await Promise.all([
      this.getCurrentBranch(repoPath),
      this.getCurrentHead(repoPath),
      this.getBranches(repoPath),
      this.checkIsRebasing(repoPath),
      this.checkIsMerging(repoPath),
      this.checkIsDetached(repoPath)
    ]);

    return {
      path: repoPath,
      name,
      isValidGit: true,
      currentBranch,
      headCommit,
      branches,
      totalCommits: 0, // Will be calculated later
      isRebasing,
      isMerging,
      isDetached
    };
  }

  private async checkIsRebasing(repoPath: string): Promise<boolean> {
    const gitPath = path.join(repoPath, '.git');
    return fs.existsSync(path.join(gitPath, 'rebase-merge')) || 
           fs.existsSync(path.join(gitPath, 'rebase-apply'));
  }

  private async checkIsMerging(repoPath: string): Promise<boolean> {
    const gitPath = path.join(repoPath, '.git');
    return fs.existsSync(path.join(gitPath, 'MERGE_HEAD'));
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
      await this.run(["checkout", "--", branchName], repoPath);
    } catch (error) {
      logError("GitService", `Failed to checkout branch ${branchName}: ${error}`);
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

  async applyStash(repoPath: string, index: string): Promise<void> {
    await this.run(["stash", "apply", "--", index], repoPath);
  }

  async dropStash(repoPath: string, index: string): Promise<void> {
    await this.run(["stash", "drop", "--", index], repoPath);
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
      
      if (!commitHash) {
        // Unstaged or Untracked
        const status = await this.run(["status", "--porcelain", "--", filePath], repoPath);
        if (status.startsWith("??")) {
          // Untracked: Show as all additions
          try {
            const isBinary = await this.isBinaryFile(path.join(repoPath, filePath));
            if (isBinary) return "BINARY_FILE";
            
            const content = await fs.promises.readFile(path.join(repoPath, filePath), 'utf8');
            return content.split('\n').map(line => `+${line}`).join('\n');
          } catch (e) {
            return "Error reading untracked file.";
          }
        } else {
          // Tracked but unstaged
          args = ["diff", "--", filePath];
        }
      } else if (commitHash === "HEAD") {
        // Staged changes
        args = ["diff", "--cached", "--", filePath];
      } else {
        // Commit changes: Diff between commit and its parent
        args = ["diff", `${commitHash}^`, commitHash, "--", filePath];
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
}
