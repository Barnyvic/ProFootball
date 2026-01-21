export interface MatchEventPayload {
  matchId: string;
  type: string;
  minute: number;
  team: 'home' | 'away';
  player?: string;
  description: string;
}

export interface ScoreUpdatePayload {
  matchId: string;
  homeScore: number;
  awayScore: number;
}

export interface MatchStatusPayload {
  matchId: string;
  status: string;
  minute: number;
}

export interface ChatMessagePayload {
  matchId: string;
  messageId: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
}

export interface TypingPayload {
  matchId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface UserRoomPayload {
  matchId: string;
  userId: string;
  username: string;
}