import {
  app,
  BrowserWindow,
  Menu,
  shell,
  ipcMain,
  dialog,
  clipboard,
} from "electron";
import * as path from "path";
import * as fs from "fs";
import { isDev, checkGitInstallation } from "./utils";
import { GitService } from "./services/git-service";
import { RepositoryWatcher } from "./services/repository-watcher";
import { SettingsService } from "./services/settings-service";
import { AuthService } from "./services/auth-service";
import { UpdateService } from "./services/update-service";
import { GitHubService } from "./services/github-service";
import { AiService } from "./services/ai-service";
import { GitLabAgentService } from "./services/gitlab-duo-service";
import { McpService } from "./services/mcp-service";
import { logInfo, logError, logWarn } from "./services/logger-service";
import { CommitFilterOptions } from "../shared/types";

class GitCanopyApp {
  private mainWindow: BrowserWindow | null = null;
  private gitService: GitService;
  private repositoryWatcher: RepositoryWatcher;
  private settingsService: SettingsService;
  private authService: AuthService;
  private updateService: UpdateService;
  private githubService: GitHubService;
  private aiService: AiService;
  private gitLabAgentService: GitLabAgentService;
  private mcpService: McpService;

  constructor() {
    this.authService = new AuthService();
    this.gitService = new GitService(this.authService);
    this.repositoryWatcher = new RepositoryWatcher();
    this.settingsService = new SettingsService();
    this.updateService = new UpdateService();
    this.githubService = new GitHubService(this.gitService, this.settingsService);
    this.aiService = new AiService();
    this.gitLabAgentService = new GitLabAgentService();
    this.mcpService = new McpService();
    this.gitLabAgentService.setMcpService(this.mcpService);
    this.initializeApp();
  }

