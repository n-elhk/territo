import { Reflector } from '@nestjs/core';
import type { Plan } from '../../enums/plan.enum';

export const RequiresPlan = Reflector.createDecorator<Plan[]>();
