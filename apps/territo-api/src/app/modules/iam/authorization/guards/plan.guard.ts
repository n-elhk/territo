import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Plan } from '../../enums/plan.enum';
import type { AuthedRequest } from '../../interfaces/authed-request.interface';
import { RequiresPlan } from '../decorators/requires-plan.decorator';

const PLAN_HIERARCHY: Record<Plan, number> = {
  [Plan.Free]: 0,
  [Plan.Artisan]: 1,
  [Plan.Pro]: 2,
  [Plan.Enterprise]: 3,
};

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredPlans = this.reflector.getAllAndOverride(RequiresPlan, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!requiredPlans || requiredPlans.length === 0) {
      return true;
    }

    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    const userLevel = PLAN_HIERARCHY[user.plan];
    const minRequired = Math.min(...requiredPlans.map((p) => PLAN_HIERARCHY[p]));

    if (userLevel < minRequired) {
      throw new ForbiddenException(
        `Plan insuffisant. Requis : ${requiredPlans.join(' ou ')}.`,
      );
    }

    return true;
  }
}
