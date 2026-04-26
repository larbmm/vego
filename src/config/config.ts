import * as fs from 'fs';
import * as path from 'path';
import * as toml from 'toml';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to find .vego directory in multiple locations
function findVegoHome(): string {
  const locations = [
    path.join(os.homedir(), '.vego'),           // ~/.vego (优先)
    path.join(process.cwd(), '.vego'),          // 当前工作目录/.vego
    path.join(__dirname, '..', '..', '.vego'),  // 项目根目录/.vego
  ];

  for (const location of locations) {
    if (fs.existsSync(location)) {
      console.log(`[Config] Using .vego directory: ${location}`);
      return location;
    }
  }

  // If not found, use home directory as default
  const defaultLocation = locations[0];
  console.warn(`[Config] .vego directory not found, using default: ${defaultLocation}`);
  return defaultLocation;
}

const VEGO_HOME = findVegoHome();
const CONFIG_PATH = path.join(VEGO_HOME, 'config.toml');

export function getVegoHome(): string {
  return VEGO_HOME;
}

export interface SchedulerConfig {
  enabled: boolean;
  schedule_time: string;
  min_conversations: number;
}

export interface WeeklyReviewConfig {
  enabled: boolean;
  day_of_week: number;
  schedule_time: string;
}

export interface ProactiveChatConfig {
  enabled: boolean;
  active_hours_start: number;
  active_hours_end: number;
  min_interval_hours: number;
  random_probability: number;
}

export interface GroupChatConfig {
  use_ai_judgment: boolean;
  question_response_probability: number;
  normal_response_probability: number;
  message_expiry_minutes: number;
}

export interface MemoryConfig {
  max_history_messages: number;
  max_recent_messages: number;
  compress_threshold: number;
}

export interface CharacterConfig {
  name: string;
  display_name?: string;  // 中文显示名称（可选）
  path: string;
  telegram_bot_token?: string;
  discord_bot_token?: string;
  feishu_app_id?: string;
  feishu_app_secret?: string;
}

export interface Config {
  api: {
    key: string;
    base: string;
    model: string;
  };
  timezone: string;  // 时区设置，如 'Asia/Shanghai'
  preset_path?: string;  // 全局预设文件路径（可选）
  character: Record<string, CharacterConfig>;
  memory: MemoryConfig;
  scheduler: SchedulerConfig;
  weekly_review: WeeklyReviewConfig;
  proactive_chat: ProactiveChatConfig;
  group_chat: GroupChatConfig;
}

function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Config file not found at ${CONFIG_PATH}`);
  }

  const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const rawConfig = toml.parse(content);

  const config: Config = {
    api: {
      key: rawConfig.api?.key || '',
      base: rawConfig.api?.base || '',
      model: rawConfig.api?.model || '',
    },
    timezone: rawConfig.timezone || 'Asia/Shanghai',  // 默认东八区
    preset_path: rawConfig.preset_path,  // 全局预设路径
    character: {},
    memory: {
      max_history_messages: rawConfig.memory?.max_history_messages || 100,
      max_recent_messages: rawConfig.memory?.max_recent_messages || 100,
      compress_threshold: rawConfig.memory?.compress_threshold || 300,
    },
    scheduler: {
      enabled: rawConfig.scheduler?.enabled !== false,
      schedule_time: rawConfig.scheduler?.schedule_time || '3:00',
      min_conversations: rawConfig.scheduler?.min_conversations || 20,
    },
    weekly_review: {
      enabled: rawConfig.weekly_review?.enabled !== false,
      day_of_week: rawConfig.weekly_review?.day_of_week || 0,
      schedule_time: rawConfig.weekly_review?.schedule_time || '4:00',
    },
    proactive_chat: {
      enabled: rawConfig.proactive_chat?.enabled !== false,
      active_hours_start: rawConfig.proactive_chat?.active_hours_start || 6.5,
      active_hours_end: rawConfig.proactive_chat?.active_hours_end || 22.5,
      min_interval_hours: rawConfig.proactive_chat?.min_interval_hours || 2,
      random_probability: rawConfig.proactive_chat?.random_probability || 0.3,
    },
    group_chat: {
      use_ai_judgment: rawConfig.group_chat?.use_ai_judgment !== false,
      question_response_probability: rawConfig.group_chat?.question_response_probability || 0.6,
      normal_response_probability: rawConfig.group_chat?.normal_response_probability || 0.2,
      message_expiry_minutes: rawConfig.group_chat?.message_expiry_minutes || 30,
    },
  };

  // Load character configs
  for (const [charName, charConfig] of Object.entries(rawConfig.character || {})) {
    const charData = charConfig as any;
    config.character[charName] = {
      name: charName,
      display_name: charData.display_name,
      path: charData.path,
      telegram_bot_token: charData.telegram_bot_token,
      discord_bot_token: charData.discord_bot_token,
      feishu_app_id: charData.feishu_app_id,
      feishu_app_secret: charData.feishu_app_secret,
    };
  }

  return config;
}

export let config = loadConfig();

export function reloadConfig(): Config {
  const newConfig = loadConfig();
  // Update the exported config object
  Object.assign(config, newConfig);
  return config;
}

export function getWorkspacePath(charConfig: CharacterConfig): string {
  return path.join(VEGO_HOME, charConfig.path);
}

export function getDatabasePath(charConfig: CharacterConfig): string {
  return path.join(getWorkspacePath(charConfig), 'memory.db');
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

/**
 * 获取预设文件的完整路径
 * 预设路径相对于 .vego 目录
 */
export function getPresetPath(): string | undefined {
  if (!config.preset_path) {
    return undefined;
  }
  return path.join(VEGO_HOME, config.preset_path);
}

/**
 * 获取当前本地时间的 ISO 字符串（精确到秒）
 * 使用配置的时区，格式：YYYY-MM-DDTHH:mm:ss
 */
export function getLocalTimeString(): string {
  const now = new Date();
  const timezone = config.timezone || 'Asia/Shanghai';
  
  // 使用 Intl.DateTimeFormat 获取本地时间
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const values: Record<string, string> = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });
  
  // 格式：YYYY-MM-DDTHH:mm:ss
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
}
