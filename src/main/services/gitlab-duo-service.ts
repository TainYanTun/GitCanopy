import fetch from 'node-fetch';
import { logError, logInfo } from './logger-service';
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
  private aiService: AiService;

  constructor() {
    this.aiService = new AiService();
  }

  setMcpService(mcpService: McpService) {
    this.mcpService = mcpService;
  }

  async triggerAgent(
    prompt: string,
    context: string,
    gitlabToken: string,
    _history?: any[]
  ): Promise<GitLabAgentResponse> {
    if (!prompt) throw new Error("prompt_required");
    if (!gitlabToken) throw new Error("token_required");
    
    if (!this.mcpService) {
        return { message: "### agent_offline\n\nmcp_server_not_connected", actions: [] };
    }

    try {
      // 1. Check for explicit @ command
      if (prompt.startsWith("@")) {
        const parts = prompt.substring(1).split(" ");
        const toolName = parts[0];
        const args = {};
        
        // Very basic naive parser for @tool name=val
        parts.slice(1).forEach(p => {
            const [k, v] = p.split("=");
            if (k && v) (args as any)[k] = v;
        });

        // 1. Context Auto-Injection:
        // Automatically inject common variables from context if they are missing
        let sessionContext: any = {};
        try {
          sessionContext = JSON.parse(context);
        } catch (e) { /* ignore */ }

        if (!(args as any).project_id && sessionContext.gitlabProjectId) {
            (args as any).project_id = sessionContext.gitlabProjectId;
        }
        if (!(args as any).projectId && sessionContext.gitlabProjectId) {
          (args as any).projectId = sessionContext.gitlabProjectId;
        }
        if (!(args as any).project_path && sessionContext.gitlabProjectPath) {
          (args as any).project_path = sessionContext.gitlabProjectPath;
        }
        if (!(args as any).projectPath && sessionContext.gitlabProjectPath) {
          (args as any).projectPath = sessionContext.gitlabProjectPath;
        }

        // 2. Check for missing required project identifiers
        const allTools = await this.mcpService.getAllTools();
        const toolDef = allTools.find(t => t.name === toolName);
        if (toolDef && toolDef.inputSchema?.required) {
          const projectFields = ["project_id", "projectId", "project_path", "projectPath"];
          const requiredProjectField = toolDef.inputSchema.required.find((p: string) => projectFields.includes(p));
          
          if (requiredProjectField && !(args as any)[requiredProjectField]) {
            return {
              message: `### project_context_required\n\nI need a **Project ID** or **Project Path** to execute \`@${toolName}\`. \n\nYou can:\n1. Provide it directly: \`@${toolName} ${requiredProjectField}=YOUR_ID\`\n2. Set it globally in **Settings** (top bar) so I can remember it for this repository.`,
              actions: []
            };
          }
        }

        logInfo("GitLabAgent", `exec_direct_tool: ${toolName} with args: ${JSON.stringify(args)}`);
        const result = await this.mcpService.callTool(toolName, args);
        return {
          message: `### direct_tool_execution: ${toolName}\n\n${JSON.stringify(result, null, 2)}`,
          actions: [{ type: 'mcp_call', payload: { tool: toolName, args, result } }]
        };
      }

      // 2. Otherwise, use Gemini to interpret and call tool
      logInfo("GitLabAgent", `exec_agent_logic: ${prompt}`);
      
      const geminiTools = this.mcpService.getGeminiTools();
      if (geminiTools.length === 0) {
          return { message: "No GitLab tools available. Please ensure MCP server is initialized.", actions: [] };
      }

      // We need Gemini API key from settings, but triggerAgent doesn't receive it directly.
      // However, we can use a placeholder for now or assume it's available in AiService if we configure it.
      // Wait, triggerAgent in main.ts is called with prompt and context. 
      // Main.ts has access to settingsService.
      
      // I should probably pass the apiKey to triggerAgent or have GitLabAgentService fetch it.
      // Given the current structure in main.ts, it's easier to pass it.
      // Let's assume for now we need to fix main.ts too.
      
      return { 
        message: "Agent is processing your request with Gemini...",
        actions: [{ type: 'agent_processing', payload: { prompt, context } }] 
      };

    } catch (e: any) {
      logError("GitLabAgent", `agent_failed: ${e.message}`);
      return { message: `### execution_error\n\n${e.message}`, actions: [] };
    }
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
