import React, { useState, useEffect } from "react";
import { AppSettings } from "@shared/types";
import {
  CloseOutlined,
  SaveOutlined,
  RobotOutlined,
  GithubOutlined,
  SettingOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from "@ant-design/icons";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'github'>('ai');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      window.gitcanopyAPI.getSettings().then(setSettings);
    }
  }, [visible]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await window.gitcanopyAPI.saveSettings(settings);
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
          </div>

          {/* Panel */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold mb-4">AI Configuration</h3>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold opacity-70">Provider</label>
                      <select
                        value={settings.aiProvider || 'gemini'}
                        onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value as any })}
                        className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent dark:text-zed-dark-text"
                      >
                        <option value="gemini">Google Gemini</option>
                        {/* <option value="openai">OpenAI (Coming Soon)</option> */}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold opacity-70">API Key</label>
                      <div className="relative">
                        <input
                          type={showKey ? "text" : "password"}
                          value={settings.aiApiKey || ''}
                          onChange={(e) => setSettings({ ...settings, aiApiKey: e.target.value })}
                          placeholder="Enter your API Key"
                          className="w-full bg-zed-bg dark:bg-zed-dark-bg border border-zed-border dark:border-zed-dark-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zed-accent pr-10 dark:text-zed-dark-text"
                        />
                        <button
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zed-muted hover:text-zed-text"
                        >
                          {showKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        </button>
                      </div>
                      <p className="text-[10px] text-zed-muted mt-1">
                        Your key is stored locally and never sent to our servers.
                        {(!settings.aiProvider || settings.aiProvider === 'gemini') && (
                            <span> Get a free key at <a href="#" onClick={() => window.gitcanopyAPI.openExternal("https://aistudio.google.com/app/apikey")} className="text-blue-500 hover:underline">Google AI Studio</a>.</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
             {/* Other tabs can be empty placeholders or minimal implementations for now */}
             {activeTab === 'general' && (
                 <div className="text-xs text-zed-muted">General settings are managed in main configuration (placeholder).</div>
             )}
             {activeTab === 'github' && (
                 <div className="text-xs text-zed-muted">GitHub token is managed in the status bar (placeholder).</div>
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
