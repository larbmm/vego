import { config, getWorkspacePath, getDatabasePath, getVegoHome, getPresetPath } from './config/config.js';
import { Character } from './character/character.js';
import { TelegramBot } from './bots/telegram-bot.js';
import { DiscordBot } from './bots/discord-bot.js';
import { FeishuBot } from './bots/feishu-bot.js';
import { Scheduler } from './scheduler/scheduler.js';
import { DreamTask, WeeklyReviewTask } from './scheduler/tasks.js';
import { startWebServer } from './web/server.js';
import * as path from 'path';

export class PersonaBotApp {
  private characters: Map<string, Character> = new Map();
  private tokenToCharacter: Map<string, Character> = new Map();
  private telegramBots: Map<string, TelegramBot> = new Map();
  private discordBots: Map<string, DiscordBot> = new Map();
  private feishuBots: Map<string, FeishuBot> = new Map();
  private scheduler?: Scheduler;
  private running = false;

  getCharacter(name: string): Character | undefined {
    return this.characters.get(name);
  }

  async initialize(): Promise<void> {
    console.log('[App] Initializing PersonaBotApp...');

    // 获取全局预设路径
    const globalPresetPath = getPresetPath();
    if (globalPresetPath) {
      console.log(`[App] Using global preset: ${globalPresetPath}`);
    }

    for (const [charName, charConfig] of Object.entries(config.character)) {
      const workspacePath = getWorkspacePath(charConfig);
      const databasePath = getDatabasePath(charConfig);

      const char = new Character(
        charName,
        workspacePath,
        databasePath,
        config.api.key,
        config.api.base,
        config.api.model,
        config.memory,
        globalPresetPath  // 使用全局预设路径
      );

      await char.initialize();
      this.characters.set(charName, char);

      // Setup Telegram bot
      if (charConfig.telegram_bot_token) {
        const tgBot = new TelegramBot(char.handleMessage.bind(char), charName);
        await tgBot.setup(
          charConfig.telegram_bot_token,
          config.api.key,
          config.api.base,
          config.api.model
        );
        this.telegramBots.set(charConfig.telegram_bot_token, tgBot);
        this.tokenToCharacter.set(charConfig.telegram_bot_token, char);
      }

      // Setup Discord bot
      if (charConfig.discord_bot_token) {
        const dcBot = new DiscordBot(char.handleMessage.bind(char), charName);
        await dcBot.setup(
          charConfig.discord_bot_token,
          config.api.key,
          config.api.base,
          config.api.model
        );
        this.discordBots.set(charConfig.discord_bot_token, dcBot);
        this.tokenToCharacter.set(charConfig.discord_bot_token, char);
      }

      // Setup Feishu bot
      if (charConfig.feishu_app_id && charConfig.feishu_app_secret) {
        const fsBot = new FeishuBot(char.handleMessage.bind(char), charName);
        await fsBot.setup(charConfig.feishu_app_id, charConfig.feishu_app_secret);
        this.feishuBots.set(charConfig.feishu_app_id, fsBot);
        this.tokenToCharacter.set(charConfig.feishu_app_id, char);
      }

      console.log(`✓ Character '${charName}' initialized`);
    }

    console.log(`✓ All ${this.characters.size} character(s) initialized`);

    if (config.scheduler.enabled) {
      this.setupScheduler();
    }
  }

  private setupScheduler(): void {
    this.scheduler = new Scheduler(config.scheduler.schedule_time);

    // Store scheduler state in .vego root directory, not in a character workspace
    const vegoHome = getVegoHome();
    this.scheduler.setStateFile(path.join(vegoHome, 'scheduler_state.json'));

    for (const [charName, char] of this.characters) {
      const dreamTask = new DreamTask(char, config.scheduler.min_conversations);
      this.scheduler.addTask(dreamTask.call.bind(dreamTask));
      console.log(`✓ Scheduler task added for '${charName}'`);
    }

    if (config.weekly_review.enabled) {
      for (const [charName, char] of this.characters) {
        const weeklyTask = new WeeklyReviewTask(char);
        this.scheduler.addWeeklyTask(
          weeklyTask.call.bind(weeklyTask),
          config.weekly_review.day_of_week,
          config.weekly_review.schedule_time
        );
        console.log(`✓ Weekly review task added for '${charName}'`);
      }
    }

    // Setup proactive chat tasks
    if (config.proactive_chat.enabled) {
      this.setupProactiveChatTasks();
    }
  }

  private setupProactiveChatTasks(): void {
    // Schedule hourly checks for proactive chat
    for (const [charName, char] of this.characters) {
      // Find telegram bot for this character
      const charConfig = config.character[charName];
      if (!charConfig?.telegram_bot_token) {
        console.log(`[App] Skipping proactive chat for '${charName}': no telegram token`);
        continue;
      }

      const tgBot = this.telegramBots.get(charConfig.telegram_bot_token);
      if (!tgBot) {
        console.log(`[App] Skipping proactive chat for '${charName}': telegram bot not found`);
        continue;
      }

      // Import and create proactive chat task
      // Use IIFE to capture current values of char, tgBot, and charName
      ((currentChar, currentBot, currentName) => {
        import('./scheduler/proactive-chat-task.js').then(({ ProactiveChatTask }) => {
          const proactiveTask = new ProactiveChatTask(
            currentChar,
            currentBot.getBot(),
            config.proactive_chat
          );

          // Add hourly task for proactive chat
          for (let hour = Math.floor(config.proactive_chat.active_hours_start); 
               hour <= Math.floor(config.proactive_chat.active_hours_end); 
               hour++) {
            this.scheduler!.addHourlyTask(
              proactiveTask.call.bind(proactiveTask),
              hour,
              0 // Run at the start of each hour
            );
          }

          console.log(`✓ Proactive chat task added for '${currentName}' (${Math.floor(config.proactive_chat.active_hours_end) - Math.floor(config.proactive_chat.active_hours_start) + 1} hourly checks)`);
        });
      })(char, tgBot, charName);
    }
  }

  async run(): Promise<void> {
    this.running = true;
    const tasks: Promise<void>[] = [];

    // Start web server
    startWebServer(3000);

    // Start all bots
    for (const bot of this.telegramBots.values()) {
      tasks.push(bot.run());
    }

    for (const bot of this.discordBots.values()) {
      tasks.push(bot.run());
    }

    for (const bot of this.feishuBots.values()) {
      tasks.push(bot.run());
    }

    // Start scheduler
    if (this.scheduler) {
      tasks.push(this.scheduler.start());
    }

    await Promise.all(tasks);
  }

  async shutdown(): Promise<void> {
    console.log('[App] Shutting down...');
    this.running = false;

    for (const bot of this.telegramBots.values()) {
      bot.stop();
    }

    for (const bot of this.discordBots.values()) {
      bot.stop();
    }

    for (const bot of this.feishuBots.values()) {
      bot.stop();
    }

    if (this.scheduler) {
      this.scheduler.stop();
    }

    for (const char of this.characters.values()) {
      char.close();
    }

    console.log('[App] Shutdown complete');
  }
}
