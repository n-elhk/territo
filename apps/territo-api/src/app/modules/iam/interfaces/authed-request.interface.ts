import type { FastifyRequest } from 'fastify';
import type { ActiveUserData } from './active-user-data.interface';

export type AuthedRequest = FastifyRequest & {
  user?: ActiveUserData;
};
