import log from 'electron-log';
import * as path from 'path';
import { app } from 'electron';

// Configure logging
log.transports.file.level = 'info';
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs/main.log');
log.transports.console.format = '{h}:{i}:{s} {text}';

// Capture unhandled errors
log.errorHandler.startCatching();

export const logger = log;

export const logError = (context: string, error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : '';
  logger.error(`[${context}] ${errorMessage}`, errorStack);
};

export const logInfo = (context: string, message: string) => {
  logger.info(`[${context}] ${message}`);
};

export const logWarn = (context: string, message: string) => {
  logger.warn(`[${context}] ${message}`);
};
