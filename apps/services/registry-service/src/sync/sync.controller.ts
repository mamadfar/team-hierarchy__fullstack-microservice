import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { ErrorDto } from '../registry/dto/registry.dto';
import { SyncTriggerResponseDto } from './dto/sync.dto';
import { SyncService } from './sync.service';
import { SyncTokenGuard } from './sync-token.guard';

@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /** Rate limit first (3/min per IP), then the constant-time token check. */
  @Post()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard, SyncTokenGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger a registry sync (UI Refresh button). Requires the app token.' })
  @ApiOkResponse({ type: SyncTriggerResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorDto })
  @ApiTooManyRequestsResponse({ type: ErrorDto })
  async trigger(): Promise<SyncTriggerResponseDto> {
    const result = await this.syncService.run('manual');
    return { status: 'ok', runId: result.runId, stats: result.stats };
  }
}
