import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

interface ClientInfo {
  socketId: string;
  userId?: string;
  username?: string;
  subscribedMatches: Set<string>;
  joinedChats: Set<string>;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  private clients: Map<string, ClientInfo> = new Map();
  registerClient(socket: Socket): void {
    this.clients.set(socket.id, {
      socketId: socket.id,
      subscribedMatches: new Set(),
      joinedChats: new Set(),
    });
    this.logger.debug(`Client registered: ${socket.id}`);
  }

  unregisterClient(socket: Socket, server: Server): void {
    const client = this.clients.get(socket.id);
    if (client) {
      client.subscribedMatches.forEach((matchId) => {
        socket.leave(`match:${matchId}`);
      });
      client.joinedChats.forEach((matchId) => {
        socket.leave(`chat:${matchId}`);
      });

      this.clients.delete(socket.id);
      this.logger.debug(`Client unregistered: ${socket.id}`);
    }
  }

  subscribeToMatch(socket: Socket, matchId: string): boolean {
    const client = this.clients.get(socket.id);
    if (!client) return false;

    const roomName = `match:${matchId}`;
    
    if (!client.subscribedMatches.has(matchId)) {
      socket.join(roomName);
      client.subscribedMatches.add(matchId);
      this.logger.debug(`Client ${socket.id} subscribed to match ${matchId}`);
    }

    return true;
  }

  unsubscribeFromMatch(socket: Socket, matchId: string): boolean {
    const client = this.clients.get(socket.id);
    if (!client) return false;

    const roomName = `match:${matchId}`;
    
    if (client.subscribedMatches.has(matchId)) {
      socket.leave(roomName);
      client.subscribedMatches.delete(matchId);
      this.logger.debug(`Client ${socket.id} unsubscribed from match ${matchId}`);
    }

    return true;
  }

  joinChat(socket: Socket, matchId: string, userId: string, username: string): boolean {
    const client = this.clients.get(socket.id);
    if (!client) return false;

    const roomName = `chat:${matchId}`;

    client.userId = userId;
    client.username = username;

    if (!client.joinedChats.has(matchId)) {
      socket.join(roomName);
      client.joinedChats.add(matchId);
      this.logger.debug(`Client ${socket.id} (${username}) joined chat ${matchId}`);
    }

    return true;
  }

  leaveChat(socket: Socket, matchId: string): boolean {
    const client = this.clients.get(socket.id);
    if (!client) return false;

    const roomName = `chat:${matchId}`;
    
    if (client.joinedChats.has(matchId)) {
      socket.leave(roomName);
      client.joinedChats.delete(matchId);
      this.logger.debug(`Client ${socket.id} left chat ${matchId}`);
    }

    return true;
  }

  getClient(socketId: string): ClientInfo | undefined {
    return this.clients.get(socketId);
  }

  getMatchSubscribers(matchId: string): ClientInfo[] {
    return Array.from(this.clients.values()).filter((client) =>
      client.subscribedMatches.has(matchId),
    );
  }

  getChatMembers(matchId: string): ClientInfo[] {
    return Array.from(this.clients.values()).filter((client) =>
      client.joinedChats.has(matchId),
    );
  }

  getChatUserCount(matchId: string): number {
    const members = this.getChatMembers(matchId);
    const uniqueUsers = new Set(members.map((m) => m.userId).filter(Boolean));
    return uniqueUsers.size;
  }

  isUserInChat(matchId: string, userId: string): boolean {
    return this.getChatMembers(matchId).some((m) => m.userId === userId);
  }

  getConnectedCount(): number {
    return this.clients.size;
  }
}
