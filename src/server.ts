import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { checkDatabase, closeDatabase } from './database/client.js';
import { logger } from './shared/logger.js';

if (!(await checkDatabase())) {
  logger.fatal('Database connectivity check failed; API startup aborted');
  try {
    await closeDatabase();
  } catch (err) {
    logger.error({ err }, 'Database cleanup failed during startup');
  }
  process.exit(1);
}

logger.info('Database connectivity check passed');

const server = createServer(createApp());

let closing = false;
async function shutdown(signal: string, code = 0) {
  if (closing) return;
  closing = true;
  logger.info({ signal }, 'Graceful shutdown started');
  const timer = setTimeout(() => process.exit(1), env.SHUTDOWN_TIMEOUT_MS).unref();
  server.close(async (error) => {
    try {
      await closeDatabase();
      clearTimeout(timer);
      if (error) throw error;
      logger.info('Shutdown complete');
      process.exit(code);
    } catch (err) {
      logger.fatal({ err }, 'Shutdown failed');
      process.exit(1);
    }
  });
}

server.listen(env.PORT, () => logger.info({ port: env.PORT }, 'API listening'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('uncaughtException', (e) => {
  logger.fatal({ err: e }, 'Uncaught exception');
  void shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (e) => {
  logger.fatal({ err: e }, 'Unhandled rejection');
  void shutdown('unhandledRejection', 1);
});
