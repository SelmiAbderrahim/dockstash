import { Server as IoServer } from 'socket.io';
import { createApp } from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { registerChatSocket } from './modules/chat/index.js';

function main(): void {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'server up');
  });

  const io = new IoServer(server, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });
  registerChatSocket(io);

  // Connect to Mongo in the background so the HTTP port opens immediately for
  // orchestrator health checks. Module routes that depend on Mongo will surface
  // their own errors until the connection is established.
  connectDb().catch((err) => {
    logger.error({ err }, 'mongo connection unavailable');
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, 'shutting down');
    io.close();
    server.close(() => {
      void disconnectDb().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
