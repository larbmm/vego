import * as fs from 'fs';
import * as path from 'path';
import * as toml from 'toml';
import * as os from 'os';

const VEGO_HOME = path.join(os.homedir(), '.vego');
const CONFIG_PATH = path.join(VEGO_HOME, 'config.toml');

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

export interface MemoryConfig {
  max_history_messages: number;
  max_recent_messages: number;
  compress_threshold: number;
}

export interface CharacterConfig {
  name: string;
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
  character: Record<string, CharacterConfig>;
  memory: MemoryConfig;
  scheduler: SchedulerConfig;
  weekly_review: WeeklyReviewConfig;
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
  };

  // Load character configs
  for (const [charName, charConfig] of Object.entries(rawConfig.character || {})) {
    const charData = charConfig as any;
    config.character[charName] = {
      name: charName,
      path: charData.path,
      telegram_bot_token: charData.telegram_bot_token,
      discord_bot_token: charData.discord_bot_token,
      feishu_app_id: charData.feishu_app_id,
      feishu_app_secret: charData.feishu_app_secret,
    };
  }

  return config;
}

export const config = loadConfig();

export function getWorkspacePath(charConfig: CharacterConfig): string {
  return path.join(VEGO_HOME, charConfig.path);
}

export function getDatabasePath(charConfig: CharacterConfig): string {
  return path.join(getWorkspacePath(charConfig), 'memory.db');
}
