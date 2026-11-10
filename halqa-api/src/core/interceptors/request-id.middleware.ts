import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

export function requestIdMiddleware(req: Request & { requestId?: string }, _res: Response, next: NextFunction): void {
  const header = req.headers['x-request-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  req.requestId = fromHeader ?? randomUUID();
  next();
}
