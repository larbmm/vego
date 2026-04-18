import * as cron from 'node-cron';
import * as fs from 'fs';
import * as path from 'path';

export interface ScheduledTask {
  (state: Record<string, any>): Promise<Record<string, any>>;
}

export class Scheduler {
  private tasks: ScheduledTask[] = [];
  private weeklyTasks: Array<{ task: ScheduledTask; dayOfWeek: number; time: string }> = [];
  private scheduleTime: string;
  private stateFile: string = '';
  private state: Record<string, any> = {};
  private jobs: cron.ScheduledTask[] = [];

  constructor(scheduleTime: string = '3:00') {
    this.scheduleTime = scheduleTime;
  }

  setStateFile(filePath: string): void {
    this.stateFile = filePath;
    this.loadState();
  }

  private loadState(): void {
    if (this.stateFile && fs.existsSync(this.stateFile)) {
      try {
        const content = fs.readFileSync(this.stateFile, 'utf-8');
        this.state = JSON.parse(content);
      } catch (error) {
        console.error('[Scheduler] Failed to load state:', error);
        this.state = {};
      }
    }
  }

  private saveState(): void {
    if (this.stateFile) {
      const dir = path.dirname(this.stateFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf-8');
    }
  }

  addTask(task: ScheduledTask): void {
    this.tasks.push(task);
  }

  addWeeklyTask(task: ScheduledTask, dayOfWeek: number, time: string): void {
    this.weeklyTasks.push({ task, dayOfWeek, time });
  }

  addHourlyTask(task: ScheduledTask, hour: number, minute: number): void {
    const cronExpression = `${minute} ${hour} * * *`;
    const job = cron.schedule(cronExpression, async () => {
      try {
        // Add random delay (0-30 minutes) to avoid exact hour triggering
        const randomDelay = Math.floor(Math.random() * 30 * 60 * 1000);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
        
        const result = await task(this.state);
        this.state = { ...this.state, ...result };
        this.saveState();
      } catch (error) {
        console.error('[Scheduler] Hourly task failed:', error);
      }
    });
    this.jobs.push(job);
    job.start();
  }

  async start(): Promise<void> {
    console.log('[Scheduler] Starting scheduler...');

    // Schedule daily tasks
    const [hour, minute] = this.scheduleTime.split(':').map(Number);
    const cronExpression = `${minute} ${hour} * * *`;

    const dailyJob = cron.schedule(cronExpression, async () => {
      console.log(`[Scheduler] Running daily tasks at ${this.scheduleTime}`);
      await this.runDailyTasks();
    });

    this.jobs.push(dailyJob);

    // Schedule weekly tasks
    for (const { task, dayOfWeek, time } of this.weeklyTasks) {
      const [wHour, wMinute] = time.split(':').map(Number);
      const weeklyCronExpression = `${wMinute} ${wHour} * * ${dayOfWeek}`;

      const weeklyJob = cron.schedule(weeklyCronExpression, async () => {
        console.log(`[Scheduler] Running weekly task at ${time}`);
        try {
          const result = await task(this.state);
          this.state = { ...this.state, ...result };
          this.saveState();
        } catch (error) {
          console.error('[Scheduler] Weekly task failed:', error);
        }
      });

      this.jobs.push(weeklyJob);
    }

    console.log('[Scheduler] Scheduler started');

    // Keep the scheduler running
    return new Promise(() => {
      // Never resolve, keep running
    });
  }

  private async runDailyTasks(): Promise<void> {
    for (const task of this.tasks) {
      try {
        const result = await task(this.state);
        this.state = { ...this.state, ...result };
        this.saveState();
      } catch (error) {
        console.error('[Scheduler] Task failed:', error);
      }
    }
  }

  stop(): void {
    for (const job of this.jobs) {
      job.stop();
    }
    console.log('[Scheduler] Scheduler stopped');
  }
}
