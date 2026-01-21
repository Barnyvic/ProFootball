export class ChatMessageResponseDto {
  id: string;
  matchId: string;
  userId: string;
  username: string;
  message: string;
  timestamp: string;
}

export class ChatRoomInfoDto {
  matchId: string;
  userCount: number;
  users: { userId: string; username: string }[];
}
