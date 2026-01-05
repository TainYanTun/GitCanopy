import { net } from "electron";
import { GitService } from "./git-service";
import { SettingsService } from "./settings-service";
import { WorkflowRun } from "../../shared/types";

export class GitHubService {
  private remoteUrlCache: Map<string, string> = new Map();

  constructor(
    private gitService: GitService,
    private settingsService: SettingsService
  ) {}

  async validateGitHubToken(token: string): Promise<boolean> {
    try {
      await this.fetchWithAuth("https://api.github.com/user", token);
      return true;
    } catch (error) {
      console.error("Token validation failed:", error);
      return false;
    }
  }

  async getWorkflowRuns(repoPath: string, _branchName?: string): Promise<WorkflowRun[]> {
    const settings = await this.settingsService.getSettings();
    if (!settings.githubToken) {
      return [];
    }

    try {
      // 1. Get Remote URL (with caching)
      let remoteUrl: string | undefined = this.remoteUrlCache.get(repoPath);
      if (!remoteUrl) {
        const fetchedUrl = await this.getRemoteUrl(repoPath);
        if (fetchedUrl) {
          remoteUrl = fetchedUrl;
          this.remoteUrlCache.set(repoPath, fetchedUrl);
        }
      }
      
      if (!remoteUrl) return [];

      // 2. Parse Owner/Repo
      const repoInfo = this.parseRepoInfo(remoteUrl);
      if (!repoInfo) return [];

      // 3. Construct API URL
      // We'll fetch the last 30 runs for the entire repository to ensure builds/releases are visible
      const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/actions/runs?per_page=30`;
      
      // 4. Fetch
      const response = await this.fetchWithAuth(apiUrl, settings.githubToken);
      if (!response.workflow_runs) return [];

      return response.workflow_runs.map((run: any) => ({
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
        event: run.event
      }));

    } catch (error) {
      // Re-throw authentication errors so the UI can handle them
      if (error instanceof Error && (error.message.includes("401") || error.message.includes("Unauthorized"))) {
        throw error;
      }
      console.error("GitHub API Error:", error);
      return [];
    }
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

      // Handle SSH: git@github.com:user/repo
      if (url.startsWith("git@")) {
        const match = url.match(/:([^/]+)\/(.+)$/);
        if (match) {
          return { owner: match[1], repo: match[2] };
        }
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
            reject(new Error(`GitHub API returned ${response.statusCode}: ${data}`));
          }
        });
        response.on("error", (error: any) => reject(error));
      });
      request.on("error", (error: any) => reject(error));
      request.end();
    });
  }
}
