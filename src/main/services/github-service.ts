import { net } from "electron";
import { GitService } from "./git-service";
import { SettingsService } from "./settings-service";
import { logError } from "./logger-service";
import { WorkflowRun } from "../../shared/types";

export class GitHubService {
  private remoteUrlCache: Map<string, string | null> = new Map();
  private nonGitHubRepos: Set<string> = new Set();

  constructor(
    private gitService: GitService,
    private settingsService: SettingsService
  ) {}

  async validateGitHubToken(token: string): Promise<boolean> {
    try {
      await this.fetchWithAuth("https://api.github.com/user", token);
      // Clear negative caches when a token is validated to allow recovery
      this.nonGitHubRepos.clear();
      this.remoteUrlCache.clear();
      return true;
    } catch (error) {
      logError("GitHubService", `Token validation failed: ${error}`);
      return false;
    }
  }

  async getWorkflowRuns(repoPath: string, branchName?: string): Promise<WorkflowRun[]> {
    const settings = await this.settingsService.getSettings();
    if (!settings.githubToken) {
      return [];
    }

    try {
      // 1. Get and verify Remote URL
      let remoteUrl = this.remoteUrlCache.get(repoPath);
      
      // If not in cache or previously determined as non-github, try one last time to be sure
      if (remoteUrl === undefined || this.nonGitHubRepos.has(repoPath)) {
        const fetchedUrl = await this.getRemoteUrl(repoPath);
        
        if (!fetchedUrl || !this.isGitHubUrl(fetchedUrl)) {
          this.remoteUrlCache.set(repoPath, null);
          this.nonGitHubRepos.add(repoPath);
          return [];
        }
        
        remoteUrl = fetchedUrl;
        this.remoteUrlCache.set(repoPath, fetchedUrl);
        this.nonGitHubRepos.delete(repoPath); // It's a GitHub repo now!
      }
      
      if (!remoteUrl) return [];

      // 2. Parse Owner/Repo
      const repoInfo = this.parseRepoInfo(remoteUrl);
      if (!repoInfo) return [];

      // 3. Construct API URL with branch filtering for accuracy
      let apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/actions/runs?per_page=50`;
      if (branchName) {
        apiUrl += `&branch=${encodeURIComponent(branchName)}`;
      }
      
      // 4. Fetch
      const response = await this.fetchWithAuth(apiUrl, settings.githubToken);
      if (!response || !response.workflow_runs) return [];

      return response.workflow_runs.map((run: any) => {
        // High-fidelity title resolution: Prefer commit message for build/release workflows
        const isGenericTitle = !run.display_title || run.display_title === run.name || run.display_title.includes('.yml');
        const commitMessage = run.head_commit?.message;
        const displayTitle = (isGenericTitle && commitMessage) ? commitMessage.split('\n')[0] : (run.display_title || run.name);

        return {
          id: run.id,
          name: run.name,
          head_branch: run.head_branch,
          head_sha: run.head_sha,
          status: run.status,
          conclusion: run.conclusion,
          html_url: run.html_url,
          created_at: run.created_at,
          updated_at: run.updated_at,
          run_number: run.run_number,
          event: run.event,
          display_title: displayTitle,
          head_commit: run.head_commit ? {
            id: run.head_commit.id,
            message: run.head_commit.message,
            timestamp: run.head_commit.timestamp,
            author: {
              name: run.head_commit.author?.name || "Unknown",
              email: run.head_commit.author?.email || ""
            }
          } : undefined,
          actor: {
            login: run.actor?.login || "github-actions"
          }
        };
      });

    } catch (error: any) {
      const status = error.message?.match(/\((\d+)\)/)?.[1];
      
      if (status === "401" || status === "403") {
        // Auth issues should be reported to the user, not blacklisted as "non-github"
        throw error;
      }
      
      if (status === "404") {
        // Only blacklist on 404 if we're sure the token is valid (token validation happens elsewhere)
        this.nonGitHubRepos.add(repoPath);
      }
      
      console.error("GitHub API Error:", error);
      return [];
    }
  }

  private isGitHubUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes("github.com");
  }

  private async getRemoteUrl(repoPath: string): Promise<string | null> {
    try {
      // Accessing the private 'run' method of GitService via a public helper would be better,
      // but for now we can assume GitService might expose a run command or we create a specific one.
      // Let's add a public `getRemoteOriginUrl` to GitService or use a direct spawn here?
      // Better to keep git logic in GitService. 
      // I'll assume GitService has been updated or I'll hack it here with a direct call if needed,
      // but let's try to add it to GitService first.
      // Wait, I can't modify GitService easily from here without checking it.
      // Let's assume I will add `getRemoteUrl` to GitService next.
      return await this.gitService.getRemoteUrl(repoPath); 
    } catch {
      return null;
    }
  }

  private parseRepoInfo(remoteUrl: string): { owner: string; repo: string } | null {
    try {
      let url = remoteUrl.trim();
      // Remove .git suffix
      if (url.endsWith(".git")) {
        url = url.slice(0, -4);
      }

      // Handle SSH: git@github.com:user/repo OR ssh://git@github.com/user/repo
      if (url.includes("@github.com")) {
        const parts = url.split("github.com")[1];
        // parts will be ":user/repo" or "/user/repo"
        const cleanPath = parts.startsWith(":") || parts.startsWith("/") ? parts.substring(1) : parts;
        const [owner, repo] = cleanPath.split("/");
        if (owner && repo) return { owner, repo };
      }

      // Handle HTTPS: https://github.com/user/repo
      if (url.startsWith("http")) {
        const urlObj = new URL(url);
        const parts = urlObj.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
        }
      }
    } catch (e) {
      console.error("Failed to parse remote URL:", remoteUrl);
    }
    return null;
  }

  private fetchWithAuth(url: string, token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = net.request(url);
      request.setHeader("Authorization", `Bearer ${token}`);
      request.setHeader("Accept", "application/vnd.github.v3+json");
      request.setHeader("User-Agent", "GitCanopy");

      request.on("response", (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk.toString();
        });
        response.on("end", () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          } else {
            // Provide a clean error message without potentially sensitive response data
            const errorMsg = `GitHub API error (${response.statusCode})`;
            reject(new Error(errorMsg));
          }
        });
        response.on("error", (error: any) => reject(error));
      });
      request.on("error", (error: any) => reject(error));
      request.end();
    });
  }
}
