import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { SubscriptionService } from '../services/subscription.service';
import { BroadcastService } from '../services/broadcast.service';
import { MatchesService } from '../../matches/services/matches.service';
import { EventBusService } from '../../../shared/events/event-bus.service';
import { SubscribeMatchDto, UnsubscribeMatchDto, JoinChatDto, LeaveChatDto } from '../dto/subscribe.dto';
import { SendMessageDto, TypingDto, PingDto } from '../dto/client-event.dto';
import { ChatService } from '../../chat/services/chat.service';
import { RateLimiterService } from 'src/modules/chat/services/rate-limiter.service';
import { TypingIndicatorService } from 'src/modules/chat/services/typing-indicator.service';


@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 25000,
  pingTimeout: 60000,
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly broadcastService: BroadcastService,
    private readonly matchesService: MatchesService,
    private readonly eventBusService: EventBusService,
    private readonly chatService: ChatService,
    private readonly typingService: TypingIndicatorService,
    private readonly rateLimiterService: RateLimiterService,
  ) {}

  afterInit(server: Server): void {
    this.broadcastService.setServer(server);
    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: Socket): void {
    this.subscriptionService.registerClient(client);
    this.logger.log(`Client connected: ${client.id}`);

    client.emit('connected', {
      socketId: client.id,
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket): void {
    const clientInfo = this.subscriptionService.getClient(client.id);

    if (clientInfo) {
      clientInfo.joinedChats.forEach((matchId) => {
        if (clientInfo.userId && clientInfo.username) {
          this.eventBusService.emitUserLeft({
            matchId,
            userId: clientInfo.userId,
            username: clientInfo.username,
          });
        }
      });
    }

    this.subscriptionService.unregisterClient(client, this.server);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe_match')
  handleSubscribeMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubscribeMatchDto,
  ): { success: boolean; matchId: string; error?: string } {
    try {
      if (!data?.matchId) {
        return { success: false, matchId: '', error: 'Match ID is required' };
      }

      if (!this.matchesService.matchExists(data.matchId)) {
        return { success: false, matchId: data.matchId, error: 'Match not found' };
      }

      const success = this.subscriptionService.subscribeToMatch(client, data.matchId);

      if (success) {
        const match = this.matchesService.getMatchById(data.matchId);
        client.emit('subscribed', { matchId: data.matchId, currentState: match });
      }

      return { success, matchId: data.matchId };
    } catch (error) {
      this.logger.error(`Error subscribing to match: ${error}`);
      return { success: false, matchId: data?.matchId || '', error: 'Internal error' };
    }
  }

  @SubscribeMessage('unsubscribe_match')
  handleUnsubscribeMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnsubscribeMatchDto,
  ): { success: boolean; matchId: string } {
    if (!data?.matchId) {
      return { success: false, matchId: '' };
    }

    const success = this.subscriptionService.unsubscribeFromMatch(client, data.matchId);
    return { success, matchId: data.matchId };
  }

  @SubscribeMessage('join_chat')
  handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinChatDto,
  ): { success: boolean; matchId: string; userCount?: number; error?: string } {
    try {
      if (!data?.matchId || !data?.userId || !data?.username) {
        return { success: false, matchId: '', error: 'Missing required fields' };
      }

      if (!this.matchesService.matchExists(data.matchId)) {
        return { success: false, matchId: data.matchId, error: 'Match not found' };
      }
      const isAlreadyInChat = this.subscriptionService.isUserInChat(data.matchId, data.userId);

      const success = this.subscriptionService.joinChat(
        client,
        data.matchId,
        data.userId,
        data.username,
      );

      if (success && !isAlreadyInChat) {
        this.eventBusService.emitUserJoined({
          matchId: data.matchId,
          userId: data.userId,
          username: data.username,
        });
      }

      const userCount = this.subscriptionService.getChatUserCount(data.matchId);

      return { success, matchId: data.matchId, userCount };
    } catch (error) {
      this.logger.error(`Error joining chat: ${error}`);
      return { success: false, matchId: data?.matchId || '', error: 'Internal error' };
    }
  }

  @SubscribeMessage('leave_chat')
  handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LeaveChatDto,
  ): { success: boolean; matchId: string } {
    if (!data?.matchId || !data?.userId) {
      return { success: false, matchId: '' };
    }

    const clientInfo = this.subscriptionService.getClient(client.id);
    const success = this.subscriptionService.leaveChat(client, data.matchId);

    if (success && clientInfo?.username) {
      const stillInChat = this.subscriptionService.isUserInChat(data.matchId, data.userId);

      if (!stillInChat) {
        this.eventBusService.emitUserLeft({
          matchId: data.matchId,
          userId: data.userId,
          username: clientInfo.username,
        });
      }
    }

    return { success, matchId: data.matchId };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!data?.matchId || !data?.userId || !data?.username || !data?.message) {
        return { success: false, error: 'Missing required fields' };
      }

      const isAllowed = await this.rateLimiterService.checkLimit(data.userId);
      if (!isAllowed) {
        client.emit('error', {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many messages. Please wait a moment.',
        });
        return { success: false, error: 'Rate limit exceeded' };
      }

      const trimmedMessage = data.message.trim();
      if (!trimmedMessage) {
        return { success: false, error: 'Message cannot be empty' };
      }

      if (trimmedMessage.length > 500) {
        return { success: false, error: 'Message too long (max 500 characters)' };
      }

      const messageId = await this.chatService.sendMessage({
        matchId: data.matchId,
        userId: data.userId,
        username: data.username,
        message: trimmedMessage,
      });

      await this.typingService.stopTyping(data.matchId, data.userId, data.username);

      return { success: true, messageId };
    } catch (error) {
      this.logger.error(`Error sending message: ${error}`);
      return { success: false, error: 'Failed to send message' };
    }
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TypingDto,
  ): Promise<{ success: boolean }> {
    if (!data?.matchId || !data?.userId || !data?.username) {
      return { success: false };
    }

    await this.typingService.startTyping(data.matchId, data.userId, data.username);
    return { success: true };
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TypingDto,
  ): Promise<{ success: boolean }> {
    if (!data?.matchId || !data?.userId || !data?.username) {
      return { success: false };
    }

    await this.typingService.stopTyping(data.matchId, data.userId, data.username);
    return { success: true };
  }

  @SubscribeMessage('ping')
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PingDto,
  ): { event: string; data: { timestamp: number; serverTime: string } } {
    return {
      event: 'pong',
      data: {
        timestamp: data?.timestamp || Date.now(),
        serverTime: new Date().toISOString(),
      },
    };
  }
}
