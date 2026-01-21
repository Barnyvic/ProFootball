import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class SubscribeMatchDto {
  @IsString()
  @IsNotEmpty()
  matchId: string;
}

export class UnsubscribeMatchDto {
  @IsString()
  @IsNotEmpty()
  matchId: string;
}

export class JoinChatDto {
  @IsString()
  @IsNotEmpty()
  matchId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  username: string;
}

export class LeaveChatDto {
  @IsString()
  @IsNotEmpty()
  matchId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}
