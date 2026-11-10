import { Controller, Get, Query } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';

@Controller('kb')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get('chunks')
  chunks(@Query('topic') topic?: string, @Query('lang') lang?: string): { chunks: unknown[] } {
    return { chunks: this.knowledge.query(topic, lang) };
  }

  @Get('stats')
  stats(): { docs: number; topics: string[] } {
    return this.knowledge.stats();
  }
}
