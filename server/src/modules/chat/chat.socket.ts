import type { Server, Socket } from 'socket.io';
import { logger } from '../../config/logger.js';

type ConversationId = string;

const MAX_ROOMS_PER_SOCKET = 25;

export function registerChatSocket(io: Server): void {
  io.on('connection', (socket: Socket) => {
    socket.on('enter conversation', (conversation: ConversationId) => {
      if (typeof conversation !== 'string' || conversation.length === 0) return;
      if (socket.rooms.size - 1 >= MAX_ROOMS_PER_SOCKET) return;
      void socket.join(conversation);
    });

    socket.on('leave conversation', (conversation: ConversationId) => {
      if (typeof conversation !== 'string' || conversation.length === 0) return;
      void socket.leave(conversation);
    });

    socket.on('new message', (conversation: ConversationId) => {
      if (typeof conversation !== 'string' || conversation.length === 0) return;
      io.in(conversation).emit('refresh messages', conversation);
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ reason, sid: socket.id }, 'chat socket disconnected');
    });
  });
}
