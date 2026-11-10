import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

/** Domain errors with correct HTTP statuses (the global filter shapes them). */
export const Err = {
  bad: (code: string): BadRequestException => new BadRequestException(code),
  missing: (code: string): NotFoundException => new NotFoundException(code),
  denied: (code: string): ForbiddenException => new ForbiddenException(code),
  conflict: (code: string): ConflictException => new ConflictException(code),
};
