import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorBody, apiError } from '../../common/types/api-error';
import { userMessageFor } from '../../common/user-messages';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiErrorBody;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      const detail =
        typeof r === 'string' ? r : ((r as Record<string, unknown>)['message'] ?? 'Request failed');
      const detailStr = Array.isArray(detail) ? detail.join('; ') : String(detail);
      // Domain errors carry `CODE` or `CODE:detail`; the DTO validator carries a sentence.
      const code = /^[A-Z][A-Z0-9_]*/.test(detailStr) ? detailStr.split(':')[0] : `HTTP_${status}`;
      // Never leak internals: only the sanitised detail string goes out, and the
      // learner-facing text is resolved per language from the code table.
      body = apiError('Request failed', code, status >= 500 || status === 429, userMessageFor(code, status, detailStr));
    } else {
      body = apiError('Internal error', 'INTERNAL', true, userMessageFor('INTERNAL', 500, ''));
    }

    res.status(status).json({ ...body, requestId: req.requestId ?? '-' });
  }
}
