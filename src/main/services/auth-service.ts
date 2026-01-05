import * as net from 'net';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { BrowserWindow } from 'electron';
import { logError } from './logger-service';

export class AuthService {
  private server: net.Server | null = null;
  private socketPath: string = '';
  private activeSocket: net.Socket | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.socketPath = this.getSocketPath();
  }

  public setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  public getSocketPath(): string {
    if (process.platform === 'win32') {
      return path.join('\\\\.\\pipe', `gitcanopy-auth-${process.pid}`);
    }
    return path.join(os.tmpdir(), `gitcanopy-auth-${process.pid}.sock`);
  }

  public async start(): Promise<string> {
    if (this.server) return this.socketPath;

    // Clean up existing socket file if needed
    if (process.platform !== 'win32' && fs.existsSync(this.socketPath)) {
      try {
        fs.unlinkSync(this.socketPath);
      } catch (_e) { /* ignore */ }
    }

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.activeSocket = socket;
        
        socket.on('data', (data) => {
          const prompt = data.toString();
          this.handleAuthRequest(prompt);
        });

        socket.on('error', (err) => {
          logError('AuthService', `Socket error: ${err}`);
          socket.destroy();
        });

        socket.on('close', () => {
          this.cleanupActiveRequest();
        });
      });

      this.server.listen(this.socketPath, () => {
        // console.log('[AuthService] Listening on', this.socketPath);
        resolve(this.socketPath);
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  public stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  private handleAuthRequest(prompt: string) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        // Parse prompt to give context
        // E.g. "Password for 'https://user@github.com':"
        // E.g. "Username for 'https://github.com':"
        this.mainWindow.webContents.send('auth-request', { prompt });
    } else {
        // No window, cancel immediately
        this.cancelAuth();
    }
  }

  public submitCredentials(answer: string) {
    if (this.activeSocket && !this.activeSocket.destroyed) {
      this.activeSocket.write(answer);
      this.activeSocket.end();
    }
    this.cleanupActiveRequest();
  }

  public cancelAuth() {
    if (this.activeSocket && !this.activeSocket.destroyed) {
      this.activeSocket.destroy();
    }
    this.cleanupActiveRequest();
  }

  private cleanupActiveRequest() {
    this.activeSocket = null;
  }
}
