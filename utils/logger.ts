/**
 * Centralized logging utility for SafePath
 * Allows easy toggling of debug logs without removing code
 */

// Set to false in production or when you want to disable debug logs
const DEBUG_ENABLED = true;

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

// Log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

/**
 * Create a logger with optional prefix
 * @param prefix - Optional prefix to identify the source (e.g., 'Sync', 'Database', 'UI')
 */
export function createLogger(prefix?: string): Logger {
  const formatMessage = (level: LogLevel, args: any[]): any[] => {
    const levelConfig = {
      debug: { color: colors.gray, label: 'DEBUG' },
      info: { color: colors.cyan, label: 'INFO' },
      warn: { color: colors.yellow, label: 'WARN' },
      error: { color: colors.red, label: 'ERROR' },
    }[level];

    const levelLabel = `${levelConfig.color}${colors.bright}[${levelConfig.label}]${colors.reset}`;
    
    if (prefix) {
      const prefixLabel = `${colors.magenta}[${prefix}]${colors.reset}`;
      return [levelLabel, prefixLabel, ...args];
    }
    return [levelLabel, ...args];
  };

  return {
    debug: (...args: any[]) => {
      if (DEBUG_ENABLED) {
        console.log(...formatMessage('debug', args));
      }
    },

    info: (...args: any[]) => {
      if (DEBUG_ENABLED) {
        console.log(...formatMessage('info', args));
      }
    },

    warn: (...args: any[]) => {
      if (DEBUG_ENABLED) {
        console.warn(...formatMessage('warn', args));
      }
    },

    error: (...args: any[]) => {
      // Always log errors, even if DEBUG_ENABLED is false
      console.error(...formatMessage('error', args));
    },
  };
}

// Default logger (no prefix)
export const logger = createLogger();

// Convenience exports for common use cases
export const syncLogger = createLogger('Sync');
export const dbLogger = createLogger('Database');
export const uiLogger = createLogger('UI');
