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
      
      // If not in cache, try to fetch it
      if (remoteUrl === undefined) {
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
    try {
      const lower = url.toLowerCase().trim();
      
      // Handle SSH format: git@github.com:owner/repo
      if (lower.startsWith("git@github.com:")) {
        return true;
      }

      // Handle standard URL formats
      const parsed = new URL(url);
      return parsed.hostname === "github.com";
    } catch {
      // If URL parsing fails, check if it's a valid git SSH short-format manually
      return /^git@github\.com:[\w.-]+\/[\w.-]+(?:\.git)?$/.test(url.trim());
    }
  }

  private async getRemoteUrl(repoPath: string): Promise<string | null> {
    try {
      return await this.gitService.getRemoteUrl(repoPath); 
    } catch {
      return null;
    }
  }

  private parseRepoInfo(remoteUrl: string): { owner: string; repo: string } | null {
    try {
      const url = remoteUrl.trim();
      
      // 1. Handle HTTPS/Standard URLs
      if (url.startsWith("http") || url.startsWith("git://") || url.startsWith("ssh://")) {
        const urlObj = new URL(url.startsWith("git@") ? `ssh://${url}` : url);
        if (urlObj.hostname !== "github.com") return null;

        const parts = urlObj.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          const owner = parts[parts.length - 2];
          const repo = parts[parts.length - 1].replace(/\.git$/, "");
          return { owner, repo };
        }
      }

      // 2. Handle SSH short format: git@github.com:owner/repo.git
      if (url.startsWith("git@github.com:")) {
        const pathPart = url.substring("git@github.com:".length);
        const [owner, repoWithGit] = pathPart.split("/");
        if (owner && repoWithGit) {
          const repo = repoWithGit.replace(/\.git$/, "");
          return { owner, repo };
        }
      }
    } catch (e) {
      logError("GitHubService", `Failed to parse remote URL: ${remoteUrl}`);
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
