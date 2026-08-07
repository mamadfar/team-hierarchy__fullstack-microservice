import { Module } from '@nestjs/common';

import { ConfluenceClient } from './confluence.client';
import { ConfluencePageParser } from './confluence-page.parser';

@Module({
  providers: [ConfluenceClient, ConfluencePageParser],
  exports: [ConfluenceClient, ConfluencePageParser],
})
export class ConfluenceModule {}
