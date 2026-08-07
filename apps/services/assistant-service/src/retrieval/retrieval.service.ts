import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error';
import type { RetrievedTeam } from './core/hybrid';
import { IndexService } from './index.service';

/**
 * Facade the chat pipeline talks to: hybrid retrieve top-8, or a clean 503
 * while the registry index is still warming up.
 */
@Injectable()
export class RetrievalService {
  constructor(@Inject(IndexService) private readonly index: IndexService) {}

  get isReady(): boolean {
    return this.index.isReady;
  }

  get docCount(): number {
    return this.index.docCount;
  }

  async retrieve(query: string): Promise<RetrievedTeam[]> {
    if (!this.index.isReady) {
      throw new AppError(503, 'Team registry index is not ready yet — try again shortly.');
    }
    return this.index.retrieve(query);
  }
}
