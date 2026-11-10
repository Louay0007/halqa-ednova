import { Controller, Get, Param, Post } from '@nestjs/common';
import { CapsuleService } from './capsule.service';

@Controller('sessions')
export class CapsuleController {
  constructor(private readonly capsule: CapsuleService) {}

  @Post(':id/capsule')
  build(@Param('id') id: string): Promise<unknown> {
    return this.capsule.build(id);
  }

  @Get(':id/capsule')
  get(@Param('id') id: string): Promise<unknown> {
    return this.capsule.get(id);
  }
}