  private initializeApp(): void {
    // Handle app ready
    app.whenReady().then(async () => {
      logInfo("App", "Application starting...");
      try {
        const isGitInstalled = await checkGitInstallation();
        if (!isGitInstalled) {
          logError("App", "Git not found");
          dialog.showErrorBox(
            "Git Not Found",
            "Git is required to run GitCanopy. Please install Git and add it to your PATH, then restart the application.",
          );
          app.quit();
          return;
        }

        const settings = await this.settingsService.getSettings();
        if (settings.recentRepositories) {
          settings.recentRepositories.forEach(repo => this.gitService.addAllowedRepository(repo));
        }

        if (settings.gitlabToken) {
          logInfo("App", "Connecting to GitLab MCP server...");
          this.mcpService.connectGitLab(settings.gitlabToken).catch(err => {
            logError("App", `Auto-connect GitLab MCP failed: ${err}`);
          });
        }

        await this.createWindow();
        this.setupIpcHandlers();
        this.setupMenu();

        // Check for updates after window is ready
        setTimeout(() => {
          this.updateService.checkForUpdates();
        }, 3000);
      } catch (error) {
        logError("App", error);
        console.error("Failed to initialize application:", error);
        dialog.showErrorBox(
          "Initialization Error",
          `Failed to start the application: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    });

    // Quit when all windows are closed (except on macOS)
    app.on("window-all-closed", () => {
      this.mcpService.shutdown();
      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    // On macOS, re-create window when dock icon is clicked
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    app.on("will-quit", () => {
      this.mcpService.shutdown();
    });

    // Security: Prevent new window creation
    app.on("web-contents-created", (_, contents) => {
      // Disable Node.js integration in every webview
      contents.on("will-attach-webview", (event, webPreferences) => {
        // Strip away preload scripts if unused or verify their location is legitimate
        delete webPreferences.preload;

        // Disable Node.js integration
        webPreferences.nodeIntegration = false;
        webPreferences.contextIsolation = true;
        event.preventDefault();
      });

      // 1. Block navigation to external sites (only allow 'self')
      contents.on("will-navigate", (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        
        if (isDev) {
          if (parsedUrl.origin !== "http://localhost:3000") {
            event.preventDefault();
          }
        } else {
          // In production, ensure the navigation is strictly to the local file schema
          if (parsedUrl.protocol !== "file:") {
            event.preventDefault();
          }
        }
      });

      // 2. Prevent the app from opening new windows
      contents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
      });

      // 3. Disable webview tags
      contents.on("will-attach-webview", (event) => {
        event.preventDefault();
      });

      // 4. Deny all permission requests (camera, mic, notifications, etc.)
      contents.session.setPermissionRequestHandler(
        (_webContents, _permission, callback) => {
          callback(false);
        },
      );
    });
  }

  private async createWindow(): Promise<void> {
    const settings = await this.settingsService.getSettings();
    const windowState = (settings as any).windowState || {
      width: 1400,
      height: 900,
      x: undefined,
      y: undefined,
    };

    const preloadPath = app.isPackaged
      ? path.join(app.getAppPath(), "dist/preload/preload/preload.js")
      : path.join(__dirname, "../../preload/preload/preload.js");
    
    logInfo("App", `Preload path: ${preloadPath}`);
    if (!fs.existsSync(preloadPath)) {
      logError("App", `Preload script not found at: ${preloadPath}`);
    }

    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: windowState.width,
      height: windowState.height,
      x: windowState.x,
      y: windowState.y,
      minWidth: 800,
      minHeight: 600,
      show: false,
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: preloadPath,
        webSecurity: true,
        allowRunningInsecureContent: false,
        // Prevent Chromium from throttling JS timers (including watcher debounce)
        // when the window is moved to the background, but only in Dev.
        backgroundThrottling: !isDev,
      },
    });
    // Load the renderer

    if (isDev) {
      this.mainWindow.loadURL("http://localhost:3000");
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(
        path.join(__dirname, "../../renderer/index.html"),
      );
    }

    // Show window when ready to prevent visual flash
    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow?.show();
      if (this.mainWindow) {
        this.authService.setMainWindow(this.mainWindow);
        this.updateService.setMainWindow(this.mainWindow);
      }

      if (isDev) {
        this.mainWindow?.webContents.openDevTools();
      }
    });

    // Handle window closed
    this.mainWindow.on("close", async () => {
      if (this.mainWindow) {
        const bounds = this.mainWindow.getBounds();
        const currentSettings = await this.settingsService.getSettings();
        await this.settingsService.saveSettings({
          ...currentSettings,
          windowState: bounds,
        } as any);
      }
    });

    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });
  }

  private setupMenu(): void {
    if (process.platform === "darwin") {
      const template: Electron.MenuItemConstructorOptions[] = [
        {
          label: app.getName(),
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
        {
          label: "File",
          submenu: [
            {
              label: "Open Repository...",
              accelerator: "CmdOrCtrl+O",
              click: () => {
                this.mainWindow?.webContents.send("menu:open-repository");
              },
            },
            {
              label: "Branch Switcher...",
              accelerator: "CmdOrCtrl+B",
              click: () => {
                this.mainWindow?.webContents.send("menu:open-branch-switcher");
              },
            },
            {
              label: "Sync Repository",
              accelerator: "CmdOrCtrl+R",
              click: () => {
                this.mainWindow?.webContents.send("menu:sync-repository");
              },
            },
            { type: "separator" },
            { role: "close" },
          ],
        },
        {
          label: "Edit",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" },
          ],
        },
        {
          label: "View",
          submenu: [
            { role: "reload" },
            { role: "forceReload" },
            { role: "toggleDevTools" },
            { type: "separator" },
            { role: "resetZoom" },
            { role: "zoomIn" },
            { role: "zoomOut" },
            { type: "separator" },
            { role: "togglefullscreen" },
          ],
        },
        {
          label: "Window",
          submenu: [
            { role: "minimize" },
            { role: "zoom" },
            { type: "separator" },
            { role: "front" },
          ],
        },
      ];

      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    } else {
      // Windows and Linux menu
      const template: Electron.MenuItemConstructorOptions[] = [
        {
          label: "File",
          submenu: [
            {
              label: "Open Repository...",
              accelerator: "CmdOrCtrl+O",
              click: () => {
                this.mainWindow?.webContents.send("menu:open-repository");
              },
            },
            {
              label: "Branch Switcher...",
              accelerator: "CmdOrCtrl+B",
              click: () => {
                this.mainWindow?.webContents.send("menu:open-branch-switcher");
              },
            },
            {
              label: "Sync Repository",
              accelerator: "CmdOrCtrl+R",
              click: () => {
                this.mainWindow?.webContents.send("menu:sync-repository");
              },
            },
            { type: "separator" },
            { role: "quit" },
          ],
        },
        {
          label: "Edit",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" },
          ],
        },
        {
          label: "View",
          submenu: [
            { role: "reload" },
            { role: "forceReload" },
            { role: "toggleDevTools" },
            { type: "separator" },
            { role: "resetZoom" },
            { role: "zoomIn" },
            { role: "zoomOut" },
            { type: "separator" },
            { role: "togglefullscreen" },
          ],
        },
      ];

      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    }
  }

  private setupIpcHandlers(): void {
    // Repository operations
    ipcMain.handle("select-repository", () => this.handleSelectRepository());
    ipcMain.handle("select-directory", () => this.handleSelectDirectory());
    ipcMain.handle("get-repository", async (_, path: string) => {
      this.gitService.addAllowedRepository(path);
      const repository = await this.gitService.getRepository(path);
      await this.settingsService.addRecentRepository(path);
      return repository;
    });
    ipcMain.handle("get-status", (_, repoPath: string) =>
      this.gitService.getStatus(repoPath),
    );
    ipcMain.handle("clone", async (event, url: string, targetPath: string) =>
      this.gitService.clone(url, targetPath, (progress) => {
        event.sender.send("clone-progress", progress);
      }),
    );
    ipcMain.handle("clone-to-parent", async (event, url: string, parentPath: string) =>
      this.gitService.cloneToParent(url, parentPath, (progress) => {
        event.sender.send("clone-progress", progress);
      }),
    );
    ipcMain.handle("stage-file", (_, repoPath: string, filePath: string) =>
      this.gitService.stageFile(repoPath, filePath),
    );
    ipcMain.handle("stage-all", (_, repoPath: string) =>
      this.gitService.stageAll(repoPath),
    );
    ipcMain.handle("unstage-file", (_, repoPath: string, filePath: string) =>
      this.gitService.unstageFile(repoPath, filePath),
    );
    ipcMain.handle("unstage-all", (_, repoPath: string) =>
      this.gitService.unstageAll(repoPath),
    );
    ipcMain.handle("discard-changes", (_, repoPath: string, filePath: string) =>
      this.gitService.discardChanges(repoPath, filePath),
    );
    ipcMain.handle("commit", async (_, repoPath: string, message: string) => {
      this.repositoryWatcher.pause();
      try {
        await this.gitService.commit(repoPath, message);
      } finally {
        this.repositoryWatcher.resume();
      }
    });
    ipcMain.handle("push", async (_, repoPath: string) => {
      await this.gitService.push(repoPath);
      this.mainWindow?.webContents.send("push-completed");
    });
    ipcMain.handle("force-push", async (_, repoPath: string) => {
      await this.gitService.forcePush(repoPath);
      this.mainWindow?.webContents.send("push-completed");
    });
    ipcMain.handle("reset-hard", (_, repoPath: string, target: string) =>
      this.gitService.resetHard(repoPath, target),
    );

    // Git data operations
    ipcMain.handle(
      "get-commits",
      (
        _,
        repoPath: string,
        limit?: number,
        offset?: number,
        options?: CommitFilterOptions,
      ) => this.gitService.getCommits(repoPath, limit, offset, options),
    );
    ipcMain.handle("get-recent-commits", async (_, repoPath: string) => {
      const LIMIT = 5; // Display the last 5 commits
      return this.gitService.getCommits(repoPath, LIMIT, 0);
    });
    ipcMain.handle("get-branches", (_, repoPath: string) =>
      this.gitService.getBranches(repoPath),
    );
    ipcMain.handle("get-current-head", (_, repoPath: string) =>
      this.gitService.getCurrentHead(repoPath),
    );
    ipcMain.handle(
      "checkout-branch",
      async (_, repoPath: string, branchName: string) => {
        this.repositoryWatcher.pause();
        try {
          await this.gitService.checkoutBranch(repoPath, branchName);
        } finally {
          this.repositoryWatcher.resume();
        }
      }
    );
    ipcMain.handle(
      "git:merge-branch",
      async (_, repoPath: string, branchName: string) => {
        this.repositoryWatcher.pause();
        try {
          await this.gitService.mergeBranch(repoPath, branchName);
        } finally {
          this.repositoryWatcher.resume();
        }
      }
    );
    ipcMain.handle("get-stash-list", (_, repoPath: string) =>
      this.gitService.getStashList(repoPath),
    );
    ipcMain.handle("git:get-stash-files", (_, repoPath, index: string) =>
      this.gitService.getStashFiles(repoPath, index),
    );
    ipcMain.handle("git:get-stash-file-diff", (_, repoPath, index: string, filePath: string) =>
      this.gitService.getStashFileDiff(repoPath, index, filePath),
    );
    ipcMain.handle("git:stash", async (_, repoPath: string) => {
      this.repositoryWatcher.pause();
      try {
        await this.gitService.stash(repoPath);
      } finally {
        this.repositoryWatcher.resume();
      }
    });
    ipcMain.handle("git:apply-stash", async (_, repoPath: string, index: string) => {
      this.repositoryWatcher.pause();
      try {
        await this.gitService.applyStash(repoPath, index);
      } finally {
        this.repositoryWatcher.resume();
      }
    });
    ipcMain.handle("git:drop-stash", (_, repoPath: string, index: string) =>
      this.gitService.dropStash(repoPath, index),
    );

    // Tag operations
    ipcMain.handle("git:create-tag", (_, repoPath: string, tagName: string, commitHash?: string, message?: string) =>
      this.gitService.createTag(repoPath, tagName, commitHash, message),
    );
    ipcMain.handle("git:delete-tag", (_, repoPath: string, tagName: string) =>
      this.gitService.deleteTag(repoPath, tagName),
    );
    ipcMain.handle("git:push-tag", (_, repoPath: string, tagName: string) =>
      this.gitService.pushTag(repoPath, tagName),
    );
    ipcMain.handle("git:get-tags", (_, repoPath: string) =>
      this.gitService.getTagsList(repoPath),
    );
    ipcMain.handle("get-reflog", (_, repoPath: string, limit?: number) =>
      this.gitService.getReflog(repoPath, limit),
    );

    // Initial Path Handling
    ipcMain.handle("get-initial-repo", () => {
      const args = isDev ? process.argv.slice(2) : process.argv.slice(1);
      const lastArg = args[args.length - 1];

      if (lastArg && !lastArg.startsWith("-")) {
        const absolutePath = path.resolve(lastArg);

        if (
          fs.existsSync(absolutePath) &&
          fs.statSync(absolutePath).isDirectory()
        ) {
          this.gitService.addAllowedRepository(absolutePath);
          return absolutePath;
        }
      }
      return null;
    });
    ipcMain.handle("get-app-version", () => {
      let version = app.getVersion();
      // If we're in dev mode, sometimes app.getVersion() returns Electron version
      if (isDev) {
        try {
          const pkgPath = path.join(__dirname, "../../../package.json");
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            version = pkg.version;
          }
        } catch (e) {
          logError("App", `Failed to read package.json version: ${e}`);
        }
      }
      return version;
    });
    ipcMain.handle(
      "get-commit-details",
      (_, repoPath: string, commitHash: string) =>
        this.gitService.getCommitDetails(repoPath, commitHash),
    );
    ipcMain.handle("git:get-diff", (_, repoPath, commitHash, filePath) =>
      this.gitService.getDiff(repoPath, commitHash, filePath),
    );
    ipcMain.handle("git:get-file-content", (_, repoPath, filePath) =>
      this.gitService.getFileContent(repoPath, filePath),
    );
    ipcMain.handle("git:resolve-conflict", (_, repoPath, filePath, content) =>
      this.gitService.resolveConflict(repoPath, filePath, content),
    );
    ipcMain.handle("squash", (_, repoPath: string, commitHashes: string[]) =>
      this.gitService.squash(repoPath, commitHashes),
    );

    // AI Operations
    ipcMain.handle("generate-commit-message", async (_, repoPath: string) => {
      const diff = await this.gitService.getStagedDiff(repoPath);
      if (!diff || !diff.trim()) {
        throw new Error("No staged changes found. Please stage your changes first.");
      }

      const settings = await this.settingsService.getSettings();
      const provider = settings.aiProvider || 'gemini';
      const apiKey = provider === 'gemini' ? settings.aiApiKey : 
                     provider === 'openai' ? settings.openaiApiKey : 
                     settings.claudeApiKey;
      const model = provider === 'gemini' ? settings.geminiModel :
                    provider === 'openai' ? settings.openaiModel :
                    settings.claudeModel;

      if (!apiKey) {
        throw new Error(`AI API Key for ${provider} not found. Please configure it in Settings.`);
      }

      return this.aiService.generateCommitMessage(diff, apiKey, provider, model);
    });

    ipcMain.handle("resolve-conflict-with-ai", async (_, current: string, incoming: string, instruction?: string) => {
      const settings = await this.settingsService.getSettings();
      const provider = settings.aiProvider || 'gemini';
      const apiKey = provider === 'gemini' ? settings.aiApiKey : 
                     provider === 'openai' ? settings.openaiApiKey : 
                     settings.claudeApiKey;
      const model = provider === 'gemini' ? settings.geminiModel :
                    provider === 'openai' ? settings.openaiModel :
                    settings.claudeModel;

      if (!apiKey) {
        throw new Error(`AI API Key for ${provider} not found. Please configure it in Settings.`);
      }
      return this.aiService.resolveConflictWithAi(current, incoming, apiKey, provider, instruction, model);
    });

    ipcMain.handle("git:explain-diff", async (_, diff: string) => {
      const settings = await this.settingsService.getSettings();
      const provider = settings.aiProvider || 'gemini';
      const apiKey = provider === 'gemini' ? settings.aiApiKey : 
                     provider === 'openai' ? settings.openaiApiKey : 
                     settings.claudeApiKey;
      const model = provider === 'gemini' ? settings.geminiModel :
                    provider === 'openai' ? settings.openaiModel :
                    settings.claudeModel;

      if (!apiKey) {
        throw new Error(`AI API Key for ${provider} not found. Please configure it in Settings.`);
      }
      return this.aiService.explainDiff(diff, apiKey, provider, model);
    });

    ipcMain.handle("git:review-code", async (_, repoPath: string) => {
      const diff = await this.gitService.getStagedDiff(repoPath);
      if (!diff || !diff.trim()) {
        throw new Error("No staged changes found to review.");
      }

      const settings = await this.settingsService.getSettings();
      const provider = settings.aiProvider || 'gemini';
      const apiKey = provider === 'gemini' ? settings.aiApiKey : 
                     provider === 'openai' ? settings.openaiApiKey : 
                     settings.claudeApiKey;
      const model = provider === 'gemini' ? settings.geminiModel :
                    provider === 'openai' ? settings.openaiModel :
                    settings.claudeModel;

      if (!apiKey) {
        throw new Error(`AI API Key for ${provider} not found. Please configure it in Settings.`);
      }
      return this.aiService.reviewCode(diff, apiKey, provider, model);
    });

    ipcMain.handle("git:audit-security", async (_, repoPath: string) => {
      const diff = await this.gitService.getStagedDiff(repoPath);
      if (!diff || !diff.trim()) {
        throw new Error("No staged changes found to audit.");
      }

      const settings = await this.settingsService.getSettings();
      const provider = settings.aiProvider || 'gemini';
      const apiKey = provider === 'gemini' ? settings.aiApiKey : 
                     provider === 'openai' ? settings.openaiApiKey : 
                     settings.claudeApiKey;
      const model = provider === 'gemini' ? settings.geminiModel :
                    provider === 'openai' ? settings.openaiModel :
                    settings.claudeModel;

      if (!apiKey) {
        throw new Error(`AI API Key for ${provider} not found. Please configure it in Settings.`);
      }
      return this.aiService.auditSecurity(diff, apiKey, provider, model);
    });

    ipcMain.handle("git:trigger-duo-agent", async (_, prompt: string, context: string, history?: any[]) => {
      const settings = await this.settingsService.getSettings();
      if (!settings.gitlabToken) throw new Error("GitLab Personal Access Token not configured.");

      const provider = settings.aiProvider || 'gemini';
      const apiKey = provider === 'gemini' ? settings.aiApiKey : 
                     provider === 'openai' ? settings.openaiApiKey : 
                     settings.claudeApiKey;
      const model = provider === 'gemini' ? settings.geminiModel :
                    provider === 'openai' ? settings.openaiModel :
                    settings.claudeModel;

      // 1. Initial Call to Agent Service (handles @ commands directly or returns 'processing')
      const initialResponse = await this.gitLabAgentService.triggerAgent(
        prompt,
        context,
        settings.gitlabToken,
        history
      );

      // 2. Direct @ Tool Call Formatting
      const mcpCallAction = initialResponse.actions?.find(a => a.type === 'mcp_call');
      if (mcpCallAction && !initialResponse.actions?.find(a => a.type === 'agent_processing')) {
        let finalMessage = initialResponse.message;
        
        if (apiKey) {
            try {
                logInfo("App", `Attempting AI summarization for: ${prompt}`);
                const { tool, result } = mcpCallAction.payload;
                const formattedMessage = await this.aiService.summarizeAgentResult(
                    prompt,
                    tool,
                    result,
                    apiKey,
                    provider,
                    model
                );
                return {
                    ...initialResponse,
                    message: formattedMessage
                };
            } catch (err: any) {
                logWarn("App", `AI summarization failed: ${err}`);
                const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
                finalMessage = `${initialResponse.message}\n\n---\n**Notice**: ${providerName} summarization unavailable. ${err.message || "The service may be unreachable or misconfigured."} Showing raw tool output.`;
            }
        } else {
            finalMessage = `${initialResponse.message}\n\n---\n**Note**: Set up your **${provider.toUpperCase()} API Key** in **Settings** to enable AI summarization and formatting for Mycelia tools.`;
        }

        return {
            ...initialResponse,
            message: finalMessage
        };
      }

      // 3. Agentic Loop (for natural language)
      if (initialResponse.actions?.find(a => a.type === 'agent_processing')) {
        if (!apiKey) throw new Error(`${provider} API Key not configured for Agent usage.`);

        const geminiTools = this.mcpService.getGeminiTools();
        const cycleResult = await this.aiService.runAgentCycle(prompt, geminiTools, apiKey, provider, model, context, history);

        // 4. Handle Tool Calling
        if (cycleResult.toolCall) {
          const { name, args } = cycleResult.toolCall;
          
          if (!args.project_id && settings.gitlabProjectId) {
              args.project_id = settings.gitlabProjectId;
          }
          if (!args.projectId && settings.gitlabProjectId) {
              args.projectId = settings.gitlabProjectId;
          }
          if (!args.project_path && settings.gitlabProjectPath) {
              args.project_path = settings.gitlabProjectPath;
          }
          if (!args.projectPath && settings.gitlabProjectPath) {
              args.projectPath = settings.gitlabProjectPath;
          }

          // Validation: Ensure required project IDs are present before execution
          const allTools = await this.mcpService.getAllTools();
          const toolDef = allTools.find(t => t.name === name);
          if (toolDef && toolDef.inputSchema?.required) {
            const projectFields = ["project_id", "projectId", "project_path", "projectPath"];
            const requiredProjectField = toolDef.inputSchema.required.find((p: string) => projectFields.includes(p));
            
            if (requiredProjectField && !args[requiredProjectField]) {
              return {
                message: `I'm trying to use the \`${name}\` tool, but I couldn't find a **Project ID** or **Project Path**. \n\nPlease provide your GitLab Project ID or configure it in **Settings** (top bar) so I can automate this for you.`
              };
            }
          }

          logInfo("App", `Agent executing tool: ${name} with args: ${JSON.stringify(args)}`);
          const toolResult = await this.mcpService.callTool(name, args);
          
          // 5. Final Turn: Summarize results
          try {
            const summary = await this.aiService.summarizeAgentResult(prompt, name, toolResult, apiKey, provider, model);
            
            return {
              message: summary,
              actions: [{ type: 'mcp_call', payload: { tool: name, args, result: toolResult } }]
            };
          } catch (err: any) {
            logWarn("App", `Agent AI summarization failed, returning raw: ${err}`);
            const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
            return {
              message: `### tool_execution_result: ${name}\n\n${JSON.stringify(toolResult, null, 2)}\n\n---\n**Notice**: ${providerName} summarization unavailable. ${err.message || "I executed the tool successfully, but the summarization service was unreachable."} Showing raw data instead.`,
              actions: [{ type: 'mcp_call', payload: { tool: name, args, result: toolResult } }]
            };
          }
        }

        return {
          message: cycleResult.message,
          actions: []
        };
      }

      return initialResponse;
    });


    ipcMain.handle("git:check-duo-agent-status", async () => {
      const settings = await this.settingsService.getSettings();
      if (!settings.gitlabToken) return false;
      return true;
    });

    ipcMain.handle("git:create-gitlab-issue", async (_, title: string, description: string) => {
      const settings = await this.settingsService.getSettings();
      if (!settings.gitlabToken) throw new Error("GitLab Token not configured.");
      if (!settings.gitlabProjectId) throw new Error("GitLab Project ID not configured.");

      return this.gitLabAgentService.createIssue(
        title,
        description,
        settings.gitlabToken,
        settings.gitlabProjectId
      );
    });

    ipcMain.handle("git:get-team-pulse", async (_, stats: any[]) => {
      const settings = await this.settingsService.getSettings();
      const provider = settings.aiProvider || 'gemini';
      const apiKey = provider === 'gemini' ? settings.aiApiKey : 
                     provider === 'openai' ? settings.openaiApiKey : 
                     settings.claudeApiKey;
      const model = provider === 'gemini' ? settings.geminiModel :
                    provider === 'openai' ? settings.openaiModel :
                    settings.claudeModel;

      if (!apiKey) {
        throw new Error(`AI API Key for ${provider} not found. Please configure it in Settings.`);
      }
      return this.aiService.getTeamPulse(stats, apiKey, provider, model);
    });

    ipcMain.handle("translate-natural-language-to-git", async (_, query: string, context: string) => {
      const settings = await this.settingsService.getSettings();
      const provider = settings.aiProvider || 'gemini';
      const apiKey = provider === 'gemini' ? settings.aiApiKey : 
                     provider === 'openai' ? settings.openaiApiKey : 
                     settings.claudeApiKey;
      const model = provider === 'gemini' ? settings.geminiModel :
                    provider === 'openai' ? settings.openaiModel :
                    settings.claudeModel;

      if (!apiKey) {
        throw new Error(`AI API Key for ${provider} not found. Please configure it in Settings.`);
      }
      return this.aiService.translateNaturalLanguageToGit(query, context, apiKey, provider, model);
    });

    ipcMain.handle("git:analyze-error", async (_, error: string, context: string) => {
      const settings = await this.settingsService.getSettings();
      const provider = settings.aiProvider || 'gemini';
      const apiKey = provider === 'gemini' ? settings.aiApiKey : 
                     provider === 'openai' ? settings.openaiApiKey : 
                     settings.claudeApiKey;
      const model = provider === 'gemini' ? settings.geminiModel :
                    provider === 'openai' ? settings.openaiModel :
                    settings.claudeModel;

      if (!apiKey) {
        throw new Error(`AI API Key for ${provider} not found. Please configure it in Settings.`);
      }
      return this.aiService.analyzeGitError(error, context, apiKey, provider, model);
    });

    ipcMain.handle("git:get-hot-files", (_, repoPath, limit, options?: CommitFilterOptions) =>
      this.gitService.getHotFiles(repoPath, limit, options),
    );
    ipcMain.handle("git:get-work-rhythm", (_, repoPath: string) =>
      this.gitService.getWorkRhythm(repoPath),
    );
    ipcMain.handle("git:get-contributors", (_, repoPath) =>
      this.gitService.getContributors(repoPath),
    );
    ipcMain.handle(
      "get-git-command-history",
      (_, limit?: number, offset?: number) =>
        this.gitService.getCommandHistory(limit, offset),
    );
    ipcMain.handle("clear-git-command-history", () =>
      this.gitService.clearCommandHistory(),
    );
    ipcMain.handle("get-file-data-url",
      async (_, repoPath: string, filePath: string) => {
        try {
          // Security: Prevent path traversal
          const absolutePath = path.resolve(repoPath, filePath);
          const resolvedRepoPath = path.resolve(repoPath);

          if (!absolutePath.startsWith(resolvedRepoPath)) {
            logWarn("Security", `Blocked path traversal attempt: ${filePath} in ${repoPath}`);
            return null;
          }

          if (!fs.existsSync(absolutePath)) return null;

          const buffer = await fs.promises.readFile(absolutePath);
          const ext = path.extname(filePath).toLowerCase();
          let mimeType = "application/octet-stream";

          if (ext === ".png") mimeType = "image/png";
          else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
          else if (ext === ".gif") mimeType = "image/gif";
          else if (ext === ".svg") mimeType = "image/svg+xml";
          else if (ext === ".ico") mimeType = "image/x-icon";

          return `data:${mimeType};base64,${buffer.toString("base64")}`;
        } catch (error) {
          logError("App", `Failed to get file data URL: ${error}`);
          return null;
        }
      },
    );
    
    // GitHub Integration
    ipcMain.handle("get-workflow-runs", async (_, repoPath: string, branchName?: string) => {
      try {
        return await this.githubService.getWorkflowRuns(repoPath, branchName);
      } catch (err: any) {
        console.error("[get-workflow-runs] IPC error:", err?.message ?? err);
        return [];
      }
    });
    ipcMain.handle("validate-github-token", (_, token: string) => 
      this.githubService.validateGitHubToken(token)
    );

    // File system operations
    ipcMain.handle("watch-repository", (_, repoPath: string) => {
      this.repositoryWatcher.watchRepository(repoPath, (event) => {
        // Send specific event type to renderer
        this.mainWindow?.webContents.send(event.type, event);
      });
    });
    ipcMain.handle("unwatch-repository", (_, repoPath: string) =>
      this.repositoryWatcher.unwatchRepository(repoPath),
    );

    // Settings
    ipcMain.handle("get-settings", () => this.settingsService.getSettings());
    ipcMain.handle("save-settings", (_, settings) =>
      this.settingsService.saveSettings(settings),
    );
    ipcMain.handle("git:get-global-config", (_, key: string) =>
      this.gitService.getGlobalConfig(key),
    );
    ipcMain.handle("git:set-global-config", (_, key: string, value: string) =>
      this.gitService.setGlobalConfig(key, value),
    );
    ipcMain.handle("execute-raw-git-command", (_, repoPath: string, command: string) =>
      this.gitService.executeRawCommand(repoPath, command),
    );
    ipcMain.handle("clear-recent-repositories", () =>
      this.settingsService.clearRecentRepositories(),
    );

    // Utility
    ipcMain.handle("show-item-in-folder", (_, path: string) =>
      shell.showItemInFolder(path),
    );
    ipcMain.handle("copy-to-clipboard", (_, text: string) => {
      clipboard.writeText(text);
    });
    ipcMain.handle("open-external", (_, url: string) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return shell.openExternal(url);
        }
        logWarn("Security", `Blocked attempt to open invalid protocol: ${parsed.protocol}`);
        return Promise.reject(new Error("Invalid protocol"));
      } catch (e) {
        logWarn("Security", `Blocked attempt to open invalid URL: ${url}`);
        return Promise.reject(new Error("Invalid URL"));
      }
    });

    // Auth
    ipcMain.handle("auth-submit", (_, answer: string) =>
      this.authService.submitCredentials(answer),
    );
    ipcMain.handle("auth-cancel", () => this.authService.cancelAuth());

    // MCP
    ipcMain.handle("mcp:connect-server", (_, config) => this.mcpService.connectServer(config));
    ipcMain.handle("mcp:get-all-tools", () => this.mcpService.getAllTools());
    ipcMain.handle("mcp:get-servers", () => this.mcpService.getServers());
    ipcMain.handle("mcp:call-tool", (_, toolName, args) => this.mcpService.callTool(toolName, args));
  }

  private async handleSelectRepository(): Promise<any> {
    const result = await dialog.showOpenDialog(this.mainWindow!, {
      title: "Select Git Repository",
      buttonLabel: "Select Repository",
      properties: ["openDirectory"],
      message: "Select a folder containing a Git repository",
    });

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    const repoPath = result.filePaths[0];
    try {
      this.gitService.addAllowedRepository(repoPath);
      const repository = await this.gitService.getRepository(repoPath);
      await this.settingsService.addRecentRepository(repoPath);
      return repository;
    } catch (error) {
      logError("App", `Failed to load repository: ${error}`);

      dialog.showErrorBox(
        "Invalid Repository",
        `The selected folder does not contain a valid Git repository.\n\nPath: ${repoPath}\n\nError: ${error instanceof Error ? error.message : "Unknown error"}`,
      );

      return null;
    }
  }

  private async handleSelectDirectory(): Promise<string | null> {
    const result = await dialog.showOpenDialog(this.mainWindow!, {
      title: "Select Destination Directory",
      buttonLabel: "Select Directory",
      properties: ["openDirectory", "createDirectory"],
      message: "Select a folder to clone the repository into",
    });

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    return result.filePaths[0];
  }
}

// Create app instance
new GitCanopyApp();
