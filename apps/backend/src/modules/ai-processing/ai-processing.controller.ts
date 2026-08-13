import { Controller, Post, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AiProcessingService } from './ai-processing.service';
import { AiProcessingResult } from './ai-processing.service';
import { TokenGuard } from '../../common/guards/token.guard';

@Controller('ai-processing')
export class AiProcessingController {
  constructor(private readonly aiProcessingService: AiProcessingService) {}

  @Post('run')
  @UseGuards(TokenGuard)
  @HttpCode(HttpStatus.OK)
  async runPending(
    @Query('limit') limit: number = 50,
    @Query('force') force: boolean = false,
  ): Promise<AiProcessingResult> {
    return this.aiProcessingService.processPending(limit, force);
  }

  @Post('run/:id')
  @UseGuards(TokenGuard)
  @HttpCode(HttpStatus.OK)
  async runOne(
    @Param('id') id: string,
    @Query('force') force: boolean = false,
  ): Promise<AiProcessingResult> {
    return this.aiProcessingService.processOne(id, force);
  }
}