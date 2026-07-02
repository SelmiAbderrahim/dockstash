// Thin boot seam over the tested runAgent() — mirrors server/src/server.ts.
import { runAgent } from './main.js';

const running = await runAgent();

const drain = (): void => {
  void running.shutdown().then(() => process.exit(0));
};
process.on('SIGTERM', drain);
process.on('SIGINT', drain);
