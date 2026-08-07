import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import type { RegistrySnapshot, SyncRun, Team } from '@orbit/shared';

import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  ErrorDto,
  HealthDto,
  RegistrySnapshotDto,
  SyncRunDto,
  TeamDto,
} from './dto/registry.dto';
import { HealthStatus, RegistryService } from './registry.service';

const QueueKeyParamSchema = z.string().trim().min(1).max(64);

@ApiTags('registry')
@Controller()
export class RegistryController {
  constructor(private readonly registryService: RegistryService) {}

  @Get('registry')
  @ApiOperation({ summary: 'Full registry snapshot (companies/domains/tribes/teams/links + lastSync). Redis-cached.' })
  @ApiOkResponse({ type: RegistrySnapshotDto })
  getRegistry(): Promise<RegistrySnapshot> {
    return this.registryService.getSnapshot();
  }

  @Get('teams/:queueKey')
  @ApiOperation({ summary: 'One team by its unique queue key.' })
  @ApiParam({ name: 'queueKey', example: 'PAY-CHK' })
  @ApiOkResponse({ type: TeamDto })
  @ApiNotFoundResponse({ type: ErrorDto })
  getTeam(
    @Param('queueKey', new ZodValidationPipe(QueueKeyParamSchema)) queueKey: string,
  ): Promise<Team> {
    return this.registryService.getTeamByQueueKey(queueKey);
  }

  @Get('sync/runs')
  @ApiOperation({ summary: 'Last 10 sync runs, newest first.' })
  @ApiOkResponse({ type: [SyncRunDto] })
  getSyncRuns(): Promise<SyncRun[]> {
    return this.registryService.getSyncRuns();
  }

  @Get('health')
  @ApiOperation({ summary: 'Liveness: DB + Redis ping.' })
  @ApiOkResponse({ type: HealthDto })
  getHealth(): Promise<HealthStatus> {
    return this.registryService.getHealth();
  }
}
