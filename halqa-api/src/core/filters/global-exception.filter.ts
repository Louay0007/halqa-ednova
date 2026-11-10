import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorBody, apiError } from '../../common/types/api-error';

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
      // Never leak internals: only the sanitised detail string goes out.
      body = apiError('Request failed', `HTTP_${status}`, status >= 500 || status === 429, {
        en: status >= 500 ? 'Something went wrong. Please try again.' : detailStr,
      });
    } else {
      body = apiError('Internal error', 'INTERNAL', true, {
        en: 'Something went wrong. Please try again.',
      });
    }

    res.status(status).json({ ...body, requestId: req.requestId ?? '-' });
  }
}
