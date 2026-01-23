export interface DebugLogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

class DebugLogService {
  private logs: DebugLogEntry[] = [];
  private maxLogs = 500; // Maximum number of logs to keep
  private listeners: Set<() => void> = new Set();

  /**
   * Add a log entry
   */
  addLog = (
    message: string,
    level: DebugLogEntry['level'] = 'info',
    data?: any,
  ) => {
    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
    };

    this.logs.unshift(entry); // Add to beginning for newest first

    // Keep only the latest maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Notify listeners
    this.notifyListeners();
  };

  /**
   * Convenience methods for different log levels
   */
  info = (message: string, data?: any) => {
    this.addLog(message, 'info', data);
  };

  warn = (message: string, data?: any) => {
    this.addLog(message, 'warn', data);
  };

  error = (message: string, data?: any) => {
    this.addLog(message, 'error', data);
  };

  debug = (message: string, data?: any) => {
    this.addLog(message, 'debug', data);
  };

  /**
   * Get all logs
   */
  getLogs = (): DebugLogEntry[] => {
    return [...this.logs];
  };

  /**
   * Clear all logs
   */
  clearLogs = () => {
    this.logs = [];
    this.notifyListeners();
  };

  /**
   * Get logs count
   */
  getLogsCount = (): number => {
    return this.logs.length;
  };

  /**
   * Subscribe to log changes
   */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Notify all listeners
   */
  private notifyListeners = () => {
    this.listeners.forEach(listener => listener());
  };
}

const debugLogService = new DebugLogService();

export default debugLogService;
