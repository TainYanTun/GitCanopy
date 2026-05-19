import { ChildProcess, spawn } from 'child_process';
import { logError } from './logger-service';
import { JSONRPCClient } from 'json-rpc-2.0';

interface McpTool {
  name: string;
  description?: string;
  inputSchema: any;
}

interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export class McpService {
  private clients = new Map<string, JSONRPCClient>();
  private processes = new Map<string, ChildProcess>();
  private tools = new Map<string, { serverId: string; tool: McpTool }>();

  /**
   * Connects to an MCP server via stdio
   */
  async connectServer(config: McpServerConfig): Promise<void> {
    try {
      const serverProcess = spawn(config.command, config.args || [], {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'inherit']
      });

      const client: JSONRPCClient = new JSONRPCClient((request) => {
        serverProcess.stdin?.write(JSON.stringify(request) + '\n');
        return Promise.resolve();
      });

      let buffer = '';
      serverProcess.stdout?.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            client.receive(JSON.parse(line));
          } catch (e) {
            console.error(`[MCP:${config.id}] Failed to parse JSON-RPC line`, e);
          }
        }
      });

      serverProcess.on('error', (err: Error) => {
        logError("McpService", `Server ${config.id} process error: ${err}`);
        this.cleanup(config.id);
      });

      serverProcess.on('exit', (code: number | null) => {
        if (code !== 0 && code !== null) {
          logError("McpService", `Server ${config.id} exited with code ${code}`);
        }
        this.cleanup(config.id);
      });

      this.clients.set(config.id, client);
      this.processes.set(config.id, serverProcess);

      // 1. Initialize Handshake (Mandatory for MCP)
      try {
        await client.request('initialize', {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "GitCanopy", version: "1.2.2" }
        });
        
        // Notify that initialization is complete
        client.notify('notifications/initialized', {});
      } catch (error) {
        logError("McpService", `Failed to initialize server ${config.id}: ${error}`);
      }

      // 2. Initial Tool Discovery
      await this.refreshTools(config.id);
      
      console.log(`[MCP] Connected to ${config.name} (${config.id})`);
    } catch (error) {
      logError("McpService", `Failed to connect to server ${config.id}: ${error}`);
      throw error;
    }
  }

  private async refreshTools(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client) return;

    try {
      const result: any = await client.request('tools/list', {});
      const serverTools: McpTool[] = result.tools || [];
      
      console.log(`[MCP] Discovered ${serverTools.length} tools from ${serverId}: ${serverTools.map(t => t.name).join(', ')}`);
      
      for (const tool of serverTools) {
        this.tools.set(tool.name, { serverId, tool });
      }
    } catch (error) {
      logError("McpService", `Failed to list tools for ${serverId}: ${error}`);
    }
  }

  /**
   * Connects to the official community GitLab MCP server
   */
  async connectGitLab(token: string, apiUrl?: string): Promise<void> {
    const args = [
      "-y", 
      "@zereight/mcp-gitlab", 
      `--token=${token}`
    ];
    
    if (apiUrl) {
      args.push(`--api-url=${apiUrl}`);
    }

    return this.connectServer({
      id: 'gitlab',
      name: 'GitLab',
      command: 'npx',
      args: args
    });
  }

  async getAllTools(): Promise<McpTool[]> {
    return Array.from(this.tools.values()).map(t => ({
      ...t.tool,
      serverId: t.serverId
    } as any));
  }

  async callTool(toolName: string, args: any): Promise<any> {
    const toolInfo = this.tools.get(toolName);
    if (!toolInfo) throw new Error(`Tool ${toolName} not found.`);

    const client = this.clients.get(toolInfo.serverId);
    if (!client) throw new Error(`Server ${toolInfo.serverId} is not connected.`);

    try {
      return await client.request('tools/call', {
        name: toolName,
        arguments: args
      });
    } catch (error) {
      logError("McpService", `Failed to call tool ${toolName}: ${error}`);
      throw error;
    }
  }

  private cleanSchemaForGemini(schema: any): any {
    if (!schema || typeof schema !== 'object') {
      return schema;
    }

    if (Array.isArray(schema)) {
      return schema.map(item => this.cleanSchemaForGemini(item));
    }

    const clean: any = {};

    // Handle anyOf / oneOf / allOf
    if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
      const firstValid = schema.anyOf.find((s: any) => s && (s.type || s.properties || s.items)) || schema.anyOf[0];
      return this.cleanSchemaForGemini({ ...schema, anyOf: undefined, ...firstValid });
    }
    if (schema.oneOf && Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
      const firstValid = schema.oneOf.find((s: any) => s && (s.type || s.properties || s.items)) || schema.oneOf[0];
      return this.cleanSchemaForGemini({ ...schema, oneOf: undefined, ...firstValid });
    }
    if (schema.allOf && Array.isArray(schema.allOf) && schema.allOf.length > 0) {
      const firstValid = schema.allOf.find((s: any) => s && (s.type || s.properties || s.items)) || schema.allOf[0];
      return this.cleanSchemaForGemini({ ...schema, allOf: undefined, ...firstValid });
    }

    // Handle type
    if ('type' in schema) {
      let typeVal = schema.type;
      if (Array.isArray(typeVal)) {
        const nonNullType = typeVal.find((t: any) => t !== 'null' && t !== 'undefined');
        typeVal = nonNullType || typeVal[0] || 'string';
      }

      if (typeof typeVal === 'string') {
        typeVal = typeVal.toUpperCase();
        if (['OBJECT', 'ARRAY', 'STRING', 'NUMBER', 'INTEGER', 'BOOLEAN'].includes(typeVal)) {
          clean.type = typeVal;
        } else {
          clean.type = 'STRING';
        }
      }
    } else if (schema.properties) {
      clean.type = 'OBJECT';
    }

    // Handle description
    if ('description' in schema && typeof schema.description === 'string') {
      clean.description = schema.description;
    }

    // Handle properties
    if (schema.properties && typeof schema.properties === 'object') {
      clean.properties = {};
      for (const [key, prop] of Object.entries(schema.properties)) {
        clean.properties[key] = this.cleanSchemaForGemini(prop);
      }
    }

    // Handle required
    if (schema.required && Array.isArray(schema.required)) {
      clean.required = schema.required.filter((r: any) => typeof r === 'string');
    }

    // Handle items
    if (schema.items) {
      clean.items = this.cleanSchemaForGemini(schema.items);
    }

    // Handle enum
    if (schema.enum && Array.isArray(schema.enum)) {
      clean.enum = schema.enum;
    }

    return clean;
  }

  /**
   * Formats tools for Gemini's function calling API
   */
  getGeminiTools(): any[] {
    const functionDeclarations = Array.from(this.tools.values()).map(({ tool }) => {
      const parameters = tool.inputSchema ? this.cleanSchemaForGemini(tool.inputSchema) : { type: 'OBJECT', properties: {} };
      return {
        name: tool.name,
        description: tool.description,
        parameters
      };
    });

    if (functionDeclarations.length === 0) return [];

    return [{
      function_declarations: functionDeclarations
    }];
  }

  getToolByName(name: string): McpTool | undefined {
    return this.tools.get(name)?.tool;
  }

  private cleanup(serverId: string): void {
    this.clients.delete(serverId);
    this.processes.delete(serverId);
    // Remove tools associated with this server
    for (const [name, info] of this.tools.entries()) {
      if (info.serverId === serverId) {
        this.tools.delete(name);
      }
    }
  }

  shutdown(): void {
    for (const serverId of this.processes.keys()) {
      this.processes.get(serverId)?.kill();
      this.cleanup(serverId);
    }
  }
}
