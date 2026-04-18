import { PersonaBotApp } from './app.js';
import './web/logger.js'; // Initialize logger to intercept console

let appInstance: PersonaBotApp | null = null;

export function getAppInstance(): PersonaBotApp | null {
  return appInstance;
}

async function main() {
  const app = new PersonaBotApp();
  appInstance = app;

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[Main] Received SIGINT, shutting down gracefully...');
    await app.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[Main] Received SIGTERM, shutting down gracefully...');
    await app.shutdown();
    process.exit(0);
  });

  try {
    await app.initialize();
    console.log('[Main] Starting application...');
    await app.run();
  } catch (error) {
    console.error('[Main] Fatal error:', error);
    process.exit(1);
  }
}

main();
