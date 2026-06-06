import { InternalServerErrorException, Logger } from '@nestjs/common';
import type { ZodType } from 'zod';

const logger = new Logger('parseResponse');

/**
 * Valide la réponse contre le schema Zod partagé avant envoi au client.
 * Si le shape ne correspond pas, log l'erreur et remonte un 500 —
 * jamais exposé au client tel quel.
 */
export function parseResponse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    logger.error(
      `Response validation failed: ${JSON.stringify(result.error.issues)}`,
    );
    throw new InternalServerErrorException('Internal response shape error');
  }
  return result.data;
}
