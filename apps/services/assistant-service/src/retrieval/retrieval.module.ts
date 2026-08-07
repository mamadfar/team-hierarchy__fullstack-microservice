import { Module } from '@nestjs/common';
import { DocumentBuilderService } from './document-builder.service';
import { IndexService } from './index.service';
import { PgVectorSearcher } from './pgvector.searcher';
import { RetrievalService } from './retrieval.service';
import { SyncListenerService } from './sync-listener.service';

@Module({
  providers: [
    DocumentBuilderService,
    PgVectorSearcher,
    IndexService,
    RetrievalService,
    SyncListenerService,
  ],
  exports: [RetrievalService, IndexService],
})
export class RetrievalModule {}
