import jwt from 'jsonwebtoken';
import type { Server as IoServer, Socket } from 'socket.io';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { LogEmitter } from './scheduler.boundaries.js';

export const LOG_ROOM_PREFIX = 'backup-logs';
export const LOG_NAMESPACE = '/scheduler';

interface JobOwnership {
  ownerOf(jobId: string): Promise<string | null>;
}

export interface AttachLogStreamDeps {
  io: Pick<IoServer, 'of'>;
  ownership: JobOwnership;
  jwtSecret?: string;
}

interface AuthedSocket extends Socket {
  data: { userId?: string };
}

function verifyToken(token: string, secret: string): string | null {
  try {
    const decoded = jwt.verify(token, secret) as { id?: string; _id?: string };
    return decoded.id ?? decoded._id ?? null;
  } catch {
    return null;
  }
}

/**
 * Attach the log-stream namespace to the retained Socket.IO `io`. Each
 * connected socket must present a JWT (same secret as `requireAuth`); it may
 * only join `backup-logs:<jobId>` rooms for jobs it owns.
 */
export function attachLogStream(deps: AttachLogStreamDeps): LogEmitter {
  const secret = deps.jwtSecret ?? env.JWT_SECRET;
  const nsp = deps.io.of(LOG_NAMESPACE);

  nsp.use((socket, next) => {
    const raw =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization ?? '').replace(/^(JWT|Bearer)\s+/i, '');
    if (!raw) return next(new Error('unauthorized'));
    const userId = verifyToken(raw, secret);
    if (!userId) return next(new Error('unauthorized'));
    (socket as AuthedSocket).data.userId = userId;
    next();
  });

  nsp.on('connection', (socket) => {
    socket.on('join', async (payload: { jobId?: string }, ack?: (r: unknown) => void) => {
      const jobId = payload?.jobId;
      if (typeof jobId !== 'string' || jobId.length === 0) {
        ack?.({ ok: false, reason: 'invalid' });
        return;
      }
      const userId = (socket as AuthedSocket).data.userId;
      const owner = await deps.ownership.ownerOf(jobId);
      if (!userId || !owner || owner !== userId) {
        ack?.({ ok: false, reason: 'forbidden' });
        return;
      }
      const room = `${LOG_ROOM_PREFIX}:${jobId}`;
      await socket.join(room);
      ack?.({ ok: true, room });
    });
  });

  const emitter: LogEmitter = {
    log(jobId, line) {
      nsp.to(`${LOG_ROOM_PREFIX}:${jobId}`).emit('log', { jobId, line });
    },
    done(jobId, ok, detail) {
      const event = ok ? 'done' : 'failed';
      nsp.to(`${LOG_ROOM_PREFIX}:${jobId}`).emit(event, { jobId, ok, detail });
    },
  };

  logger.info('scheduler.logstream: attached');
  return emitter;
}
