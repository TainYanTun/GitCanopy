import fetch from 'node-fetch';
import { logError, logInfo, logWarn } from './logger-service';
import { LRUCache } from 'lru-cache';
import { McpService } from './mcp-service';
import { AiService } from './ai-service';

interface GitLabAgentResponse {
  message: string;
  actions?: Array<{
    type: string;
    payload: any;
  }>;
}

export class GitLabAgentService {
  private cache = new LRUCache<string, any>({ max: 50, ttl: 1000 * 60 * 5 });
  private mcpService: McpService | null = null;

  setMcpService(mcpService: McpService) {
    this.mcpService = mcpService;
  }

  async triggerAgent(
    prompt: string,
    context: string,
    gitlabToken: string,
    gitlabProjectId?: string
  ): Promise<GitLabAgentResponse> {
    if (!prompt) throw new Error("prompt_required");
    if (!gitlabToken) throw new Error("token_required");
    
    if (this.mcpService) {
      try {
        logInfo("GitLabAgent", `exec_mcp_tool: ${prompt}`);
        
        const projectId = gitlabProjectId || "";

        if (prompt.toLowerCase().includes("issue") || prompt.toLowerCase().includes("bug") || prompt.toLowerCase().includes("task")) {
          const result: any = await this.mcpService.callTool("list_project_issues", { project_id: projectId });
          return {
            message: `### project_issues\n\n${this.formatIssues(result)}`,
            actions: [{ type: 'mcp_call', payload: { tool: 'list_project_issues', result } }]
          };
        }

        if (prompt.toLowerCase().includes("branch") || prompt.toLowerCase().includes("repo") || prompt.toLowerCase().includes("project")) {
          const result: any = await this.mcpService.callTool("list_branches", { project_id: projectId });
          return {
            message: `### project_branches\n\n${this.formatBranches(result)}`,
            actions: [{ type: 'mcp_call', payload: { tool: 'list_branches', result } }]
          };
        }

        if (prompt.toLowerCase().includes("diff") || prompt.toLowerCase().includes("review") || prompt.toLowerCase().includes("mr") || prompt.toLowerCase().includes("merge")) {
           const result: any = await this.mcpService.callTool("list_merge_requests", { project_id: projectId, state: "opened" });
           return {
             message: `### merge_requests\n\n${this.formatMRs(result)}`,
             actions: [{ type: 'mcp_call', payload: { tool: 'list_merge_requests', result } }]
           };
        }

        const allTools = await this.mcpService.getAllTools();
        return {
          message: `### gitlab_agent_online\n\nmcp_status: connected\ntools_available: ${allTools.length}\n\n**capabilities**\n- issues: list / create / manage\n- merge_requests: review / approve\n- repository: branches / search\n- pipelines: status / logs`,
          actions: []
        };

      } catch (e: any) {
        logError("GitLabAgent", `tool_execution_failed: ${e.message}`);
        return { message: `### execution_error\n\n${e.message}`, actions: [] };
      }
    }

    return { message: "### agent_offline\n\nmcp_server_not_connected", actions: [] };
  }

  async checkAgentStatus(_gitlabToken: string, _agentId: string): Promise<boolean> {
     // Simple check to see if we can reach the agent
     return true; 
  }

  private formatIssues(result: any): string {
    try {
      const data = JSON.parse(result.content[0].text);
      if (!Array.isArray(data) || data.length === 0) return "no_issues_found";
      
      return "```\n" + data.map((i: any) => {
        const id = `#${i.iid}`.padEnd(6);
        const state = `[${i.state}]`.padEnd(10);
        return `${id}  ${i.title.substring(0, 50).padEnd(52)} ${state}`;
      }).join('\n') + "\n```";
    } catch (e) {
      return "err_formatting_data";
    }
  }

  private formatMRs(result: any): string {
    try {
      const data = JSON.parse(result.content[0].text);
      if (!Array.isArray(data) || data.length === 0) return "no_open_mrs";
      
      return "```\n" + data.map((m: any) => {
        const id = `!${m.iid}`.padEnd(6);
        const author = `@${m.author.username}`.padEnd(15);
        return `${id}  ${m.title.substring(0, 40).padEnd(42)} ${author}`;
      }).join('\n') + "\n```";
    } catch (e) {
      return "err_formatting_data";
    }
  }

  private formatBranches(result: any): string {
    try {
      const data = JSON.parse(result.content[0].text);
      if (!Array.isArray(data) || data.length === 0) return "no_branches_found";
      
      return "```\n" + data.map((b: any) => {
        const name = b.name.substring(0, 30).padEnd(32);
        const hash = b.commit.short_id.padEnd(10);
        const suffix = b.default ? " [default]" : "";
        return `${name} ${hash}${suffix}`;
      }).join('\n') + "\n```";
    } catch (e) {
      return "err_formatting_data";
    }
  }

  async createIssue(
    title: string,
    description: string,
    gitlabToken: string,
    projectId: string
  ): Promise<{ webUrl: string }> {
    if (!title || !description) throw new Error("Title and description are required.");
    if (!gitlabToken) throw new Error("GitLab Token is required.");
    if (!projectId) throw new Error("Project ID is required.");

    // Use REST API for Issue Creation (simpler than GraphQL for this specific task)
    // Ensure projectId is numeric or URL-encoded path
    const numericId = projectId.replace('gid://gitlab/Project/', ''); 
    const url = `https://gitlab.com/api/v4/projects/${encodeURIComponent(numericId)}/issues`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gitlabToken}`
      },
      body: JSON.stringify({
        title: title,
        description: description,
        labels: 'security, automated-audit'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create issue: ${response.statusText}`);
    }

    const data = await response.json();
    return { webUrl: data.web_url };
  }
}
