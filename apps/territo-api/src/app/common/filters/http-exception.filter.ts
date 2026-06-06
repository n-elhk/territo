import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      this.logger.error(exception);
    }

    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : null;

    const message =
      typeof raw === 'string'
        ? raw
        : typeof raw === 'object' && raw !== null && 'message' in raw
          ? Array.isArray((raw as Record<string, unknown>)['message'])
            ? 'Validation error'
            : String((raw as Record<string, unknown>)['message'])
          : 'Internal server error';

    const errors =
      typeof raw === 'object' &&
      raw !== null &&
      'message' in raw &&
      Array.isArray((raw as Record<string, unknown>)['message'])
        ? ((raw as Record<string, unknown>)['message'] as string[])
        : undefined;

    reply.status(status).send({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...(errors ? { errors } : {}),
    });
  }
}
