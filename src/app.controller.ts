import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot(): { status: string; message: string; version: string } {
    return {
      status: 'ok',
      message: 'ProFootball Real-time Match Center API',
      version: '1.0.0',
    };
  }

  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
