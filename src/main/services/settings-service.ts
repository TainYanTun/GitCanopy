import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { safeStorage } from 'electron';
import { AppSettings } from '../../shared/types';
import { getAppDataPath, safeJsonParse } from '../utils';
import { logError } from './logger-service';

export class SettingsService {
  private settingsPath: string;
  private defaultSettings: AppSettings = {
    theme: 'system',
    maxCommits: 1000,
    autoRefresh: true,
    refreshInterval: 5000,
    showAuthor: true,
    showTimestamp: true,
    compactMode: false,
    colorBlindMode: false,
    recentRepositories: [],
  };

  constructor() {
    this.settingsPath = join(getAppDataPath(), 'settings.json');
  }

  async getSettings(): Promise<AppSettings> {
    try {
      if (!existsSync(this.settingsPath)) {
        await this.saveSettings(this.defaultSettings);
        return this.defaultSettings;
      }

      const settingsJson = readFileSync(this.settingsPath, 'utf8');
      const settings = safeJsonParse<AppSettings>(settingsJson, this.defaultSettings);

      // Merge with defaults to ensure all properties exist
      const mergedSettings = { ...this.defaultSettings, ...settings };

      // Decrypt GitHub token if it exists and is encrypted
      if (mergedSettings.githubToken && typeof mergedSettings.githubToken === 'string') {
        mergedSettings.githubToken = this.decryptToken(mergedSettings.githubToken);
      }

      return mergedSettings;
    } catch (error) {
      logError("SettingsService", `Failed to load settings: ${error}`);
      return this.defaultSettings;
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      // Ensure the settings directory exists
      const settingsDir = getAppDataPath();
      if (!existsSync(settingsDir)) {
        mkdirSync(settingsDir, { recursive: true });
      }

      // Clone settings to avoid mutating the original object
      const settingsToSave = { ...settings };

      // Encrypt GitHub token before saving
      if (settingsToSave.githubToken && typeof settingsToSave.githubToken === 'string') {
        settingsToSave.githubToken = this.encryptToken(settingsToSave.githubToken);
      }

      // Validate settings before saving
      const validatedSettings = this.validateSettings(settingsToSave);

      writeFileSync(this.settingsPath, JSON.stringify(validatedSettings, null, 2));
    } catch (error) {
      logError("SettingsService", `Failed to save settings: ${error}`);
      throw new Error('Could not save settings');
    }
  }

  private encryptToken(token: string): string {
    if (!token || !safeStorage.isEncryptionAvailable()) {
      return token;
    }
    try {
      const encrypted = safeStorage.encryptString(token);
      return `enc:${encrypted.toString('base64')}`;
    } catch (error) {
      logError("SettingsService", `Failed to encrypt token: ${error}`);
      return token;
    }
  }

  private decryptToken(encryptedToken: string): string {
    if (!encryptedToken || !encryptedToken.startsWith('enc:') || !safeStorage.isEncryptionAvailable()) {
      return encryptedToken;
    }
    try {
      const base64Data = encryptedToken.substring(4);
      const buffer = Buffer.from(base64Data, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (error) {
      logError("SettingsService", `Failed to decrypt token: ${error}`);
      // If decryption fails, it might be a plain token that was saved with 'enc:' prefix by mistake,
      // or from a different machine. In any case, we return the original if it doesn't work.
      return encryptedToken;
    }
  }

  private validateSettings(settings: AppSettings): AppSettings {
    const validated: AppSettings = {
      theme: ['light', 'dark', 'system'].includes(settings.theme) ? settings.theme : 'system',
      maxCommits: Math.max(100, Math.min(settings.maxCommits || 1000, 50000)),
      autoRefresh: Boolean(settings.autoRefresh),
      refreshInterval: Math.max(1000, Math.min(settings.refreshInterval || 5000, 60000)),
      showAuthor: Boolean(settings.showAuthor),
      showTimestamp: Boolean(settings.showTimestamp),
      compactMode: Boolean(settings.compactMode),
      colorBlindMode: Boolean(settings.colorBlindMode),
      recentRepositories: Array.isArray(settings.recentRepositories)
        ? settings.recentRepositories.filter(r => typeof r === 'string').slice(0, 10)
        : [],
    };

    // Preserve GitHub token if present (it's already encrypted if it was supposed to be)
    if (settings.githubToken && typeof settings.githubToken === 'string') {
        validated.githubToken = settings.githubToken;
    }
    if (settings.githubTokenCreated && typeof settings.githubTokenCreated === 'number') {
        validated.githubTokenCreated = settings.githubTokenCreated;
    }
    if (settings.lastSeenVersion && typeof settings.lastSeenVersion === 'string') {
        validated.lastSeenVersion = settings.lastSeenVersion;
    }

    return validated;
  }

  resetToDefaults(): Promise<void> {
    return this.saveSettings(this.defaultSettings);
  }

  async addRecentRepository(path: string): Promise<void> {
    const settings = await this.getSettings();
    let recent = settings.recentRepositories || [];

    // Remove if already exists to move to front
    recent = recent.filter(p => p !== path);
    // Add to front
    recent.unshift(path);
    // Limit size
    recent = recent.slice(0, 10); // Keep max 10 recent repositories

    await this.saveSettings({ ...settings, recentRepositories: recent });
  }

  async getRecentRepositories(): Promise<string[]> {
    const settings = await this.getSettings();
    return settings.recentRepositories || [];
  }

  async clearRecentRepositories(): Promise<void> {
    const settings = await this.getSettings();
    await this.saveSettings({ ...settings, recentRepositories: [] });
  }
}
