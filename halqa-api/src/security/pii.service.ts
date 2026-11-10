import { Injectable } from '@nestjs/common';
import { containsPii, screenPii } from '../domain/pii';

@Injectable()
export class PiiService {
  /** Screen free text at a write boundary. Returns the cleaned text + whether PII was found. */
  screen(text: string): { clean: string; hadPii: boolean } {
    const { clean, findings } = screenPii(text);
    return { clean, hadPii: findings.length > 0 };
  }

  hasPii(text: string): boolean {
    return containsPii(text);
  }
}
