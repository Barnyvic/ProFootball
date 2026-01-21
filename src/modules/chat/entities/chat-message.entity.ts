export interface ChatMessage {
  id: string;
  matchId: string;
  userId: string;
  username: string;
  message: string;
  createdAt: Date;
}
