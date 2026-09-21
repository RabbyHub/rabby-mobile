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
  private filter: ((entry: DebugLogEntry) => boolean) | null = null;

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
   * Get all logs, respecting any active filter
   */
  getLogs = (): DebugLogEntry[] => {
    const logs = [...this.logs];
    return this.filter ? logs.filter(this.filter) : logs;
  };

  /**
   * Set a filter predicate. Only entries matching the predicate will be
   * returned by getLogs() and shown in the log viewer.
   *
   * @example
   *   // Show only keychain perf logs
   *   debugLogService.setFilter(e => e.message.includes('[RabbyUnlockPerf:keychain]'))
   *
   *   // Show only errors
   *   debugLogService.setFilter(e => e.level === 'error')
   *
   *   // Show only logs whose message matches a regex
   *   debugLogService.setFilter(e => /keychain/i.test(e.message))
   */
  setFilter = (predicate: (entry: DebugLogEntry) => boolean) => {
    this.filter = predicate;
    this.notifyListeners();
  };

  /**
   * Remove the active filter, restoring the full log view
   */
  clearFilter = () => {
    this.filter = null;
    this.notifyListeners();
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
