import { autoUpdater } from 'electron-updater';
import { BrowserWindow, dialog } from 'electron';
import { logger, logError, logInfo } from './logger-service';

export class UpdateService {
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    autoUpdater.logger = logger;
    autoUpdater.autoDownload = false; // Let user decide when to download
    this.setupListeners();
  }

  public setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  public checkForUpdates() {
    logInfo('UpdateService', 'Checking for updates...');
    try {
        autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
        // Only log if it's a real error, not just a network issue
        if (error instanceof Error && !error.message.includes('offline')) {
            logError('UpdateService', error);
        }
    }
  }

  private setupListeners() {
    autoUpdater.on('checking-for-update', () => {
      logInfo('UpdateService', 'Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      logInfo('UpdateService', `Update available: ${info.version}`);
      if (this.mainWindow) {
        dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: 'Update Available',
          message: `A new version (${info.version}) is available. Do you want to download it now?`,
          buttons: ['Download', 'Later'],
          defaultId: 0,
        }).then(({ response }) => {
          if (response === 0) {
            autoUpdater.downloadUpdate();
          }
        });
      }
    });

    autoUpdater.on('update-not-available', () => {
      logInfo('UpdateService', 'Update not available');
    });

    autoUpdater.on('error', (err) => {
      logError('UpdateService', err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      logInfo('UpdateService', `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`);
      if (this.mainWindow) {
          this.mainWindow.setProgressBar(progressObj.percent / 100);
      }
    });

    autoUpdater.on('update-downloaded', () => {
      logInfo('UpdateService', 'Update downloaded');
      if (this.mainWindow) {
        this.mainWindow.setProgressBar(-1); // Remove progress bar
        dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: 'Update Ready',
          message: 'Update downloaded. Restart the application to apply updates?',
          buttons: ['Restart', 'Later'],
          defaultId: 0,
        }).then(({ response }) => {
          if (response === 0) {
            autoUpdater.quitAndInstall();
          }
        });
      }
    });
  }
}
