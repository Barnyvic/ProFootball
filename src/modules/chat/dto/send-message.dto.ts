import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  matchId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500, { message: 'Message must be 500 characters or less' })
  message: string;
}
