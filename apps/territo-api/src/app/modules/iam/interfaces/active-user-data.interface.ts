import type { Plan } from '../enums/plan.enum';
import type { Role } from '../enums/role.enum';

export interface ActiveUserData {
  sub: string;
  email: string;
  role: Role;
  plan: Plan;
}
