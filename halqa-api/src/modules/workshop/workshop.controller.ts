import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MatcherService } from '../matcher/matcher.service';
import { Circle, CircleDocument } from '../../persistence/schemas/circle.schema';
import { CircleService } from '../circle/circle.service';

class MatchDto {
  @IsArray()
  @IsString({ each: true })
  nicknames!: string[];
  @IsOptional()
  @IsInt()
  seed?: number;
}

/**
 * WorkshopController — POST /circles/match (deterministic matcher) +
 * GET /board (workshop grid: per-circle S-B-U + needs_human).
 */
@Controller()
export class WorkshopController {
  constructor(
    private readonly matcher: MatcherService,
    private readonly circles: CircleService,
    @InjectModel(Circle.name) private readonly circleModel: Model<CircleDocument>,
  ) {}

  @Post('circles/match')
  match(@Body() dto: MatchDto): unknown {
    const learners = dto.nicknames.map((n, i) => ({
      learnerId: `L-${String(i + 1).padStart(2, '0')}`,
      level: ['novice', 'beginner', 'intermediate'][i % 3],
      lang: ['fr', 'darija', 'ar', 'en'][i % 4],
      style: ['visual', 'analogy', 'steps'][i % 3],
    }));
    return this.matcher.match(learners, dto.seed ?? 2026);
  }

  @Get('board')
  async board(@Query('topic') topic?: string): Promise<{ circles: unknown[] }> {
    const filter = topic ? { topic } : {};
    const docs = await this.circleModel.find(filter).sort({ createdAt: -1 }).limit(24).lean().exec();
    const rows = [];
    for (const c of docs) {
      try {
        const h = await this.circles.health(c._id);
        rows.push({ id: c._id, topic: c.topic, ...h });
      } catch {
        rows.push({ id: c._id, topic: c.topic, noSession: true });
      }
    }
    return { circles: rows };
  }
}
