import { EventType } from '../enums/event-type.enum';

export interface MatchEvent {
  id: string;
  matchId: string;
  type: EventType;
  minute: number;
  team: 'home' | 'away';
  player?: string;
  assistPlayer?: string;
  description: string;
  timestamp: Date;
}
