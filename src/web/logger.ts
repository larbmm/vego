// Simple in-memory logger for web interface
export class WebLogger {
  private static logs: Array<{
    timestamp: Date;
    level: 'info' | 'warn' | 'error';
    message: string;
    source?: string;
  }> = [];
  
  private static maxLogs = 500; // Keep last 500 logs
  
  static log(level: 'info' | 'warn' | 'error', message: string, source?: string) {
    this.logs.push({
      timestamp: new Date(),
      level,
      message,
      source,
    });
    
    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }
  
  static info(message: string, source?: string) {
    this.log('info', message, source);
  }
  
  static warn(message: string, source?: string) {
    this.log('warn', message, source);
  }
  
  static error(message: string, source?: string) {
    this.log('error', message, source);
  }
  
  static getLogs(limit: number = 100) {
    return this.logs.slice(-limit).reverse();
  }
  
  static clear() {
    this.logs = [];
  }
}

// Intercept console.log, console.warn, console.error
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args: any[]) => {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  
  WebLogger.info(message);
  originalLog.apply(console, args);
};

console.warn = (...args: any[]) => {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  
  WebLogger.warn(message);
  originalWarn.apply(console, args);
};

console.error = (...args: any[]) => {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  
  WebLogger.error(message);
  originalError.apply(console, args);
};
