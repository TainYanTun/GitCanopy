import React, { useState, useEffect } from "react";
import { AppSettings } from "@shared/types";
import {
  CloseOutlined,
  SaveOutlined,
  RobotOutlined,
  GithubOutlined,
  GitlabOutlined,
  SettingOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from "@ant-design/icons";
import { useTheme } from "./ThemeContext";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { setTheme: setAppTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'github' | 'gitlab'>('general');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  // Identity state
  const [identity, setIdentity] = useState({ name: '', email: '' });

  useEffect(() => {
    if (visible) {
      window.gitcanopyAPI.getSettings().then(setSettings);
      
      // Fetch git identity
      Promise.all([
        window.gitcanopyAPI.getGlobalConfig('user.name'),
        window.gitcanopyAPI.getGlobalConfig('user.email')
      ]).then(([name, email]) => {
        setIdentity({ name, email });
      });
    }
  }, [visible]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await window.gitcanopyAPI.saveSettings(settings);
      
      // Sync theme with context
      if (settings.theme) {
        setAppTheme(settings.theme);
      }
      
      // Save git identity sequentially to avoid lock file conflicts
      await window.gitcanopyAPI.setGlobalConfig('user.name', identity.name);
      await window.gitcanopyAPI.setGlobalConfig('user.email', identity.email);
      
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !settings) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zed-dark-surface w-[600px] rounded-lg shadow-2xl border border-zed-border dark:border-zed-dark-border overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zed-border dark:border-zed-dark-border bg-zed-bg dark:bg-zed-dark-bg">
          <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <SettingOutlined /> Settings
          </h2>
          <button onClick={onClose} className="text-zed-muted hover:text-zed-text dark:text-zed-dark-muted dark:hover:text-zed-dark-text">
            <CloseOutlined />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-40 border-r border-zed-border dark:border-zed-dark-border bg-[#f8f8f8] dark:bg-zed-dark-bg/50 p-2 space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full text-left px-3 py-2 text-xs font-medium rounded ${activeTab === 'general' ? 'bg-zed-element dark:bg-zed-dark-element text-zed-text dark:text-zed-dark-text' : 'text-zed-muted hover:bg-black/5 dark:hover:bg-white/5'}`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`w-full text-left px-3 py-2 text-xs font-medium rounded flex items-center gap-2 ${activeTab === 'ai' ? 'bg-zed-element dark:bg-zed-dark-element text-zed-text dark:text-zed-dark-text' : 'text-zed-muted hover:bg-black/5 dark:hover:bg-white/5'}`}
            >
              <RobotOutlined /> AI Assistant
            </button>
             <button
              onClick={() => setActiveTab('github')}
              className={`w-full text-left px-3 py-2 text-xs font-medium rounded flex items-center gap-2 ${activeTab === 'github' ? 'bg-zed-element dark:bg-zed-dark-element text-zed-text dark:text-zed-dark-text' : 'text-zed-muted hover:bg-black/5 dark:hover:bg-white/5'}`}
            >
              <GithubOutlined /> GitHub
            </button>
            <button
              onClick={() => setActiveTab('gitlab')}
              className={`w-full text-left px-3 py-2 text-xs font-medium rounded flex items-center gap-2 ${activeTab === 'gitlab' ? 'bg-zed-element dark:bg-zed-dark-element text-zed-text dark:text-zed-dark-text' : 'text-zed-muted hover:bg-black/5 dark:hover:bg-white/5'}`}
            >
              <GitlabOutlined /> GitLab
            </button>
          </div>

          {/* Panel */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold mb-4">User Identity</h3>
                  <p className="text-[10px] text-zed-muted mb-4 leading-relaxed">
                    These settings are used for your commit authorship and are stored in your global Git configuration.
                  </p>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold opacity-70">Full Name</label>
                      <input
                        type="text"
                        value={identity.name}
                        onChange={(e) => setIdentity({ ...identity, name: e.target.value })}
                        placeholder="e.g. John Doe"
                        className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent dark:text-zed-dark-text"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold opacity-70">Email Address</label>
                      <input
                        type="email"
                        value={identity.email}
                        onChange={(e) => setIdentity({ ...identity, email: e.target.value })}
                        placeholder="e.g. john@example.com"
                        className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent dark:text-zed-dark-text"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zed-border dark:border-zed-dark-border">
                  <h3 className="text-sm font-bold mb-4">Application</h3>
                   <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-xs font-bold opacity-70">Theme</label>
                        <p className="text-[10px] text-zed-muted">Select your preferred interface style.</p>
                      </div>
                      <select
                        value={settings.theme || 'system'}
                        onChange={(e) => setSettings({ ...settings, theme: e.target.value as any })}
                        className="bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-zed-accent dark:text-zed-dark-text"
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="system">System</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold mb-4">AI Configuration</h3>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold opacity-70">Primary Provider</label>
                      <select
                        value={settings.aiProvider || 'gemini'}
                        onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value as any })}
                        className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent dark:text-zed-dark-text"
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="openai">OpenAI</option>
                        <option value="claude">Anthropic Claude</option>
                      </select>
                    </div>

                    {/* Gemini Settings */}
                    {settings.aiProvider === 'gemini' && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                        <div className="space-y-1">
                          <label className="text-xs font-bold opacity-70">Gemini Model</label>
                          <select
                            value={settings.geminiModel || 'gemini-3-flash'}
                            onChange={(e) => setSettings({ ...settings, geminiModel: e.target.value })}
                            className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent dark:text-zed-dark-text"
                          >
                            <option value="gemini-3-flash">Gemini 3 Flash</option>
                            <option value="gemini-3-pro">Gemini 3 Pro</option>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</option>
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold opacity-70">Gemini API Key</label>
                          <div className="relative">
                            <input
                              type={showKey ? "text" : "password"}
                              value={settings.aiApiKey || ''}
                              onChange={(e) => setSettings({ ...settings, aiApiKey: e.target.value })}
                              placeholder="Enter your Google API Key"
                              className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent pr-10 dark:text-zed-dark-text"
                            />
                            <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zed-muted hover:text-zed-text">
                              {showKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                            </button>
                          </div>
                          <p className="text-[10px] text-zed-muted mt-1">Get a free key at <a href="#" onClick={() => window.gitcanopyAPI.openExternal("https://aistudio.google.com/app/apikey")} className="text-blue-500 hover:underline">Google AI Studio</a>.</p>
                        </div>
                      </div>
                    )}

                    {/* OpenAI Settings */}
                    {settings.aiProvider === 'openai' && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                        <div className="space-y-1">
                          <label className="text-xs font-bold opacity-70">OpenAI Model</label>
                          <select
                            value={settings.openaiModel || 'gpt-4o'}
                            onChange={(e) => setSettings({ ...settings, openaiModel: e.target.value })}
                            className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent dark:text-zed-dark-text"
                          >
                            <option value="gpt-4o">GPT-4o (Standard)</option>
                            <option value="gpt-4o-mini">GPT-4o mini (Fast)</option>
                            <option value="o1-preview">o1 Preview (Smartest)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold opacity-70">OpenAI API Key</label>
                          <div className="relative">
                            <input
                              type={showKey ? "text" : "password"}
                              value={settings.openaiApiKey || ''}
                              onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                              placeholder="sk-..."
                              className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent pr-10 dark:text-zed-dark-text"
                            />
                            <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zed-muted hover:text-zed-text">
                              {showKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Claude Settings */}
                    {settings.aiProvider === 'claude' && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                        <div className="space-y-1">
                          <label className="text-xs font-bold opacity-70">Claude Model</label>
                          <select
                            value={settings.claudeModel || 'claude-3-5-sonnet-latest'}
                            onChange={(e) => setSettings({ ...settings, claudeModel: e.target.value })}
                            className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent dark:text-zed-dark-text"
                          >
                            <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet (Best)</option>
                            <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku (Fastest)</option>
                            <option value="claude-3-opus-latest">Claude 3 Opus</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold opacity-70">Anthropic API Key</label>
                          <div className="relative">
                            <input
                              type={showKey ? "text" : "password"}
                              value={settings.claudeApiKey || ''}
                              onChange={(e) => setSettings({ ...settings, claudeApiKey: e.target.value })}
                              placeholder="sk-ant-..."
                              className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent pr-10 dark:text-zed-dark-text"
                            />
                            <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zed-muted hover:text-zed-text">
                              {showKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
             {/* Other tabs can be empty placeholders or minimal implementations for now */}
             {activeTab === 'github' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold mb-4">GitHub Integration</h3>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold opacity-70">Personal Access Token</label>
                        <div className="relative">
                          <input
                            type={showKey ? "text" : "password"}
                            value={settings.githubToken || ''}
                            onChange={(e) => setSettings({ ...settings, githubToken: e.target.value })}
                            placeholder="ghp_... or github_pat_..."
                            className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent pr-10 dark:text-zed-dark-text"
                          />
                          <button
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zed-muted hover:text-zed-text"
                          >
                            {showKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                          </button>
                        </div>
                        <p className="text-[10px] text-zed-muted mt-2 leading-relaxed">
                          Required for private repositories, PRs, and workflow monitoring.
                          Generate a token at <a href="#" onClick={() => window.gitcanopyAPI.openExternal("https://github.com/settings/tokens")} className="text-blue-500 hover:underline">GitHub Settings</a>.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
             )}
             {activeTab === 'gitlab' && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold">GitLab Integration</h3>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold uppercase tracking-tight">Active Integration</span>
                    </div>
                    
                    <div className="p-3 mb-6 rounded border border-blue-100 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/20 text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                      <strong>AI Agent Capabilities:</strong> This integration utilizes the <strong>Model Context Protocol (MCP)</strong> to enable autonomous repository management. Configure these settings to allow the AI assistant to interact directly with your GitLab projects.
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold opacity-70">Personal Access Token (PAT)</label>
                        <div className="relative">
                          <input
                            type={showKey ? "text" : "password"}
                            value={settings.gitlabToken || ''}
                            onChange={(e) => setSettings({ ...settings, gitlabToken: e.target.value })}
                            placeholder="glpat-..."
                            className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent pr-10 dark:text-zed-dark-text"
                          />
                          <button
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zed-muted hover:text-zed-text"
                          >
                            {showKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                          </button>
                        </div>
                        <p className="text-[10px] text-zed-muted mt-2 leading-relaxed">
                          The <strong>master key</strong> that allows the agent to act on your behalf. Required for all features.
                          Scopes: <code>api, read_api, read_repository, write_repository</code>.
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                          <label className="text-xs font-bold opacity-70">Project ID</label>
                          <input
                            type="text"
                            value={settings.gitlabProjectId || ''}
                            onChange={(e) => setSettings({ ...settings, gitlabProjectId: e.target.value })}
                            placeholder="e.g. 12345678"
                            className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent dark:text-zed-dark-text"
                          />
                          <p className="text-[10px] text-zed-muted mt-1 leading-relaxed">
                            The <strong>target</strong> project. Tells the agent exactly which repo to manage.
                          </p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold opacity-70">Project Path</label>
                          <input
                            type="text"
                            value={settings.gitlabProjectPath || ''}
                            onChange={(e) => setSettings({ ...settings, gitlabProjectPath: e.target.value })}
                            placeholder="e.g. username/repo"
                            className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent dark:text-zed-dark-text"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
             )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zed-border dark:border-zed-dark-border bg-zed-bg dark:bg-zed-dark-bg flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-zed-text dark:text-zed-dark-text">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-xs font-bold rounded bg-zed-accent text-white hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            {saving ? "Saving..." : <><SaveOutlined /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
};
