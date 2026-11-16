import { env } from './config/env.js';
import { createApp } from './app.js';
import { sqlClient } from './db/index.js';

const server = createApp().listen(env.PORT, () => {
  console.info(`DriveThrough API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

const shutdown = (signal: string) => {
  console.info(`${signal} received, shutting down`);
  server.close(async () => {
    await sqlClient.end({ timeout: 5 });
    process.exit(0);
  });
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
