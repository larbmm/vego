// ANSI 颜色代码
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // 前景色
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // 亮色
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

// 根据模块名返回颜色
export function getModuleColor(module: string): string {
  const moduleColors: Record<string, string> = {
    'App': colors.brightCyan,           // 亮青色
    'Main': colors.brightGreen,         // 亮绿色
    'Config': colors.green,             // 绿色
    'Web': colors.brightMagenta,        // 亮洋红色
    'Database': colors.magenta,         // 洋红色
    'MemoryManager': colors.magenta,    // 洋红色
    'Scheduler': colors.brightYellow,   // 亮黄色
    'DreamTask': colors.yellow,         // 黄色
    'WeeklyReview': colors.yellow,      // 黄色
    'ProactiveChatTask': colors.yellow, // 黄色
    'TelegramBot': colors.brightBlue,   // 亮蓝色
    'DiscordBot': colors.blue,          // 蓝色
    'FeishuBot': colors.cyan,           // 青色
    'GPTClient': colors.green,          // 绿色
    'ERROR': colors.brightRed,          // 亮红色
  };
  
  return moduleColors[module] || colors.white;
}

// 格式化带颜色的日志
export function colorLog(module: string, message: string): string {
  const color = getModuleColor(module);
  return `${color}[${module}]${colors.reset} ${message}`;
}

// 成功消息（绿色 ✓）
export function success(message: string): string {
  return `${colors.brightGreen}✓${colors.reset} ${message}`;
}

// 错误消息（红色）
export function error(message: string): string {
  return `${colors.brightRed}${message}${colors.reset}`;
}

// 警告消息（黄色）
export function warn(message: string): string {
  return `${colors.brightYellow}${message}${colors.reset}`;
}

// 信息消息（蓝色）
export function info(message: string): string {
  return `${colors.brightBlue}${message}${colors.reset}`;
}
