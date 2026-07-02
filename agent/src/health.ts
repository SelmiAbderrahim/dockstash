import * as http from 'node:http';

export interface HealthStatus {
  runningJobId: string | null;
  lastHeartbeatAt: Date | null;
}

/**
 * Tiny local health endpoint for the compose healthcheck:
 * `GET /healthz` → `{ ok, lastHeartbeatAt, runningJobId }`.
 */
export function startHealthServer(
  port: number,
  status: () => HealthStatus,
): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === '/healthz') {
      const s = status();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          lastHeartbeatAt: s.lastHeartbeatAt ? s.lastHeartbeatAt.toISOString() : null,
          runningJobId: s.runningJobId,
        }),
      );
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false }));
  });
  server.listen(port, '127.0.0.1');
  return server;
}
